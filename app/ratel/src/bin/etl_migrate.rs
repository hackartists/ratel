//! Phase 4 ETL — migrates exported production DynamoDB items
//! (`ratel-prod-export/all-items.ndjson`, one `{"Item": {...AttributeValue}}`
//! per line) into the already-migrated Postgres schema (the
//! `PostgresEntity`-derived models under `src/common/models` /
//! `src/features/**/models`).
//!
//! ## Identity mapping
//!
//! DynamoDB rows had no surrogate uuid; Postgres tables do. We synthesize a
//! **deterministic** uuid from the source `pk`/`sk` via UUIDv5 against a fixed
//! namespace (`RATEL_NS`), so re-running this tool is idempotent (`upsert` on
//! the same `id`) and so a child row's cross-feature reference (e.g. a
//! `user_pk` string) always resolves to the *same* id that entity's own row
//! was minted with — no lookup table required.
//!
//! - Entities keyed by `pk` alone (sk is a fixed literal, one row per pk):
//!   `id = uuid_v5(pk)`.
//! - Entities keyed by `pk` + a variable `sk` (many rows per pk):
//!   `id = uuid_v5("{pk}#{sk}")`.
//!
//! ## Field mapping
//!
//! For each item: convert the DynamoDB `AttributeValue` map to a
//! `serde_json::Value` via `serde_dynamo` (the same crate/pattern already used
//! by `common::stream_handler` / `event_bridge_envelope`), strip `pk`/`sk`/
//! `gsi*` (DynamoDB-only projections, not Postgres columns), inject the
//! derived `id` (and any reference columns the Postgres model expects but
//! which only lived inside `pk`/`sk`), then `serde_json::from_value` straight
//! into the migrated struct. Extra/unknown JSON keys are silently ignored by
//! serde (no `deny_unknown_fields` on these models), so passing the full
//! cleaned object through is safe even when the source item carries legacy
//! fields the Postgres model dropped.
//!
//! ## Usage
//!
//! ```text
//! DATABASE_URL=postgres://asset:asset@127.0.0.1:5433/ratel_dev \
//!   cargo run --bin etl_migrate --features server -- [--dry-run] [path/to/all-items.ndjson]
//! ```
//!
//! `--dry-run` parses + maps every item and reports per-entity counts /
//! failures without writing to Postgres. Default (no flag) upserts.

#[cfg(not(feature = "server"))]
fn main() {
    eprintln!("etl_migrate requires --features server");
    std::process::exit(1);
}

#[cfg(feature = "server")]
mod imp {
    use serde_json::{Map, Value, json};
    use std::collections::BTreeMap;
    use uuid::Uuid;

    use app_shell::common::models::auth::{User, UserFollow};
    use app_shell::common::models::did::{AttributeCode, VerifiedAttributes};
    use app_shell::common::models::notification::{
        Notification, UserDeviceToken, UserInboxNotification,
    };
    use app_shell::common::models::reward::{UserReward, UserRewardHistory};
    use app_shell::common::models::space::{SpaceAdmin, SpaceCommon, SpaceParticipant, SpaceStatusChangeEvent};
    use app_shell::features::activity::models::{SpaceActivity, SpaceScore};
    use app_shell::features::auth::models::{
        UserEvmAddress, UserNotification, UserPrincipal, UserReferralCode, UserTeam, UserTeamGroup,
    };
    use app_shell::features::character::models::{CharacterXp, CharacterXpSource};
    use app_shell::features::essence::models::{Essence, UserEssenceStats};
    use app_shell::features::ai_moderator::models::AiModeratorConfig;
    use app_shell::features::cross_posting::models::{
        PostSyndicationDirective, SocialConnection, SyndicationJob,
    };
    use app_shell::features::membership::models::{
        Membership, TeamMembership, UserMembership, UserPurchase,
    };
    use app_shell::features::sub_team::models::{
        SubTeamAnnouncement, SubTeamAnnouncementFanout, SubTeamApplication, SubTeamFormField,
        SubTeamLink,
    };
    use app_shell::features::posts::models::{
        Category, Post, PostComment, PostLike, Team, TeamGroup, TeamOwner,
    };
    use app_shell::features::spaces::SpaceInvitationMember;
    use app_shell::features::spaces::models::SpacePanelParticipant;
    use app_shell::features::spaces::pages::apps::apps::file::models::{FileLink, SpaceFile};
    use app_shell::features::spaces::pages::apps::models::SpaceApp;
    use app_shell::features::spaces::pages::actions::actions::discussion::{
        SpaceCategory, SpacePost, SpacePostComment, SpacePostCommentLike, SpacePostSubscription,
    };
    use app_shell::features::spaces::pages::actions::actions::follow::SpaceFollowAction;
    use app_shell::features::spaces::pages::actions::actions::poll::models::{
        SpacePoll, SpacePollUserAnswer,
    };
    use app_shell::features::spaces::pages::actions::actions::quiz::{
        SpaceQuiz, SpaceQuizAnswer, SpaceQuizAttempt,
    };
    use app_shell::features::spaces::pages::actions::models::SpaceAction;
    use app_shell::features::spaces::pages::apps::apps::analyzes::{
        SpaceAnalyzeDiscussionResult, SpaceAnalyzeReport, SpaceAnalyzeReportResult,
    };
    use app_shell::features::timeline::models::TimelineEntry;
    // NOTE: `SpacePanelParticipant` (features/spaces/models/), `FileLink` and
    // `SpaceApp` (features/spaces/pages/apps/**/models/) are NOT reachable from
    // an external bin crate — their owning `mod models;` declarations are
    // private and not re-exported anywhere. Making them `pub` would be a
    // library-code change, which is out of scope for this additive ETL bin
    // (see module doc). Their sk-prefixes fall through to the generic
    // "unmapped" bucket with that reason noted in the run report.

    /// Fixed namespace for deterministic id derivation. Never change this —
    /// changing it would break idempotency / cross-reference resolution for
    /// any environment that has already been backfilled.
    const RATEL_NS: Uuid = Uuid::from_u128(0x1d2b_3a4c_5e6f_4a1b_9c0d_1e2f_3a4b_5c6d);

    fn key_to_uuid(k: &str) -> Uuid {
        // A Space and its Post/Feed are ONE logical id in the app: `Partition`'s
        // `to_post_key`/`to_space_key` just swap the `SPACE#`/`FEED#` prefix,
        // keeping the id (`get_space` → `to_post_key(SPACE#id)` →
        // `Post::get_by_feed_id(id)`; `create_space` mints the SpaceCommon from
        // the post's id). DynamoDB stored them as `SPACE#<X>` and `FEED#<X>` with
        // the SAME `<X>`, so hashing the full prefixed string would give the
        // space and its post DIFFERENT uuids and break every space-detail lookup
        // ("Post Not Found"). Canonicalize a bare `SPACE#<X>` to `FEED#<X>` before
        // hashing so `space.id == post.id`. Only single-segment keys are
        // canonicalized — composite keys (`SPACE#<X>##USER#<Y>`) are surrogate
        // ids nothing prefix-swaps against, so they hash as-is.
        let canonical = match k.strip_prefix("SPACE#") {
            Some(rest) if !rest.contains('#') => format!("FEED#{rest}"),
            _ => k.to_string(),
        };
        Uuid::new_v5(&RATEL_NS, canonical.as_bytes())
    }

