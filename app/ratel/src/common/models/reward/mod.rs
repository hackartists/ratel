// Postgres-backed reward models are server-only (the `postgres` crate is gated
// behind the `server` feature). No web code references these structs — every
// consumer (admin/social/spaces controllers + `SpaceReward::award`) touches
// them inside server-gated bodies. Web-facing DTOs (`RewardResponse`,
// `RewardHistoryItem`, `SpaceRewardResponse`, …) stay cross-platform and live
// with their controllers.
#[cfg(feature = "server")]
mod reward;
#[cfg(feature = "server")]
mod user_reward;
#[cfg(feature = "server")]
mod user_reward_history;

#[cfg(feature = "server")]
pub use reward::*;
#[cfg(feature = "server")]
pub use user_reward::*;
#[cfg(feature = "server")]
pub use user_reward_history::*;
