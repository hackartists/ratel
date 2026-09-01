use super::*;
use crate::features::membership::models::{
    Currency, Membership, PurchaseStatus, TeamMembership, TeamPayment, TeamPurchase,
    TransactionType, UserMembership, UserPayment, UserPurchase,
};
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use crate::features::membership::models::MembershipEntity;
#[cfg(feature = "server")]
use crate::features::membership::services::portone::PortOne;
use crate::features::membership::*;
#[cfg(feature = "server")]
use std::str::FromStr;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct PortoneRequest {
    pub payment_id: String,
    pub status: String,
    pub tx_id: String,
}

#[cfg(feature = "server")]
fn should_schedule_renewal(membership: &Membership, currency: Currency) -> bool {
    membership.duration_days > 0 && membership.price_in_currency(currency) > 0
}

#[cfg(feature = "server")]
async fn has_user_scheduled_purchase(user_pk: &str) -> Result<bool> {
    Ok(!UserPurchase::find_scheduled_for_user(user_pk).await?.is_empty())
}

#[cfg(feature = "server")]
async fn has_team_scheduled_purchase(team_pk: &str) -> Result<bool> {
    Ok(!TeamPurchase::find_scheduled_for_team(team_pk).await?.is_empty())
}

#[cfg(feature = "server")]
async fn schedule_user_renewal(
    portone: &PortOne,
    membership: &Membership,
    user_membership: &UserMembership,
    user_payment: &UserPayment,
    currency: Currency,
) -> Result<()> {
    if !user_membership.auto_renew || !should_schedule_renewal(membership, currency) {
        return Ok(());
    }

    if has_user_scheduled_purchase(&user_membership.user_pk).await? {
        return Ok(());
    }

    let Some(scheduled_at) = user_membership.renewal_date_rfc_3339() else {
        return Ok(());
    };

    let scheduled_purchase = user_payment
        .schedule_next_membership_purchase(
            portone,
            TransactionType::PurchaseMembership(membership.tier.clone()),
            membership.price_in_currency(currency),
            currency,
            scheduled_at,
        )
        .await?;

    UserPurchase::repository()
        .insert(&scheduled_purchase)
        .await
        .map_err(Error::from)?;
    Ok(())
}

#[cfg(feature = "server")]
async fn schedule_team_renewal(
    portone: &PortOne,
    membership: &Membership,
    team_membership: &TeamMembership,
    team_payment: &TeamPayment,
    currency: Currency,
) -> Result<()> {
    if !team_membership.auto_renew || !should_schedule_renewal(membership, currency) {
        return Ok(());
    }

    if has_team_scheduled_purchase(&team_membership.team_pk).await? {
        return Ok(());
    }

    let Some(scheduled_at) = team_membership.renewal_date_rfc_3339() else {
        return Ok(());
    };

    let scheduled_purchase = team_payment
        .schedule_next_membership_purchase(
            portone,
            TransactionType::PurchaseMembership(membership.tier.clone()),
            membership.price_in_currency(currency),
            currency,
            scheduled_at,
        )
        .await?;

    TeamPurchase::repository()
        .insert(&scheduled_purchase)
        .await
        .map_err(Error::from)?;
    Ok(())
}

#[cfg(feature = "server")]
async fn disable_user_auto_renew(membership: &UserMembership) -> Result<()> {
    let mut updated = membership.clone();
    updated.auto_renew = false;
    updated.next_membership = None;
    updated.save().await?;
    Ok(())
}

#[cfg(feature = "server")]
async fn disable_team_auto_renew(membership: &TeamMembership) -> Result<()> {
    let mut updated = membership.clone();
    updated.auto_renew = false;
    updated.next_membership = None;
    updated.save().await?;
    Ok(())
}

