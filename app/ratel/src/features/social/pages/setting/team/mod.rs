#![allow(unused)]
pub mod config;
pub mod controllers;
pub mod models;

#[cfg(feature = "server")]
pub mod server;

use crate::common::*;

type Result<T> = crate::common::Result<T>;
type DioxusResult<T> = dioxus::prelude::Result<T>;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy)]
pub struct SettingsSaveContext {
    pub save_trigger: Signal<u64>,
    pub is_saving: Signal<bool>,
}
