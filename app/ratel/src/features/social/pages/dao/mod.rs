#![allow(unused)]
pub mod config;
pub mod controllers;
pub mod dto;
pub mod models;


use crate::common::*;

type Result<T> = crate::common::Result<T>;
type DioxusResult<T> = dioxus::prelude::Result<T>;

use serde::{Deserialize, Serialize};
