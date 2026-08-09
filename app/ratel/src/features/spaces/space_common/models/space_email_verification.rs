use crate::common::models::notification::Notification;
use crate::common::models::space::SpaceCommon;
use crate::common::utils::time::get_now_timestamp;
use crate::features::spaces::space_common::*;
use postgres::PostgresEntity;
use uuid::Uuid;

const EXPIRATION_TIME: u64 = 1800; // 30 minutes
const MAX_ATTEMPT_COUNT: i32 = 5;

/// Per-(space, email) verification code for space invitations.
///
/// Postgres migration: the DynamoDB identity was `pk = Space(space_id)` +
/// `sk = SpaceEmailVerification(email)`. It becomes the natural key
/// `(space_pk, email)` (composite UNIQUE) on a surrogate `id` PK. `space_pk`
/// is a cross-feature reference stored as the full `Partition` string
/// (`"SPACE#…"`) — plain column, **no FK**.
#[derive(Debug, Clone, Serialize, Deserialize, PostgresEntity, Default)]
#[postgres(table = "space_email_verifications", unique(space_pk, email))]
pub struct SpaceEmailVerification {
    pub id: Uuid,

    /// Cross-feature reference to the space, full `Partition` string.
    #[postgres(index)]
    pub space_pk: String,

    #[postgres(order)]
    pub created_at: i64,
    pub email: String,
    pub value: String,
    pub expired_at: i64,
    pub attempt_count: i32,

    pub authorized: bool,
}

impl SpaceEmailVerification {
    pub fn new(space_pk: Partition, email: String, value: String, expired_at: i64) -> Self {
        let created_at = chrono::Utc::now().timestamp_micros();

        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            email,
            created_at,
            value,
            expired_at,
            attempt_count: 0,
            authorized: false,
        }
    }
}

impl SpaceEmailVerification {
    /// The verification row for `(space, email)`, if present.
    pub async fn get_for(space_pk: &Partition, email: &str) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .email(StringOp::Eq(email.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Expire every outstanding verification for a space in one atomic
    /// `UPDATE … SET expired_at = $now`. Mirrors the original bulk transact
    /// that stamped `expired_at` across all rows.
    pub async fn expire_verifications(space_pk: Partition) -> Result<()> {
        use postgres::Value;
        use postgres::sqlx::{Postgres, QueryBuilder};

        let expired_at = get_now_timestamp();
        let table = Self::table_name();

        let mut qb =
            QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET expired_at = "));
        Value::from(expired_at).push_bind(&mut qb);
        qb.push(" WHERE space_pk = ");
        Value::from(space_pk.to_string()).push_bind(&mut qb);

        Self::repository().db().execute(qb).await.map_err(|e| {
            crate::error!("Failed to update verifications: {:?}", e);
            SpaceError::EmailVerificationFailed
        })?;

        Ok(())
    }

    pub async fn upsert_verification(
        space_pk: Partition,
        user_email: String,
    ) -> Result<SpaceEmailVerification> {
        let existing = Self::get_for(&space_pk, &user_email).await?;

        let now = get_now_timestamp();

        let verification = match existing {
            Some(v) if v.expired_at > now && v.attempt_count < MAX_ATTEMPT_COUNT => v,
            Some(mut v) => {
                let code = Self::generate_random_code();
                let expired_at = now + EXPIRATION_TIME as i64;

                v.attempt_count = 0;
                v.value = code.clone();
                v.expired_at = expired_at;
                Self::repository()
                    .upsert_on(&["space_pk", "email"], &v)
                    .await
                    .map_err(crate::common::Error::from)?;
                v
            }
            None => {
                let code = Self::generate_random_code();
                let expired_at = now + EXPIRATION_TIME as i64;

                let v = SpaceEmailVerification::new(space_pk.clone(), user_email, code, expired_at);
                Self::repository()
                    .upsert_on(&["space_pk", "email"], &v)
                    .await
                    .map_err(crate::common::Error::from)?;
                v
            }
        };

        Ok(verification)
    }

    pub fn html_excerpt_ellipsis(html: &str, max_chars: usize) -> String {
        let re = regex::Regex::new(r"(?is)<[^>]+>").unwrap();
        let no_tags = re.replace_all(html, "");
        let squashed = no_tags.split_whitespace().collect::<Vec<_>>().join(" ");
        let mut s = String::new();
        for (i, ch) in squashed.chars().enumerate() {
            if i >= max_chars {
                s.push('\u{2026}');
                break;
            }
            s.push(ch);
        }
        s
    }

    /// Send invitation emails by creating a Notification document.
    /// The async worker pipeline sends the actual emails.
    ///
    /// Postgres migration: `Notification` is Postgres-backed now too, so no
    /// DynamoDB client is needed.
    pub async fn send_invitation_emails(
        user_emails: Vec<String>,
        space: &SpaceCommon,
        title: String,
    ) -> Result<()> {
        let mut verifications = Vec::with_capacity(user_emails.len());

        for email in &user_emails {
            let v = Self::upsert_verification(space.partition(), email.clone()).await?;
            verifications.push((email.clone(), v.value.clone()));
        }

        let space_id = match space.partition() {
            Partition::Space(v) => v.to_string(),
            _ => String::new(),
        };

        let conf = crate::config::get();

        let cta_url = format!("{}/spaces/{}", conf.common.env.web_endpoint(), space_id);

        let notification = Notification::new(NotificationData::SendSpaceInvitation {
            emails: user_emails,
            space_title: title,
            space_content: Self::html_excerpt_ellipsis(&space.content, 160),
            author_profile_url: space.author_profile_url.clone(),
            author_username: space.author_username.clone(),
            author_display_name: space.author_display_name.clone(),
            cta_url,
        });
        notification.save().await?;

        Ok(())
    }

    fn generate_random_code() -> String {
        use rand::{Rng, RngExt};
        let charset = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let mut rng = rand::rng();
        (0..6)
            .map(|_| {
                let idx = rng.random_range(0..charset.len());
                charset[idx] as char
            })
            .collect()
    }
}
