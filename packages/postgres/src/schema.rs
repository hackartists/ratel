use std::collections::{BTreeMap, HashMap, HashSet};

use crate::Result;
use crate::entity::{ColumnDef, EnumVariantDef, PostgresEntity, RelationDef, RelationKind};
use crate::object::{Ddl, VersionedDdl, VersionedObject};
use sha2::{Digest, Sha256};
use sqlx::Row;

pub const SCHEMA_VERSION_TABLE: &str = "postgres_schema_versions";
/// Every process that shares a database uses the same lock so independently
/// linked schema inventories cannot apply DDL concurrently.
pub const SCHEMA_MIGRATION_LOCK_ID: i64 = 2026070802;
const SCHEMA_VERSION_TABLE_DDL: &str = "CREATE TABLE IF NOT EXISTS postgres_schema_versions (\
    scope text NOT NULL, \
    version bigint NOT NULL CHECK (version >= 0), \
    checksum text NOT NULL, \
    applied_at timestamptz NOT NULL DEFAULT now(), \
    PRIMARY KEY (scope, version)\
)";

#[derive(Debug, Clone, PartialEq, Eq)]
struct ExpectedVersion {
    scope: String,
    version: u64,
    checksum: String,
    statements: Vec<String>,
}

fn version_checksum(scope: &str, version: u64, statements: &[String]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(scope.as_bytes());
    hasher.update([0]);
    hasher.update(version.to_be_bytes());
    for statement in statements {
        hasher.update((statement.len() as u64).to_be_bytes());
        hasher.update(statement.as_bytes());
    }
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn expected_versions(object: &VersionedObject) -> Vec<ExpectedVersion> {
    let mut expected = Vec::with_capacity(object.migrations.len() + 1);
    expected.push(ExpectedVersion {
        scope: object.scope.clone(),
        version: 0,
        checksum: version_checksum(&object.scope, 0, &object.baseline),
        statements: Vec::new(),
    });
    expected.extend(object.migrations.iter().map(|migration| ExpectedVersion {
        scope: object.scope.clone(),
        version: migration.version,
        checksum: version_checksum(&object.scope, migration.version, &migration.statements),
        statements: migration.statements.clone(),
    }));
    expected
}

fn sql_string(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

/// native `PostgresEnum`의 최신 CREATE TYPE과 기존 타입용 label 추가 단계를 만든다.
pub fn build_create_enum(name: &str, variants: &[EnumVariantDef]) -> Ddl {
    let labels = variants
        .iter()
        .map(|variant| sql_string(variant.label))
        .collect::<Vec<_>>()
        .join(", ");
    let baseline_labels = variants
        .iter()
        .filter(|variant| variant.version == 0)
        .map(|variant| sql_string(variant.label))
        .collect::<Vec<_>>()
        .join(", ");

    let create_statement = |labels: &str| {
        format!(
            "DO $$ BEGIN CREATE TYPE \"{name}\" AS ENUM ({labels}); \
             EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
        )
    };

    let mut by_version: BTreeMap<u64, Vec<String>> = BTreeMap::new();
    for variant in variants.iter().filter(|variant| variant.version > 0) {
        by_version.entry(variant.version).or_default().push(format!(
            "ALTER TYPE \"{name}\" ADD VALUE IF NOT EXISTS {}",
            sql_string(variant.label)
        ));
    }

    Ddl {
        create: vec![create_statement(&labels)],
        post_create: vec![],
        drop: vec![format!("DROP TYPE IF EXISTS \"{name}\"")],
        versioned: Some(VersionedObject {
            scope: format!("enum:{name}"),
            baseline: vec![create_statement(&baseline_labels)],
            migrations: by_version
                .into_iter()
                .map(|(version, statements)| VersionedDdl {
                    version,
                    statements,
                })
                .collect(),
        }),
    }
}

/// `CREATE TABLE IF NOT EXISTS "{name}" (…)` + 컬럼별 `CREATE INDEX IF NOT EXISTS` +
/// `DROP TABLE IF EXISTS "{name}" CASCADE`.
///
/// FK 제약(`REFERENCES "{t}"("{c}")` [+ `ON DELETE {…}`])과 관계발 UNIQUE 는 `rels` 의
/// FK-렌더 관계(소유 `OneToOne`/`ManyToOne` + 스칼라 `ForeignKey` — `foreign_key()`
/// 컬럼과 매칭)에서 유도한다. `on_delete` 가 있으면 REFERENCES 뒤에 `ON DELETE {…}` 를
/// 덧붙인다. NULL 여부는 항상 해당 컬럼의 `ColumnDef::nullable` 이 기준이다. REFERENCES 는
/// pk 컬럼에도 붙을 수 있다(`#[postgres(pk, references = …)]`).
///
/// `composite_uniques` 는 struct-level `#[postgres(unique(a, b, …))]` 그룹들(각각 컬럼명
/// 목록)이다 — 그룹마다 `CREATE UNIQUE INDEX IF NOT EXISTS "{name}_{cols_joined}_key"`
/// 를 컬럼별 인덱스와 같은 방식(멱등)으로 방출한다. 컬럼별 인덱스처럼 별도 `DROP INDEX`
/// 는 내지 않는다 — `DROP TABLE … CASCADE` 가 인덱스도 함께 제거하기 때문이다.
pub fn build_create_table(
    name: &str,
    cols: &[ColumnDef],
    rels: &[RelationDef],
    composite_uniques: &[&[&str]],
) -> Ddl {
    // 미래 derive 버그를 시끄럽게 잡기: FK 를 렌더하는 각 관계(소유 pk-side +
    // 스칼라 FK-only)의 FK 컬럼은 선언된 컬럼 중 정확히 하나에 대응해야 한다
    // (없거나 중복이면 REFERENCES 유도가 어긋난다). ForeignKey 엔트리의 foreign_key
    // 는 스칼라 컬럼명 자신이므로 이 검증을 그대로 만족한다.
    for rel in rels {
        if matches!(
            rel.kind,
            RelationKind::OneToOne | RelationKind::ManyToOne | RelationKind::ForeignKey
        ) {
            let fk = (rel.foreign_key)();
            debug_assert_eq!(
                cols.iter().filter(|c| c.name == fk).count(),
                1,
                "FK-rendering relation `{}` FK column `{fk}` must match exactly one column",
                rel.field
            );
        }
    }

    let render_column = |col: &ColumnDef| {
        let sql_type = (col.sql_type)().to_sql();
        let mut line = format!("\"{}\" {}", col.name, sql_type);

        // FK 를 렌더하는 관계(소유 pk-side + 스칼라 FK-only)가 이 컬럼을 참조하는지.
        // REFERENCES 는 pk 컬럼에도 붙을 수 있으므로(`#[postgres(pk, references = …)]`)
        // primary_key 분기 밖에서 렌더한다.
        let fk_rel = rels.iter().find(|r| {
            matches!(
                r.kind,
                RelationKind::OneToOne | RelationKind::ManyToOne | RelationKind::ForeignKey
            ) && (r.foreign_key)() == col.name
        });

        if col.primary_key {
            line.push_str(" PRIMARY KEY");
        } else {
            if !col.nullable {
                line.push_str(" NOT NULL");
            }
            let unique = col.unique || fk_rel.is_some_and(|r| r.unique);
            if unique {
                line.push_str(" UNIQUE");
            }
        }

        if let Some(rel) = fk_rel {
            line.push_str(&format!(
                " REFERENCES \"{}\"(\"{}\")",
                (rel.target_table)(),
                (rel.reference_key)()
            ));
            if let Some(on_delete) = rel.on_delete {
                line.push_str(&format!(" ON DELETE {on_delete}"));
            }
        }

        if col.version > 0 {
            if let Some(default) = (col.default_sql)() {
                line.push_str(" DEFAULT ");
                line.push_str(default);
            }
        }

        line
    };

    let col_lines = cols.iter().map(render_column).collect::<Vec<_>>();
    let baseline_col_lines = cols
        .iter()
        .filter(|column| column.version == 0)
        .map(render_column)
        .collect::<Vec<_>>();

    let mut index_lines = Vec::new();
    let mut baseline_index_lines = Vec::new();
    let mut version_statements: BTreeMap<u64, Vec<String>> = BTreeMap::new();

    for col in cols {
        if col.version > 0 {
            version_statements
                .entry(col.version)
                .or_default()
                .push(format!(
                    "ALTER TABLE \"{name}\" ADD COLUMN IF NOT EXISTS {}",
                    render_column(col)
                ));
        }

        if col.index {
            let index = format!(
                "CREATE INDEX IF NOT EXISTS \"{name}_{}_idx\" ON \"{name}\"(\"{}\")",
                col.name, col.name
            );
            index_lines.push(index.clone());
            if col.index_version == 0 {
                baseline_index_lines.push(index);
            } else {
                version_statements
                    .entry(col.index_version)
                    .or_default()
                    .push(index);
            }
        }
    }

    // struct-level 복합 UNIQUE: 그룹마다 `CREATE UNIQUE INDEX IF NOT EXISTS`.
    // 인덱스명은 `{table}_{cols joined by _}_key`, 컬럼 목록은 쿼팅·콤마 결합.
    for group in composite_uniques {
        let joined = group.join("_");
        let cols_sql = group
            .iter()
            .map(|c| format!("\"{c}\""))
            .collect::<Vec<_>>()
            .join(",");
        index_lines.push(format!(
            "CREATE UNIQUE INDEX IF NOT EXISTS \"{name}_{joined}_key\" ON \"{name}\" ({cols_sql})"
        ));
    }

    let create = vec![format!(
        "CREATE TABLE IF NOT EXISTS \"{name}\" ({})",
        col_lines.join(", ")
    )];

    let mut baseline = vec![format!(
        "CREATE TABLE IF NOT EXISTS \"{name}\" ({})",
        baseline_col_lines.join(", ")
    )];
    baseline.extend(baseline_index_lines);
    baseline.extend(
        index_lines
            .iter()
            .filter(|statement| statement.starts_with("CREATE UNIQUE INDEX"))
            .cloned(),
    );

    let migrations = version_statements
        .into_iter()
        .map(|(version, statements)| VersionedDdl {
            version,
            statements,
        })
        .collect();

    Ddl {
        create,
        post_create: index_lines,
        drop: vec![format!("DROP TABLE IF EXISTS \"{name}\" CASCADE")],
        versioned: Some(VersionedObject {
            scope: name.to_string(),
            baseline,
            migrations,
        }),
    }
}

/// 프로세스 인벤토리에 자동 등록되는 스키마 엔트리 (M7). 모든 `PostgresEntity`
/// 엔티티마다 파생 코드가 `inventory::submit!` 로 하나씩 심는다 —
/// [`Schema::from_inventory`] 가 전부 수집해 FK 위상정렬 후 부트스트랩한다.
///
/// 모든 필드가 `fn` 포인터인 이유: `inventory::submit!` 은 값을 `static` 초기자에 두므로
/// const 컨텍스트여야 한다. 함수 포인터(비캡처 클로저 강제변환)는 const 안전하지만, enum
/// prefix·타깃 테이블명은 런타임 prefix(`POSTGRES_PREFIX`)에 의존하므로 값을 미리 계산할
/// 수 없다 — 지연 평가한다. 위상정렬의 노드 정체성은 `name()`(최종·prefix 적용 테이블명),
/// 간선은 `fk_targets()`(같은 `<Target as PostgresObject>::name()` 을 부르는 relations 의
/// FK-렌더 대상)라 양쪽이 정확히 같은 문자열로 매칭된다.
pub struct SchemaRegistration {
    /// 최종(prefix 적용) 테이블명 — 위상정렬 노드 정체성.
    pub name: fn() -> String,
    /// `<T as PostgresObject>::ddl()` — CREATE TABLE + 인덱스.
    pub table_ddl: fn() -> Ddl,
    /// `<T as PostgresEntity>::enum_dependencies()` — 컬럼 enum CREATE TYPE 류.
    pub enum_dependencies: fn() -> Vec<Ddl>,
    /// `<T as PostgresEntity>::join_table_ddls()` — m2m 조인테이블.
    pub join_table_ddls: fn() -> Vec<Ddl>,
    /// 이 테이블이 FK 로 참조하는 (최종)테이블명들 — 소유 OneToOne/ManyToOne +
    /// 스칼라 ForeignKey. 위상정렬 간선의 소스.
    pub fk_targets: fn() -> Vec<String>,
}

inventory::collect!(SchemaRegistration);

/// 등록된 엔티티 하나의 DDL 묶음 — `T::enum_dependencies()` / `T::ddl()` /
/// `T::join_table_ddls()` 를 등록 시점에 스냅샷한다.
struct SchemaEntry {
    enum_deps: Vec<Ddl>,
    table: Ddl,
    join_tables: Vec<Ddl>,
}

/// 여러 `PostgresEntity` 를 등록해 두고 한 번의 `create()`/`drop()` 호출로 순서대로(그리고
/// 멱등하게) 부트스트랩하는 헬퍼. 등록 순서는 FK 의존 순서를 따라야 한다 — `register::<T>()`
/// 로 넣은 순서가 곧 `create()` 의 테이블 생성 순서(및 `drop()` 의 역순)이기 때문이다.
///
/// 실행 순서(spec): (1) 전 엔트리의 enum dependency — `CREATE TYPE` 문자열로 dedupe(같은
/// enum 을 여러 테이블이 컬럼으로 쓸 수 있다) → (2) 테이블 — 등록순 → (3) 전 엔트리의
/// 조인테이블(m2m) — REFERENCES 대상 테이블이 모두 생긴 뒤; 양쪽 엔티티가 같은
/// 조인테이블을 미러 선언할 수 있어 여기도 dedupe 하지만, 키는 **CREATE 문자열이 아니라
/// drop[0]**(`DROP TABLE IF EXISTS "{table}" CASCADE` — 테이블 이름만 담고 있어 미러
/// 양쪽에서 항상 동일)이다. 미러 선언은 self/target 관점이 바뀌어 조인테이블의 from/to
/// 컬럼 순서가 달라지므로 CREATE 문자열 자체는 서로 다르다 — 그래서 문자열 dedupe로는
/// 같은 테이블임을 잡아내지 못한다(둘 다 `IF NOT EXISTS`라 에러 없이 통과해 마스킹될
/// 뿐, 두 번째 CREATE 는 실제로 다시 실행된다). `drop()` 은 정확히 역순: 조인테이블
/// (drop 텍스트 dedupe — 이쪽은 원래도 테이블 이름만 담겨 있어 문자열 dedupe가 그대로
/// 맞다) → 테이블(역등록순) → enum(문자열 dedupe). enum 은 `create_table`/`drop_table`
/// (Task 6, `PostgresRepository`) 과 달리 다른 테이블이 여전히 참조 중일 수 있으므로 여기
/// 서만 안전하게 한 번에 drop 한다 — 개별 `PostgresRepository::drop_table` 은 enum 을
/// 건드리지 않는다.
#[derive(Default)]
pub struct Schema {
    entries: Vec<SchemaEntry>,
    /// [`from_inventory`](Schema::from_inventory) 의 FK 위상정렬이 사이클을 만나면 여기
    /// 담아 두고, [`create`](Schema::create)/[`create_with_advisory_lock`](Schema::create_with_advisory_lock)
    /// 이 공유하는 [`ordered_create_statements`](Schema::ordered_create_statements) 에서
    /// `Error::Schema` 로 돌려준다 — 명시적인 `register()` 경로(사용자가 순서를 직접
    /// 잡음)에서는 항상 `None`.
    topo_error: Option<String>,
}

impl Schema {
    pub fn new() -> Self {
        Self::default()
    }

    /// 등록된 테이블 엔트리 수 (조인테이블/enum 제외). `from_inventory` 가 실제로 수집한
    /// 엔티티 개수 확인용.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// 등록된 엔트리가 하나도 없으면 `true`.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// 프로세스 인벤토리(모든 `PostgresEntity` 자동 등록)에 모인 전 엔티티를 수집해, FK
    /// 의존 그래프로 **위상정렬**한 `Schema` 를 만든다. `create()` 는 (enum → 테이블(위상순)
    /// → 조인테이블) 순으로 부트스트랩하므로, 참조되는 테이블이 항상 참조하는 테이블보다
    /// 먼저 생성된다 — 서버의 손수 정렬한 `registered_schemas()` 를 자동으로 재현한다.
    ///
    /// 위상정렬 노드 정체성은 각 엔티티의 최종 테이블명(`name()`), 간선은 `fk_targets()`
    /// (relations 의 FK-렌더 대상 `<Target>::name()`)라 둘이 정확히 같은 문자열로 매칭된다.
    /// 인벤토리에 없는 fk_target(외부/비관리 테이블)은 간선을 만들지 않는다. 관리 테이블
    /// 사이에 FK 사이클이 있으면 여기서 panic 하지 않고 에러를 담아 두었다가 `create()` 에서
    /// `Error::Schema` 로 돌려준다 (명시적 `register()` 순서로 만들라는 안내).
    pub fn from_inventory() -> Self {
        let regs: Vec<&'static SchemaRegistration> =
            inventory::iter::<SchemaRegistration>.into_iter().collect();

        let names: Vec<String> = regs.iter().map(|r| (r.name)()).collect();

        // 두 엔티티가 같은 최종 테이블명으로 등록되면(오타, 또는 서로 다른 모듈이 같은
        // `table = "..."` 를 지정) 위상정렬과 create() 가 조용히 한쪽을 덮어써 진짜
        // 문제를 감춘다 — 손수 나열하던 서버의 `registered_schemas()` 레지스트리가 갖던
        // 안전장치를 그대로 재현해 여기서 즉시 크게 알린다. `from_inventory()` 는
        // fallible 하지 않으므로(프로세스 부팅 시 자동 호출) panic 으로 표면화한다.
        {
            let mut seen_names = HashSet::with_capacity(names.len());
            for name in &names {
                if !seen_names.insert(name.as_str()) {
                    panic!("duplicate table registration: {name}");
                }
            }
        }

        let fk_lists: Vec<Vec<String>> = regs.iter().map(|r| (r.fk_targets)()).collect();

        let build_entry = |r: &SchemaRegistration| SchemaEntry {
            enum_deps: (r.enum_dependencies)(),
            table: (r.table_ddl)(),
            join_tables: (r.join_table_ddls)(),
        };

        match topo_sort_tables(&names, &fk_lists) {
            Ok(order) => Schema {
                entries: order.into_iter().map(|i| build_entry(regs[i])).collect(),
                topo_error: None,
            },
            Err(cycle) => Schema {
                // 사이클이어도 구조체는 온전하게(인벤토리 순서) 채워 두고, create() 에서
                // 막는다 — drop() 은 이 순서로도 동작한다(CASCADE).
                entries: regs.iter().map(|r| build_entry(r)).collect(),
                topo_error: Some(format!(
                    "schema has a foreign-key cycle among tables: [{}]; \
                     create them via explicit Schema::register order",
                    cycle.join(", ")
                )),
            },
        }
    }

    /// `T` 를 등록한다. FK 로 참조하는 엔티티는 그 앞에 먼저 등록해야 한다.
    pub fn register<T: PostgresEntity>(mut self) -> Self {
        self.entries.push(SchemaEntry {
            enum_deps: T::enum_dependencies(),
            table: T::ddl(),
            join_tables: T::join_table_ddls(),
        });
        self
    }

    fn versioned_objects(&self) -> Result<Vec<VersionedObject>> {
        if let Some(msg) = &self.topo_error {
            return Err(crate::Error::Schema(msg.clone()));
        }

        let mut objects = Vec::new();
        let mut positions: HashMap<String, usize> = HashMap::new();

        // native enum은 여러 테이블이 공유하므로 scope로 dedupe하고, 테이블보다 먼저 둔다.
        for entry in &self.entries {
            for ddl in &entry.enum_deps {
                let Some(object) = &ddl.versioned else {
                    continue;
                };
                if let Some(position) = positions.get(&object.scope).copied() {
                    if objects[position] != *object {
                        return Err(crate::Error::Schema(format!(
                            "conflicting schema metadata for scope `{}`",
                            object.scope
                        )));
                    }
                    continue;
                }
                positions.insert(object.scope.clone(), objects.len());
                objects.push(object.clone());
            }
        }

        for entry in &self.entries {
            let Some(object) = &entry.table.versioned else {
                continue;
            };
            if positions
                .insert(object.scope.clone(), objects.len())
                .is_some()
            {
                return Err(crate::Error::Schema(format!(
                    "duplicate versioned schema scope `{}`",
                    object.scope
                )));
            }
            objects.push(object.clone());
        }

        for object in &objects {
            let mut seen = HashSet::new();
            for migration in &object.migrations {
                if migration.version == 0 || !seen.insert(migration.version) {
                    return Err(crate::Error::Schema(format!(
                        "scope `{}` has an invalid or duplicate migration version {}",
                        object.scope, migration.version
                    )));
                }
            }
        }

        Ok(objects)
    }

    fn expected_versions(&self) -> Result<Vec<ExpectedVersion>> {
        Ok(self
            .versioned_objects()?
            .iter()
            .flat_map(expected_versions)
            .collect())
    }

    /// 코드가 요구하는 모든 `(scope, version, checksum)` 원장 행을 한 번에 검증한다.
    /// API/worker 시작 경로에서 사용하며 DB schema를 변경하거나 advisory lock을 잡지 않는다.
    pub async fn validate_versions(&self, pool: &sqlx::PgPool) -> Result<()> {
        let ledger_exists: Option<String> = sqlx::query_scalar("SELECT to_regclass($1)::text")
            .bind(SCHEMA_VERSION_TABLE)
            .fetch_one(pool)
            .await?;
        if ledger_exists.is_none() {
            return Err(crate::Error::Schema(format!(
                "schema version ledger `{SCHEMA_VERSION_TABLE}` is missing"
            )));
        }

        let rows = sqlx::query("SELECT scope, version, checksum FROM postgres_schema_versions")
            .fetch_all(pool)
            .await?;
        let mut applied = HashMap::with_capacity(rows.len());
        for row in rows {
            let scope: String = row.try_get("scope")?;
            let version: i64 = row.try_get("version")?;
            let checksum: String = row.try_get("checksum")?;
            if version >= 0 {
                applied.insert((scope, version as u64), checksum);
            }
        }

        for expected in self.expected_versions()? {
            let key = (expected.scope.clone(), expected.version);
            match applied.get(&key) {
                Some(checksum) if checksum == &expected.checksum => {}
                Some(_) => {
                    return Err(crate::Error::Schema(format!(
                        "schema checksum mismatch for `{}` version {}",
                        expected.scope, expected.version
                    )));
                }
                None => {
                    return Err(crate::Error::Schema(format!(
                        "schema `{}` version {} is not applied",
                        expected.scope, expected.version
                    )));
                }
            }
        }
        Ok(())
    }

    /// 기준선 v0를 등록하고 누락된 추가형 migration을 적용한다.
    ///
    /// 현재 존재하는 테이블/enum은 최신 v0라는 호출자 전제를 따른다. 빈 DB에는 최신
    /// CREATE DDL을 바로 실행한다. enum label은 추가된 트랜잭션이 커밋된 뒤에야 사용할 수
    /// 있으므로 각 버전 단계를 별도 advisory-locked 트랜잭션으로 커밋한다.
    pub async fn migrate(&self, pool: &sqlx::PgPool) -> Result<()> {
        self.migrate_with_advisory_lock(pool, SCHEMA_MIGRATION_LOCK_ID)
            .await
    }

    /// [`migrate`](Self::migrate)의 custom-lock 변형. 테스트나 서로 다른 데이터베이스를
    /// 한 프로세스에서 다루는 도구 외에는 공통 lock을 사용하는 `migrate`를 선호한다.
    pub async fn migrate_with_advisory_lock(
        &self,
        pool: &sqlx::PgPool,
        lock_id: i64,
    ) -> Result<()> {
        // 정상적인 재시작은 조회 두 번으로 끝낸다. DDL도 advisory lock도 실행하지 않는다.
        if self.validate_versions(pool).await.is_ok() {
            return Ok(());
        }

        let objects = self.versioned_objects()?;
        let expected: HashMap<(String, u64), ExpectedVersion> = objects
            .iter()
            .flat_map(expected_versions)
            .map(|version| ((version.scope.clone(), version.version), version))
            .collect();

        // 빠른 검증 뒤 다른 프로세스가 먼저 적용했을 수 있으므로 lock 안에서 다시
        // 원장을 확인한다. checksum 오류는 어떤 DDL보다 먼저 실패한다.
        let mut tx = pool.begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock($1)")
            .bind(lock_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query(SCHEMA_VERSION_TABLE_DDL)
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query("SELECT scope, version, checksum FROM postgres_schema_versions")
            .fetch_all(&mut *tx)
            .await?;
        let mut applied = HashSet::new();
        for row in rows {
            let scope: String = row.try_get("scope")?;
            let version: i64 = row.try_get("version")?;
            let checksum: String = row.try_get("checksum")?;
            if version < 0 {
                continue;
            }
            if let Some(expected) = expected.get(&(scope.clone(), version as u64)) {
                if expected.checksum != checksum {
                    return Err(crate::Error::Schema(format!(
                        "schema checksum mismatch for `{scope}` version {version}"
                    )));
                }
                applied.insert((scope, version as u64));
            }
        }

        if expected.keys().all(|key| applied.contains(key)) {
            tx.commit().await?;
            return Ok(());
        }

        // 최신 enum/테이블 본체를 멱등 생성하고 현재 DB를 기준선 v0로 등록한다. 인덱스는
        // 기존 테이블의 버전형 컬럼이 추가되기 전에는 실행하지 않는다.
        for statement in self.ordered_base_create_statements()? {
            sqlx::query(&statement).execute(&mut *tx).await?;
        }

        for object in &objects {
            let baseline = expected
                .get(&(object.scope.clone(), 0))
                .expect("every versioned object has a v0 checksum");
            sqlx::query(
                "INSERT INTO postgres_schema_versions (scope, version, checksum) \
                 VALUES ($1, 0, $2) ON CONFLICT (scope, version) DO NOTHING",
            )
            .bind(&object.scope)
            .bind(&baseline.checksum)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;

        // versioned_objects()가 enum scope를 먼저 반환하므로 enum label 커밋이 모든 테이블
        // 컬럼 migration보다 앞선다.
        for object in &objects {
            for migration in &object.migrations {
                let expected = expected
                    .get(&(object.scope.clone(), migration.version))
                    .expect("migration checksum exists");
                let mut tx = pool.begin().await?;
                sqlx::query("SELECT pg_advisory_xact_lock($1)")
                    .bind(lock_id)
                    .execute(&mut *tx)
                    .await?;

                let applied: Option<String> = sqlx::query_scalar(
                    "SELECT checksum FROM postgres_schema_versions \
                     WHERE scope = $1 AND version = $2",
                )
                .bind(&object.scope)
                .bind(migration.version as i64)
                .fetch_optional(&mut *tx)
                .await?;
                if let Some(checksum) = applied {
                    if checksum != expected.checksum {
                        return Err(crate::Error::Schema(format!(
                            "schema checksum mismatch for `{}` version {}",
                            object.scope, migration.version
                        )));
                    }
                    tx.commit().await?;
                    continue;
                }

                for statement in &migration.statements {
                    sqlx::query(statement).execute(&mut *tx).await?;
                }
                sqlx::query(
                    "INSERT INTO postgres_schema_versions (scope, version, checksum) \
                     VALUES ($1, $2, $3)",
                )
                .bind(&object.scope)
                .bind(migration.version as i64)
                .bind(&expected.checksum)
                .execute(&mut *tx)
                .await?;
                tx.commit().await?;
            }
        }

        // 모든 버전형 컬럼이 존재하는 시점에 일반/unique 인덱스를 마지막으로 만든다.
        let mut tx = pool.begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock($1)")
            .bind(lock_id)
            .execute(&mut *tx)
            .await?;
        for statement in self.ordered_post_create_statements()? {
            sqlx::query(&statement).execute(&mut *tx).await?;
        }
        tx.commit().await?;

        self.validate_versions(pool).await
    }

    /// `create()`/`create_with_advisory_lock()` 가 공유하는, 실행할 정확한 순서의 DDL
    /// 문자열 목록을 만든다 — (1) 전 엔트리의 enum dependency, 전체 `CREATE TYPE`
    /// 문자열로 dedupe(같은 enum 을 여러 테이블이 컬럼으로 쓸 수 있다) → (2) 테이블,
    /// 등록/위상순 → (3) 전 엔트리의 조인테이블(m2m), **drop[0]**(테이블 정체성)으로
    /// dedupe — 미러 선언(양쪽 엔티티가 같은 조인테이블을 반대 관점으로 선언)은 CREATE
    /// 문자열이 서로 달라 문자열 dedupe로는 잡히지 않는다(`RArticle::tags` /
    /// `RTag::articles` 처럼 from/to 컬럼 순서가 바뀌어 두 번째 항목이 첫 항목과 다른
    /// CREATE 문자열을 emit — 아래 `dedup_tests::join_table_dedup_keys_by_drop_text_not_create_text`
    /// 참고).
    ///
    /// `from_inventory()` 가 FK 사이클을 발견했다면(`topo_error`) 아무 문장도 만들지
    /// 않고 여기서 즉시 `Error::Schema` 로 돌려준다 — `create()`(pool 직접)와
    /// `create_with_advisory_lock()`(xact 트랜잭션) 어느 경로를 타든 DB 를 건드리기
    /// 전에 막힌다.
    fn ordered_base_create_statements(&self) -> Result<Vec<String>> {
        if let Some(msg) = &self.topo_error {
            return Err(crate::Error::Schema(msg.clone()));
        }

        let mut stmts = Vec::new();

        let mut seen = HashSet::new();
        for entry in &self.entries {
            for stmt in entry.enum_deps.iter().flat_map(|d| &d.create) {
                if seen.insert(stmt.clone()) {
                    stmts.push(stmt.clone());
                }
            }
        }

        for entry in &self.entries {
            stmts.extend(entry.table.create.iter().cloned());
        }

        let mut seen = HashSet::new();
        for entry in &self.entries {
            for ddl in &entry.join_tables {
                let identity = ddl.drop.first().cloned().unwrap_or_default();
                if seen.insert(identity) {
                    stmts.extend(ddl.create.iter().cloned());
                }
            }
        }

        Ok(stmts)
    }

    fn ordered_post_create_statements(&self) -> Result<Vec<String>> {
        if let Some(msg) = &self.topo_error {
            return Err(crate::Error::Schema(msg.clone()));
        }
        Ok(self
            .entries
            .iter()
            .flat_map(|entry| entry.table.post_create.iter().cloned())
            .collect())
    }

    fn ordered_create_statements(&self) -> Result<Vec<String>> {
        let mut statements = self.ordered_base_create_statements()?;
        // 컬럼을 참조하는 인덱스/unique는 모든 기본 테이블과 조인테이블 뒤에 실행한다.
        statements.extend(self.ordered_post_create_statements()?);
        Ok(statements)
    }

    /// 등록된 전 엔티티를 (enum → 테이블 → 조인테이블) 순으로 생성한다. 순서/dedupe
    /// 규칙은 [`ordered_create_statements`](Self::ordered_create_statements) 참고. 모든
    /// `CREATE` 문이 `IF NOT EXISTS`/`duplicate_object`-흡수 `DO` 블록이라 재호출해도
    /// 에러 없이 통과한다(멱등).
    pub async fn create(&self, pool: &sqlx::PgPool) -> Result<()> {
        for stmt in self.ordered_create_statements()? {
            sqlx::query(&stmt).execute(pool).await?;
        }
        Ok(())
    }

    /// 여러 서버 인스턴스가 동시에 부팅할 때 안전하게 스키마를 한 번만 부트스트랩하도록
    /// PostgreSQL **트랜잭션 스코프 어드바이저리 락**(`pg_advisory_xact_lock`)으로 감싼
    /// `create()` — 복수 프로세스에서 동시에 실행해도 DDL이 한 번씩 직렬화되도록
    /// 한 패턴이다.
    ///
    /// 세션 락(`pg_advisory_lock`/`pg_advisory_unlock`)과 달리 xact 락은 **트랜잭션이
    /// 끝나는 시점(commit/rollback 불문)에 자동 해제**된다 — 명시적 unlock 호출이 없으므로
    /// panic 이나 future 취소(cancellation)로 이 함수 실행이 도중에 끊겨도 트랜잭션이
    /// 롤백되며 락이 남지 않는다(세션 락 + 수동 unlock 조합은 그 사이 panic 하면 unlock 이
    /// 절대 실행되지 않아 락이 새는 것과 대조적). DDL 자체도 Postgres 에서 트랜잭셔널이라
    /// 하나의 tx 안에서 실행해도 안전하다.
    ///
    /// 락 획득과 DDL 실행이 **같은 트랜잭션·같은 커넥션**이므로 풀 커넥션이 1개만
    /// 있어도 동작한다(세션 락 버전이 요구하던 "락 전용 1 + DDL용 1" 제약이 없다).
    pub async fn create_with_advisory_lock(&self, pool: &sqlx::PgPool, lock_id: i64) -> Result<()> {
        let stmts = self.ordered_create_statements()?;

        let mut tx = pool.begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock($1)")
            .bind(lock_id)
            .execute(&mut *tx)
            .await?;

        for stmt in &stmts {
            sqlx::query(stmt).execute(&mut *tx).await?;
        }

        tx.commit().await?;
        Ok(())
    }

    /// `create()` 의 정확한 역순 — 조인테이블(dedupe) → 테이블(역등록순) → enum(dedupe).
    /// 조인테이블의 `drop` 문은 (미러 선언이어도) 테이블 이름만 담고 있어 애초에 양쪽이
    /// 동일한 문자열을 emit 하므로, 여기서는 문자열 dedupe(`exec_dedup`) 그대로가 맞다 —
    /// `create()` 쪽의 CREATE 문자열 dedupe만 미러 선언에서 실패했었다.
    pub async fn drop(&self, pool: &sqlx::PgPool) -> Result<()> {
        let mut seen = HashSet::new();
        for entry in self.entries.iter().rev() {
            exec_dedup(
                pool,
                entry.join_tables.iter().flat_map(|d| &d.drop),
                &mut seen,
            )
            .await?;
        }

        for entry in self.entries.iter().rev() {
            for stmt in &entry.table.drop {
                sqlx::query(stmt).execute(pool).await?;
            }
        }

        let mut seen = HashSet::new();
        for entry in self.entries.iter().rev() {
            exec_dedup(
                pool,
                entry.enum_deps.iter().flat_map(|d| &d.drop),
                &mut seen,
            )
            .await?;
        }

        Ok(())
    }
}

/// `stmts` 를 순서대로 훑으며, `seen` 에 아직 없는 문자열만 실행하고 등록한다 — 여러
/// 엔티티가 **완전히 동일한** DDL 문자열을 emit 하는 경우(`drop()` 쪽 enum dependency,
/// 그리고 조인테이블 drop 문처럼 테이블 이름만 담은 문자열)에 한 번만 실행되도록 한다.
/// `create()` 쪽 enum/조인테이블 dedupe 는 [`Schema::ordered_create_statements`] 가
/// (DB 를 건드리기 전에) 문자열 목록 단계에서 수행한다 — 조인테이블 **create** 문은
/// 미러 선언에서 문자열 자체가 달라지므로 거기서는 `drop[0]`(테이블 정체성)을 키로
/// 쓰고, 여기 `drop()` 쪽은 drop 문 자체가 항상 동일하므로 문자열 dedupe 그대로 맞다.
async fn exec_dedup<'a>(
    pool: &sqlx::PgPool,
    stmts: impl Iterator<Item = &'a String>,
    seen: &mut HashSet<String>,
) -> Result<()> {
    for stmt in stmts {
        if seen.insert(stmt.clone()) {
            sqlx::query(stmt).execute(pool).await?;
        }
    }
    Ok(())
}

/// FK 의존 그래프의 **Kahn 위상정렬**. 각 노드는 최종 테이블명(`names[i]`)으로 식별하고,
/// `fk_targets[i]` 는 노드 i 가 FK 로 참조하는 (최종)테이블명들이다. 참조 대상은 참조하는
/// 테이블보다 **먼저** 생성돼야 하므로 "참조되는 테이블 먼저"(referenced-first) 순서의 노드
/// 인덱스 목록을 돌려준다.
///
/// - 인벤토리에 없는 fk_target(외부/비관리 테이블)은 간선을 만들지 않는다 — 그 이름이
///   `names` 에 없으면 무시한다.
/// - self-FK(자기 자신 참조)는 CREATE TABLE 한 문장 안에서 해소되므로 간선에서 제외한다
///   (아니면 자기 자신이 자기보다 먼저여야 한다는 모순 = 거짓 사이클이 된다).
/// - 같은 대상을 두 컬럼이 참조해도(중복 fk_target) 간선은 한 번만 센다.
/// - 관리 테이블 사이에 진짜 FK 사이클이 있으면 `Err(사이클에 남은 노드명들)`.
fn topo_sort_tables(
    names: &[String],
    fk_targets: &[Vec<String>],
) -> std::result::Result<Vec<usize>, Vec<String>> {
    use std::collections::{HashMap, HashSet};

    let n = names.len();
    let index_of: HashMap<&str, usize> = names
        .iter()
        .enumerate()
        .map(|(i, s)| (s.as_str(), i))
        .collect();

    // indegree[i] = i 가 참조하는 (관리)테이블 수; dependents[t] = t 를 참조하는 노드들.
    let mut indegree = vec![0usize; n];
    let mut dependents: Vec<Vec<usize>> = vec![Vec::new(); n];

    for (i, targets) in fk_targets.iter().enumerate() {
        let mut seen = HashSet::new();
        for t in targets {
            let Some(&j) = index_of.get(t.as_str()) else {
                continue; // 비관리 대상 → 간선 없음
            };
            if j == i {
                continue; // self-FK → 단일 CREATE TABLE 내 해소
            }
            if seen.insert(j) {
                // j(참조 대상) 가 i(참조자) 보다 먼저 → i 는 j 에 의존.
                indegree[i] += 1;
                dependents[j].push(i);
            }
        }
    }

    // Kahn: indegree 0 노드를 인덱스 순으로 시드해 결정적 출력.
    let mut queue: std::collections::VecDeque<usize> =
        (0..n).filter(|&i| indegree[i] == 0).collect();
    let mut order = Vec::with_capacity(n);
    while let Some(i) = queue.pop_front() {
        order.push(i);
        for &d in &dependents[i] {
            indegree[d] -= 1;
            if indegree[d] == 0 {
                queue.push_back(d);
            }
        }
    }

    if order.len() == n {
        Ok(order)
    } else {
        // 아직 indegree>0 인 노드 = 사이클에 걸려 있거나 그 하류.
        let remaining: Vec<String> = (0..n)
            .filter(|&i| indegree[i] > 0)
            .map(|i| names[i].clone())
            .collect();
        Err(remaining)
    }
}

#[cfg(test)]
mod topo_tests {
    use super::topo_sort_tables;

    /// 뒤섞인 등록 순서(child, grandparent, parent)를 참조되는 것 먼저로 정렬한다:
    /// grandparent < parent < child.
    #[test]
    fn orders_referenced_tables_first() {
        let names = vec![
            "child".to_string(),
            "grandparent".to_string(),
            "parent".to_string(),
        ];
        let fk_targets = vec![
            vec!["parent".to_string()],      // child → parent
            vec![],                          // grandparent → (없음)
            vec!["grandparent".to_string()], // parent → grandparent
        ];
        let order = topo_sort_tables(&names, &fk_targets).expect("acyclic");
        let pos = |name: &str| order.iter().position(|&i| names[i] == name).unwrap();
        assert!(
            pos("grandparent") < pos("parent"),
            "grandparent before parent"
        );
        assert!(pos("parent") < pos("child"), "parent before child");
        assert_eq!(order.len(), 3);
    }

    /// 진짜 FK 사이클(a↔b)은 Err — 남은 노드명을 담아 돌려준다.
    #[test]
    fn detects_foreign_key_cycle() {
        let names = vec!["a".to_string(), "b".to_string()];
        let fk_targets = vec![vec!["b".to_string()], vec!["a".to_string()]];
        let err = topo_sort_tables(&names, &fk_targets).expect_err("cycle must be Err");
        assert_eq!(err.len(), 2, "both nodes remain in the cycle");
        assert!(err.contains(&"a".to_string()) && err.contains(&"b".to_string()));
    }

    /// self-FK 와 비관리(인벤토리 밖) 대상은 간선을 만들지 않는다 — 거짓 사이클 없음.
    #[test]
    fn ignores_self_fk_and_unmanaged_targets() {
        let names = vec!["a".to_string()];
        let fk_targets = vec![vec!["a".to_string(), "external_table".to_string()]];
        assert_eq!(
            topo_sort_tables(&names, &fk_targets).expect("no real edges"),
            vec![0]
        );
    }

    /// 한 테이블이 같은 대상을 여러 컬럼으로 참조해도(중복) 간선은 한 번만 세어 정상 정렬.
    #[test]
    fn dedups_multiple_edges_to_same_target() {
        let names = vec!["parent".to_string(), "child".to_string()];
        let fk_targets = vec![
            vec![],
            vec!["parent".to_string(), "parent".to_string()], // child → parent (x2)
        ];
        let order = topo_sort_tables(&names, &fk_targets).expect("acyclic");
        assert_eq!(order, vec![0, 1], "parent(0) before child(1)");
    }
}

#[cfg(test)]
mod dedup_tests {
    use std::collections::HashSet;

    /// dedupe 자체는 DB 없이도 검증 가능 — `exec_dedup` 이 쓰는 것과 동일한
    /// "seen 에 없으면 실행 대상에 넣는다" 로직만 순수하게 떼어내 확인한다.
    /// `create()`/`drop()` 이 이 로직으로 실제 DDL 을 한 번만 실행하는지는
    /// `tests/schema.rs` 의 라이브 왕복(재실행 idempotent)이 증명한다.
    #[test]
    fn dedup_keeps_first_occurrence_only() {
        let stmts = [
            "CREATE TYPE a".to_string(),
            "CREATE TYPE b".to_string(),
            "CREATE TYPE a".to_string(),
        ];
        let mut seen = HashSet::new();
        let to_run: Vec<_> = stmts
            .iter()
            .filter(|s| seen.insert((*s).clone()))
            .cloned()
            .collect();
        assert_eq!(
            to_run,
            vec!["CREATE TYPE a".to_string(), "CREATE TYPE b".to_string()]
        );
    }

    /// 조인테이블 미러 선언 시나리오 — `RArticle::tags` / `RTag::articles`
    /// (`tests/many_to_many.rs`) 처럼 같은 조인테이블을 반대 관점(from/to 컬럼 순서가
    /// 뒤바뀐)으로 emit하는 두 `Ddl` 이, **CREATE 문자열은 서로 다르지만 drop[0] 은
    /// 동일**할 때 `Schema::ordered_create_statements` 가 실제로 쓰는 것과 동일한
    /// "drop[0] 을 seen 에 넣는다" 필터로 정확히 하나의 create 실행으로 collapse
    /// 되는지 검증한다.
    /// 이전의 CREATE-문자열 dedupe 였다면 이 두 Ddl 은 서로 다른 문자열이라 절대
    /// 걸러지지 않았을 것이다(`CREATE TABLE IF NOT EXISTS` 라 에러 없이 통과해
    /// 마스킹되었을 뿐).
    #[test]
    fn join_table_dedup_keys_by_drop_text_not_create_text() {
        use crate::object::Ddl;

        // RArticle 관점: 컬럼 순서 (r3_articles_id, r3_tags_id).
        let from_article_side = Ddl {
            create: vec![
                "CREATE TABLE IF NOT EXISTS \"r3_articles_r3_tags\" (\
                 \"r3_articles_id\" UUID NOT NULL REFERENCES \"r3_articles\"(\"id\") ON DELETE CASCADE, \
                 \"r3_tags_id\" UUID NOT NULL REFERENCES \"r3_tags\"(\"id\") ON DELETE CASCADE, \
                 PRIMARY KEY (\"r3_articles_id\", \"r3_tags_id\"))"
                    .to_string(),
            ],
            post_create: vec![],
            drop: vec!["DROP TABLE IF EXISTS \"r3_articles_r3_tags\" CASCADE".to_string()],
            versioned: None,
        };
        // RTag 관점(미러): 같은 테이블, 컬럼 순서 반대(r3_tags_id, r3_articles_id) →
        // CREATE 문자열은 다르지만 drop 문자열은 항상 같다(테이블 이름만 담음).
        let from_tag_side = Ddl {
            create: vec![
                "CREATE TABLE IF NOT EXISTS \"r3_articles_r3_tags\" (\
                 \"r3_tags_id\" UUID NOT NULL REFERENCES \"r3_tags\"(\"id\") ON DELETE CASCADE, \
                 \"r3_articles_id\" UUID NOT NULL REFERENCES \"r3_articles\"(\"id\") ON DELETE CASCADE, \
                 PRIMARY KEY (\"r3_tags_id\", \"r3_articles_id\"))"
                    .to_string(),
            ],
            post_create: vec![],
            drop: vec!["DROP TABLE IF EXISTS \"r3_articles_r3_tags\" CASCADE".to_string()],
            versioned: None,
        };

        assert_ne!(
            from_article_side.create, from_tag_side.create,
            "mirror declarations must emit different CREATE text (column order swapped) \
             — otherwise this test would not exercise the bug"
        );
        assert_eq!(
            from_article_side.drop, from_tag_side.drop,
            "mirror declarations must emit the identical DROP text (table identity)"
        );

        let ddls = [from_article_side.clone(), from_tag_side];
        let mut seen = HashSet::new();
        let mut to_run: Vec<String> = Vec::new();
        for ddl in &ddls {
            let identity = ddl.drop.first().cloned().unwrap_or_default();
            if seen.insert(identity) {
                to_run.extend(ddl.create.iter().cloned());
            }
        }

        assert_eq!(
            to_run, from_article_side.create,
            "mirror pair must collapse to exactly the first-registered side's CREATE, not both"
        );
    }
}

#[cfg(test)]
mod topo_error_tests {
    use super::Schema;

    /// `from_inventory()` 가 FK 사이클을 발견하면 구조체 자체는 온전히(인벤토리 순서로)
    /// 채워 두고 `topo_error` 에만 메시지를 담아 둔다 — `drop()` 은 사이클이 있어도 그
    /// 순서로 동작해야 하기 때문이다. 이 테스트는 그렇게 만들어진 `Schema` 가
    /// `create()`/`create_with_advisory_lock()` 양쪽이 공유하는
    /// `ordered_create_statements()`에서 `Error::Schema`로 표면화되는지 검증한다 —
    /// 이 함수는 순수 동기 로직이라 실제 PG 커넥션도 런타임도 필요 없이, 사이클을
    /// 수동으로 주입한 `Schema` 만으로 "create 계층에서 사이클이 에러가 된다"를
    /// 직접 증명할 수 있다.
    #[test]
    fn cyclic_topo_error_surfaces_as_schema_error_before_any_db_call() {
        let schema = Schema {
            entries: Vec::new(),
            topo_error: Some(
                "schema has a foreign-key cycle among tables: [a, b]; \
                 create them via explicit Schema::register order"
                    .to_string(),
            ),
        };

        let err = schema
            .ordered_create_statements()
            .expect_err("topo_error must surface as Err before touching the DB");

        match err {
            crate::Error::Schema(msg) => assert!(
                msg.contains("foreign-key cycle"),
                "error message must carry the cycle detail: {msg}"
            ),
            other => panic!("expected Error::Schema, got {other:?}"),
        }
    }
}
