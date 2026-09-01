//! The `SpaceInvitationMember` model + `InvitationStatus` enum are canonically
//! defined in `space_common::models::space_invitation_member` (the version
//! re-exported as `crate::spaces::SpaceInvitationMember`). This module used to
//! carry a byte-identical duplicate `#[derive(DynamoEntity)]` struct; during
//! the Postgres migration that duplicate is removed (two entities mapping to
//! the same `space_invitation_members` table would clash in the schema
//! inventory) and this module simply re-exports the canonical types. No caller
//! referenced this copy distinctly, so the collapse is behavior-preserving.

pub use crate::features::spaces::space_common::models::InvitationStatus;
#[cfg(feature = "server")]
pub use crate::features::spaces::space_common::models::SpaceInvitationMember;
