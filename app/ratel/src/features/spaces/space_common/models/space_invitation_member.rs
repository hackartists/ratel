use crate::features::spaces::space_common::*;
#[cfg(feature = "server")]
use crate::common::models::User;
#[cfg(feature = "server")]
use crate::common::models::space::SpaceCommon;
#[cfg(feature = "server")]
use crate::common::utils::time::get_now_timestamp_millis;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[cfg(feature = "server")]
use super::SpaceEmailVerification;

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    serde_repr::Serialize_repr,
    serde_repr::Deserialize_repr,
    Default,
    DynamoEnum,
)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[repr(u8)]
pub enum InvitationStatus {
    #[default]
    Pending = 1,
    Invited = 2,
    Accepted = 3,
    Declined = 4,
}

/// Per-(space, invitee) invitation row.
///
/// Postgres migration: the DynamoDB identity was `pk = Space(space_id)` +
/// `sk = SpaceInvitationMember(user_pk)` (+ by-user / by-status GSIs). It
/// becomes the natural key `(space_pk, user_pk)` (composite UNIQUE) on a
/// surrogate `id` PK; the GSIs become plain indexed-column queries. `space_pk`
/// / `user_pk` are cross-feature references stored as full `Partition` strings
/// (`"SPACE#…"` / `"USER#…"`) — plain columns, **no FK**.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "space_invitation_members", unique(space_pk, user_pk))]
pub struct SpaceInvitationMember {
    pub id: uuid::Uuid,

    #[postgres(index)]
    pub space_pk: String,
    #[postgres(index)]
    pub user_pk: String,

    pub display_name: String,
    pub profile_url: String,
    pub username: String,
    pub email: String,
    pub status: InvitationStatus,

    #[serde(default)]
    #[postgres(order)]
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SpaceInvitationMemberResponse {
    pub user_pk: Partition,
    pub display_name: String,
    pub profile_url: String,
    pub username: String,
    pub email: String,
    pub authorized: bool,
}

#[cfg(feature = "server")]
impl From<SpaceInvitationMember> for SpaceInvitationMemberResponse {
    fn from(member: SpaceInvitationMember) -> Self {
        use std::str::FromStr;
        Self {
            user_pk: Partition::from_str(&member.user_pk).unwrap_or_default(),
            display_name: member.display_name,
            profile_url: member.profile_url,
            username: member.username,
            email: member.email,
            authorized: false,
        }
    }
}

#[cfg(feature = "server")]
impl SpaceInvitationMember {
    pub fn new(space_pk: Partition, user: User) -> Self {
        Self {
            id: uuid::Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            user_pk: user.pk().to_string(),
            display_name: user.display_name,
            profile_url: user.profile_url,
            username: user.username,
            email: user.email,
            status: InvitationStatus::Pending,
            created_at: get_now_timestamp_millis(),
        }
    }

    /// The invitation row for `(space, user)`, if present.
    pub async fn get_for(space_pk: &Partition, user_pk: &Partition) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .user_pk(StringOp::Eq(user_pk.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert on `(space_pk, user_pk)`.
    pub async fn save(&self) -> Result<Self> {
        Self::repository()
            .upsert_on(&["space_pk", "user_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Idempotent delete by natural key.
    pub async fn delete_for(space_pk: &Partition, user_pk: &Partition) -> Result<()> {
        if let Some(existing) = Self::get_for(space_pk, user_pk).await? {
            match Self::delete_by_id(existing.id).await {
                Ok(_) | Err(postgres::Error::NotFound) => {}
                Err(e) => return Err(crate::common::Error::from(e)),
            }
        }
        Ok(())
    }

    /// Every invitation row for a space, newest first, page-paginated.
    pub async fn find_by_space(
        space_pk: &Partition,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .order_by(SpaceInvitationMemberColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every invitation for a user, newest first (mirrors the old
    /// `find_user_invitations_by_status_latest` GSI scan).
    pub async fn find_by_user_latest(
        user_pk: &Partition,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find(
                Self::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .order_by(SpaceInvitationMemberColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Move every Pending invitation on a space to Invited (atomic bulk
    /// UPDATE) and fire invitation emails for those invitees.
    pub async fn send_email(space: &SpaceCommon, title: String) -> Result<()> {
        use postgres::Value;
        use postgres::ops::{EnumOp, StringOp};
        use postgres::sqlx::{Postgres, QueryBuilder};

        // Collect the pending invitees' emails before flipping status.
        let pending = Self::repository()
            .find(
                Self::query()
                    .space_pk(StringOp::Eq(space.space_pk.clone()))
                    .status(EnumOp::Eq(InvitationStatus::Pending)),
            )
            .await
            .map_err(crate::common::Error::from)?;

        let emails: Vec<String> = pending.items.iter().map(|m| m.email.clone()).collect();

        // Atomic bulk transition Pending → Invited for this space.
        let table = Self::table_name();
        let mut qb = QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET status = "));
        Value::from(InvitationStatus::Invited).push_bind(&mut qb);
        qb.push(" WHERE space_pk = ");
        Value::from(space.space_pk.clone()).push_bind(&mut qb);
        qb.push(" AND status = ");
        Value::from(InvitationStatus::Pending).push_bind(&mut qb);
        Self::repository().db().execute(qb).await.map_err(|e| {
            crate::error!("Failed to update invitations: {:?}", e);
            SpaceError::EmailVerificationFailed
        })?;

        if !emails.is_empty() {
            SpaceEmailVerification::send_invitation_emails(emails, space, title).await?;
        }

        Ok(())
    }

    /// List a space's invitation members hydrated with their email
    /// verification `authorized` flag.
    pub async fn list_invitation_members(
        space_pk: &Partition,
    ) -> Result<Vec<SpaceInvitationMemberResponse>> {
        use postgres::ops::StringOp;

        let rows = Self::repository()
            .find(Self::query().space_pk(StringOp::Eq(space_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)?;

        let mut members: Vec<SpaceInvitationMemberResponse> = Vec::with_capacity(rows.items.len());
        for response in rows.items {
            let email = response.email.clone();
            let mut member: SpaceInvitationMemberResponse = response.into();

            let verification = SpaceEmailVerification::get_for(space_pk, &email).await?;
            member.authorized = verification.map(|v| v.authorized).unwrap_or(false);

            members.push(member);
        }

        Ok(members)
    }
}
