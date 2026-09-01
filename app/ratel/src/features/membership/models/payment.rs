use crate::features::membership::models::MembershipTier;
use crate::features::membership::*;
#[cfg(feature = "server")]
use crate::social::pages::membership::user::controllers::PurchaseHistoryItem;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use std::str::FromStr;
use uuid::Uuid;

#[cfg(feature = "server")]
use crate::features::membership::models::PurchaseEntity;
#[cfg(feature = "server")]
use crate::features::membership::services::portone::PortOne;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct CardInfo {
    pub card_number: String,
    pub expiry_year: String,
    pub expiry_month: String,
    pub birth_or_business_registration_number: String,
    pub password_two_digits: String,
}

/// Purchase currency. Unit-variant enum stored as a `TEXT` column
/// (`#[postgres(text)]`); the wire form is still driven by the manual
/// `Display`/`FromStr` below (`"USD"`/`"KRW"`).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, SerializeDisplay, DeserializeFromStr)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[cfg_attr(feature = "server", postgres(text))]
pub enum Currency {
    #[default]
    Usd,
    Krw,
}

impl std::fmt::Display for Currency {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let value = match self {
            Currency::Usd => "USD",
            Currency::Krw => "KRW",
        };
        f.write_str(value)
    }
}

impl std::str::FromStr for Currency {
    type Err = Error;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s.to_ascii_uppercase().as_str() {
            "USD" => Ok(Currency::Usd),
            "KRW" => Ok(Currency::Krw),
            _ => {
                crate::error!("invalid currency: {s}");
                Err(
                    crate::features::membership::types::MembershipPaymentError::InvalidCurrency
                        .into(),
                )
            }
        }
    }
}

