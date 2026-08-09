//! `#[derive(PostgresEntity)]` 파싱 모델 — DeriveInput → 구조화된 컬럼/관계/키 정보.
//!
//! 스칼라 컬럼(Task 9) + 소유 관계(one_to_one / many_to_one, Task 10) + 역방향
//! one_to_many(Task 11) + 다대다 many_to_many(Task 12)를 코드 생성한다.

use convert_case::{Case, Casing};
use quote::format_ident;
use syn::{Data, DeriveInput, Fields, Type};

use crate::attrs::PostgresAttrs;

/// 관계 attribute 플래그 — 이 플래그가 붙은 필드는 스칼라 컬럼이 아니라 관계다.
const RELATION_FLAGS: [&str; 4] = ["one_to_one", "many_to_one", "one_to_many", "many_to_many"];

/// `Vec<T>` 의 inner 타입 `T`. one_to_many 필드는 반드시 `Vec<T>` 컨테이너여야 하므로
/// path 마지막 세그먼트가 `Vec` 인지 문법 레벨에서 확인하고 첫 제네릭 인자를 뽑는다.
fn vec_inner_type(ty: &Type) -> Option<Type> {
    let Type::Path(tp) = ty else {
        return None;
    };
    let seg = tp.path.segments.last()?;
    if seg.ident != "Vec" {
        return None;
    }
    let syn::PathArguments::AngleBracketed(args) = &seg.arguments else {
        return None;
    };
    match args.args.first()? {
        syn::GenericArgument::Type(inner) => Some(inner.clone()),
        _ => None,
    }
}

/// `Vec<T>` 이거나 `Option<Vec<T>>` 인지 (bare-Vec 진단용). 관계 attr 없이 남은 필드가
/// 숨겨진 `Vec` 컬럼 후보인지 잡아내는 데만 쓰인다 — 코드 생성 경로(소유 관계의
/// `<ty as RelationRef>::Target` 등)는 여전히 `Option` 을 텍스트로 파싱하지 않는다.
fn is_vec_or_option_vec(ty: &Type) -> bool {
    if vec_inner_type(ty).is_some() {
        return true;
    }
    let Type::Path(tp) = ty else {
        return false;
    };
    let Some(seg) = tp.path.segments.last() else {
        return false;
    };
    if seg.ident != "Option" {
        return false;
    }
    let syn::PathArguments::AngleBracketed(args) = &seg.arguments else {
        return false;
    };
    match args.args.first() {
        Some(syn::GenericArgument::Type(inner)) => vec_inner_type(inner).is_some(),
        _ => false,
    }
}

/// path 타입의 마지막 세그먼트 ident. self-referential 판정(inner 타입 == struct 이름)용.
fn type_last_ident(ty: &Type) -> Option<&syn::Ident> {
    match ty {
        Type::Path(tp) => tp.path.segments.last().map(|s| &s.ident),
        _ => None,
    }
}

fn is_option_type(ty: &Type) -> bool {
    matches!(
        ty,
        Type::Path(tp) if tp.path.segments.last().is_some_and(|segment| segment.ident == "Option")
    )
}

fn has_automatic_migration_default(ty: &Type) -> bool {
    type_last_ident(ty).is_some_and(|ident| {
        matches!(
            ident.to_string().as_str(),
            "String" | "i16" | "i32" | "i64" | "f32" | "f64" | "bool"
        )
    })
}

/// snake_case 이름의 **마지막 underscore 세그먼트만** 복수화한다: `user`→`users`,
/// `email_verification`→`email_verifications`, `company`→`companies`,
/// `data_room`→`data_rooms`. `table = "…"` override 가 없을 때의 기본 테이블 base 이름
/// 유도에만 쓰인다. `pluralizer::pluralize(word, 2, false)` 는 count≠1 이라 항상 복수형을
/// 돌려준다 (count 접두어 없이).
fn pluralize_last_segment(snake: &str) -> String {
    match snake.rsplit_once('_') {
        Some((head, last)) => format!("{head}_{}", pluralizer::pluralize(last, 2, false)),
        None => pluralizer::pluralize(snake, 2, false),
    }
}

/// 관계 카디널리티 (매크로 내부). 런타임 `#krate::RelationKind` 로 매핑된다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RelationKind {
    OneToOne,
    ManyToOne,
    OneToMany,
    ManyToMany,
}

