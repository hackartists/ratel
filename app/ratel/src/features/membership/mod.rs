#![allow(unused)]
pub mod config;
pub mod controllers;
pub mod models;
pub mod services;
pub mod types;
#[cfg(feature = "server")]
pub mod server;


pub use crate::common::macros::dynamo_entity::DynamoEntity;
pub use crate::common::models::*;
pub use crate::common::types::*;
pub use crate::common::{DeserializeFromStr, DynamoEnum, EnumProp, SerializeDisplay};

use crate::common::*;

use serde::{Deserialize, Serialize};

type Result<T> = crate::common::Result<T>;
