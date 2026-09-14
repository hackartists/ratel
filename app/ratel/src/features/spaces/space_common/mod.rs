#![allow(unused)]
pub mod config;
pub mod controllers;
pub mod models;
pub mod services;
pub mod types;

// Re-export
pub use crate::features::auth as ratel_auth;
pub use crate::features::posts as ratel_post;

pub use config::*;
pub use controllers::*;
pub use models::*;
pub use types::*;

use super::*;
use crate::*;