/// Purchase lifecycle status. Unit-variant enum → `TEXT` column.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default, DynamoEnum, Eq, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[cfg_attr(feature = "server", postgres(text))]
pub enum PurchaseStatus {
    #[default]
    Success,
    Scheduled,
    Canceled,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, Default, DynamoEnum)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub enum TransactionType {
    #[default]
    None,
    PurchaseMembership(MembershipTier),
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct PaymentReceipt {
    pub id: String,
    pub paid_at: i64,
    pub tx_type: TransactionType,
    pub currency: Currency,
    pub tx_id: String,
    pub amount: i64,
}

/// One row per user purchase / payment attempt.
///
/// Postgres migration: DynamoDB `pk = <user>##PURCHASE` + `sk =
/// UserPurchase(uuid)` collapses to a surrogate `id` PK with `user_pk` holding
/// the owning user's `Partition` string. **This model shares the physical
/// `user_purchases` table with the social feature's read-side mirror
/// `UserPurchaseLocal` (schema owner), hence `skip_schema`** — its columns
/// (names + SQL types) mirror that model exactly so the reader hydrates
/// membership-written rows. The payload-carrying `TransactionType` can't be a
/// native PG enum, so `tx_type` is flattened to its `Display` string
/// (reversible via `TransactionType::from_str`), matching the mirror.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "user_purchases", skip_schema))]
pub struct UserPurchase {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub user_pk: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,

    #[cfg_attr(feature = "server", postgres(index))]
    pub status: PurchaseStatus,
    pub tx_type: String,
    pub amount: i64,
    pub currency: Currency,
    #[cfg_attr(feature = "server", postgres(index))]
    pub payment_id: String,
    pub tx_id: String,
}

#[cfg(feature = "server")]
impl UserPurchase {
    /// `user_pk` is the owning user's full `Partition` string (`USER#…`).
    pub fn new(
        user_pk: String,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
        payment_id: String,
        tx_id: String,
    ) -> Self {
        let created_at = crate::common::utils::time::now();

        Self {
            id: Uuid::now_v7(),
            user_pk,
            tx_type: tx_type.to_string(),
            amount,
            created_at,
            payment_id,
            tx_id,
            currency,
            status: PurchaseStatus::Success,
        }
    }

    pub fn with_status(mut self, status: PurchaseStatus) -> Self {
        self.status = status;
        self
    }

    /// All purchase rows carrying a given PortOne `payment_id`
    /// (replaces the `find_by_payment_id` GSI).
    pub async fn find_by_payment_id(payment_id: &str) -> Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(UserPurchase::repository()
            .find(UserPurchase::query().payment_id(StringOp::Eq(payment_id.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// A user's scheduled (pending-renewal) purchases
    /// (replaces the `find_by_status` GSI scoped to `Scheduled`).
    pub async fn find_scheduled_for_user(user_pk: &str) -> Result<Vec<Self>> {
        use postgres::ops::{EnumOp, StringOp};
        Ok(UserPurchase::repository()
            .find(
                UserPurchase::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .status(EnumOp::Eq(PurchaseStatus::Scheduled)),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// A user's purchase history, newest first. `page` is 1-based. Replaces the
    /// DynamoDB `find_by_user` query (`scan_index_forward(false)`, limit 20).
    pub async fn find_by_user_page(
        user_pk: &str,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        use postgres::ops::StringOp;
        UserPurchase::repository()
            .find(
                UserPurchase::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .order_by(UserPurchaseColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }
}

#[cfg(feature = "server")]
impl From<UserPurchase> for PaymentReceipt {
    fn from(purchase: UserPurchase) -> Self {
        Self {
            id: purchase.payment_id,
            paid_at: purchase.created_at,
            tx_type: TransactionType::from_str(&purchase.tx_type).unwrap_or_default(),
            currency: purchase.currency,
            tx_id: purchase.tx_id,
            amount: purchase.amount,
        }
    }
}

#[cfg(feature = "server")]
#[async_trait::async_trait]
impl PurchaseEntity for UserPurchase {
    async fn insert_in_tx(&self, tx: &postgres::Tx) -> Result<()> {
        UserPurchase::repository()
            .with_tx(tx)
            .insert(self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }
}

/// One payment profile per user (`unique(user_pk)`).
///
/// Postgres migration: DynamoDB `pk = <user>##PAYMENT` + `sk = Created(ts)`
/// collapses to a surrogate `id` with `unique(user_pk)`; the `Created(ts)` sort
/// key becomes the `created_at` column.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "user_payments", unique(user_pk)))]
pub struct UserPayment {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub user_pk: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,

    pub billing_key: Option<String>,
    pub customer_id: String,
    pub name: String,
    pub birth_date: String,
    #[serde(default)]
    pub masked_card_number: Option<String>,
}

#[cfg(feature = "server")]
impl UserPayment {
    pub fn new(user_pk: Partition, customer_id: String, name: String, birth_date: String) -> Self {
        let now = crate::common::utils::time::now();
        Self {
            id: Uuid::now_v7(),
            user_pk: user_pk.to_string(),
            created_at: now,
            customer_id,
            name,
            birth_date,
            billing_key: None,
            masked_card_number: None,
        }
    }

    /// Stable per-user identifier registered with PortOne when issuing the
    /// billing key. Reproduces the former `CompositePartition(user, Payment)`
    /// key string so behavior is unchanged.
    pub fn billing_customer_key(&self) -> String {
        format!("{}##PAYMENT", self.user_pk)
    }

    /// Natural-key upsert on `user_pk`, preserving the surrogate `id`.
    pub async fn save(&self) -> Result<()> {
        UserPayment::repository()
            .upsert_on(&["user_pk"], self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    /// The single payment profile for a user (by full `Partition` string).
    pub async fn find_by_user_pk(user_pk: &str) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        UserPayment::repository()
            .find_one(UserPayment::query().user_pk(StringOp::Eq(user_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn get_by_user(
        portone: &PortOne,
        user_pk: UserPartition,
        card_info: Option<CardInfo>,
    ) -> Result<(Self, bool)> {
        use postgres::ops::StringOp;
        let owner: Partition = user_pk.into();
        let mut user_payment: UserPayment = UserPayment::repository()
            .find_one(UserPayment::query().user_pk(StringOp::Eq(owner.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .ok_or_else(|| Error::NotFound("User payment not found".to_string()))?;

        let mut should_update = false;

        if user_payment.billing_key.is_none() {
            let CardInfo {
                card_number,
                expiry_year,
                expiry_month,
                birth_or_business_registration_number,
                password_two_digits,
            } = card_info.ok_or_else(|| {
                Error::from(
                    crate::features::membership::types::MembershipPaymentError::MissingCardInfo,
                )
            })?;

            // Store masked card number before passing to Portone
            let digits: String = card_number.chars().filter(|c| c.is_ascii_digit()).collect();
            let last4 = if digits.len() >= 4 {
                &digits[digits.len() - 4..]
            } else {
                "****"
            };
            user_payment.masked_card_number = Some(format!("****-****-****-{last4}"));

            let res = portone
                .get_billing_key(
                    user_payment.billing_customer_key(),
                    user_payment.name.clone(),
                    card_number,
                    expiry_year,
                    expiry_month,
                    birth_or_business_registration_number,
                    password_two_digits,
                )
                .await?;

            user_payment.billing_key = Some(res.billing_key_info.billing_key.clone());
            should_update = true;
        }

        Ok((user_payment, should_update))
    }

    pub async fn purchase(
        &self,
        portone: &PortOne,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
    ) -> Result<UserPurchase> {
        let (res, payment_id) = portone
            .pay_with_billing_key(
                self.customer_id.clone(),
                self.name.clone(),
                tx_type.to_string(),
                self.billing_key.clone().unwrap_or_default(),
                amount,
                currency,
            )
            .await?;

        Ok(UserPurchase::new(
            self.user_pk.clone(),
            tx_type,
            amount,
            currency,
            payment_id,
            res.payment.pg_tx_id,
        ))
    }

    pub async fn schedule_next_membership_purchase(
        &self,
        portone: &PortOne,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
        time_to_pay: String,
    ) -> Result<UserPurchase> {
        let (res, payment_id) = portone
            .schedule_pay_with_billing_key(
                self.customer_id.clone(),
                self.name.clone(),
                tx_type.to_string(),
                self.billing_key.clone().unwrap_or_default(),
                amount,
                currency,
                time_to_pay,
            )
            .await?;

        Ok(UserPurchase::new(
            self.user_pk.clone(),
            tx_type,
            amount,
            currency,
            payment_id,
            res.schedule.id,
        )
        .with_status(PurchaseStatus::Scheduled))
    }

    pub async fn cancel_scheduled_payments(&self, portone: &PortOne) -> Result<()> {
        if self.billing_key.is_none() {
            return Err(
                crate::features::membership::types::MembershipPaymentError::MissingBillingKey
                    .into(),
            );
        }

        let _ = portone
            .cancel_schedule_with_billing_key(self.billing_key.clone().unwrap())
            .await?;

        let scheduled = UserPurchase::find_scheduled_for_user(&self.user_pk).await?;
        let mut purchase = match scheduled.into_iter().next() {
            Some(item) => item,
            None => return Ok(()),
        };
        purchase.status = PurchaseStatus::Canceled;

        // Preserve the original at-least-once semantics: retry the status write
        // until it succeeds (was a DynamoDB conditional-update retry loop).
        while let Err(err) = UserPurchase::repository().upsert(&purchase).await {
            error!(
                "Failed to update purchase status to Canceled: {:?}, retrying...",
                err
            );
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }

        Ok(())
    }

    pub async fn upsert_in_tx(&self, tx: &postgres::Tx) -> Result<()> {
        UserPayment::repository()
            .with_tx(tx)
            .upsert_on(&["user_pk"], self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }
}

// ── Team Payment & Purchase ──────────────────────────────────────────

/// One row per team purchase / payment attempt. Mirrors [`UserPurchase`] but
/// owns its own `team_purchases` schema (no external read-side mirror).
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "team_purchases"))]
pub struct TeamPurchase {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub team_pk: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,

    #[cfg_attr(feature = "server", postgres(index))]
    pub status: PurchaseStatus,
    pub tx_type: String,
    pub amount: i64,
    pub currency: Currency,
    #[cfg_attr(feature = "server", postgres(index))]
    pub payment_id: String,
    pub tx_id: String,
}

#[cfg(feature = "server")]
impl TeamPurchase {
    /// `team_pk` is the owning team's full `Partition` string (`TEAM#…`).
    pub fn new(
        team_pk: String,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
        payment_id: String,
        tx_id: String,
    ) -> Self {
        let created_at = crate::common::utils::time::now();

        Self {
            id: Uuid::now_v7(),
            team_pk,
            tx_type: tx_type.to_string(),
            amount,
            created_at,
            payment_id,
            tx_id,
            currency,
            status: PurchaseStatus::Success,
        }
    }

    pub fn with_status(mut self, status: PurchaseStatus) -> Self {
        self.status = status;
        self
    }

    pub async fn find_by_payment_id(payment_id: &str) -> Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(TeamPurchase::repository()
            .find(TeamPurchase::query().payment_id(StringOp::Eq(payment_id.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    pub async fn find_scheduled_for_team(team_pk: &str) -> Result<Vec<Self>> {
        use postgres::ops::{EnumOp, StringOp};
        Ok(TeamPurchase::repository()
            .find(
                TeamPurchase::query()
                    .team_pk(StringOp::Eq(team_pk.to_string()))
                    .status(EnumOp::Eq(PurchaseStatus::Scheduled)),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// A team's purchase history, newest first. `page` is 1-based.
    pub async fn find_by_team_page(
        team_pk: &str,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        use postgres::ops::StringOp;
        TeamPurchase::repository()
            .find(
                TeamPurchase::query()
                    .team_pk(StringOp::Eq(team_pk.to_string()))
                    .order_by(TeamPurchaseColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }
}

#[cfg(feature = "server")]
impl From<TeamPurchase> for PaymentReceipt {
    fn from(purchase: TeamPurchase) -> Self {
        Self {
            id: purchase.payment_id,
            paid_at: purchase.created_at,
            tx_type: TransactionType::from_str(&purchase.tx_type).unwrap_or_default(),
            currency: purchase.currency,
            tx_id: purchase.tx_id,
            amount: purchase.amount,
        }
    }
}

#[cfg(feature = "server")]
impl From<TeamPurchase> for PurchaseHistoryItem {
    fn from(purchase: TeamPurchase) -> Self {
        PurchaseHistoryItem {
            created_at: purchase.created_at,
            tx_type: purchase.tx_type,
            amount: purchase.amount,
            payment_id: purchase.payment_id,
            tx_id: purchase.tx_id,
        }
    }
}

#[cfg(feature = "server")]
#[async_trait::async_trait]
impl PurchaseEntity for TeamPurchase {
    async fn insert_in_tx(&self, tx: &postgres::Tx) -> Result<()> {
        TeamPurchase::repository()
            .with_tx(tx)
            .insert(self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }
}

/// One payment profile per team (`unique(team_pk)`). Mirrors [`UserPayment`].
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "team_payments", unique(team_pk)))]
pub struct TeamPayment {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub team_pk: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,

    pub billing_key: Option<String>,
    pub customer_id: String,
    pub name: String,
    pub birth_date: String,
    #[serde(default)]
    pub masked_card_number: Option<String>,
}

#[cfg(feature = "server")]
impl TeamPayment {
    pub fn new(team_pk: Partition, customer_id: String, name: String, birth_date: String) -> Self {
        let now = crate::common::utils::time::now();
        Self {
            id: Uuid::now_v7(),
            team_pk: team_pk.to_string(),
            created_at: now,
            customer_id,
            name,
            birth_date,
            billing_key: None,
            masked_card_number: None,
        }
    }

    pub fn billing_customer_key(&self) -> String {
        format!("{}##PAYMENT", self.team_pk)
    }

    pub async fn save(&self) -> Result<()> {
        TeamPayment::repository()
            .upsert_on(&["team_pk"], self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    /// The single payment profile for a team (by full `Partition` string).
    pub async fn find_by_team_pk(team_pk: &str) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        TeamPayment::repository()
            .find_one(TeamPayment::query().team_pk(StringOp::Eq(team_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn get_by_team(
        portone: &PortOne,
        team_pk: TeamPartition,
        card_info: Option<CardInfo>,
    ) -> Result<(Self, bool)> {
        use postgres::ops::StringOp;
        let owner: Partition = team_pk.into();
        let mut team_payment: TeamPayment = TeamPayment::repository()
            .find_one(TeamPayment::query().team_pk(StringOp::Eq(owner.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .ok_or_else(|| Error::NotFound("Team payment not found".to_string()))?;

        let mut should_update = false;

        if team_payment.billing_key.is_none() {
            let CardInfo {
                card_number,
                expiry_year,
                expiry_month,
                birth_or_business_registration_number,
                password_two_digits,
            } = card_info.ok_or_else(|| {
                Error::from(
                    crate::features::membership::types::MembershipPaymentError::MissingCardInfo,
                )
            })?;

            let digits: String = card_number.chars().filter(|c| c.is_ascii_digit()).collect();
            let last4 = if digits.len() >= 4 {
                &digits[digits.len() - 4..]
            } else {
                "****"
            };
            team_payment.masked_card_number = Some(format!("****-****-****-{last4}"));

            let res = portone
                .get_billing_key(
                    team_payment.billing_customer_key(),
                    team_payment.name.clone(),
                    card_number,
                    expiry_year,
                    expiry_month,
                    birth_or_business_registration_number,
                    password_two_digits,
                )
                .await?;

            team_payment.billing_key = Some(res.billing_key_info.billing_key.clone());
            should_update = true;
        }

        Ok((team_payment, should_update))
    }

    pub async fn purchase(
        &self,
        portone: &PortOne,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
    ) -> Result<TeamPurchase> {
        let (res, payment_id) = portone
            .pay_with_billing_key(
                self.customer_id.clone(),
                self.name.clone(),
                tx_type.to_string(),
                self.billing_key.clone().unwrap_or_default(),
                amount,
                currency,
            )
            .await?;

        Ok(TeamPurchase::new(
            self.team_pk.clone(),
            tx_type,
            amount,
            currency,
            payment_id,
            res.payment.pg_tx_id,
        ))
    }

    pub async fn schedule_next_membership_purchase(
        &self,
        portone: &PortOne,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
        time_to_pay: String,
    ) -> Result<TeamPurchase> {
        let (res, payment_id) = portone
            .schedule_pay_with_billing_key(
                self.customer_id.clone(),
                self.name.clone(),
                tx_type.to_string(),
                self.billing_key.clone().unwrap_or_default(),
                amount,
                currency,
                time_to_pay,
            )
            .await?;

        Ok(TeamPurchase::new(
            self.team_pk.clone(),
            tx_type,
            amount,
            currency,
            payment_id,
            res.schedule.id,
        )
        .with_status(PurchaseStatus::Scheduled))
    }

    pub async fn cancel_scheduled_payments(&self, portone: &PortOne) -> Result<()> {
        if self.billing_key.is_none() {
            return Err(
                crate::features::membership::types::MembershipPaymentError::MissingBillingKey
                    .into(),
            );
        }

        let _ = portone
            .cancel_schedule_with_billing_key(self.billing_key.clone().unwrap())
            .await?;

        let scheduled = TeamPurchase::find_scheduled_for_team(&self.team_pk).await?;
        let mut purchase = match scheduled.into_iter().next() {
            Some(item) => item,
            None => return Ok(()),
        };
        purchase.status = PurchaseStatus::Canceled;

        while let Err(err) = TeamPurchase::repository().upsert(&purchase).await {
            error!(
                "Failed to update team purchase status to Canceled: {:?}, retrying...",
                err
            );
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }

        Ok(())
    }

    pub async fn upsert_in_tx(&self, tx: &postgres::Tx) -> Result<()> {
        TeamPayment::repository()
            .with_tx(tx)
            .upsert_on(&["team_pk"], self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }
}
