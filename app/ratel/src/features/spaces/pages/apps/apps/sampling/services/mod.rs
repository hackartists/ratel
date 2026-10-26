//! Server-side Sampling logic. Pure functions (allocation, cells,
//! selection, unique keys) are unit tested in place; the async services read and write
//! the Sampling tables.

pub mod admission;
pub mod allocation;
pub mod cells;
pub mod population;
pub mod selection;
pub mod status;
pub mod transition;
pub mod unique_keys;

pub use admission::*;
pub use allocation::*;
pub use cells::*;
pub use population::*;
pub use selection::*;
pub use status::*;
pub use transition::*;
pub use unique_keys::*;