    fn strip1<'a>(s: &'a str, prefix: &str) -> &'a str {
        s.strip_prefix(prefix).unwrap_or(s)
    }

    // ── FK reference-id remapping ─────────────────────────────────────────────
    //
    // Every entity's own Postgres `id` is `key_to_uuid(pk)` — a UUIDv5 of its
    // original DynamoDB pk. But cross-feature reference columns (`user_pk`,
    // `team_pk`, `space_pk`, …) are stored as the Display string form
    // `"PREFIX#<id>"`, and the running app reconstructs them from the referenced
    // entity's id via `Partition::X(entity.id)` → `"PREFIX#" + entity.id`. So a
    // reference must embed the SAME uuid the target row was minted with, not the
    // original DynamoDB id — otherwise "my teams / my invitations / my posts"
    // reverse-lookups (`WHERE user_pk = "USER#" + users.id`) never match the
    // migrated rows. Rewrite each reference `"PREFIX#<orig>"` →
    // `"PREFIX#" + key_to_uuid("PREFIX#<orig>")`. Deterministic ⇒ idempotent.

    /// Field names that hold a single `"PREFIX#<id>"` reference to another
    /// entity (every `*_pk: String` FK column across the migrated models, plus
    /// the lone `pk: String` on user_metadata which is a user reference).
    const FK_REF_FIELDS: &[&str] = &[
        "user_pk",
        "team_pk",
        "space_pk",
        "owner_pk",
        "author_pk",
        "parent_team_pk",
        "target_pk",
        "post_pk",
        "applicant_team_pk",
        "target_user_pk",
        "source_pk",
        "other_user_pk",
        "other_pk",
        "child_team_pk",
        "anchor_post_pk",
        "actor_pk",   // poll answers reference the responding user via actor_pk
        "creator_pk", // fact_fold_subject creator
        "agreed_by",  // sub_team doc agreement — the agreeing user
        "approved_by", // sub_team link — the approving user
        "flip_cite_user_pk",
        "target_post_pk",
        "pk",
    ];

    /// Rewrite a single `"PREFIX#<orig-id>"` reference to embed the target's
    /// migrated uuid. Returns `None` (leave untouched) for anything that isn't a
    /// bare single-segment prefixed reference — composite `PREFIX#a##PREFIX#b`
    /// keys, values with no `#`, or non-uppercase prefixes.
    fn remap_ref_string(s: &str) -> Option<String> {
        let (prefix, rest) = s.split_once('#')?;
        if rest.is_empty() || rest.contains('#') {
            return None; // composite / malformed — not a single entity reference
        }
        if prefix.is_empty()
            || !prefix
                .chars()
                .all(|c| c.is_ascii_uppercase() || c == '_')
        {
            return None;
        }
        Some(format!("{prefix}#{}", key_to_uuid(s)))
    }

    /// Apply `remap_ref_string` to every FK reference column of a finalized
    /// entity object, in place. Called once per row in `finish!`, so it covers
    /// references injected by any `prep_*` path uniformly.
    fn remap_fk_reference_ids(v: &mut Value) {
        if let Value::Object(map) = v {
            for &field in FK_REF_FIELDS {
                if let Some(Value::String(s)) = map.get(field) {
                    if let Some(mapped) = remap_ref_string(s) {
                        map.insert(field.to_string(), Value::String(mapped));
                    }
                }
            }
        }
    }

    /// Bare `*_id` cross-entity reference columns → the referenced entity's
    /// canonical prefix. Unlike `FK_REF_FIELDS` (which hold the full
    /// `"PREFIX#<id>"` string), these hold a BARE id and the running app compares
    /// them against a target entity's uuid `id` (`Partition::User(user.id).0`,
    /// `Partition::Space(space.id).0`, …). The ETL forgot to remap them, so
    /// actions/scores/activity/etc. — which link to their Space via a bare
    /// `space_id` — never resolved. Field→prefix from the 3-tree audit; every
    /// name here references the SAME entity type in every model it appears in.
    /// Context-dependent names (`post_id`, `announcement_id`) are deliberately
    /// EXCLUDED: in every ETL-dispatched entity they are natural keys (KEEP);
    /// the models that would remap them (hot_spaces, syndication, …) aren't
    /// migrated. `remap_id_value` also handles the rare prefixed form
    /// (`mcp_client_secret.user_id` = `"USER#.."`, `backing_post_id` = `"FEED#.."`).
    const ID_REF_FIELDS: &[(&str, &str)] = &[
        ("space_id", "FEED"), // Space canonicalizes to FEED (space.id == post.id)
        ("user_id", "USER"),
        ("author_user_id", "USER"),
        ("submitter_user_id", "USER"),
        ("parent_team_id", "TEAM"),
        ("pending_parent_team_id", "TEAM"),
        ("sub_team_id", "TEAM"),
        ("applicant_team_id", "TEAM"),
        ("child_team_id", "TEAM"),
        ("target_child_team_id", "TEAM"),
        ("announcement_parent_team_id", "TEAM"),
        ("backing_post_id", "FEED"),
    ];

    /// Remap one reference value to the referenced entity's migrated id.
    /// `key_to_uuid` applies the SPACE→FEED canonicalization, so a bare space id
    /// hashed under `FEED#` lands on the exact same uuid as the space's own row.
    fn remap_id_value(value: &str, prefix: &str) -> String {
        if value.is_empty() {
            return value.to_string();
        }
        let pfx = format!("{prefix}#");
        if let Some(rest) = value.strip_prefix(&pfx) {
            // Already prefixed (mcp_client_secret.user_id / backing_post_id):
            // keep the prefix, rewrite the inner id. Skip composites.
            if rest.contains('#') {
                return value.to_string();
            }
            format!("{prefix}#{}", key_to_uuid(value))
        } else if value.contains('#') {
            // Composite or a differently-prefixed value — not a bare id ref.
            value.to_string()
        } else {
            // Bare id → bare canonical uuid of the referenced entity.
            key_to_uuid(&format!("{prefix}#{value}")).to_string()
        }
    }

    fn remap_id_reference_fields(v: &mut Value) {
        if let Value::Object(map) = v {
            for &(field, prefix) in ID_REF_FIELDS {
                if let Some(Value::String(s)) = map.get(field) {
                    let mapped = remap_id_value(s, prefix);
                    if mapped != *s {
                        map.insert(field.to_string(), Value::String(mapped));
                    }
                }
            }
        }
    }

    // ── Reporting ───────────────────────────────────────────────────────────

    #[derive(Default, Clone, Copy)]
    struct EntityStat {
        parse_ok: u64,
        parse_failed: u64,
        db_ok: u64,
        db_failed: u64,
    }

    struct Report {
        stats: BTreeMap<&'static str, EntityStat>,
        /// Unmapped sk-prefixes — genuinely not handled by any dispatch branch.
        skipped: BTreeMap<String, u64>,
        /// Deliberately-not-migrated sk-prefixes, with the reason recorded once.
        /// Kept separate from `skipped` so the summary can tell "we haven't
        /// gotten to this yet" apart from "this should never be migrated".
        intentional_skips: BTreeMap<&'static str, (u64, &'static str)>,
        /// Deduplicated error signatures: `"[entity] PARSE|DB <message>"` ->
        /// (occurrence count, one example `pk=.. sk=..`). Distinct pk/sk values
        /// would otherwise make every failure look unique, burying the actual
        /// handful of root causes.
        error_sigs: BTreeMap<String, (u64, String)>,
        malformed_lines: u64,
    }

    impl Report {
        fn new() -> Self {
            Self {
                stats: BTreeMap::new(),
                skipped: BTreeMap::new(),
                intentional_skips: BTreeMap::new(),
                error_sigs: BTreeMap::new(),
                malformed_lines: 0,
            }
        }

        fn parse_ok(&mut self, name: &'static str) {
            self.stats.entry(name).or_default().parse_ok += 1;
        }

        fn parse_fail(&mut self, name: &'static str, pk: &str, sk: &str, msg: &str) {
            self.stats.entry(name).or_default().parse_failed += 1;
            self.record_error(name, "PARSE", pk, sk, msg);
        }

        fn db_ok(&mut self, name: &'static str) {
            self.stats.entry(name).or_default().db_ok += 1;
        }

        fn db_fail(&mut self, name: &'static str, pk: &str, sk: &str, msg: &str) {
            self.stats.entry(name).or_default().db_failed += 1;
            self.record_error(name, "DB", pk, sk, msg);
        }

        fn record_error(&mut self, name: &str, kind: &str, pk: &str, sk: &str, msg: &str) {
            let sig = format!("[{name}] {kind} {msg}");
            let entry = self
                .error_sigs
                .entry(sig)
                .or_insert_with(|| (0, format!("pk={pk} sk={sk}")));
            entry.0 += 1;
        }

        /// Unmapped sk-prefix — logged and counted, never silently dropped.
        fn skip(&mut self, sk: &str) {
            let bucket = sk.split('#').next().unwrap_or(sk).to_string();
            *self.skipped.entry(bucket).or_insert(0) += 1;
        }

        /// Deliberately-not-migrated sk-prefix (ephemeral / security-sensitive /
        /// retired-feature / no-current-model), with a fixed human-readable
        /// reason recorded on first occurrence.
        fn skip_intentional(&mut self, bucket: &'static str, reason: &'static str) {
            let entry = self.intentional_skips.entry(bucket).or_insert((0, reason));
            entry.0 += 1;
        }

        fn print_summary(&self, dry_run: bool) {
            println!();
            println!("==================== ETL SUMMARY ({}) ====================",
                if dry_run { "DRY RUN" } else { "WRITE" });
            println!(
                "{:<28} {:>10} {:>12} {:>10} {:>10}",
                "entity", "parse_ok", "parse_fail", "db_ok", "db_fail"
            );
            let mut total_parse_ok = 0u64;
            let mut total_parse_failed = 0u64;
            let mut total_db_ok = 0u64;
            let mut total_db_failed = 0u64;
            for (name, s) in &self.stats {
                println!(
                    "{:<28} {:>10} {:>12} {:>10} {:>10}",
                    name, s.parse_ok, s.parse_failed, s.db_ok, s.db_failed
                );
                total_parse_ok += s.parse_ok;
                total_parse_failed += s.parse_failed;
                total_db_ok += s.db_ok;
                total_db_failed += s.db_failed;
            }
            println!(
                "{:<28} {:>10} {:>12} {:>10} {:>10}",
                "TOTAL", total_parse_ok, total_parse_failed, total_db_ok, total_db_failed
            );

            println!();
            println!("---- intentionally skipped (ephemeral / sensitive / retired / no model) ----");
            let mut total_intentional = 0u64;
            for (bucket, (count, reason)) in &self.intentional_skips {
                println!("{bucket:<32} {count:>8}  — {reason}");
                total_intentional += count;
            }
            println!("{:<32} {:>8}", "TOTAL INTENTIONALLY SKIPPED", total_intentional);

            println!();
            println!("---- unmapped (not yet handled — logged, not dropped) ----");
            let mut total_skipped = 0u64;
            for (bucket, count) in &self.skipped {
                println!("{:<28} {:>10}", bucket, count);
                total_skipped += count;
            }
            println!("{:<28} {:>10}", "TOTAL UNMAPPED", total_skipped);

            if self.malformed_lines > 0 {
                println!();
                println!("malformed lines (failed to parse as JSON/Item): {}", self.malformed_lines);
            }

            if !self.error_sigs.is_empty() {
                println!();
                println!(
                    "---- distinct error signatures ({}) — count, example, message ----",
                    self.error_sigs.len()
                );
                let mut rows: Vec<(&String, &(u64, String))> = self.error_sigs.iter().collect();
                rows.sort_by(|a, b| b.1 .0.cmp(&a.1 .0));
                for (sig, (count, example)) in rows {
                    println!("x{count:<6} {example:<70} {sig}");
                }
            }
        }
    }

    // ── DynamoDB AttributeValue JSON -> serde_json::Value ─────────────────────

    fn item_to_obj(item: Value) -> Result<Map<String, Value>, String> {
        let attrs: std::collections::HashMap<String, serde_dynamo::AttributeValue> =
            serde_json::from_value(item).map_err(|e| format!("attribute-value parse: {e}"))?;
        let val: Value =
            serde_dynamo::from_item(attrs).map_err(|e| format!("serde_dynamo::from_item: {e}"))?;
        match val {
            Value::Object(m) => Ok(m),
            other => Err(format!("item is not a JSON object: {other:?}")),
        }
    }

    /// Strip `pk`/`sk`/`gsi*` — DynamoDB-only keys, never Postgres columns.
    fn clean(mut obj: Map<String, Value>) -> Map<String, Value> {
        obj.remove("pk");
        obj.remove("sk");
        obj.retain(|k, _| !k.starts_with("gsi"));
        obj
    }

    /// `CamelCase` -> `UPPER_SNAKE_CASE`, used as a fallback for tagged-enum
    /// variant names this ETL doesn't explicitly know (see
    /// [`tagged_partition_to_string`]).
    fn camel_to_upper_snake(s: &str) -> String {
        let mut out = String::new();
        for (i, c) in s.chars().enumerate() {
            if c.is_uppercase() && i != 0 {
                out.push('_');
            }
            out.extend(c.to_uppercase());
        }
        out
    }

    /// Some legacy rows stored `Partition`/`AuthorPartition` reference columns
    /// (`user_pk`, `author_pk`, ...) using serde's default internally-tagged
    /// enum representation (`{"User": "<id>"}`) instead of the
    /// `SerializeDisplay` string form (`"USER#<id>"`) every migrated Postgres
    /// model expects. Converts the former into the latter; a plain string
    /// value (the common case) passes through unchanged.
    fn tagged_partition_to_string(v: &Value) -> Option<String> {
        if let Value::String(s) = v {
            return Some(s.clone());
        }
        if let Value::Object(m) = v {
            if m.len() == 1 {
                if let Some((k, val)) = m.iter().next() {
                    if let Some(id) = val.as_str() {
                        let prefix = match k.as_str() {
                            "User" => "USER".to_string(),
                            "Team" => "TEAM".to_string(),
                            "Space" => "SPACE".to_string(),
                            "Feed" => "FEED".to_string(),
                            "SpacePost" => "SPACE_POST".to_string(),
                            "SpacePostLike" => "SPACE_POST_LIKE".to_string(),
                            other => camel_to_upper_snake(other),
                        };
                        return Some(format!("{prefix}#{id}"));
                    }
                }
            }
        }
        None
    }

    /// Applies [`tagged_partition_to_string`] to every `*_pk` (and bare `pk`,
    /// though that one is always removed by [`clean`] before this runs) field
    /// still present after cleaning. Cheap and a no-op for the common case
    /// (already-a-string), so it's safe to call unconditionally for every
    /// entity rather than threading it through each `prep_*` function.
    fn normalize_partition_like_fields(obj: &mut Map<String, Value>) {
        let keys: Vec<String> = obj
            .iter()
            .filter(|(k, v)| (k.ends_with("_pk") || k.as_str() == "pk") && v.is_object())
            .map(|(k, _)| k.clone())
            .collect();
        for k in keys {
            if let Some(v) = obj.get(&k) {
                if let Some(s) = tagged_partition_to_string(v) {
                    obj.insert(k, Value::String(s));
                }
            }
        }
    }

    /// Backfills a missing `updated_at`/`created_at` sibling from whichever of
    /// the pair is present (some legacy rows only ever wrote one of the two);
    /// defaults both to 0 if neither exists. No-op when both are already
    /// present, so safe to call unconditionally.
    fn backfill_timestamps(obj: &mut Map<String, Value>) {
        let created = obj.get("created_at").and_then(|v| v.as_i64());
        let updated = obj.get("updated_at").and_then(|v| v.as_i64());
        match (created, updated) {
            (Some(c), None) => {
                obj.insert("updated_at".to_string(), json!(c));
            }
            (None, Some(u)) => {
                obj.insert("created_at".to_string(), json!(u));
            }
            (None, None) => {
                obj.entry("created_at".to_string()).or_insert(json!(0));
                obj.entry("updated_at".to_string()).or_insert(json!(0));
            }
            (Some(_), Some(_)) => {}
        }
    }

    /// Prefers `canonical` over `alias` when a struct field carries
    /// `#[serde(alias = "...")]` — passing both through unchanged makes serde
    /// report "duplicate field" (see conventions: DynamoEntity updater ALL_NEW
    /// + serde alias dup). If only `alias` is present, promotes it to
    /// `canonical`.
    fn resolve_alias_prefer_canonical(obj: &mut Map<String, Value>, canonical: &str, alias: &str) {
        if obj.contains_key(canonical) {
            obj.remove(alias);
        } else if let Some(v) = obj.remove(alias) {
            obj.insert(canonical.to_string(), v);
        }
    }

    /// `Post.categories` (`Vec<String>` jsonb) has `#[serde(alias = "category")]`
    /// for the pre-migration singular field, which some legacy rows stored as a
    /// bare string (not a one-element array). Normalizes either shape into a
    /// proper `categories` array and drops `category` so the alias never
    /// collides with the canonical key.
    fn resolve_categories(obj: &mut Map<String, Value>) {
        if obj.contains_key("categories") {
            obj.remove("category");
            return;
        }
        if let Some(v) = obj.remove("category") {
            let arr = match v {
                Value::Array(a) => Value::Array(a),
                Value::String(s) if s.is_empty() => Value::Array(vec![]),
                Value::String(s) => Value::Array(vec![Value::String(s)]),
                Value::Null => Value::Array(vec![]),
                other => Value::Array(vec![other]),
            };
            obj.insert("categories".to_string(), arr);
        }
    }

    // ── Per-entity field derivation (pk/sk -> missing columns) ────────────────
    // Each `prep_*` takes the cleaned object plus the ORIGINAL (unstripped)
    // pk/sk strings and returns the JSON value ready for
    // `serde_json::from_value::<Model>`.

    fn prep_own(pk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        Value::Object(obj)
    }

    /// TEAM: legacy rows predate several columns added later
    /// (`points`, `allow_invite`, sub-team fields, ...) and have no `#[serde(default)]`
    /// on the Rust side (the struct stays wire-identical to the live app, which
    /// always writes every field). Backfills the same defaults `Team::new()`
    /// uses.
    fn prep_team(pk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        for (k, default) in [
            ("points", json!(0)),
            ("followers", json!(0)),
            ("followings", json!(0)),
            ("allow_invite", json!(false)),
            ("allow_create_space", json!(false)),
            ("is_parent_eligible", json!(false)),
            ("min_sub_team_members", json!(0)),
            ("min_sub_team_age_days", json!(0)),
            ("description", json!("")),
            ("dao_address", Value::Null),
            ("thumbnail_url", Value::Null),
            ("parent_team_id", Value::Null),
            ("pending_parent_team_id", Value::Null),
        ] {
            obj.entry(k.to_string()).or_insert(default);
        }
        Value::Object(obj)
    }

    /// POST: dedupes the `body`/`html_contents` and `categories`/`category`
    /// serde aliases (both appearing together is a "duplicate field" error;
    /// `category` as a bare string instead of a one-element array is a type
    /// error) before falling through to the generic own-row `id` derivation.
    fn prep_post(pk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        resolve_alias_prefer_canonical(&mut obj, "body", "html_contents");
        resolve_categories(&mut obj);
        Value::Object(obj)
    }

    fn prep_own_with_user_pk(pk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("user_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    fn prep_space_common(pk: &str, obj: Map<String, Value>) -> Value {
        let mut obj = obj;
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("space_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    fn prep_space_post(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let space_id = strip1(pk, "SPACE#");
        let post_id = strip1(sk, "SPACE_POST#");
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        obj.entry("post_id".to_string()).or_insert(json!(post_id));
        Value::Object(obj)
    }

    fn prep_space_poll(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let space_id = strip1(pk, "SPACE#");
        let poll_id = strip1(sk, "SPACE_POLL#");
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        obj.entry("poll_id".to_string()).or_insert(json!(poll_id));
        Value::Object(obj)
    }

    fn prep_poll_user_answer(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "SPACE_POLL_USER_ANSWER#USER#<uid>"
        // sk = "SPACE_POLL_USER_ANSWER#SPACE#<space>#SPACE_POLL#<poll>"
        let actor_pk = strip1(pk, "SPACE_POLL_USER_ANSWER#");
        let rest = strip1(sk, "SPACE_POLL_USER_ANSWER#"); // "SPACE#<space>#SPACE_POLL#<poll>"
        // ALWAYS derive space_id + poll_id from the sk — some source rows (e.g.
        // the "사전 설문조사" answers) omit the `space_id` attribute entirely, which
        // left them with a NULL space_id and made the space-scoped completion
        // lookup (`WHERE space_id = …`) miss them.
        let (space_id, poll_id) = match strip1(rest, "SPACE#").split_once("#SPACE_POLL#") {
            Some((s, p)) => (s.to_string(), p.to_string()),
            None => (
                String::new(),
                rest.rsplit('#').next().unwrap_or("").to_string(),
            ),
        };
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.insert("actor_pk".into(), json!(actor_pk));
        if !space_id.is_empty() {
            obj.insert("space_id".into(), json!(space_id)); // bare → remapped to FEED by finish!
        }
        obj.insert("poll_id".into(), json!(poll_id));
        Value::Object(obj)
    }

    fn prep_quiz_attempt(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // sk = "SPACE_QUIZ_ATTEMPT#<quiz_id>#<attempt_id>"
        let rest = strip1(sk, "SPACE_QUIZ_ATTEMPT#");
        let mut parts = rest.splitn(2, '#');
        let quiz_id = parts.next().unwrap_or("").to_string();
        let attempt_id = parts.next().unwrap_or("").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("quiz_id".to_string()).or_insert(json!(quiz_id));
        obj.entry("attempt_id".to_string())
            .or_insert(json!(attempt_id));
        // `quiz_user` = "USER#<uid>#<quiz_id>" — a composite the app rebuilds from
        // the CURRENT user id (find_latest_by_quiz_user), so the embedded user_pk
        // must be remapped (composite → not covered by the field-level auto-remap).
        if let Some(Value::String(qu)) = obj.get("quiz_user") {
            if let Some(rest) = qu.strip_prefix("USER#") {
                if let Some((uid, quiz)) = rest.split_once('#') {
                    let mapped = key_to_uuid(&format!("USER#{uid}"));
                    obj.insert("quiz_user".into(), json!(format!("USER#{mapped}#{quiz}")));
                }
            }
        }
        Value::Object(obj)
    }

    fn derive_space_id_from_space_pk(obj: &mut Map<String, Value>) {
        if !obj.contains_key("space_id") {
            if let Some(space_pk) = obj.get("space_pk").and_then(|v| v.as_str()) {
                let space_id = strip1(space_pk, "SPACE#").to_string();
                obj.insert("space_id".into(), json!(space_id));
            }
        }
    }

    fn prep_comment(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // top-level comment: pk = "SPACE_POST#<post_id>", sk = "SPACE_POST_COMMENT#<comment_id>"
        let post_id = strip1(pk, "SPACE_POST#");
        let comment_id = strip1(sk, "SPACE_POST_COMMENT#");
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("post_id".to_string()).or_insert(json!(post_id));
        obj.entry("comment_id".to_string())
            .or_insert(json!(comment_id));
        obj.entry("parent_comment_id".to_string())
            .or_insert(json!(""));
        derive_space_id_from_space_pk(&mut obj);
        Value::Object(obj)
    }

    fn prep_comment_reply(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "SPACE_POST#<post_id>", sk = "SPACE_POST_COMMENT_REPLY#<parent>#<reply>"
        let post_id = strip1(pk, "SPACE_POST#");
        let rest = strip1(sk, "SPACE_POST_COMMENT_REPLY#");
        let mut parts = rest.splitn(2, '#');
        let parent = parts.next().unwrap_or("").to_string();
        let reply = parts.next().unwrap_or("").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("post_id".to_string()).or_insert(json!(post_id));
        obj.entry("comment_id".to_string()).or_insert(json!(reply));
        obj.entry("parent_comment_id".to_string())
            .or_insert(json!(parent));
        derive_space_id_from_space_pk(&mut obj);
        Value::Object(obj)
    }

    fn prep_comment_like(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "SPACE_POST_LIKE#<post_id>", sk = "SPACE_POST_COMMENT_LIKE#<user_id>#<comment_key...>"
        let post_id = strip1(pk, "SPACE_POST_LIKE#");
        let rest = strip1(sk, "SPACE_POST_COMMENT_LIKE#");
        let mut parts = rest.splitn(2, '#');
        let user_part = parts.next().unwrap_or("").to_string();
        let comment_key = parts.next().unwrap_or("").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("post_id".to_string()).or_insert(json!(post_id));
        obj.entry("comment_key".to_string())
            .or_insert(json!(comment_key));
        obj.entry("user_pk".to_string())
            .or_insert(json!(format!("USER#{user_part}")));
        Value::Object(obj)
    }

    fn prep_participant(pk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "SPACE#<space>##USER#<user>", sk = "SPACE_PARTICIPANT"
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("kind".to_string()).or_insert(json!("PARTICIPANT"));
        // A handful of very old rows predate one of these columns (or, for
        // `space_pk`, never carried it as its own attribute at all — only pk
        // encoded it).
        obj.entry("space_pk".to_string())
            .or_insert_with(|| json!(pk.split("##").next().unwrap_or(pk)));
        obj.entry("display_name".to_string()).or_insert(json!(""));
        obj.entry("username".to_string()).or_insert(json!(""));
        obj.entry("profile_url".to_string()).or_insert(json!(""));
        obj.entry("user_type".to_string()).or_insert(json!(4)); // AnonymousSpaceUser
        obj.entry("created_at".to_string()).or_insert(json!(0));
        Value::Object(obj)
    }

    fn rename_author_pk(obj: &mut Map<String, Value>) {
        if !obj.contains_key("author_pk") {
            if let Some(v) = obj.get("user_pk").cloned() {
                obj.insert("author_pk".into(), v);
            }
        }
    }

    fn prep_activity(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "<space_id>##USER#<user>" / "<space_id>##TEAM#<team>" (bare space id)
        // sk = "SPACE_ACTIVITY#<dedup>#<timestamp>"
        let space_id = pk.split("##").next().unwrap_or("").to_string();
        let rest = strip1(sk, "SPACE_ACTIVITY#");
        let dedup_key = match rest.rsplit_once('#') {
            Some((d, _ts)) => d.to_string(),
            None => rest.to_string(),
        };
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        obj.entry("dedup_key".to_string())
            .or_insert(json!(dedup_key));
        rename_author_pk(&mut obj);
        Value::Object(obj)
    }

    fn prep_score(pk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "<space_id>##USER#<user>", sk = "SPACE_SCORE"
        let space_id = pk.split("##").next().unwrap_or("").to_string();
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        rename_author_pk(&mut obj);
        Value::Object(obj)
    }

    fn prep_user_reward(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "USER#<id>##REWARD" or "TEAM#<id>##REWARD"
        // sk = "SPACE_REWARD##<space>##<action>##<behavior>" (== RewardKey Display form)
        let target_pk = pk.strip_suffix("##REWARD").unwrap_or(pk).to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.insert("target_pk".into(), json!(target_pk));
        obj.insert("reward_key".into(), json!(sk));
        // Legacy rows sometimes lack the running aggregate counters entirely
        // (only the per-claim ledger fields were written); a fresh zero
        // aggregate is the correct starting point — nothing was ever summed
        // into a `UserReward` row for these before.
        obj.entry("total_claims".to_string()).or_insert(json!(0));
        obj.entry("total_points".to_string()).or_insert(json!(0));
        Value::Object(obj)
    }

    /// Replace the space-id segment of a `/spaces/<id>/…` URL with the space's
    /// migrated (canonical) id. Discussion/comment/post ids in the rest of the
    /// path are natural keys (kept raw at migration), so they already match.
    fn remap_space_in_url(url: &str) -> Option<String> {
        let idx = url.find("/spaces/")?;
        let after = &url[idx + "/spaces/".len()..];
        let end = after.find('/').unwrap_or(after.len());
        let raw = &after[..end];
        if raw.is_empty() {
            return None;
        }
        let canonical = key_to_uuid(&format!("FEED#{raw}")).to_string();
        Some(format!(
            "{}/spaces/{}{}",
            &url[..idx],
            canonical,
            &after[end..]
        ))
    }

    /// Remap the space references embedded in an inbox notification's `payload`
    /// jsonb. The in-space inbox filter queries `payload->>'space_id'` and the
    /// deep-link `cta_url` both carry the space id, which the running app now
    /// expresses as the canonical (post-migration) id — so a raw id here makes
    /// the in-space bell show nothing and clicking the notification 404.
    fn remap_inbox_payload(obj: &mut Map<String, Value>) {
        if let Some(Value::Object(p)) = obj.get_mut("payload") {
            if let Some(Value::String(s)) = p.get("space_id") {
                if !s.is_empty() {
                    let mapped = key_to_uuid(&format!("FEED#{s}")).to_string();
                    p.insert("space_id".into(), json!(mapped));
                }
            }
            if let Some(Value::String(url)) = p.get("cta_url") {
                if let Some(new_url) = remap_space_in_url(url) {
                    p.insert("cta_url".into(), json!(new_url));
                }
            }
        }
    }

    fn prep_inbox(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "USER#<id>", sk = "USER_INBOX_NOTIFICATION#<uuid>"
        let user_id = strip1(pk, "USER#").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("user_id".to_string()).or_insert(json!(user_id));
        remap_inbox_payload(&mut obj);
        Value::Object(obj)
    }

    fn prep_user_team(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "USER#<id>", sk = "USER_TEAM#TEAM#<team>"
        let team_pk = strip1(sk, "USER_TEAM#").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("user_pk".to_string()).or_insert(json!(pk));
        obj.entry("team_pk".to_string()).or_insert(json!(team_pk));
        Value::Object(obj)
    }

    fn prep_user_team_group(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "USER#<id>", sk = "USER_TEAM_GROUP#TEAM_GROUP#<n>"
        let team_group_sk = strip1(sk, "USER_TEAM_GROUP#").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("user_pk".to_string()).or_insert(json!(pk));
        obj.entry("team_group_sk".to_string())
            .or_insert(json!(team_group_sk));
        Value::Object(obj)
    }

    fn prep_char_xp_source(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "USER#<id>", sk = "CHARACTER_XP_SOURCE#<space_id>"
        let space_id = strip1(sk, "CHARACTER_XP_SOURCE#").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("user_pk".to_string()).or_insert(json!(pk));
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        Value::Object(obj)
    }

    /// FOLLOWER / FOLLOWING edges → `UserFollow`. DynamoDB stored two rows per
    /// relationship (pk=owner, sk="FOLLOWER#<other>" or "FOLLOWING#<other>").
    /// Natural key (owner_pk, relation, other_pk) == (pk, sk), so
    /// `id = key_to_uuid("{pk}#{sk}")`. owner_pk/other_pk/user_pk/target_user_pk
    /// are raw Partition strings → remapped by `finish!` (FK_REF_FIELDS).
    fn prep_user_follow(
        pk: &str,
        sk: &str,
        relation: &str,
        prefix: &str,
        mut obj: Map<String, Value>,
    ) -> Value {
        let other_pk = strip1(sk, prefix).to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("owner_pk".to_string()).or_insert(json!(pk));
        obj.insert("relation".into(), json!(relation));
        obj.entry("other_pk".to_string()).or_insert(json!(other_pk));
        Value::Object(obj)
    }

    /// SPACE_ACTION_FOLLOW → `SpaceFollowAction`. pk="SPACE#<space>",
    /// sk="SPACE_ACTION_FOLLOW#<uuid>". Surrogate id + space_id (bare, remapped
    /// to FEED) + follow_id (natural key, kept). id = key_to_uuid("{pk}#{sk}").
    fn prep_space_follow_action(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let space_id = strip1(pk, "SPACE#");
        let follow_id = strip1(sk, "SPACE_ACTION_FOLLOW#");
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        obj.entry("follow_id".to_string()).or_insert(json!(follow_id));
        Value::Object(obj)
    }

    /// SPACE_POST_SUBSCRIPTION → `SpacePostSubscription`. pk="SPACE_POST#<post>",
    /// sk="SPACE_POST_SUBSCRIPTION#USER#<uid>". id = key_to_uuid("{pk}#{sk}");
    /// post_id (bare, natural key, kept), space_id derived from `space_pk`.
    fn prep_space_post_subscription(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let post_id = strip1(pk, "SPACE_POST#");
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("post_id".to_string()).or_insert(json!(post_id));
        derive_space_id_from_space_pk(&mut obj);
        Value::Object(obj)
    }

    /// SPACE_REWARD## per-event ledger → `UserRewardHistory`. Shares the summary's
    /// pk ("{target}##REWARD") and "SPACE_REWARD##" sk prefix, but the sk is
    /// "<reward_key>###<time_key>". Natural key (target_pk, reward_key, time_key)
    /// == (pk, sk) → id = key_to_uuid("{pk}#{sk}"). reward_key/time_key are opaque
    /// (not references). target_pk → remapped by finish! (FK_REF_FIELDS).
    fn prep_user_reward_history(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let target_pk = pk.strip_suffix("##REWARD").unwrap_or(pk).to_string();
        let (reward_key, time_key) = match sk.split_once("###") {
            Some((rk, tk)) => (rk.to_string(), tk.to_string()),
            None => (sk.to_string(), String::new()),
        };
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.insert("target_pk".into(), json!(target_pk));
        obj.insert("reward_key".into(), json!(reward_key));
        obj.insert("time_key".into(), json!(time_key));
        Value::Object(obj)
    }

    // ── Sub-team ──────────────────────────────────────────────────────────
    fn prep_sub_team_announcement(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk="TEAM#<parent>", sk="SUB_TEAM_ANNOUNCEMENT#<id>". App looks it up by
        // announcement_id.parse::<Uuid>() → id MUST equal that uuid.
        let ann_id = strip1(sk, "SUB_TEAM_ANNOUNCEMENT#");
        let id = Uuid::parse_str(ann_id).unwrap_or_else(|_| key_to_uuid(&format!("{pk}#{sk}")));
        obj.insert("id".into(), json!(id.to_string()));
        obj.entry("team_pk".to_string()).or_insert(json!(pk));
        obj.entry("announcement_id".to_string()).or_insert(json!(ann_id));
        Value::Object(obj)
    }

    fn prep_sub_team_announcement_fanout(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let ann_id = strip1(sk, "SUB_TEAM_ANNOUNCEMENT_FANOUT#");
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("child_team_pk".to_string()).or_insert(json!(pk));
        obj.entry("announcement_id".to_string()).or_insert(json!(ann_id));
        Value::Object(obj)
    }

    fn prep_sub_team_application(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // App parses application_id → get(uuid); id MUST equal that uuid.
        let app_id = strip1(sk, "SUB_TEAM_APPLICATION#");
        let id = Uuid::parse_str(app_id).unwrap_or_else(|_| key_to_uuid(&format!("{pk}#{sk}")));
        obj.insert("id".into(), json!(id.to_string()));
        obj.entry("parent_team_pk".to_string()).or_insert(json!(pk));
        obj.entry("application_id".to_string()).or_insert(json!(app_id));
        Value::Object(obj)
    }

    fn prep_sub_team_form_field(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let field_id = strip1(sk, "SUB_TEAM_FORM_FIELD#");
        let id = Uuid::parse_str(field_id).unwrap_or_else(|_| key_to_uuid(&format!("{pk}#{sk}")));
        obj.insert("id".into(), json!(id.to_string()));
        obj.entry("team_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    fn prep_sub_team_link(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let child_id = strip1(sk, "SUB_TEAM_LINK#");
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("parent_team_pk".to_string()).or_insert(json!(pk));
        obj.entry("child_team_id".to_string()).or_insert(json!(child_id));
        // `approved_by` ("USER#<id>") is not in FK_REF_FIELDS → remap here.
        if let Some(Value::String(s)) = obj.get("approved_by") {
            if let Some(mapped) = remap_ref_string(s) {
                obj.insert("approved_by".into(), Value::String(mapped));
            }
        }
        Value::Object(obj)
    }

    // ── Cross-posting ─────────────────────────────────────────────────────
    fn prep_social_connection(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let user_id = strip1(pk, "USER#");
        let platform = strip1(sk, "SOCIAL_CONNECTION#");
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("user_id".to_string()).or_insert(json!(user_id));
        obj.entry("platform".to_string()).or_insert(json!(platform));
        if !obj.contains_key("platform_status") {
            let status = obj
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("connected");
            obj.insert("platform_status".into(), json!(format!("{platform}#{status}")));
        }
        obj.entry("external_handle".to_string()).or_insert(json!(""));
        Value::Object(obj)
    }

    fn prep_syndication_directive(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        // post_id excluded from auto-remap → set explicitly to the migrated Post uuid.
        obj.insert("post_id".into(), json!(key_to_uuid(pk).to_string()));
        // author_user_id must be BARE to match SocialConnection.user_id.
        if let Some(Value::String(s)) = obj.get("author_user_id") {
            obj.insert("author_user_id".into(), json!(strip1(s, "USER#").to_string()));
        }
        Value::Object(obj)
    }

    fn prep_syndication_job(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let platform = strip1(sk, "SYNDICATION_JOB#");
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.insert("post_id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("platform".to_string()).or_insert(json!(platform));
        if let Some(Value::String(s)) = obj.get("author_user_id") {
            obj.insert("author_user_id".into(), json!(strip1(s, "USER#").to_string()));
        }
        obj.entry("dispatch_shard".to_string()).or_insert(Value::Null);
        obj.entry("engagement_shard".to_string()).or_insert(Value::Null);
        Value::Object(obj)
    }

    // ── Membership ────────────────────────────────────────────────────────
    fn prep_user_purchase(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let purchase_uuid = strip1(sk, "USER_PURCHASE#");
        let id =
            Uuid::parse_str(purchase_uuid).unwrap_or_else(|_| key_to_uuid(&format!("{pk}#{sk}")));
        obj.insert("id".into(), json!(id.to_string()));
        let user_pk = pk.strip_suffix("##PURCHASE").unwrap_or(pk);
        obj.entry("user_pk".to_string()).or_insert(json!(user_pk));
        // PurchaseStatus expects PascalCase; prod stores SCREAMING.
        if let Some(Value::String(s)) = obj.get("status") {
            let norm = match s.to_ascii_uppercase().as_str() {
                "SUCCESS" => "Success",
                "SCHEDULED" => "Scheduled",
                "CANCELED" | "CANCELLED" => "Canceled",
                _ => "Success",
            };
            obj.insert("status".into(), json!(norm));
        }
        Value::Object(obj)
    }

    // ── AI moderator ──────────────────────────────────────────────────────
    fn prep_ai_moderator_config(pk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "<space_id>##<discussion_id>" (both bare), sk = "AI_MODERATOR_CONFIG".
        let mut parts = pk.splitn(2, "##");
        let space_id = parts.next().unwrap_or("").to_string();
        let discussion_id = parts.next().unwrap_or("").to_string();
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        obj.entry("discussion_id".to_string())
            .or_insert(json!(discussion_id));
        Value::Object(obj)
    }

    // ── Space apps / files / panels ───────────────────────────────────────
    /// SPACE_APP: pk="SPACE#<space>", sk="SPACE_APP#<AppType>". One installed-app
    /// row per (space, app_type). `app_type` (e.g. "Analyzes") is already in obj.
    fn prep_space_app(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    /// SPACE_FILE: pk="SPACE#<space>", sk="SPACE_FILE" (singleton). `files`
    /// (Vec<File>) already in obj; space_pk = pk (remapped by finish!).
    fn prep_space_file(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    /// FILE_LINK: pk="SPACE#<space>", sk="FILE_LINK#<uuid>". file_url/link_target
    /// already in obj; space_pk = pk (remapped by finish!).
    fn prep_file_link(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    /// SPACE_PANEL_PARTICIPANT: pk="SPACE#<space>",
    /// sk="SPACE_PANEL_PARTICIPANT#USER#<uid>". unique(space_id, user_pk).
    /// space_id (bare, →FEED via finish!), user_pk already in obj (→remapped).
    fn prep_space_panel_participant(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let space_id = strip1(pk, "SPACE#");
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        Value::Object(obj)
    }

    /// POST_COMMENT → `PostComment` (feed-post comment). pk="FEED#<post>",
    /// sk="POST_COMMENT#<uuid>". id = the comment uuid; post_id = migrated Post
    /// uuid (key_to_uuid(pk)). author_pk (USER#..) remapped by finish!.
    fn prep_post_comment(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let comment_uuid = strip1(sk, "POST_COMMENT#");
        let id = Uuid::parse_str(comment_uuid).unwrap_or_else(|_| key_to_uuid(&format!("{pk}#{sk}")));
        obj.insert("id".into(), json!(id.to_string()));
        obj.insert("post_id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("images".to_string()).or_insert(json!([]));
        Value::Object(obj)
    }

    fn prep_timeline(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "TIMELINE#<user_id>", sk = "TIMELINE_ENTRY#<created_at>#<post_id>"
        let user_id = strip1(pk, "TIMELINE#").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("user_id".to_string()).or_insert(json!(user_id));
        if let Some(post_pk) = obj.get("post_pk").and_then(|v| v.as_str()).map(str::to_string) {
            let post_id = strip1(&post_pk, "FEED#").to_string();
            obj.entry("post_id".to_string()).or_insert(json!(post_id));
        }
        if let Some(author_pk) = obj
            .get("author_pk")
            .and_then(|v| v.as_str())
            .map(str::to_string)
        {
            if let Some(team_id) = author_pk.strip_prefix("TEAM#") {
                obj.entry("author_id".to_string())
                    .or_insert(json!(team_id));
                obj.entry("author_is_team".to_string())
                    .or_insert(json!(true));
            } else if let Some(user_id2) = author_pk.strip_prefix("USER#") {
                obj.entry("author_id".to_string())
                    .or_insert(json!(user_id2));
                obj.entry("author_is_team".to_string())
                    .or_insert(json!(false));
            }
        }
        Value::Object(obj)
    }

    // ── Additional entity mappers (coverage expansion, job B) ─────────────────

    fn prep_essence(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = owner partition string ("TEAM#.."/"USER#.."), sk = "ESSENCE#<encoded source id>"
        let source_id = strip1(sk, "ESSENCE#").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("owner_pk".to_string()).or_insert(json!(pk));
        obj.entry("source_id".to_string()).or_insert(json!(source_id));
        Value::Object(obj)
    }

    fn prep_user_essence_stats(pk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("owner_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    fn prep_verified_attributes(pk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "USER#<id>##ATTRIBUTES"
        let user_pk = pk.strip_suffix("##ATTRIBUTES").unwrap_or(pk).to_string();
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("user_pk".to_string()).or_insert(json!(user_pk));
        Value::Object(obj)
    }

    fn prep_attribute_code(pk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "ATTRIBUTE_CODE#<code>", sk = "ATTRIBUTE_CODE"
        let code = strip1(pk, "ATTRIBUTE_CODE#").to_string();
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("code".to_string()).or_insert(json!(code));
        obj.entry("created_at".to_string()).or_insert(json!(0));
        Value::Object(obj)
    }

    fn prep_invitation_member(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "SPACE#<id>", sk = "SPACE_INVITATION_MEMBER#USER#<uid>"
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    fn prep_user_membership(pk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("user_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    fn prep_team_membership(pk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("team_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    fn prep_team_owner(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "TEAM#<id>", sk = "TEAM_OWNER" — `team_id` must equal the Team
        // row's own derived id (`key_to_uuid(pk)`) for the cross-reference to
        // resolve; the row's own `id` is hashed with `sk` appended so it
        // doesn't collide with the Team row's id in a different table.
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.insert("team_id".into(), json!(key_to_uuid(pk).to_string()));
        Value::Object(obj)
    }

    fn prep_team_group(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "TEAM#<id>", sk = "TEAM_GROUP#<group_uuid>" — the doc comment on
        // `TeamGroup` says its surrogate id IS the former group id, so reuse it
        // verbatim when it parses as a uuid.
        let group_id_str = strip1(sk, "TEAM_GROUP#");
        let id =
            Uuid::parse_str(group_id_str).unwrap_or_else(|_| key_to_uuid(&format!("{pk}#{sk}")));
        obj.insert("id".into(), json!(id.to_string()));
        obj.insert("team_id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("members".to_string()).or_insert(json!(0));
        obj.entry("permissions".to_string()).or_insert(json!(0));
        obj.entry("description".to_string()).or_insert(json!(""));
        obj.entry("created_at".to_string()).or_insert(json!(0));
        Value::Object(obj)
    }

    fn prep_post_like(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "POST_LIKE#<feed_uuid>", sk = "POST_LIKE#USER#<uid>" — `post_id`
        // must equal the Post row's own derived id (`key_to_uuid("FEED#<uuid>")`).
        let feed_uuid = strip1(pk, "POST_LIKE#");
        let post_id = key_to_uuid(&format!("FEED#{feed_uuid}")).to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.insert("post_id".into(), json!(post_id));
        Value::Object(obj)
    }

    fn prep_status_change_event(pk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = sk = "SPACE_STATUS_CHANGE_EVENT#<uuid>" — reuse the original
        // uuid as `id` when it parses (it always should).
        let event_uuid = strip1(pk, "SPACE_STATUS_CHANGE_EVENT#");
        let id = Uuid::parse_str(event_uuid).unwrap_or_else(|_| key_to_uuid(pk));
        obj.insert("id".into(), json!(id.to_string()));
        obj.entry("created_at".to_string()).or_insert(json!(0));
        Value::Object(obj)
    }

    fn prep_analyze_discussion_result(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        obj.entry("space_pk".to_string()).or_insert(json!(pk));
        let id = obj
            .get("request_id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
            .unwrap_or_else(|| key_to_uuid(&format!("{pk}#{sk}")));
        obj.insert("id".into(), json!(id.to_string()));
        Value::Object(obj)
    }

    fn prep_space_category(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let space_id = strip1(pk, "SPACE#").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        obj.entry("created_at".to_string()).or_insert(json!(0));
        Value::Object(obj)
    }

    fn prep_space_admin(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_pk".to_string()).or_insert(json!(pk));
        obj.entry("created_at".to_string()).or_insert(json!(0));
        Value::Object(obj)
    }

    fn prep_category(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "CATEGORY" (fixed), sk = "CATEGORY#<id>"
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("created_at".to_string()).or_insert(json!(0));
        Value::Object(obj)
    }

    fn prep_user_device_token(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let user_id = strip1(pk, "USER#").to_string();
        let device_id = strip1(sk, "USER_DEVICE_TOKEN#").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("user_id".to_string()).or_insert(json!(user_id));
        obj.entry("device_id".to_string()).or_insert(json!(device_id));
        Value::Object(obj)
    }

    fn prep_user_notification(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let device_id = strip1(sk, "USER_NOTIFICATION#").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("user_pk".to_string()).or_insert(json!(pk));
        obj.entry("device_id".to_string()).or_insert(json!(device_id));
        Value::Object(obj)
    }

    fn prep_space_action(pk: &str, mut obj: Map<String, Value>) -> Value {
        // pk = "<space_id>##<action_id>" (both bare), sk = "SPACE_ACTION" (fixed)
        let mut parts = pk.splitn(2, "##");
        let space_id = parts.next().unwrap_or("").to_string();
        let action_id = parts.next().unwrap_or("").to_string();
        obj.insert("id".into(), json!(key_to_uuid(pk).to_string()));
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        obj.entry("action_id".to_string()).or_insert(json!(action_id));
        Value::Object(obj)
    }

    fn prep_analyze_report(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        // sk = "SPACE_ANALYZE_REPORT#<uuid>" — the doc comment says the
        // surrogate id IS that original report uuid.
        let uuid_str = strip1(sk, "SPACE_ANALYZE_REPORT#");
        let id = Uuid::parse_str(uuid_str).unwrap_or_else(|_| key_to_uuid(&format!("{pk}#{sk}")));
        obj.insert("id".into(), json!(id.to_string()));
        obj.entry("space_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    fn prep_analyze_report_result(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_pk".to_string()).or_insert(json!(pk));
        Value::Object(obj)
    }

    fn prep_space_quiz(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let space_id = strip1(pk, "SPACE#").to_string();
        let quiz_id = strip1(sk, "SPACE_QUIZ#").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        obj.entry("quiz_id".to_string()).or_insert(json!(quiz_id));
        Value::Object(obj)
    }

    fn prep_space_quiz_answer(pk: &str, sk: &str, mut obj: Map<String, Value>) -> Value {
        let space_id = strip1(pk, "SPACE#").to_string();
        let quiz_id = strip1(sk, "SPACE_QUIZ_ANSWER#").to_string();
        obj.insert(
            "id".into(),
            json!(key_to_uuid(&format!("{pk}#{sk}")).to_string()),
        );
        obj.entry("space_id".to_string()).or_insert(json!(space_id));
        obj.entry("quiz_id".to_string()).or_insert(json!(quiz_id));
        Value::Object(obj)
    }

    // ── Dispatch ────────────────────────────────────────────────────────────

    /// Entities inserted in the first pass — natural "parents" of the rest.
    /// (No FK constraints exist on these tables yet, so this is a courtesy
    /// ordering rather than a correctness requirement — see
    /// conventions/anti-patterns.md; every cross-feature reference column in
    /// this migration wave is a plain indexed string, not a `REFERENCES`.)
    fn is_parent_sk(sk: &str) -> bool {
        sk == "USER" || sk == "TEAM" || sk == "SPACE_COMMON" || sk == "POST" || sk.starts_with("SPACE_POST#")
    }

    macro_rules! finish {
        ($report:expr, $name:expr, $dry_run:expr, $pk:expr, $sk:expr, $Model:ty, $val:expr) => {{
            let mut __val = $val;
            // Remap every "PREFIX#<orig-id>" reference to the target's migrated
            // uuid so the app's reverse-lookups (WHERE user_pk = "USER#"+id) hit.
            remap_fk_reference_ids(&mut __val);
            // Same for bare `*_id` reference columns (space_id/user_id/*_team_id).
            remap_id_reference_fields(&mut __val);
            match serde_json::from_value::<$Model>(__val) {
                Ok(row) => {
                    $report.parse_ok($name);
                    if !$dry_run {
                        match <$Model>::repository().upsert(&row).await {
                            Ok(_) => $report.db_ok($name),
                            Err(e) => $report.db_fail($name, $pk, $sk, &e.to_string()),
                        }
                    }
                }
                Err(e) => $report.parse_fail($name, $pk, $sk, &e.to_string()),
            }
        }};
    }

    async fn dispatch_one(report: &mut Report, dry_run: bool, pk: &str, sk: &str, raw: Map<String, Value>) {
        let mut obj = clean(raw);
        // Generic legacy-data repair, applied unconditionally before any
        // entity-specific derivation: some rows serialized `*_pk` reference
        // columns as a tagged-enum map instead of the Display string form, and
        // some rows are missing one half of the created_at/updated_at pair.
        normalize_partition_like_fields(&mut obj);
        backfill_timestamps(&mut obj);

        if sk == "USER" {
            let val = prep_own(pk, obj);
            finish!(report, "USER", dry_run, pk, sk, User, val);
        } else if sk == "TEAM" {
            let val = prep_team(pk, obj);
            finish!(report, "TEAM", dry_run, pk, sk, Team, val);
        } else if sk == "SPACE_COMMON" {
            let val = prep_space_common(pk, obj);
            finish!(report, "SPACE_COMMON", dry_run, pk, sk, SpaceCommon, val);
        } else if sk == "POST" {
            let val = prep_post(pk, obj);
            finish!(report, "POST", dry_run, pk, sk, Post, val);
        } else if sk.starts_with("SPACE_POST#") {
            let val = prep_space_post(pk, sk, obj);
            finish!(report, "SPACE_POST", dry_run, pk, sk, SpacePost, val);
        } else if sk == "SPACE_POLL_QUESTION" {
            report.skip_intentional(
                "SPACE_POLL_QUESTION",
                "no standalone Postgres model — SpacePoll already embeds `questions` directly on \
                 its own row; this sk is a legacy duplicate of that embedded field (merging it in \
                 would risk overwriting the live SpacePoll row's other columns with defaults)",
            );
        } else if sk.starts_with("SPACE_POLL_USER_ANSWER#") {
            let val = prep_poll_user_answer(pk, sk, obj);
            finish!(
                report,
                "SPACE_POLL_USER_ANSWER",
                dry_run,
                pk,
                sk,
                SpacePollUserAnswer,
                val
            );
        } else if sk.starts_with("SPACE_POLL#") {
            let val = prep_space_poll(pk, sk, obj);
            finish!(report, "SPACE_POLL", dry_run, pk, sk, SpacePoll, val);
        } else if sk.starts_with("SPACE_QUIZ_ATTEMPT#") {
            let val = prep_quiz_attempt(pk, sk, obj);
            finish!(
                report,
                "SPACE_QUIZ_ATTEMPT",
                dry_run,
                pk,
                sk,
                SpaceQuizAttempt,
                val
            );
        } else if sk.starts_with("SPACE_POST_COMMENT_LIKE#") {
            let val = prep_comment_like(pk, sk, obj);
            finish!(
                report,
                "SPACE_POST_COMMENT_LIKE",
                dry_run,
                pk,
                sk,
                SpacePostCommentLike,
                val
            );
        } else if sk.starts_with("SPACE_POST_COMMENT_REPLY#") {
            let val = prep_comment_reply(pk, sk, obj);
            finish!(
                report,
                "SPACE_POST_COMMENT_REPLY",
                dry_run,
                pk,
                sk,
                SpacePostComment,
                val
            );
        } else if sk.starts_with("SPACE_POST_COMMENT#") {
            let val = prep_comment(pk, sk, obj);
            finish!(
                report,
                "SPACE_POST_COMMENT",
                dry_run,
                pk,
                sk,
                SpacePostComment,
                val
            );
        } else if sk == "SPACE_PARTICIPANT" {
            let val = prep_participant(pk, obj);
            finish!(
                report,
                "SPACE_PARTICIPANT",
                dry_run,
                pk,
                sk,
                SpaceParticipant,
                val
            );
        } else if sk.starts_with("SPACE_ACTIVITY#") {
            let val = prep_activity(pk, sk, obj);
            finish!(report, "SPACE_ACTIVITY", dry_run, pk, sk, SpaceActivity, val);
        } else if sk == "SPACE_SCORE" {
            let val = prep_score(pk, obj);
            finish!(report, "SPACE_SCORE", dry_run, pk, sk, SpaceScore, val);
        } else if sk.starts_with("SPACE_REWARD##") && sk.contains("###") {
            // Per-transaction ledger row ("<reward_key>###<time_key>") →
            // `UserRewardHistory`. MUST precede the summary branch below, which
            // matches the same "SPACE_REWARD##" prefix WITHOUT the "###"
            // separator and would otherwise swallow these as bogus UserReward.
            let val = prep_user_reward_history(pk, sk, obj);
            finish!(
                report,
                "SPACE_REWARD->UserRewardHistory",
                dry_run,
                pk,
                sk,
                UserRewardHistory,
                val
            );
        } else if sk.starts_with("SPACE_REWARD##") {
            // Maps to the per-(target,reward) aggregate `UserReward`, not the
            // per-space `SpaceReward` config row — see doc comment on
            // `prep_user_reward` / the ETL report for rationale.
            let val = prep_user_reward(pk, sk, obj);
            finish!(report, "SPACE_REWARD->UserReward", dry_run, pk, sk, UserReward, val);
        } else if sk.starts_with("FOLLOWER#") {
            let val = prep_user_follow(pk, sk, "follower", "FOLLOWER#", obj);
            finish!(report, "USER_FOLLOW", dry_run, pk, sk, UserFollow, val);
        } else if sk.starts_with("FOLLOWING#") {
            let val = prep_user_follow(pk, sk, "following", "FOLLOWING#", obj);
            finish!(report, "USER_FOLLOW", dry_run, pk, sk, UserFollow, val);
        } else if sk.starts_with("SPACE_ACTION_FOLLOW#") {
            let val = prep_space_follow_action(pk, sk, obj);
            finish!(
                report,
                "SPACE_ACTION_FOLLOW",
                dry_run,
                pk,
                sk,
                SpaceFollowAction,
                val
            );
        } else if sk.starts_with("SPACE_POST_SUBSCRIPTION#") {
            let val = prep_space_post_subscription(pk, sk, obj);
            finish!(
                report,
                "SPACE_POST_SUBSCRIPTION",
                dry_run,
                pk,
                sk,
                SpacePostSubscription,
                val
            );
        } else if sk.starts_with("NOTIFICATION#") {
            // Two disjoint shapes share this sk prefix. The current
            // `Notification` model (event-dispatch row: id/created_at/status
            // in {Requested,Failed,Completed}/data) is keyed
            // `pk == sk == "NOTIFICATION#<uuid>"`. A pre-migration per-user
            // in-app notification format is keyed `pk = "NOTIFICATION#USER#<uid>"`
            // and carries `user_pk`/`operation`/`status` in {Unread,Read} — it
            // doesn't fit `Notification` (wrong status enum) or
            // `UserInboxNotification` (its `payload` is a typed `InboxPayload`
            // enum, not this free-form `operation` map), so it's called out
            // explicitly rather than force-parsed.
            if pk.starts_with("NOTIFICATION#USER#") {
                report.skip_intentional(
                    "NOTIFICATION_LEGACY_USER_FORMAT",
                    "pre-migration per-user notification row (user_pk/operation/status=Unread|Read) — \
                     superseded by USER_INBOX_NOTIFICATION; shape fits neither Notification \
                     (event-dispatch status enum) nor UserInboxNotification (typed InboxPayload)",
                );
            } else {
                let val = prep_own(pk, obj);
                finish!(report, "NOTIFICATION", dry_run, pk, sk, Notification, val);
            }
        } else if sk.starts_with("USER_INBOX_NOTIFICATION#") {
            let val = prep_inbox(pk, sk, obj);
            finish!(
                report,
                "USER_INBOX_NOTIFICATION",
                dry_run,
                pk,
                sk,
                UserInboxNotification,
                val
            );
        } else if sk == "USER_REFERRAL_CODE" {
            let val = prep_own_with_user_pk(pk, obj);
            finish!(
                report,
                "USER_REFERRAL_CODE",
                dry_run,
                pk,
                sk,
                UserReferralCode,
                val
            );
        } else if sk == "USER_PRINCIPAL" {
            let val = prep_own_with_user_pk(pk, obj);
            finish!(report, "USER_PRINCIPAL", dry_run, pk, sk, UserPrincipal, val);
        } else if sk == "USER_EVM_ADDRESS" {
            let val = prep_own_with_user_pk(pk, obj);
            finish!(
                report,
                "USER_EVM_ADDRESS",
                dry_run,
                pk,
                sk,
                UserEvmAddress,
                val
            );
        } else if sk.starts_with("USER_TEAM_GROUP#") {
            let val = prep_user_team_group(pk, sk, obj);
            finish!(
                report,
                "USER_TEAM_GROUP",
                dry_run,
                pk,
                sk,
                UserTeamGroup,
                val
            );
        } else if sk.starts_with("USER_TEAM#") {
            let val = prep_user_team(pk, sk, obj);
            finish!(report, "USER_TEAM", dry_run, pk, sk, UserTeam, val);
        } else if sk == "CHARACTER_XP" {
            let val = prep_own_with_user_pk(pk, obj);
            finish!(report, "CHARACTER_XP", dry_run, pk, sk, CharacterXp, val);
        } else if sk.starts_with("CHARACTER_XP_SOURCE#") {
            let val = prep_char_xp_source(pk, sk, obj);
            finish!(
                report,
                "CHARACTER_XP_SOURCE",
                dry_run,
                pk,
                sk,
                CharacterXpSource,
                val
            );
        } else if sk == "MEMBERSHIP" {
            let val = prep_own(pk, obj);
            finish!(report, "MEMBERSHIP", dry_run, pk, sk, Membership, val);
        } else if sk.starts_with("TIMELINE_ENTRY#") {
            let val = prep_timeline(pk, sk, obj);
            finish!(report, "TIMELINE_ENTRY", dry_run, pk, sk, TimelineEntry, val);
        // ── Coverage expansion (job B) ──────────────────────────────────
        } else if sk.starts_with("ESSENCE#") {
            let val = prep_essence(pk, sk, obj);
            finish!(report, "ESSENCE", dry_run, pk, sk, Essence, val);
        } else if sk == "USER_ESSENCE_STATS" {
            let val = prep_user_essence_stats(pk, obj);
            finish!(report, "USER_ESSENCE_STATS", dry_run, pk, sk, UserEssenceStats, val);
        } else if sk == "VERIFIED_ATTRIBUTES" {
            let val = prep_verified_attributes(pk, obj);
            finish!(
                report,
                "VERIFIED_ATTRIBUTES",
                dry_run,
                pk,
                sk,
                VerifiedAttributes,
                val
            );
        } else if sk == "ATTRIBUTE_CODE" {
            let val = prep_attribute_code(pk, obj);
            finish!(report, "ATTRIBUTE_CODE", dry_run, pk, sk, AttributeCode, val);
        } else if sk.starts_with("SPACE_INVITATION_MEMBER#") {
            let val = prep_invitation_member(pk, sk, obj);
            finish!(
                report,
                "SPACE_INVITATION_MEMBER",
                dry_run,
                pk,
                sk,
                SpaceInvitationMember,
                val
            );
        } else if sk == "USER_MEMBERSHIP" {
            let val = prep_user_membership(pk, obj);
            finish!(report, "USER_MEMBERSHIP", dry_run, pk, sk, UserMembership, val);
        } else if sk == "TEAM_MEMBERSHIP" {
            let val = prep_team_membership(pk, obj);
            finish!(report, "TEAM_MEMBERSHIP", dry_run, pk, sk, TeamMembership, val);
        } else if sk == "TEAM_OWNER" {
            let val = prep_team_owner(pk, sk, obj);
            finish!(report, "TEAM_OWNER", dry_run, pk, sk, TeamOwner, val);
        } else if sk.starts_with("TEAM_GROUP#") {
            let val = prep_team_group(pk, sk, obj);
            finish!(report, "TEAM_GROUP", dry_run, pk, sk, TeamGroup, val);
        } else if sk.starts_with("POST_LIKE#") {
            let val = prep_post_like(pk, sk, obj);
            finish!(report, "POST_LIKE", dry_run, pk, sk, PostLike, val);
        } else if sk.starts_with("SPACE_STATUS_CHANGE_EVENT#") {
            let val = prep_status_change_event(pk, obj);
            finish!(
                report,
                "SPACE_STATUS_CHANGE_EVENT",
                dry_run,
                pk,
                sk,
                SpaceStatusChangeEvent,
                val
            );
        } else if sk.starts_with("SPACE_ANALYZE_DISCUSSION_RESULT#") {
            let val = prep_analyze_discussion_result(pk, sk, obj);
            finish!(
                report,
                "SPACE_ANALYZE_DISCUSSION_RESULT",
                dry_run,
                pk,
                sk,
                SpaceAnalyzeDiscussionResult,
                val
            );
        } else if sk.starts_with("SPACE_CATEGORY#") {
            let val = prep_space_category(pk, sk, obj);
            finish!(report, "SPACE_CATEGORY", dry_run, pk, sk, SpaceCategory, val);
        } else if sk.starts_with("SPACE_ADMIN#") {
            let val = prep_space_admin(pk, sk, obj);
            finish!(report, "SPACE_ADMIN", dry_run, pk, sk, SpaceAdmin, val);
        } else if sk.starts_with("CATEGORY#") {
            let val = prep_category(pk, sk, obj);
            finish!(report, "CATEGORY", dry_run, pk, sk, Category, val);
        } else if sk.starts_with("USER_DEVICE_TOKEN#") {
            let val = prep_user_device_token(pk, sk, obj);
            finish!(
                report,
                "USER_DEVICE_TOKEN",
                dry_run,
                pk,
                sk,
                UserDeviceToken,
                val
            );
        } else if sk.starts_with("USER_NOTIFICATION#") {
            let val = prep_user_notification(pk, sk, obj);
            finish!(
                report,
                "USER_NOTIFICATION",
                dry_run,
                pk,
                sk,
                UserNotification,
                val
            );
        // ── Deliberately not migrated (ephemeral / security-sensitive /
        //    retired feature / no current Postgres model) ────────────────
        } else if sk.starts_with("SESSION") {
            report.skip_intentional(
                "SESSION",
                "tower-sessions ephemeral session store — not a durable domain entity",
            );
        } else if sk.starts_with("SPACE_EMAIL_VERIFICATION") {
            report.skip_intentional(
                "SPACE_EMAIL_VERIFICATION",
                "one-time verification code, TTL'd, security-sensitive — not migrated",
            );
        } else if sk.starts_with("EMAIL_VERIFICATION") {
            report.skip_intentional(
                "EMAIL_VERIFICATION",
                "one-time verification code, TTL'd, security-sensitive — not migrated",
            );
        } else if sk.starts_with("INBOX_DEDUP_MARKER") {
            report.skip_intentional(
                "INBOX_DEDUP_MARKER",
                "ephemeral idempotency marker with no read path — not a durable entity",
            );
        } else if sk.starts_with("USER_REFRESH_TOKEN") {
            report.skip_intentional(
                "USER_REFRESH_TOKEN",
                "security bearer token — must not be migrated; forces re-auth instead",
            );
        } else if sk.starts_with("PENDING_REWARD") {
            report.skip_intentional(
                "PENDING_REWARD",
                "retired feature (BiyardService removal, see common::migrations::runner) — no current model",
            );
        } else if sk.starts_with("DID_DOCUMENT") {
            report.skip_intentional(
                "DID_DOCUMENT",
                "no Postgres model exists yet for this entity (retired DID-document flow)",
            );
        } else if sk.starts_with("TEST_ACCOUNT") {
            report.skip_intentional(
                "TEST_ACCOUNT",
                "dev/test fixture row, not production domain data",
            );
        } else if sk.starts_with("MCP_CLIENT_SECRET") {
            report.skip_intentional(
                "MCP_CLIENT_SECRET",
                "security secret — must not be migrated in plaintext",
            );
        } else if sk.starts_with("LAST_BACKFILL_VERSION") {
            report.skip_intentional(
                "LAST_BACKFILL_VERSION",
                "internal DynamoDB migration-runner cursor — meaningless under the new schema",
            );
        } else if sk.starts_with("CREATED#") {
            report.skip_intentional(
                "PAYMENT_CREATED",
                "billing/payment record (customer_id, billing_key) — sensitive financial data, out of migration scope",
            );
        } else if sk.starts_with("SPACE_PANEL_PARTICIPANT#") {
            let val = prep_space_panel_participant(pk, sk, obj);
            finish!(
                report,
                "SPACE_PANEL_PARTICIPANT",
                dry_run,
                pk,
                sk,
                SpacePanelParticipant,
                val
            );
        } else if sk.starts_with("FILE_LINK#") {
            let val = prep_file_link(pk, sk, obj);
            finish!(report, "FILE_LINK", dry_run, pk, sk, FileLink, val);
        } else if sk.starts_with("SPACE_APP#") {
            let val = prep_space_app(pk, sk, obj);
            finish!(report, "SPACE_APP", dry_run, pk, sk, SpaceApp, val);
        } else if sk == "SPACE_FILE" {
            let val = prep_space_file(pk, sk, obj);
            finish!(report, "SPACE_FILE", dry_run, pk, sk, SpaceFile, val);
        } else if sk.starts_with("SPACE_PANEL_ATTRIBUTE#")
            || sk == "SPACE_PANEL"
            || sk.starts_with("SPACE_PANEL#")
            || sk == "SPACE_PANELS"
            || sk.starts_with("SPACE_REQUIREMENT#")
        {
            report.skip_intentional(
                "SPACE_PANEL_DEFINITION",
                "panel definition / attribute / requirement rows have no standalone \
                 PostgresEntity table (the panel app folds them into space_panel_quotas \
                 at runtime) — deferred; participant rows ARE migrated",
            );
        } else if sk.starts_with("SPACE_DASHBOARD_EXTENSION#") {
            report.skip_intentional(
                "SPACE_DASHBOARD_EXTENSION",
                "model (features/spaces/space_common/models/dashboard/) lives under the crate-private \
                 `pub(crate) mod space_common` and is not re-exported — not reachable from an external \
                 bin crate without changing library visibility — out of scope",
            );
        // ── Coverage expansion round 2 (models confirmed publicly reachable) ──
        } else if sk == "SPACE_ACTION" {
            let val = prep_space_action(pk, obj);
            finish!(report, "SPACE_ACTION", dry_run, pk, sk, SpaceAction, val);
        } else if sk.starts_with("SPACE_ANALYZE_REPORT_RESULT#") {
            let val = prep_analyze_report_result(pk, sk, obj);
            finish!(
                report,
                "SPACE_ANALYZE_REPORT_RESULT",
                dry_run,
                pk,
                sk,
                SpaceAnalyzeReportResult,
                val
            );
        } else if sk.starts_with("SPACE_ANALYZE_REPORT#") {
            let val = prep_analyze_report(pk, sk, obj);
            finish!(
                report,
                "SPACE_ANALYZE_REPORT",
                dry_run,
                pk,
                sk,
                SpaceAnalyzeReport,
                val
            );
        } else if sk.starts_with("SPACE_QUIZ_ANSWER#") {
            let val = prep_space_quiz_answer(pk, sk, obj);
            finish!(report, "SPACE_QUIZ_ANSWER", dry_run, pk, sk, SpaceQuizAnswer, val);
        } else if sk.starts_with("SPACE_QUIZ#") {
            let val = prep_space_quiz(pk, sk, obj);
            finish!(report, "SPACE_QUIZ", dry_run, pk, sk, SpaceQuiz, val);
        // ── Coverage expansion round 3: sub-team / cross-posting / misc ──
        } else if sk.starts_with("SUB_TEAM_ANNOUNCEMENT_FANOUT#") {
            let val = prep_sub_team_announcement_fanout(pk, sk, obj);
            finish!(
                report,
                "SUB_TEAM_ANNOUNCEMENT_FANOUT",
                dry_run,
                pk,
                sk,
                SubTeamAnnouncementFanout,
                val
            );
        } else if sk.starts_with("SUB_TEAM_ANNOUNCEMENT#") {
            let val = prep_sub_team_announcement(pk, sk, obj);
            finish!(
                report,
                "SUB_TEAM_ANNOUNCEMENT",
                dry_run,
                pk,
                sk,
                SubTeamAnnouncement,
                val
            );
        } else if sk.starts_with("SUB_TEAM_APPLICATION#") {
            let val = prep_sub_team_application(pk, sk, obj);
            finish!(
                report,
                "SUB_TEAM_APPLICATION",
                dry_run,
                pk,
                sk,
                SubTeamApplication,
                val
            );
        } else if sk.starts_with("SUB_TEAM_FORM_FIELD#") {
            let val = prep_sub_team_form_field(pk, sk, obj);
            finish!(
                report,
                "SUB_TEAM_FORM_FIELD",
                dry_run,
                pk,
                sk,
                SubTeamFormField,
                val
            );
        } else if sk.starts_with("SUB_TEAM_LINK#") {
            let val = prep_sub_team_link(pk, sk, obj);
            finish!(report, "SUB_TEAM_LINK", dry_run, pk, sk, SubTeamLink, val);
        } else if sk.starts_with("SOCIAL_CONNECTION#") {
            let val = prep_social_connection(pk, sk, obj);
            finish!(
                report,
                "SOCIAL_CONNECTION",
                dry_run,
                pk,
                sk,
                SocialConnection,
                val
            );
        } else if sk == "SYNDICATION_DIRECTIVE" {
            let val = prep_syndication_directive(pk, sk, obj);
            finish!(
                report,
                "SYNDICATION_DIRECTIVE",
                dry_run,
                pk,
                sk,
                PostSyndicationDirective,
                val
            );
        } else if sk.starts_with("SYNDICATION_JOB#") {
            let val = prep_syndication_job(pk, sk, obj);
            finish!(report, "SYNDICATION_JOB", dry_run, pk, sk, SyndicationJob, val);
        } else if sk.starts_with("USER_PURCHASE#") {
            let val = prep_user_purchase(pk, sk, obj);
            finish!(report, "USER_PURCHASE", dry_run, pk, sk, UserPurchase, val);
        } else if sk == "AI_MODERATOR_CONFIG" {
            let val = prep_ai_moderator_config(pk, obj);
            finish!(
                report,
                "AI_MODERATOR_CONFIG",
                dry_run,
                pk,
                sk,
                AiModeratorConfig,
                val
            );
        } else if sk == "SPRINT_LEAGUE"
            || sk.starts_with("SPRINT_LEAGUE_PLAYER#")
            || sk.starts_with("SPRINT_LEAGUE_VOTE#")
        {
            report.skip_intentional(
                "SPRINT_LEAGUE",
                "no PostgresEntity model exists for the sprint-league game entities \
                 (only Partition/EntityType variants) — out of scope",
            );
        } else if pk == "REWARD" {
            report.skip_intentional(
                "REWARD_CONFIG",
                "global reward-config rows (pk=REWARD; DISCUSSION_COMMENT/QUIZ_ANSWER/\
                 RESPOND_POLL/FOLLOW action rows) map to SpaceReward under crate-private \
                 space_common — not reachable from the bin crate",
            );
        } else if sk == "PHONE_VERIFICATION" {
            report.skip_intentional(
                "PHONE_VERIFICATION",
                "one-time TTL'd phone verification code, security-sensitive — not migrated",
            );
        } else if sk.starts_with("POST_COMMENT#") {
            let val = prep_post_comment(pk, sk, obj);
            finish!(report, "POST_COMMENT", dry_run, pk, sk, PostComment, val);
        } else {
            report.skip(sk);
        }
    }

    pub async fn run() -> Result<(), Box<dyn std::error::Error>> {
        tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,app_shell=warn")),
            )
            .init();

        let mut dry_run = false;
        let mut path: Option<String> = None;
        for arg in std::env::args().skip(1) {
            if arg == "--dry-run" {
                dry_run = true;
            } else {
                path = Some(arg);
            }
        }
        let path = path.unwrap_or_else(|| {
            "../../ratel-prod-export/all-items.ndjson".to_string()
        });

        println!("etl_migrate: reading {path} (dry_run={dry_run})");

        // ── Postgres bootstrap (mirrors common::run::serve's postgres block) ──
        let database_url = std::env::var("DATABASE_URL")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .unwrap_or_else(|| "postgres://asset:asset@127.0.0.1:5433/ratel_dev".to_string());

        let pool = postgres::sqlx::postgres::PgPoolOptions::new()
            .max_connections(10)
            .connect(&database_url)
            .await?;
        postgres::set_global_pool(pool.clone());
        postgres::Schema::from_inventory().migrate(&pool).await?;
        println!("etl_migrate: postgres schema migrated ({database_url})");

        // ── Read + parse every line once ───────────────────────────────────
        let file = std::fs::File::open(&path)
            .map_err(|e| format!("failed to open {path}: {e}"))?;
        let reader = std::io::BufReader::new(file);

        let mut report = Report::new();
        let mut items: Vec<(String, String, Map<String, Value>)> = Vec::new();

        use std::io::BufRead;
        for line in reader.lines() {
            let line = line?;
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let outer: Value = match serde_json::from_str(line) {
                Ok(v) => v,
                Err(_) => {
                    report.malformed_lines += 1;
                    continue;
                }
            };
            let item_val = match outer.get("Item").cloned() {
                Some(v) => v,
                None => {
                    report.malformed_lines += 1;
                    continue;
                }
            };
            let obj = match item_to_obj(item_val) {
                Ok(o) => o,
                Err(e) => {
                    report.malformed_lines += 1;
                    report.record_error("RAW", "PARSE", "", "", &e);
                    continue;
                }
            };
            let pk = obj
                .get("pk")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let sk = obj
                .get("sk")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            items.push((pk, sk, obj));
        }

        println!("etl_migrate: parsed {} lines ({} malformed)", items.len(), report.malformed_lines);

        // ── Pass 1: parents (User/Team/SpaceCommon/Post/SpacePost) ─────────
        for (pk, sk, obj) in &items {
            if is_parent_sk(sk) {
                dispatch_one(&mut report, dry_run, pk, sk, obj.clone()).await;
            }
        }

        // ── Pass 2: everything else ─────────────────────────────────────────
        for (pk, sk, obj) in &items {
            if !is_parent_sk(sk) {
                dispatch_one(&mut report, dry_run, pk, sk, obj.clone()).await;
            }
        }

        report.print_summary(dry_run);

        Ok(())
    }
}

#[cfg(feature = "server")]
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    imp::run().await
}