impl RelationKind {
    /// 이 flag 이름에 대응하는 카디널리티.
    fn from_flag(flag: &str) -> Option<Self> {
        match flag {
            "one_to_one" => Some(Self::OneToOne),
            "many_to_one" => Some(Self::ManyToOne),
            "one_to_many" => Some(Self::OneToMany),
            "many_to_many" => Some(Self::ManyToMany),
            _ => None,
        }
    }

    /// 런타임 `#krate::RelationKind::<variant>` 의 variant ident.
    pub fn variant_ident(self) -> syn::Ident {
        let name = match self {
            Self::OneToOne => "OneToOne",
            Self::ManyToOne => "ManyToOne",
            Self::OneToMany => "OneToMany",
            Self::ManyToMany => "ManyToMany",
        };
        format_ident!("{}", name)
    }
}

/// 한 엔티티(struct) 전체의 파싱 결과.
pub struct EntityModel {
    pub ident: syn::Ident,
    pub vis: syn::Visibility,
    /// prefix 적용 전 base 이름 — `table` attr 또는 struct명 snake_case.
    pub base_name: String,
    /// 생성 코드가 참조할 런타임 crate 경로 — 기본 `::postgres`.
    pub krate: syn::Path,
    /// false면 repository/row 매핑은 생성하되 이 바이너리의 Schema inventory에는
    /// 등록하지 않는다. 다른 서비스 소유 테이블의 read-only mirror용이다.
    pub register_schema: bool,
    pub pk: ColumnModel,
    /// pk 를 제외한 스칼라 컬럼.
    pub scalars: Vec<ColumnModel>,
    /// 관계 필드 (one_to_one / many_to_one / one_to_many / many_to_many).
    pub relations: Vec<RelationModel>,
    /// `#[postgres(skip)]` 필드 — 영속화하지 않고 `Default` 로 채운다.
    pub skipped: Vec<syn::Ident>,
    /// `#[postgres(default_order)]` 가 붙은 필드의 컬럼명 (pk/스칼라 통틀어 최대 하나).
    /// finder 들이 이 컬럼으로 `ORDER BY … DESC` 를 방출한다. 없으면 finder 는 무정렬.
    pub default_order: Option<String>,
    /// struct-level `#[postgres(unique(a, b, …))]` 복합 UNIQUE 그룹들 — 각 그룹은
    /// **컬럼명**의 순서 있는 목록(필드 ident → 그 필드의 컬럼명으로 해소된 값).
    /// `build_create_table` 이 그룹마다 `CREATE UNIQUE INDEX` 를 하나씩 방출한다.
    pub composite_uniques: Vec<Vec<String>>,
}

/// 스칼라 컬럼 하나.
pub struct ColumnModel {
    pub field: syn::Ident,
    pub ty: Type,
    /// column attr 또는 필드명 snake_case.
    pub column: String,
    /// `#[postgres(type = "...")]` — SqlType::Raw 로 감싼다.
    pub sql_type_override: Option<String>,
    pub unique: bool,
    pub index: bool,
    pub version: u64,
    pub index_version: u64,
    pub sql_default: Option<String>,
    /// `#[postgres(references = …)]` / `#[postgres(foreign_key = …)]` — 스칼라 컬럼에
    /// 걸리는 FK 제약. 컬럼 자체는 그대로 스칼라(sql_type/insert/value_of/query/update
    /// 불변)이고, 이 정보는 `relations()` 에 `RelationKind::ForeignKey` 엔트리로만
    /// 반영되어 DDL 에 REFERENCES 를 더한다. pk 와도 공존한다.
    pub fk: Option<ScalarFk>,
    /// `#[postgres(find = "find_by_room")]` — 이 컬럼 == value 인 전 행을 `Page<Self>` 로
    /// 돌려주는 전역 풀 finder 메서드 이름. 전역 풀 편의 메서드는 이제 모든 엔티티에 항상
    /// 생성되므로 별도 struct 플래그가 필요없다. `references` 와 독립적으로 조합된다.
    pub find: Option<String>,
    /// `#[postgres(default_order)]` — finder 들이 `ORDER BY <col> DESC` 로 정렬할 컬럼임을
    /// 표시한다 (newest-first, asset-storage scan_index_forward=false 대응). struct 당
    /// 최대 하나의 필드만 켤 수 있다.
    pub default_order: bool,
}

