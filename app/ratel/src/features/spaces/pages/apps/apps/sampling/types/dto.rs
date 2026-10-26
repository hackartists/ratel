use crate::features::spaces::pages::actions::models::RequiredAttributeRule;
use crate::features::spaces::pages::apps::apps::sampling::*;

/// Saved Sampling settings for a space.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct SamplingConfigDto {
    pub entry_poll_id: String,
    pub population_rules: Vec<RequiredAttributeRule>,
    pub dimensions: Vec<usize>,
    pub total_samples: i64,
    pub allocation: SamplingAllocation,
    pub method: SamplingMethod,
    pub allow_recruit_during_sampling: bool,
    pub sampling_started_at: Option<i64>,
    /// Short-answer question indices whose answers may not repeat among
    /// admitted members; empty when duplicate prevention is off.
    pub unique_questions: Vec<usize>,
}

/// One cell: a combination of options of the sampling questions plus its
/// equal-allocation target.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct SamplingCellDto {
    pub position: i64,
    pub cell_key: String,
    pub labels: Vec<String>,
    pub target: i64,
}

/// Settings screen payload. `locked` is true once the space left `Open`,
/// after which the settings can no longer change.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct SamplingSettingsResponse {
    pub config: Option<SamplingConfigDto>,
    pub cells: Vec<SamplingCellDto>,
    pub locked: bool,
}

/// Full Sampling settings submitted from the settings screen.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct UpsertSamplingConfigRequest {
    pub entry_poll_id: String,
    #[serde(default)]
    pub population_rules: Vec<RequiredAttributeRule>,
    #[serde(default)]
    pub dimensions: Vec<usize>,
    pub total_samples: i64,
    #[serde(default)]
    pub allocation: SamplingAllocation,
    #[serde(default)]
    pub method: SamplingMethod,
    #[serde(default)]
    pub allow_recruit_during_sampling: bool,
    /// Short-answer question indices of the entry poll used for duplicate
    /// prevention; empty turns it off.
    #[serde(default)]
    pub unique_questions: Vec<usize>,
}

/// Unsaved inputs for the cell target preview.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct PreviewSamplingRequest {
    pub entry_poll_id: String,
    #[serde(default)]
    pub dimensions: Vec<usize>,
    pub total_samples: i64,
}

/// Per-cell progress on the creator dashboard.
///
/// `population` counts every member assigned to the cell, `selected` the
/// members drawn (random) or seated (first come), `entered` the seated
/// members. `shortage` flags a population smaller than the target;
/// `filled` flags a cell whose target is met.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct SamplingDashboardRow {
    pub position: i64,
    pub cell_key: String,
    pub labels: Vec<String>,
    pub target: i64,
    pub population: i64,
    pub selected: i64,
    pub entered: i64,
    pub shortage: bool,
    pub filled: bool,
}

/// Column sums of [`SamplingDashboardRow`].
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct SamplingDashboardTotals {
    pub target: i64,
    pub population: i64,
    pub selected: i64,
    pub entered: i64,
}

/// Creator dashboard payload.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct SamplingDashboardResponse {
    pub method: SamplingMethod,
    pub status: Option<SpaceStatus>,
    pub rows: Vec<SamplingDashboardRow>,
    pub totals: SamplingDashboardTotals,
}

/// The signed-in user's Sampling state, with the labels of their cell when
/// they belong to the population.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct MySamplingStatusResponse {
    pub state: MySamplingState,
    pub method: SamplingMethod,
    pub cell_labels: Vec<String>,
}
