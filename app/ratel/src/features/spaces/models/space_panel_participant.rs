use crate::features::spaces::*;
use postgres::PostgresEntity;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// One panel-participation record: a user counted against a space's panel.
///
/// Postgres migration: the DynamoDB identity was `pk = Space(space_id)` +
/// `sk = SpacePanelParticipant(user_pk)`, with GSIs `find_by_user_pk`
/// (`user_pk`) and `find_by_space_and_user` (`space_pk` + `user_pk`). It
/// collapses to the natural key `(space_id, user_pk)` (composite UNIQUE) on a
/// surrogate `id` PK; both former GSIs become plain indexed-column queries.
///
/// `space_id` (spaces) and `user_pk` (users, stored as the full `Partition`
/// string `USER#…`) are cross-feature references — plain columns, **no FK**.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "space_panel_participants", unique(space_id, user_pk))]
pub struct SpacePanelParticipant {
    pub id: Uuid,

    /// Cross-feature reference to the space (bare id).
    #[postgres(index)]
    pub space_id: String,
    /// Participant as full `Partition` string (`USER#…`).
    #[postgres(index)]
    pub user_pk: String,

    pub display_name: String,
    pub profile_url: String,
    pub username: String,
}

impl SpacePanelParticipant {
    pub fn new(space_pk: Partition, user: User) -> Self {
        let User {
            display_name,
            profile_url,
            username,
            ..
        } = user.clone();
        Self {
            id: Uuid::now_v7(),
            space_id: Self::space_id_of(&space_pk),
            user_pk: user.pk().to_string(),
            display_name,
            profile_url,
            username,
        }
    }

    fn space_id_of(space_pk: &Partition) -> String {
        match space_pk {
            Partition::Space(id) => id.clone(),
            other => other.to_string(),
        }
    }

    /// The participation row for `(space, user)`, if present.
    pub async fn get_for(
        space_pk: &Partition,
        user_pk: &Partition,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(Self::space_id_of(space_pk)))
                    .user_pk(StringOp::Eq(user_pk.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Idempotent create — natural-key upsert on `(space_id, user_pk)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["space_id", "user_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