/// 스칼라 컬럼에 걸리는 FK 제약 (`references` / `foreign_key` attr). 로드되는 관계가
/// 아니라 DDL REFERENCES 제약만 만든다 (asset-storage `#[pg(foreign_key = …)]` 대응).
pub struct ScalarFk {
    /// 참조 대상 테이블 base 이름 (prefix 미적용 — 런타임 `qualified_name` 이 적용).
    pub table: String,
    /// 참조 대상 컬럼명.
    pub column: String,
    /// `ON DELETE {…}` SQL 조각 ("SET NULL", "CASCADE", …). shorthand(sibling key)와
    /// full-form(nested key) 둘 다 지원 — 이미 [`validate_on_delete`] 로 검증/정규화된
    /// (대문자) 값이다.
    pub on_delete: Option<String>,
}

/// `on_delete` 허용값 (case-insensitive 입력 → 이 정규 대문자 표기로 정규화).
const ON_DELETE_ALLOWED: [&str; 5] = [
    "CASCADE",
    "SET NULL",
    "SET DEFAULT",
    "RESTRICT",
    "NO ACTION",
];

/// `on_delete` 값을 allowlist 로 검증하고 정규 대문자 표기로 정규화한다. DDL 에 그대로
/// 보간되는 값이라 매크로 확장 시점에 막지 않으면 오타가 런타임(DB 접속 후) `CREATE
/// TABLE` 실패로만 드러난다.
fn validate_on_delete(field: &syn::Field, raw: &str) -> syn::Result<String> {
    let normalized = raw
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase();
    if ON_DELETE_ALLOWED.contains(&normalized.as_str()) {
        Ok(normalized)
    } else {
        Err(syn::Error::new_spanned(
            field,
            format!("on_delete must be one of: {}", ON_DELETE_ALLOWED.join(", ")),
        ))
    }
}

/// scalar 필드의 `references` / `foreign_key` attr 를 파싱한다. 둘은 동의어이며 두 문법을
/// 받는다:
/// - shorthand 문자열: `references = "data_rooms(id)"` → table=`data_rooms`, column=`id`.
///   sibling `on_delete = "…"` 키를 같이 붙이면(`references = "t(c)", on_delete = "CASCADE"`)
///   그 값도 읽는다.
/// - full form: `references(table = "…", column = "…", on_delete = "…")` — `on_delete` 는
///   nested list 안의 키.
///
/// 관계 필드(`one_to_one`/`many_to_one` 등)의 `foreign_key = "…"`(FK 컬럼명 override)와는
/// 완전히 다른 코드 경로(관계 분기)에서만 쓰이므로 스칼라 분기의 이 파싱과 충돌하지 않는다.
fn parse_scalar_fk(field: &syn::Field, fattrs: &PostgresAttrs) -> syn::Result<Option<ScalarFk>> {
    let references_present =
        fattrs.get("references").is_some() || fattrs.get_list("references").is_some();
    let foreign_key_present =
        fattrs.get("foreign_key").is_some() || fattrs.get_list("foreign_key").is_some();
    if references_present && foreign_key_present {
        return Err(syn::Error::new_spanned(
            field,
            "field has both `references` and `foreign_key`; use one",
        ));
    }

    for name in ["references", "foreign_key"] {
        // shorthand: `name = "table(column)"` (+ optional sibling `on_delete = "…"`)
        if let Some(spec) = fattrs.get(name) {
            let (table, column) = parse_fk_shorthand(spec).ok_or_else(|| {
                syn::Error::new_spanned(
                    field,
                    format!(
                        "`{name}` shorthand must be \"table(column)\", got \"{spec}\" — or use the full form {name}(table = \"…\", column = \"…\", on_delete = \"…\")"
                    ),
                )
            })?;
            let on_delete = fattrs
                .get("on_delete")
                .map(|od| validate_on_delete(field, od))
                .transpose()?;
            return Ok(Some(ScalarFk {
                table,
                column,
                on_delete,
            }));
        }
        // full form: `name(table = "…", column = "…", on_delete = "…")`
        if let Some(list) = fattrs.get_list(name) {
            let table = list.get("table").map(str::to_string).ok_or_else(|| {
                syn::Error::new_spanned(field, format!("`{name}(...)` requires table = \"…\""))
            })?;
            let column = list.get("column").map(str::to_string).ok_or_else(|| {
                syn::Error::new_spanned(field, format!("`{name}(...)` requires column = \"…\""))
            })?;
            let on_delete = list
                .get("on_delete")
                .map(|od| validate_on_delete(field, od))
                .transpose()?;
            return Ok(Some(ScalarFk {
                table,
                column,
                on_delete,
            }));
        }
    }
    Ok(None)
}

