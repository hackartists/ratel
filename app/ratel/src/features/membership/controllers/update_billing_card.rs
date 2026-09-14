use super::*;
use crate::features::auth::User;
use crate::features::membership::controllers::get_billing_info::BillingInfoResponse;
use crate::features::membership::controllers::normalize_error;
use crate::features::membership::models::{CardInfo, UserPayment};
use crate::features::membership::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use crate::features::membership::services::portone::PortOne;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UpdateBillingCardRequest {
    pub card_info: CardInfo,
}

#[cfg(feature = "server")]
use super::mask_card_number;

#[post("/v3/me/billing", user: User)]
pub async fn update_billing_card_handler(
    req: UpdateBillingCardRequest,
) -> Result<BillingInfoResponse> {
    let result = async {
        let conf = crate::features::membership::config::get();
        let portone = PortOne::new(conf.portone.api_secret);

        let mut payment: UserPayment = UserPayment::find_by_user_pk(&user.pk().to_string())
            .await?
            .ok_or_else(|| {
                Error::NotFound(
                    "No payment profile found. Please verify your identity first.".to_string(),
                )
            })?;

        let card = req.card_info;
        let masked = mask_card_number(&card.card_number);

        let res = portone
            .get_billing_key(
                payment.customer_id.clone(),
                payment.name.clone(),
                card.card_number,
                card.expiry_year,
                card.expiry_month,
                card.birth_or_business_registration_number,
                card.password_two_digits,
            )
            .await?;

        let new_billing_key = res.billing_key_info.billing_key;
        payment.billing_key = Some(new_billing_key);
        payment.masked_card_number = Some(masked.clone());
        payment.save().await?;

        Ok(BillingInfoResponse {
            has_card: true,
            customer_name: payment.name,
            masked_card_number: Some(masked),
        })
    }
    .await;

    result.map_err(normalize_error)
}
