use super::*;
use crate::features::auth::User;
use crate::features::membership::controllers::normalize_error;
use crate::features::membership::models::UserPayment;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use crate::features::membership::services::portone::PortOne;
use crate::features::membership::services::portone::VerifiedCustomer;
use crate::features::membership::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct IdentificationRequest {
    pub id: String,
}

#[post("/v3/payments/identify", user: User)]
pub async fn identify_handler(req: IdentificationRequest) -> Result<VerifiedCustomer> {
    let result = async {
        let conf = crate::features::membership::config::get();
        let portone = PortOne::new(conf.portone.api_secret);

        let result = portone.identify(&req.id).await?;
        let verified = result.verified_customer.clone();

        // Natural-key upsert preserves the former DynamoDB PutItem overwrite
        // semantics (one payment profile per user, re-verify replaces it).
        UserPayment::new(
            user.pk(),
            verified.id.clone(),
            verified.name.clone(),
            verified.birth_date.clone(),
        )
        .save()
        .await?;

        Ok(verified)
    }
    .await;

    result.map_err(normalize_error)
}
