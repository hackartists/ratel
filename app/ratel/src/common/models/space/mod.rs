mod space_admin;
mod space_common;
mod space_participant;
mod space_status_change_event;
mod space_user;

// Postgres `TEXT` column codecs for the shared `SpaceStatus` /
// `SpaceVisibility` / `SpacePublishState` enums (server-only). Keeps the model
// fields typed without editing the shared `common::types` enum definitions.
#[cfg(feature = "server")]
mod pg_enum_glue;

pub use space_admin::*;
pub use space_common::*;
pub use space_participant::*;
pub use space_status_change_event::*;
pub use space_user::*;
