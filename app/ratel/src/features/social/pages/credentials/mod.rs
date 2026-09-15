#![allow(unused)]
pub mod config;
pub mod controllers;
pub mod models;
#[cfg(feature = "server")]
pub mod services;


#[cfg(feature = "server")]
pub mod server;


use crate::common::*;

type Result<T> = crate::common::Result<T>;
type DioxusResult<T> = dioxus::prelude::Result<T>;

use serde::{Deserialize, Serialize};
