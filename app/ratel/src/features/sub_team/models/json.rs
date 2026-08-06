//! Shared `PostgresJson` newtypes for the sub_team module.
//!
//! The Postgres ORM has no column codec for bare `Vec<_>` / `HashMap<_>` or
//! for enums owned by other feature modules (`SpaceType`, `Visibility`). Each
//! such field is stored as a `jsonb` column via a single-field tuple newtype —
//! serde treats the newtype transparently, so the column holds the bare JSON
//! document. The newtype structs stay cross-platform (the model structs that
//! embed them are cross-platform); only the `PostgresJson` derive is
//! server-gated.

use crate::common::*;
use crate::features::posts::types::{SpaceType, Visibility};
use std::collections::HashMap;

/// `Vec<File>` attachment list stored as jsonb. Shared by announcements,
/// documents, and document-version snapshots.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
pub struct FileList(pub Vec<File>);

/// `Vec<String>` list stored as jsonb — announcement tags, form-field options.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
pub struct StringList(pub Vec<String>);

/// `field_id → applicant value` map stored as jsonb.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
pub struct FormValues(pub HashMap<String, serde_json::Value>);

/// Fan-out post visibility (external `posts` enum) stored as jsonb.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
pub struct VisibilityJson(pub Visibility);

/// Optional attached-Space type (external `posts` enum) stored as jsonb.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
pub struct SpaceTypeOpt(pub Option<SpaceType>);