#[cfg(feature = "server")]
async fn handle_user_purchase(
    portone: &PortOne,
    req: &PortoneRequest,
    user_purchase: UserPurchase,
) -> Result<bool> {
    let user_pk = user_purchase.user_pk.clone();
    let user_partition: Partition = user_pk
        .parse()
        .map_err(|_| Error::InvalidPartitionKey(user_pk.clone()))?;
    let user_id: UserPartition = user_partition.into();
    let (user_payment, _) = UserPayment::get_by_user(portone, user_id.clone(), None).await?;

    let TransactionType::PurchaseMembership(tier) =
        TransactionType::from_str(&user_purchase.tx_type).unwrap_or_default()
    else {
        return Ok(true);
    };
    let membership = Membership::get_by_membership_tier(&tier).await?;

    match user_purchase.status {
        PurchaseStatus::Scheduled => {
            let renewed_membership = UserMembership::new(
                user_id,
                membership.tier.clone(),
                membership.duration_days,
                membership.credits,
            )?
            .with_auto_renew(true);

            let mut updated_purchase = user_purchase.clone();
            updated_purchase.status = PurchaseStatus::Success;
            updated_purchase.tx_id = req.tx_id.clone();

            let tx = postgres::Tx::begin().await.map_err(Error::from)?;
            UserPurchase::repository()
                .with_tx(&tx)
                .upsert(&updated_purchase)
                .await
                .map_err(Error::from)?;
            renewed_membership.save_in_tx(&tx).await?;
            tx.commit().await.map_err(Error::from)?;

            if let Err(err) = schedule_user_renewal(
                portone,
                &membership,
                &renewed_membership,
                &user_payment,
                user_purchase.currency,
            )
            .await
            {
                tracing::error!("failed to schedule next user membership renewal: {:?}", err);
                disable_user_auto_renew(&renewed_membership).await?;
            }
        }
        PurchaseStatus::Success => {
            let user_membership = UserMembership::find_by_user(&user_purchase.user_pk)
                .await?
                .ok_or_else(|| Error::NotFound("User membership not found".to_string()))?;

            if let Err(err) = schedule_user_renewal(
                portone,
                &membership,
                &user_membership,
                &user_payment,
                user_purchase.currency,
            )
            .await
            {
                tracing::error!("failed to schedule next user membership renewal: {:?}", err);
                disable_user_auto_renew(&user_membership).await?;
            }
        }
        PurchaseStatus::Canceled => {}
    }

    Ok(true)
}

#[cfg(feature = "server")]
async fn handle_team_purchase(
    portone: &PortOne,
    req: &PortoneRequest,
    team_purchase: TeamPurchase,
) -> Result<bool> {
    let team_pk = team_purchase.team_pk.clone();
    let team_partition: Partition = team_pk
        .parse()
        .map_err(|_| Error::InvalidPartitionKey(team_pk.clone()))?;
    let team_id: TeamPartition = team_partition.into();
    let (team_payment, _) = TeamPayment::get_by_team(portone, team_id.clone(), None).await?;

    let TransactionType::PurchaseMembership(tier) =
        TransactionType::from_str(&team_purchase.tx_type).unwrap_or_default()
    else {
        return Ok(true);
    };
    let membership = Membership::get_by_membership_tier(&tier).await?;

    match team_purchase.status {
        PurchaseStatus::Scheduled => {
            let renewed_membership = TeamMembership::new(
                team_id,
                membership.tier.clone(),
                membership.duration_days,
                membership.credits,
            )?
            .with_auto_renew(true);

            let mut updated_purchase = team_purchase.clone();
            updated_purchase.status = PurchaseStatus::Success;
            updated_purchase.tx_id = req.tx_id.clone();

            let tx = postgres::Tx::begin().await.map_err(Error::from)?;
            TeamPurchase::repository()
                .with_tx(&tx)
                .upsert(&updated_purchase)
                .await
                .map_err(Error::from)?;
            renewed_membership.save_in_tx(&tx).await?;
            tx.commit().await.map_err(Error::from)?;

            if let Err(err) = schedule_team_renewal(
                portone,
                &membership,
                &renewed_membership,
                &team_payment,
                team_purchase.currency,
            )
            .await
            {
                tracing::error!("failed to schedule next team membership renewal: {:?}", err);
                disable_team_auto_renew(&renewed_membership).await?;
            }
        }
        PurchaseStatus::Success => {
            let team_membership = TeamMembership::find_by_team(&team_purchase.team_pk)
                .await?
                .ok_or_else(|| Error::NotFound("Team membership not found".to_string()))?;

            if let Err(err) = schedule_team_renewal(
                portone,
                &membership,
                &team_membership,
                &team_payment,
                team_purchase.currency,
            )
            .await
            {
                tracing::error!("failed to schedule next team membership renewal: {:?}", err);
                disable_team_auto_renew(&team_membership).await?;
            }
        }
        PurchaseStatus::Canceled => {}
    }

    Ok(true)
}

#[cfg(feature = "server")]
pub async fn handle_portone_webhook(req: PortoneRequest) -> Result<()> {
    let result = async {
        if !req.status.eq_ignore_ascii_case("paid") {
            return Ok(());
        }

        let conf = crate::features::membership::config::get();
        let portone = PortOne::new(conf.portone.api_secret);

        let user_purchases = UserPurchase::find_by_payment_id(&req.payment_id).await?;

        if let Some(user_purchase) = user_purchases.into_iter().next() {
            handle_user_purchase(&portone, &req, user_purchase).await?;
            return Ok(());
        }

        let team_purchases = TeamPurchase::find_by_payment_id(&req.payment_id).await?;

        if let Some(team_purchase) = team_purchases.into_iter().next() {
            handle_team_purchase(&portone, &req, team_purchase).await?;
            return Ok(());
        }

        Err(Error::NotFound("Purchase not found".to_string()))
    }
    .await;

    result.map_err(normalize_error)
}

#[cfg(not(feature = "server"))]
pub async fn handle_portone_webhook(_req: PortoneRequest) -> Result<()> {
    Err(crate::features::membership::types::MembershipPaymentError::WebhookProcessingFailed.into())
}
