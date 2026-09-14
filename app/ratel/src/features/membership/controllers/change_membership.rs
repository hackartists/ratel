use super::*;
use crate::features::auth::User;
use crate::features::membership::controllers::normalize_error;
use crate::features::membership::models::{
    CardInfo, Currency, Membership, MembershipResponse, MembershipTier, PaymentReceipt,
    TransactionType, UserMembership, UserPayment,
};
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use crate::features::membership::models::{
    handle_downgrade, handle_upgrade, MembershipEntity, PaymentEntity, PurchaseEntity,
};
#[cfg(feature = "server")]
use crate::features::membership::services::portone::PortOne;
use crate::features::membership::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct ChangeMembershipRequest {
    pub membership: MembershipTier,
    pub currency: Currency,
    pub card_info: Option<CardInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct ChangeMembershipResponse {
    pub renewal_date: i64,
    pub receipt: Option<PaymentReceipt>,
    pub membership: Option<MembershipResponse>,
}

#[post("/v3/me/memberships", user: User)]
pub async fn change_membership_handler(
    req: ChangeMembershipRequest,
) -> Result<ChangeMembershipResponse> {
    let result = async {
        let conf = crate::features::membership::config::get();
        let portone = PortOne::new(conf.portone.api_secret);

        let mut ret = ChangeMembershipResponse {
            renewal_date: crate::common::utils::time::now(),
            receipt: None,
            membership: None,
        };

        let user_membership = UserMembership::find_by_user(&user.pk().to_string()).await?;

        match user_membership {
            Some(user_membership) => {
                let current_membership =
                    Membership::get_by_membership_tier(&user_membership.membership_pk).await?;

                if current_membership.tier == req.membership {
                    return Err(Error::MembershipAlreadyActive);
                }

                let user_id: UserPartition = user.pk().into();

                if req.membership < current_membership.tier {
                    let (user_payment, _) =
                        UserPayment::get_by_user(&portone, user_id.clone(), None).await?;

                    let new_membership = handle_downgrade(
                        &portone,
                        &user_membership,
                        Some(&user_payment),
                        req.membership.clone(),
                        "user",
                    )
                    .await?;

                    ret.renewal_date = user_membership.expired_at + 1;
                    ret.membership = Some(new_membership.into());
                } else {
                    let (user_payment, should_update) =
                        UserPayment::get_by_user(&portone, user_id.clone(), req.card_info).await?;

                    let (user_purchase, new_membership) = handle_upgrade(
                        &portone,
                        &user_membership,
                        current_membership,
                        req.membership.clone(),
                        req.currency,
                        user_payment,
                        should_update,
                        |new_membership| {
                            let new_user_membership = UserMembership::new(
                                user_id.clone(),
                                new_membership.tier.clone(),
                                new_membership.duration_days,
                                new_membership.credits,
                            )?
                            .with_auto_renew(true);
                            Ok(new_user_membership)
                        },
                    )
                    .await?;

                    ret.receipt = Some(user_purchase.into());
                    ret.membership = Some(new_membership.into());
                }
            }
            None => {
                if req.membership == MembershipTier::Free {
                    return Err(Error::MembershipAlreadyActive);
                }

                let new_membership = Membership::get_by_membership_tier(&req.membership).await?;
                let user_id: UserPartition = user.pk().into();
                let (user_payment, should_update) =
                    UserPayment::get_by_user(&portone, user_id.clone(), req.card_info).await?;

                let tx_type = TransactionType::PurchaseMembership(req.membership.clone());
                let amount = match req.currency {
                    Currency::Usd => new_membership.price_dollars,
                    Currency::Krw => new_membership.price_won,
                };

                let user_purchase = user_payment
                    .purchase(&portone, tx_type, amount, req.currency)
                    .await?;

                let new_user_membership = UserMembership::new(
                    user_id,
                    new_membership.tier.clone(),
                    new_membership.duration_days,
                    new_membership.credits,
                )?
                .with_auto_renew(true);

                // Atomic: purchase insert + membership upsert (+ optional payment upsert).
                let tx = postgres::Tx::begin().await.map_err(Error::from)?;
                user_purchase.insert_in_tx(&tx).await?;
                new_user_membership.save_in_tx(&tx).await?;
                if should_update {
                    user_payment.upsert_in_tx(&tx).await?;
                }
                tx.commit().await.map_err(Error::from)?;

                ret.receipt = Some(user_purchase.into());
                ret.membership = Some(new_membership.into());
            }
        }

        Ok(ret)
    }
    .await;

    result.map_err(normalize_error)
}
