//! Sampling space app.
//!
//! Builds a population from entry-poll respondents that satisfy the
//! configured Required Attribute rules, splits it into cells (the cartesian
//! product of the chosen single-choice questions' options), allocates the
//! total sample size equally across cells, and admits members either first
//! come, first served or by a random draw when the creator moves the space
//! from `Open` to `Sampling`.

pub mod controllers;
#[cfg(feature = "server")]
pub mod models;
#[cfg(feature = "server")]
pub mod services;
pub mod types;

pub use controllers::*;
#[cfg(feature = "server")]
pub use models::*;
pub use types::*;

use crate::*;
