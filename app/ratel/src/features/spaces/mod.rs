#![allow(unused)]
mod config;
mod controllers;
mod dto;
pub mod models;
pub mod pages;
pub(crate) mod space_common;
mod types;

pub use space_common::InvitationStatus;
// `SpaceInvitationMember` is Postgres-backed and server-only.
#[cfg(feature = "server")]
pub use space_common::SpaceInvitationMember;

use crate::*;
use space_common::*;
pub use types::*;

// Re-export common types/macros for model derives.
pub use crate::common::macros::dynamo_entity::DynamoEntity;
pub use crate::common::types::*;
pub use crate::common::{DeserializeFromStr, DynamoEnum, EnumProp, SerializeDisplay};

#[cfg(feature = "server")]
#[derive(Clone)]
pub struct AppState {
    pub upstream_url: String,
}

#[cfg(feature = "server")]
use dioxus::fullstack::{axum::extract::FromRef, FullstackContext};

#[cfg(feature = "server")]
impl FromRef<FullstackContext> for AppState {
    fn from_ref(state: &FullstackContext) -> Self {
        state.extension::<AppState>().unwrap()
    }
}
