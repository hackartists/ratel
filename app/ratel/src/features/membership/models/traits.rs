use crate::features::membership::models::{
    Currency, Membership, MembershipTier, PaymentReceipt, TransactionType, UserMembership,
    UserPayment,
};
use crate::features::membership::services::portone::PortOne;
use crate::features::membership::*;

/// A user's or team's membership row, abstracted so the upgrade/downgrade flow
/// can be written once. Postgres writes go through the natural-key upsert
/// helpers (`save` / `save_in_tx`) instead of DynamoDB `TransactWriteItem`s.
#[async_trait::async_trait]
pub trait MembershipEntity: Clone + Send + Sync {
    fn membership_pk(&self) -> &MembershipTier;
    fn set_membership_pk(&mut self, pk: MembershipTier);
    fn next_membership(&self) -> Option<&MembershipTier>;
    fn set_next_membership(&mut self, pk: Option<MembershipTier>);
    fn expired_at(&self) -> i64;
    fn set_updated_at(&mut self, timestamp: i64);
    fn calculate_remaining_duration_days(&self) -> i32;

    /// Natural-key upsert (standalone).
    async fn save(&self) -> Result<()>;
    /// Natural-key upsert within an open transaction.
    async fn save_in_tx(&self, tx: &postgres::Tx) -> Result<()>;

    fn is_infinite(&self) -> bool {
        self.expired_at() == i64::MAX
    }
}

#[async_trait::async_trait]
pub trait PaymentEntity: Clone + Send + Sync {
    type Purchase: PurchaseEntity;

    async fn purchase(
        &self,
        portone: &PortOne,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
    ) -> Result<Self::Purchase>;

    async fn schedule_next_membership_purchase(
        &self,
        portone: &PortOne,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
        scheduled_at: String,
    ) -> Result<Self::Purchase>;

    async fn cancel_scheduled_payments(&self, portone: &PortOne) -> Result<()>;

    /// Natural-key upsert of the payment profile within an open transaction.
    async fn upsert_in_tx(&self, tx: &postgres::Tx) -> Result<()>;
}

#[async_trait::async_trait]
pub trait PurchaseEntity: Clone + Send + Sync + Into<PaymentReceipt> {
    /// Insert the purchase row within an open transaction.
    async fn insert_in_tx(&self, tx: &postgres::Tx) -> Result<()>;
}

#[async_trait::async_trait]
impl PaymentEntity for UserPayment {
    type Purchase = crate::features::membership::models::UserPurchase;

    async fn purchase(
        &self,
        portone: &PortOne,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
    ) -> Result<Self::Purchase> {
        self.purchase(portone, tx_type, amount, currency).await
    }

    async fn schedule_next_membership_purchase(
        &self,
        portone: &PortOne,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
        scheduled_at: String,
    ) -> Result<Self::Purchase> {
        self.schedule_next_membership_purchase(portone, tx_type, amount, currency, scheduled_at)
            .await
    }

    async fn cancel_scheduled_payments(&self, portone: &PortOne) -> Result<()> {
        self.cancel_scheduled_payments(portone).await
    }

    async fn upsert_in_tx(&self, tx: &postgres::Tx) -> Result<()> {
        self.upsert_in_tx(tx).await
    }
}

pub async fn handle_downgrade<M, P>(
    portone: &PortOne,
    entity_membership: &M,
    payment: Option<&P>,
    new_tier: MembershipTier,
    _owner_label: &str,
) -> Result<Membership>
where
    M: MembershipEntity,
    P: PaymentEntity,
{
    let new_membership = Membership::get_by_membership_tier(&new_tier).await?;

    let mut updated_membership = entity_membership.clone();
    updated_membership.set_next_membership(Some(new_membership.tier.clone()));
    updated_membership.set_updated_at(crate::common::utils::time::now());

    if let Some(payment) = payment {
        let _ = payment.cancel_scheduled_payments(portone).await;
    }

    updated_membership.save().await?;

    Ok(new_membership)
}

