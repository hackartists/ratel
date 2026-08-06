//! 재설계 검증용 example — `docs/postgres-redesign/room-file-and-message.md` 의
//! `RoomAgentFile` / `RoomMessage` / `MessageReaction` 를 **새 `postgres` 크레이트
//! 컨벤션**(PostgresEntity + PostgresEnum(native) + PostgresJson) 으로 정의하고,
//! DB 없이 `Schema::ordered_create_statements()` 로 생성될 DDL 을 찍어본다.
//!
//! 실행: `cargo run -p postgres --example asset_models_ddl`
//!
//! 검증 포인트:
//!   - enum → native `CREATE TYPE … AS ENUM` (jsonb 아님)
//!   - Vec<struct> → `PostgresJson` newtype → JSONB
//!   - u8 는 `PostgresType` 미구현 → **i16(SMALLINT)** 로 바꿔야 컴파일됨
//!   - f32 → REAL, f64 → DOUBLE PRECISION (구 asset-storage 의 f32 버그 없음)
//!   - `Uuid` PK, `#[postgres(index)]` → CREATE INDEX

use postgres::prelude::*;
use postgres::sqlx::postgres::PgPoolOptions;
use postgres::uuid::Uuid;
use serde::{Deserialize, Serialize};

// ── JSONB 안에 들어갈 값 타입 (스칼라 f32 는 jsonb 내부라 무해) ──────────────
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct Signal {
    pub label: String,
    pub weight: f32,
}
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct SubItemCandidate {
    pub code: String,
    pub confidence: f32,
}
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct MessageAttachment {
    pub name: String,
    pub size_bytes: i64,
    pub mime: String,
    pub source_file_id: String,
}
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct AnchorRect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

// ── PostgresJson newtype → JSONB 컬럼 (bare Vec<T> 금지 → newtype 로 감쌈) ──
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, PostgresJson)]
pub struct Signals(pub Vec<Signal>);
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, PostgresJson)]
pub struct SubItemCandidates(pub Vec<SubItemCandidate>);
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, PostgresJson)]
pub struct Attachments(pub Vec<MessageAttachment>);
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, PostgresJson)]
pub struct AnchorRects(pub Vec<AnchorRect>);

// ── PostgresEnum → native CREATE TYPE AS ENUM ───────────────────────────────
#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum RoomAgentFileStatus {
    #[default]
    Listed,
    Approved,
    Classified,
    Failed,
}
#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum ScopeType {
    #[default]
    DataRoom,
    Dataset,
}
#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum SourceTypeCol {
    #[default]
    GDrive,
    OneDrive,
    Dropbox,
    DirectUpload,
    Notion,
    Dart,
    Onchain,
}
#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum ClassificationSourceCol {
    #[default]
    Heuristic,
    Agent,
    Override,
}
#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum PipelineStateCol {
    #[default]
    Idle,
    Listing,
    AwaitingApproval,
    Indexing,
    Ready,
    Scoring,
    Failed,
}
#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum OcrJobStatusCol {
    #[default]
    Pending,
    Running,
    Succeeded,
    Failed,
}
#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum MessageAuthorRole {
    #[default]
    AssetHolder,
    Investor,
    System,
}
#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum RoomMessageKind {
    #[default]
    Text,
    DocComment,
}

// ── ENTITY 1: room_agent_files ──────────────────────────────────────────────
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "room_agent_files")]
pub struct RoomAgentFile {
    pub id: Uuid, // 대리 PK (now_v7 자동). 합성 "scope:file" 폐기
    #[postgres(index)]
    pub scope_id: Uuid,
    pub scope_type: ScopeType, // native enum (폴리모픽: FK 생략)
    pub dataset_id: Option<Uuid>,
    pub workspace_id: Uuid,

    pub status: RoomAgentFileStatus, // native enum (was jsonb)
    pub source_type: SourceTypeCol,  // native enum
    pub source_file_id: String,
    pub display_name: String,
    pub mime: String,
    pub preview_url: Option<String>,
    pub size_bytes: i64,
    pub modified_at: i64,

    pub folder_path: String,
    pub heuristic_folder_id: String,
    pub heuristic_signals: Signals, // jsonb (newtype)
    pub folder_id: String,
    pub sub_item_candidates: SubItemCandidates, // jsonb
    pub source: ClassificationSourceCol,        // native enum (was jsonb)
    pub reason: String,
    pub signals: Signals,    // jsonb
    pub source_trust: i16,   // SMALLINT (was u8 → jsonb)
    pub max_confidence: f32, // REAL (구 crate 는 double precision 버그였음)

    pub approved: bool,
    pub approved_at: Option<i64>,
    pub parsed_markdown_key: Option<String>,
    pub qdrant_point_id: Option<String>,
    pub ocr_status: Option<OcrJobStatusCol>, // nullable native enum
    pub ocr_attempt: i32,
    pub ocr_max_attempts: i32,

    pub stage: PipelineStateCol, // native enum (was jsonb)
    pub error_code: String,
    pub error_message: String,
    pub retry_count: i16, // SMALLINT (was u8 → jsonb)
    pub last_attempted_at: i64,
    pub version: i64,
}

// ── ENTITY 2: room_messages ─────────────────────────────────────────────────
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "room_messages")]
pub struct RoomMessage {
    pub id: Uuid, // (구: text 로 저장된 uuid → Uuid 타입)
    // conv_key("{room}#{conv}") 폐기 → 실제 컬럼 + 인덱스
    #[postgres(index)]
    pub room_id: Uuid,
    #[postgres(index)]
    pub conversation_id: Uuid,
    pub created_at: i64,

    pub author_role: MessageAuthorRole, // native enum (was jsonb)
    pub author_user_id: Uuid,
    pub author_name: String,
    pub kind: RoomMessageKind, // native enum
    pub body: String,
    pub edited: bool,
    pub deleted: bool,
    pub parent_id: Option<Uuid>, // self FK (스레드)

    pub doc_file_id: String,
    pub doc_file_name: String,
    pub doc_folder_label: String,
    pub doc_anchor: String,
    pub doc_page: i32,
    pub doc_quote: String,
    pub doc_rects: AnchorRects,   // jsonb (was doc_rects_json TEXT)
    pub attachments: Attachments, // jsonb
}

// ── ENTITY 3: message_reactions (정규화 — reactions_json TEXT 대체) ──────────
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "message_reactions")]
pub struct MessageReaction {
    pub id: Uuid,
    #[postgres(index)]
    pub message_id: Uuid, // FK → room_messages (relation form 은 후속: many_to_one)
    pub emoji: String,
    pub user_id: Uuid,
    pub created_at: i64,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    // 스크래치 DB (앱의 `asset` DB 와 충돌 방지). 미리 CREATE DATABASE 해둘 것.
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://asset:asset@localhost:5432/ddl_scratch".into());
    let pool = PgPoolOptions::new().connect(&url).await?;

    let schema = Schema::new()
        .register::<RoomAgentFile>()
        .register::<RoomMessage>()
        .register::<MessageReaction>();

    schema.create(&pool).await?;
    println!("OK — 3 entities registered + tables/enums/indexes created in {url}");
    Ok(())
}