/// `"table(column)"` shorthand 파싱 → `(table, column)`. 형식이 어긋나면 `None`.
fn parse_fk_shorthand(spec: &str) -> Option<(String, String)> {
    let spec = spec.trim();
    let open = spec.find('(')?;
    let inner = spec.strip_suffix(')')?;
    let table = spec[..open].trim().to_string();
    let column = inner[open + 1..].trim().to_string();
    if table.is_empty() || column.is_empty() {
        return None;
    }
    Some((table, column))
}

/// 관계 필드 하나 (one_to_one / many_to_one / one_to_many / many_to_many).
///
/// - 소유 측(one_to_one / many_to_one): 선언 타입 `ty` 는 `T` 또는 `Option<T>` 원문이며
///   `vec_child = None`. 매크로는 이를 `<ty as RelationRef>::Target` 으로 target 에
///   도달한다 — `Option` 을 텍스트로 파싱하지 않는다.
/// - 역방향(one_to_many) / 다대다(many_to_many): 선언 타입 `ty` 는 `Vec<Child>` 이고
///   `vec_child = Some(Child)` — Vec 은 `RelationRef` impl 이 없으므로 inner 타입을 직접
///   뽑아 target 으로 쓴다. 부모 테이블엔 컬럼이 생기지 않는다. many_to_many 는 추가로
///   규약 유도(또는 override) 되는 조인테이블/from_key/to_key 를 소비한다.
pub struct RelationModel {
    pub field: syn::Ident,
    pub ty: Type,
    pub kind: RelationKind,
    /// one_to_many / many_to_many 의 `Vec<Child>` inner 타입 `Child`. 소유 관계는 `None`.
    pub vec_child: Option<Type>,
    /// FK 컬럼명 override — 소유 측 기본 `{field}_id`, one_to_many 기본 `{Self base_name}_id`.
    pub foreign_key: Option<String>,
    /// 참조 컬럼 override — 없으면 런타임에 target 의 `primary_key_column()`.
    pub reference_key: Option<String>,
    /// `#[postgres(type = "...")]` — FK 컬럼의 SQL 타입 (custom reference_key 시 필수).
    pub sql_type_override: Option<String>,
    /// many_to_many `join_table = "..."` override — 없으면 정렬된 base_name 결합 유도.
    pub join_table: Option<String>,
    /// many_to_many `from_key = "..."` override — 없으면 `{Self base_name}_id` 유도.
    pub from_key: Option<String>,
    /// many_to_many `to_key = "..."` override — 없으면 `{Target base_name}_id` 유도.
    pub to_key: Option<String>,
}

impl RelationModel {
    /// FK 컬럼명 — `foreign_key` attr 또는 `{field}_id`.
    pub fn fk_column(&self) -> String {
        self.foreign_key
            .clone()
            .unwrap_or_else(|| format!("{}_id", self.field))
    }
    /// FK 컬럼명을 ident 로 (Update FK 세터명 / with 플래그 필드명 계산용).
    pub fn fk_ident(&self) -> syn::Ident {
        format_ident!("{}", self.fk_column())
    }
    /// OneToOne 이면 FK 컬럼에 UNIQUE 를 건다.
    pub fn is_one_to_one(&self) -> bool {
        self.kind == RelationKind::OneToOne
    }
    /// 역방향 관계 — 부모 컬럼/insert/FK 세터 없음, 자식 배치 hydrate 만.
    pub fn is_one_to_many(&self) -> bool {
        self.kind == RelationKind::OneToMany
    }
    /// 다대다 관계 — 부모 컬럼/insert/FK 세터 없음, 조인테이블 + attach/detach + 배치 hydrate.
    pub fn is_many_to_many(&self) -> bool {
        self.kind == RelationKind::ManyToMany
    }
    /// 소유(pk-side) 관계 — FK 컬럼/insert/FK 세터를 만드는 one_to_one / many_to_one.
    pub fn is_owning(&self) -> bool {
        matches!(self.kind, RelationKind::OneToOne | RelationKind::ManyToOne)
    }
    /// `impl {Name}RepositoryExt::attach_{field}` 확장 메서드 ident (many_to_many).
    pub fn attach_ident(&self) -> syn::Ident {
        format_ident!("attach_{}", self.field)
    }
    /// `impl {Name}RepositoryExt::detach_{field}` 확장 메서드 ident (many_to_many).
    pub fn detach_ident(&self) -> syn::Ident {
        format_ident!("detach_{}", self.field)
    }
    /// `{Query}::with_{field}` 메서드/플래그 필드 ident.
    pub fn with_ident(&self) -> syn::Ident {
        format_ident!("with_{}", self.field)
    }
    /// `impl Name::load_{field}` lazy 로더 ident.
    pub fn loader_ident(&self) -> syn::Ident {
        format_ident!("load_{}", self.field)
    }
}

