#[cfg(feature = "server")]
mod server;
#[cfg(feature = "server")]
pub use server::*;
#[cfg(feature = "server")]
pub type CommonConfig = server::ServerConfig;

#[cfg(not(feature = "server"))]
pub type CommonConfig = web::WebConfig;

mod environment;
mod web;
mod log_level;
mod portone_config;
mod site_config;

pub use environment::*;
pub use web::*;
pub use log_level::*;
pub use portone_config::*;
pub use site_config::*;
