// Postgres-backed models are server-only. Cross-platform items (InvitationStatus,
// HotSpaceHeat, and the wire *Response DTOs) live in the same files but are
// gated per-item, so their modules stay un-gated here.
#[cfg(feature = "server")]
mod space_email_verification;
mod space_invitation_member;
#[cfg(feature = "server")]
pub mod space_reward;
#[cfg(feature = "server")]
pub use space_reward::*;

mod space_reward_response;
pub use space_reward_response::*;

pub mod dashboard;
pub use dashboard::*;

mod hot_space;
pub use hot_space::*;

#[cfg(feature = "server")]
pub use space_email_verification::*;
pub use space_invitation_member::*;
