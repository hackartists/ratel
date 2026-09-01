//! A reviewer/QA test account. App-store and Play-store reviewers can't receive
//! real verification emails, so listed emails skip email delivery and accept the
//! fixed verification code "000000" at login — at runtime, without the
//! compile-time `bypass` feature (which is never shipped to production).
//!
//! Postgres migration: the DynamoDB singleton partition (`pk = TestAccount`,
//! `sk = TestAccount(email)`) collapses onto a surrogate `id` PK with the email
//! as the `unique(email)` natural key — the full list is a plain table scan and
//! existence is an indexed point lookup.
#![cfg(feature = "server")]

use crate::common::*;
use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PostgresEntity, PartialEq)]
#[postgres(table = "test_accounts", unique(email))]
pub struct TestAccount {
    /// Surrogate primary key (minted `now_v7` on insert when nil).
    pub id: Uuid,

    #[postgres(index)]
    pub email: String,
    /// Free-form admin note, e.g. "App Store reviewer".
    pub note: String,
    #[postgres(order)]
    pub created_at: i64,
}

impl TestAccount {
    pub fn new(email: String, note: String) -> Self {
        Self {
            id: Uuid::now_v7(),
            email,
            note,
            created_at: crate::common::utils::time::now(),
        }
    }

    /// True when `email` is registered as a reviewer test account. Email match
    /// is case-insensitive (emails are stored lowercased by the controller).
    pub async fn is_test_account(email: &str) -> bool {
        let key = email.trim().to_lowercase();
        matches!(
            Self::repository()
                .find_one(Self::query().email(StringOp::Eq(key)))
                .await,
            Ok(Some(_))
        )
    }

    /// Every registered test account, newest first (replaces the old
    /// single-partition query).
    pub async fn list(limit: i64) -> Result<Vec<Self>> {
        Ok(Self::repository()
            .find(
                Self::query()
                    .order_by(TestAccountColumn::CreatedAt, postgres::Order::Desc)
                    .page(1)
                    .page_size(limit),
            )
            .await
            .map_err(Error::from)?
            .items)
    }

    /// Delete a test account by email; idempotent (missing → `Ok`).
    pub async fn delete_by_email(email: &str) -> Result<Option<Self>> {
        let key = email.trim().to_lowercase();
        let Some(row) = Self::repository()
            .find_one(Self::query().email(StringOp::Eq(key)))
            .await
            .map_err(Error::from)?
        else {
            return Ok(None);
        };
        Self::repository()
            .delete(row.id)
            .await
            .map_err(Error::from)?;
        Ok(Some(row))
    }
}