impl EntityModel {
    pub fn from_derive_input(input: &DeriveInput) -> syn::Result<Self> {
        let ident = input.ident.clone();
        let vis = input.vis.clone();

        let struct_attrs = PostgresAttrs::parse(&input.attrs)?;
        if struct_attrs.get_u64("version").is_some() || struct_attrs.get("version").is_some() {
            return Err(syn::Error::new_spanned(
                input,
                "table version is derived from field and index versions; do not set version on the struct",
            ));
        }
        // 기본 테이블명은 struct 이름의 snake_case 에서 **마지막 세그먼트만 복수화**한다
        // (`User`→`users`, `EmailVerification`→`email_verifications`,
        // `Company`→`companies`, `DataRoom`→`data_rooms`). `table = "…"` override 는
        // 그대로(복수화하지 않음). 최종 SQL 식별자는 런타임 `qualified_name` 이 prefix +
        // 정규화를 적용해 만든다.
        let base_name = struct_attrs
            .get("table")
            .map(str::to_string)
            .unwrap_or_else(|| pluralize_last_segment(&ident.to_string().to_case(Case::Snake)));
        let krate: syn::Path = match struct_attrs.get("crate") {
            Some(s) => syn::parse_str(s)?,
            None => syn::parse_str("::postgres").expect("valid default crate path"),
        };
        let register_schema = !struct_attrs.has_flag("skip_schema");
        // 전역 풀 편의 메서드(get_by_id/delete_by_id/upsert/create)는 모든 엔티티에
        // 생성된다. inventory 등록만 `skip_schema`로 끌 수 있다. 예전의
        // `#[postgres(global)]` 게이트는 제거됐다. asset-storage가 쓰던 struct-level
        // 별칭/legacy attr은 **인식만 하고 무시**한다:
        // - `repository` = 옛 `global` 별칭 → 이제 no-op (그 동작이 상시 켜져 있으므로).
        // - `partition = "…"` / `legacy_sk = "…"` = DynamoDB 단일테이블 pk/sk 개념,
        //   postgres 대응 없음.
        // 셋 다 아무 코드도 생성하지 않으며, 마이그레이션 정리 단계에서 제거되어야 한다.
        let _ = (
            struct_attrs.has_flag("repository"),
            struct_attrs.get("partition"),
            struct_attrs.get("legacy_sk"),
        );

        let fields = match &input.data {
            Data::Struct(s) => match &s.fields {
                Fields::Named(n) => &n.named,
                _ => {
                    return Err(syn::Error::new_spanned(
                        input,
                        "PostgresEntity supports named-field structs",
                    ));
                }
            },
            _ => {
                return Err(syn::Error::new_spanned(
                    input,
                    "PostgresEntity supports named-field structs",
                ));
            }
        };

        // (컬럼, pk-flag) 목록 + 관계 + skip 분류.
        let mut columns: Vec<(ColumnModel, bool)> = Vec::new();
        let mut relations: Vec<RelationModel> = Vec::new();
        let mut skipped: Vec<syn::Ident> = Vec::new();

        for f in fields {
            let field = f.ident.clone().expect("named field has ident");
            let fattrs = PostgresAttrs::parse(&f.attrs)?;

            let declared_version = fattrs.get_u64("version");
            if fattrs.get("version").is_some() {
                return Err(syn::Error::new_spanned(
                    f,
                    "postgres version must be an integer literal, for example version = 1",
                ));
            }
            if declared_version == Some(0) {
                return Err(syn::Error::new_spanned(
                    f,
                    "version 0 is the implicit baseline; omit #[postgres(version = 0)]",
                ));
            }

            if fattrs.has_flag("skip") {
                if declared_version.is_some() {
                    return Err(syn::Error::new_spanned(
                        f,
                        "version is not valid on a skipped field",
                    ));
                }
                skipped.push(field);
                continue;
            }
            if let Some(kind) = RELATION_FLAGS
                .iter()
                .find(|fl| fattrs.has_flag(fl))
                .and_then(|fl| RelationKind::from_flag(fl))
            {
                if declared_version.is_some()
                    || fattrs.get("sql_default").is_some()
                    || fattrs.get_u64("sql_default").is_some()
                    || fattrs.has_flag("index")
                    || fattrs.get_list("index").is_some()
                {
                    return Err(syn::Error::new_spanned(
                        f,
                        "versioned relation fields are not supported; add a versioned scalar FK column instead",
                    ));
                }
                // many_to_many: 조인테이블 유도 + attach/detach + 양방향 hydrate.
                if kind == RelationKind::ManyToMany {
                    // 필드 타입은 반드시 `Vec<T>` — inner 를 target 으로 뽑는다.
                    let inner = vec_inner_type(&f.ty).ok_or_else(|| {
                        syn::Error::new_spanned(&f.ty, "many_to_many requires a Vec<T> field")
                    })?;
                    let join_table = fattrs.get("join_table").map(str::to_string);
                    let from_key = fattrs.get("from_key").map(str::to_string);
                    let to_key = fattrs.get("to_key").map(str::to_string);

                    // self-referential(대상 == 자신)은 규약 유도로 from/to 를 구분할 수 없다
                    // (양쪽 컬럼이 같은 base_name 을 낳는다) — 셋 다 명시해야 한다.
                    // `Vec<Self>` 스펠링도 포함: inner 의 마지막 세그먼트가 리터럴 `Self`
                    // 키워드인 경우 struct 이름과 문자열로 일치하지 않으므로 별도 체크.
                    let self_ref = type_last_ident(&inner)
                        .is_some_and(|last| last == &ident || last == "Self");
                    if self_ref && (join_table.is_none() || from_key.is_none() || to_key.is_none())
                    {
                        return Err(syn::Error::new_spanned(
                            f,
                            "self-referential many_to_many requires explicit join_table, from_key, to_key",
                        ));
                    }

                    relations.push(RelationModel {
                        field,
                        ty: f.ty.clone(),
                        kind,
                        vec_child: Some(inner),
                        foreign_key: None,
                        reference_key: None,
                        sql_type_override: None,
                        join_table,
                        from_key,
                        to_key,
                    });
                    continue;
                }
                let reference_key = fattrs.get("reference_key").map(str::to_string);
                let sql_type_override = fattrs.get("type").map(str::to_string);

                let vec_child = if kind == RelationKind::OneToMany {
                    // one_to_many 는 부모에 컬럼을 만들지 않으므로 FK 타입 추론 문제는
                    // 없지만, 자식 FK 컬럼을 부모 pk 타입으로 매칭한다 — custom
                    // reference_key 는 자식 FK 가 부모 pk 타입이 아닐 수 있어 v1 미지원.
                    if reference_key.is_some() {
                        return Err(syn::Error::new_spanned(
                            f,
                            "one_to_many with custom reference_key is not supported yet",
                        ));
                    }
                    // one_to_many 는 부모 테이블에 컬럼을 만들지 않으므로 `type` 은
                    // 바인딩될 곳이 없다 — 조용히 무시하지 않고 컴파일 에러로 막는다.
                    if sql_type_override.is_some() {
                        return Err(syn::Error::new_spanned(
                            f,
                            "type is meaningless on one_to_many; it creates no column",
                        ));
                    }
                    // 필드 타입은 반드시 `Vec<T>` — inner 타입을 target 으로 뽑는다.
                    Some(vec_inner_type(&f.ty).ok_or_else(|| {
                        syn::Error::new_spanned(&f.ty, "one_to_many requires a Vec<T> field")
                    })?)
                } else {
                    // 소유 측 custom reference_key 는 FK 컬럼 타입을 추론할 수 없다 (매크로가
                    // target 타입을 못 보므로) — `type` 을 명시하지 않으면 컴파일 에러.
                    if reference_key.is_some() && sql_type_override.is_none() {
                        return Err(syn::Error::new_spanned(
                            f,
                            "macro cannot infer FK column type for a non-pk reference_key; add type = \"…\"",
                        ));
                    }
                    None
                };

                relations.push(RelationModel {
                    field,
                    ty: f.ty.clone(),
                    kind,
                    vec_child,
                    foreign_key: fattrs.get("foreign_key").map(str::to_string),
                    reference_key,
                    sql_type_override,
                    join_table: None,
                    from_key: None,
                    to_key: None,
                });
                continue;
            }

            // 관계 attr 없이 남은 `Vec<T>` (또는 `Option<Vec<T>>`) 필드는 컬럼이 될 수
            // 없다 — 조용히 스칼라로 떨어뜨리면 `Vec<T>` 에 `PostgresType` 이 없다는
            // 하류 트레잇 에러로 이어져 사용자가 원인을 찾기 어렵다. 여기서 명확하게
            // 막고 두 갈래 해결책을 알려준다: jsonb 저장은 `#[derive(PostgresJson)]`
            // 뉴타입으로 감싸거나, 관계라면 one_to_many/many_to_many attr 을 붙이라고.
            if is_vec_or_option_vec(&f.ty) {
                return Err(syn::Error::new_spanned(
                    &f.ty,
                    format!(
                        "field `{field}`: a bare `Vec<_>`/`Option<Vec<_>>` field is not a column. Wrap the inner type in a #[derive(PostgresJson)] newtype (jsonb), or annotate the field with #[postgres(one_to_many)] / #[postgres(many_to_many)] (relation)."
                    ),
                ));
            }

            let column = fattrs
                .get("column")
                .map(str::to_string)
                .unwrap_or_else(|| field.to_string().to_case(Case::Snake));
            let fk = parse_scalar_fk(f, &fattrs)?;
            let version = declared_version.unwrap_or(0);
            let sql_default = fattrs.get("sql_default").map(str::to_string);
            if fattrs.get_u64("sql_default").is_some() {
                return Err(syn::Error::new_spanned(
                    f,
                    "sql_default must be a string SQL expression",
                ));
            }
            if version == 0 && sql_default.is_some() {
                return Err(syn::Error::new_spanned(
                    f,
                    "sql_default is for versioned fields; baseline v0 keeps the existing table definition",
                ));
            }

            let index_list = fattrs.get_list("index");
            if fattrs.has_flag("index") && index_list.is_some() {
                return Err(syn::Error::new_spanned(
                    f,
                    "use either #[postgres(index)] or #[postgres(index(version = N))], not both",
                ));
            }
            let index = fattrs.has_flag("index") || index_list.is_some();
            let index_version = match index_list {
                Some(attrs) => {
                    if attrs.get("version").is_some() || attrs.get_u64("version").is_none() {
                        return Err(syn::Error::new_spanned(
                            f,
                            "index(version = N) requires a positive integer version",
                        ));
                    }
                    let index_version = attrs.get_u64("version").expect("checked above");
                    if index_version == 0 {
                        return Err(syn::Error::new_spanned(
                            f,
                            "index version 0 is the implicit baseline; use bare #[postgres(index)]",
                        ));
                    }
                    index_version
                }
                None if index => version,
                None => 0,
            };

            if index && index_version < version {
                return Err(syn::Error::new_spanned(
                    f,
                    "index version cannot be lower than the field version",
                ));
            }
            if version > 0 && fattrs.has_flag("unique") {
                return Err(syn::Error::new_spanned(
                    f,
                    "unique constraints on versioned fields require an explicit migration",
                ));
            }
            if version > 0 && fk.is_some() && !is_option_type(&f.ty) {
                return Err(syn::Error::new_spanned(
                    f,
                    "an automatically versioned foreign key must be nullable (Option<T>)",
                ));
            }
            if version > 0
                && !is_option_type(&f.ty)
                && sql_default.is_none()
                && (fattrs.get("type").is_some() || !has_automatic_migration_default(&f.ty))
            {
                return Err(syn::Error::new_spanned(
                    f,
                    "a versioned non-null field needs sql_default; automatic defaults exist only for String, numeric types, and bool without a SQL type override",
                ));
            }
            let col = ColumnModel {
                field,
                ty: f.ty.clone(),
                column,
                sql_type_override: fattrs.get("type").map(str::to_string),
                unique: fattrs.has_flag("unique"),
                index,
                version,
                index_version,
                sql_default,
                fk,
                find: fattrs.get("find").map(str::to_string),
                // asset-storage 는 `default_order` 를 `order` 로 쓴다 — 별칭으로 받아준다.
                default_order: fattrs.has_flag("default_order") || fattrs.has_flag("order"),
            };
            // asset-storage 는 `pk` 를 `primary_key` 로 쓴다 — 별칭으로 받아준다.
            columns.push((col, fattrs.has_flag("pk") || fattrs.has_flag("primary_key")));
        }

        // ── #[postgres(default_order)]: struct 당 최대 하나 ── (pk 포함해 스캔)
        let default_order_cols: Vec<String> = columns
            .iter()
            .filter(|(c, _)| c.default_order)
            .map(|(c, _)| c.column.clone())
            .collect();
        if default_order_cols.len() > 1 {
            return Err(syn::Error::new_spanned(
                input,
                "at most one field may have #[postgres(default_order)]",
            ));
        }
        let default_order = default_order_cols.into_iter().next();

        // ── #[postgres(unique(a, b, …))]: struct-level 복합 UNIQUE ──
        // 각 그룹의 이름은 **필드 ident** 여야 한다 — pk/스칼라(컬럼을 갖는 필드) 중
        // 하나로 해소해 그 컬럼명 목록으로 저장한다. 실존하지 않는 필드(오타/관계 필드)를
        // 가리키면 컴파일 에러로 막는다(런타임 CREATE INDEX 실패 대신).
        let field_to_column: std::collections::HashMap<String, (String, u64)> = columns
            .iter()
            .map(|(c, _)| (c.field.to_string(), (c.column.clone(), c.version)))
            .collect();
        let mut composite_uniques: Vec<Vec<String>> = Vec::new();
        for group in struct_attrs.composite_uniques() {
            if group.is_empty() {
                return Err(syn::Error::new_spanned(
                    input,
                    "#[postgres(unique(...))] needs at least one column",
                ));
            }
            let mut resolved = Vec::with_capacity(group.len());
            for name in group {
                let Some((col, version)) = field_to_column.get(name) else {
                    return Err(syn::Error::new_spanned(
                        input,
                        format!(
                            "#[postgres(unique(...))] references `{name}`, which is not a scalar/pk field of this struct"
                        ),
                    ));
                };
                if *version > 0 {
                    return Err(syn::Error::new_spanned(
                        input,
                        "a composite unique containing a versioned field requires an explicit migration",
                    ));
                }
                resolved.push(col.clone());
            }
            composite_uniques.push(resolved);
        }

        // pk 선택: `#[postgres(pk)]` → 없으면 `id` 필드 → 둘 다 없으면 compile_error.
        let pk_flagged: Vec<usize> = columns
            .iter()
            .enumerate()
            .filter(|(_, (_, is_pk))| *is_pk)
            .map(|(i, _)| i)
            .collect();
        let pk_idx = if pk_flagged.len() > 1 {
            return Err(syn::Error::new_spanned(
                input,
                "PostgresEntity allows only one #[postgres(pk)] field",
            ));
        } else if let Some(&i) = pk_flagged.first() {
            i
        } else {
            match columns.iter().position(|(c, _)| c.field == "id") {
                Some(i) => i,
                None => {
                    return Err(syn::Error::new_spanned(
                        input,
                        "PostgresEntity requires a primary key: add #[postgres(pk)] or an `id` field",
                    ));
                }
            }
        };

        let (pk, _) = columns.remove(pk_idx);
        if pk.version > 0 {
            return Err(syn::Error::new_spanned(
                input,
                "the primary key belongs to baseline v0 and cannot be a versioned field",
            ));
        }
        let scalars: Vec<ColumnModel> = columns.into_iter().map(|(c, _)| c).collect();

        let versions: std::collections::BTreeSet<u64> = std::iter::once(&pk)
            .chain(scalars.iter())
            .flat_map(|column| [column.version, column.index_version])
            .filter(|version| *version > 0)
            .collect();
        if let Some(max_version) = versions.last().copied() {
            for expected in 1..=max_version {
                if !versions.contains(&expected) {
                    return Err(syn::Error::new_spanned(
                        input,
                        format!("schema versions must be contiguous; missing version {expected}"),
                    ));
                }
            }
        }
        if !register_schema && !versions.is_empty() {
            return Err(syn::Error::new_spanned(
                input,
                "a #[postgres(skip_schema)] entity cannot declare schema versions",
            ));
        }

        Ok(EntityModel {
            ident,
            vis,
            base_name,
            krate,
            register_schema,
            pk,
            scalars,
            relations,
            skipped,
            default_order,
            composite_uniques,
        })
    }

    pub fn column_enum_ident(&self) -> syn::Ident {
        format_ident!("{}Column", self.ident)
    }
    pub fn cols_ident(&self) -> syn::Ident {
        format_ident!("{}Cols", self.ident)
    }
    pub fn query_ident(&self) -> syn::Ident {
        format_ident!("{}Query", self.ident)
    }
    pub fn update_ident(&self) -> syn::Ident {
        format_ident!("{}Update", self.ident)
    }
}

impl ColumnModel {
    /// PascalCase 변형 이름 (`{Name}Column` enum 용).
    pub fn variant_ident(&self) -> syn::Ident {
        format_ident!("{}", self.field.to_string().to_case(Case::Pascal))
    }
}
