use crate::common::models::auth::User;
use crate::common::models::space::SpaceCommon;
use crate::features::spaces::pages::apps::apps::analyzes::*;
use crate::features::spaces::pages::apps::models::SpaceApp;
use crate::features::spaces::pages::apps::types::SpaceAppError;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct CreateAnalyzeReportRequest {
    pub name: String,
    pub filters: Vec<AnalyzeReportFilter>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct CreateAnalyzeReportResponse {
    pub report_id: String,
}

/// Persist a new analyze report with `status = InProgress`. The actual
/// LDA / TF-IDF / poll-quiz aggregation pipeline (next stage) reads the
/// stored `filters` off this row, writes its result fields back onto
/// the same row, and flips `status` to `Finish`. The response carries
/// just the new id so the client can navigate to the detail view (or
/// stay on the list and watch the badge update).
///
/// Quota gate: non-Enterprise spaces are capped at
/// `AnalyzeQuotaConfig::non_enterprise_limit` reports per space (default
/// 2). Enterprise tier is unlimited. The Enterprise check attaches to
/// the **space owner** (the user or team that created the space), not
/// the calling user — otherwise a non-paying team member acting on a
/// team's Enterprise space would be wrongly capped, and an Enterprise
/// user would bypass a non-Enterprise team's quota. Limit is
/// admin-tunable through `PUT /api/admin/analyze-quota`.
#[mcp_tool(
    name = "create_analyze_report",
    description = "Create a new analyze report on a space. The pipeline computes poll/quiz/follow aggregates asynchronously; the response only returns the new report id. Quota gated for non-Enterprise space owners. Requires creator role."
)]
#[post("/api/spaces/{space_id}/apps/analyzes/reports", user: User, role: SpaceUserRole, space: SpaceCommon)]
pub async fn create_analyze_report(
    #[mcp(description = "Space partition key")] space_id: SpacePartition,
    #[mcp(
        description = "Report payload as JSON, e.g. {\"name\": \"My Report\", \"filters\": [{\"name\": \"...\", \"items\": [...]}]}"
    )]
    req: CreateAnalyzeReportRequest,
) -> Result<CreateAnalyzeReportResponse> {
    SpaceApp::can_edit(role)?;
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();
    let space_pk: Partition = space_id.clone().into();

    let trimmed_name = req.name.trim();
    if trimmed_name.is_empty() {
        return Err(Error::InvalidFormat);
    }

    let owner_pk: Partition = space.user_pk.parse().unwrap_or_default();
    if !is_enterprise_owner(&owner_pk).await? {
        let limit = AnalyzeQuotaConfig::get_limit().await.map_err(|e| {
            crate::error!("create_analyze_report: failed to read quota config: {e}");
            Error::Internal
        })?;
        let used = SpaceAnalyzeReport::count_by_space(&space_pk).await?;
        if used >= limit {
            return Err(SpaceAppError::AnalyzeQuotaExceeded.into());
        }
    }

    // Run the same matching the preview API uses, but capture the row
    // refs alongside the count so the records page can hydrate them
    // later. Empty filters → no records to capture (the empty-filter
    // case is rejected by the wizard's Next button anyway).
    let matched_records = if req.filters.is_empty() {
        Vec::new()
    } else {
        let (_intersection, _data_count, records) =
            services::intersection::intersect_filters(cli, &space_pk, &req.filters).await?;
        records
    };

    let report = SpaceAnalyzeReport::new(
        space_id,
        trimmed_name.to_string(),
        req.filters,
        matched_records,
    );
    let report_id = report.report_id();

    SpaceAnalyzeReport::repository()
        .insert(&report)
        .await
        .map_err(|e| {
            crate::error!("failed to create analyze report: {e}");
            Error::Internal
        })?;

    Ok(CreateAnalyzeReportResponse { report_id })
}

/// Treats the space owner as Enterprise when the matching membership
/// row's `membership_pk` stringifies to anything containing
/// `Enterprise`. Same cheap string check `UserMembershipResponse::is_paid`
/// uses for the "is paying" predicate — avoids loading the parent
/// `Membership` entity just to read the tier.
///
/// Routes the lookup by `Partition` variant: `User(_)` reads
/// `UserMembership`, `Team(_)` reads `TeamMembership`. Anything else
/// (defensive — `SpaceCommon.user_pk` should only ever be one of those
/// two) returns `false` so the quota still applies.
#[cfg(feature = "server")]
async fn is_enterprise_owner(owner_pk: &Partition) -> Result<bool> {
    use crate::features::membership::models::{MembershipTier, TeamMembership, UserMembership};
    match owner_pk {
        Partition::User(_) => {
            let row = UserMembership::find_by_user(&owner_pk.to_string()).await?;
            Ok(row
                .map(|m| matches!(m.membership_pk, MembershipTier::Enterprise(_)))
                .unwrap_or(false))
        }
        Partition::Team(_) => {
            let row = TeamMembership::find_by_team(&owner_pk.to_string()).await?;
            Ok(row
                .map(|m| matches!(m.membership_pk, MembershipTier::Enterprise(_)))
                .unwrap_or(false))
        }
        _ => Ok(false),
    }
}