pub async fn handle_upgrade<M, P, NewMembershipFn>(
    portone: &PortOne,
    entity_membership: &M,
    current_membership: Membership,
    new_tier: MembershipTier,
    currency: Currency,
    payment: P,
    should_update_payment: bool,
    new_membership_fn: NewMembershipFn,
) -> Result<(P::Purchase, Membership)>
where
    M: MembershipEntity,
    P: PaymentEntity,
    NewMembershipFn: FnOnce(&Membership) -> Result<M>,
{
    let new_membership = Membership::get_by_membership_tier(&new_tier).await?;

    let tx_type = TransactionType::PurchaseMembership(new_tier.clone());
    let amount = match currency {
        Currency::Usd => new_membership.price_dollars,
        Currency::Krw => new_membership.price_won,
    };

    let remaining_duration_days = entity_membership.calculate_remaining_duration_days();
    let remaining_price =
        current_membership.calculate_remaining_price(currency, remaining_duration_days);
    let amount = amount - remaining_price;

    let purchase = payment
        .purchase(portone, tx_type.clone(), amount, currency)
        .await?;

    let new_user_membership = new_membership_fn(&new_membership)?;

    // Atomic multi-write replacing the DynamoDB TransactWriteItems batch:
    // purchase insert + new membership upsert + optional payment upsert.
    let tx = postgres::Tx::begin().await.map_err(crate::common::Error::from)?;
    purchase.insert_in_tx(&tx).await?;
    new_user_membership.save_in_tx(&tx).await?;
    if should_update_payment {
        payment.upsert_in_tx(&tx).await?;
    }
    tx.commit().await.map_err(crate::common::Error::from)?;

    Ok((purchase, new_membership))
}

#[async_trait::async_trait]
impl MembershipEntity for UserMembership {
    fn membership_pk(&self) -> &MembershipTier {
        &self.membership_pk
    }

    fn set_membership_pk(&mut self, pk: MembershipTier) {
        self.membership_pk = pk;
    }

    fn next_membership(&self) -> Option<&MembershipTier> {
        self.next_membership.as_ref()
    }

    fn set_next_membership(&mut self, pk: Option<MembershipTier>) {
        self.next_membership = pk;
    }

    fn expired_at(&self) -> i64 {
        self.expired_at
    }

    fn set_updated_at(&mut self, timestamp: i64) {
        self.updated_at = timestamp;
    }

    fn calculate_remaining_duration_days(&self) -> i32 {
        self.calculate_remaining_duration_days()
    }

    async fn save(&self) -> Result<()> {
        self.save().await
    }

    async fn save_in_tx(&self, tx: &postgres::Tx) -> Result<()> {
        UserMembership::repository()
            .with_tx(tx)
            .upsert_on(&["user_pk"], self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }
}

#[async_trait::async_trait]
impl MembershipEntity for crate::features::membership::models::TeamMembership {
    fn membership_pk(&self) -> &MembershipTier {
        &self.membership_pk
    }

    fn set_membership_pk(&mut self, pk: MembershipTier) {
        self.membership_pk = pk;
    }

    fn next_membership(&self) -> Option<&MembershipTier> {
        self.next_membership.as_ref()
    }

    fn set_next_membership(&mut self, pk: Option<MembershipTier>) {
        self.next_membership = pk;
    }

    fn expired_at(&self) -> i64 {
        self.expired_at
    }

    fn set_updated_at(&mut self, timestamp: i64) {
        self.updated_at = timestamp;
    }

    fn calculate_remaining_duration_days(&self) -> i32 {
        self.calculate_remaining_duration_days()
    }

    async fn save(&self) -> Result<()> {
        self.save().await
    }

    async fn save_in_tx(&self, tx: &postgres::Tx) -> Result<()> {
        crate::features::membership::models::TeamMembership::repository()
            .with_tx(tx)
            .upsert_on(&["team_pk"], self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }
}

#[async_trait::async_trait]
impl PaymentEntity for crate::features::membership::models::TeamPayment {
    type Purchase = crate::features::membership::models::TeamPurchase;

    async fn purchase(
        &self,
        portone: &PortOne,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
    ) -> Result<Self::Purchase> {
        self.purchase(portone, tx_type, amount, currency).await
    }

    async fn schedule_next_membership_purchase(
        &self,
        portone: &PortOne,
        tx_type: TransactionType,
        amount: i64,
        currency: Currency,
        scheduled_at: String,
    ) -> Result<Self::Purchase> {
        self.schedule_next_membership_purchase(portone, tx_type, amount, currency, scheduled_at)
            .await
    }

    async fn cancel_scheduled_payments(&self, portone: &PortOne) -> Result<()> {
        self.cancel_scheduled_payments(portone).await
    }

    async fn upsert_in_tx(&self, tx: &postgres::Tx) -> Result<()> {
        self.upsert_in_tx(tx).await
    }
}
