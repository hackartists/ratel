use crate::features::spaces::pages::apps::apps::sampling::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

/// Strategy for distributing the total sample size across cells.
///
/// Only `Equal` exists today; the enum keeps room for proportional or
/// manual allocation without changing the wire shape.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq, Translate)]
#[cfg_attr(
    feature = "server",
    derive(rmcp::schemars::JsonSchema, postgres::PostgresEnum)
)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub enum SamplingAllocation {
    #[default]
    #[translate(en = "Equal allocation", ko = "균등 배분")]
    Equal,
}

/// How members are drawn from the population once sampling begins.
///
/// `FirstCome` admits population members in the order they press enter
/// while the space is in `Sampling`, as long as their cell has a free seat.
/// `Random` draws each cell's members at random the moment the creator
/// starts sampling; only the drawn members may enter.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq, Translate)]
#[cfg_attr(
    feature = "server",
    derive(rmcp::schemars::JsonSchema, postgres::PostgresEnum)
)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub enum SamplingMethod {
    #[default]
    #[translate(en = "First come, first served", ko = "선착순")]
    FirstCome,
    #[translate(en = "Random", ko = "랜덤")]
    Random,
}

/// Lifecycle of one population member.
///
/// `Population` members satisfy the population rules; `Selected` members
/// were drawn by the random method; `Entered` members took a seat and count
/// toward the sample.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[cfg_attr(
    feature = "server",
    derive(rmcp::schemars::JsonSchema, postgres::PostgresEnum)
)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub enum SamplingMemberStatus {
    #[default]
    Population,
    Selected,
    Entered,
}

/// What the signed-in user sees on the Sampling entry card.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub enum MySamplingState {
    /// Has not answered the entry poll and recruiting is still open.
    #[default]
    NotAnswered,
    /// Has not answered the entry poll and recruiting is closed.
    RecruitClosed,
    /// Answered, but the answers fail the population rules.
    NotEligible,
    /// In the population; sampling has not started yet.
    Waiting,
    /// First come: a seat is free in the member's cell.
    CanEnter,
    /// First come: the member's cell is already full.
    CellFull,
    /// Random: drawn into the sample and may enter.
    Selected,
    /// Random: not drawn into the sample.
    NotSelected,
    /// Took a seat; counts toward the sample.
    Entered,
    /// The space is ongoing, late joining is off and the user never entered.
    SampleClosed,
    /// The space is ongoing with late joining on, so sampling no longer
    /// restricts participation.
    ParticipationOpen,
}
