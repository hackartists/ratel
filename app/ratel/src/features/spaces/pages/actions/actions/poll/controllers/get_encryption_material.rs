use crate::common::models::space::SpaceUser;
use crate::features::spaces::pages::actions::actions::poll::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct VoteEncryptionMaterialResponse {
    pub poll_id: String,
    pub voter_tag: String,
    pub voter_secret_key_json: String,
    pub authority_public_key_json: String,
}

#[get("/api/spaces/{space_pk}/polls/{poll_sk}/encryption-material", role: SpaceUserRole, member: SpaceUser)]
pub async fn get_encryption_material(
    space_pk: SpacePartition,
    poll_sk: SpacePollEntityType,
) -> Result<VoteEncryptionMaterialResponse> {
    let poll = SpacePoll::get_one(&space_pk, &poll_sk)
        .await?
        .ok_or(Error::NotFound("Poll not found".into()))?;
    let poll_sk_entity: EntityType = poll_sk.into();
    if !poll.canister_upload_enabled {
        return Err(Error::NotFound(
            "Encrypted voting is not enabled for this poll".into(),
        ));
    }

    use crate::features::spaces::pages::actions::services::vote_crypto::VOTE_CRYPTO_SERVICE;
    let crypto = VOTE_CRYPTO_SERVICE
        .as_ref()
        .ok_or(SpacePollError::EncryptionFailed)?;

    let voter_tag = crypto.build_voter_tag(&poll_sk_entity, &member.pk)?;
    let voter_secret_key_json = crypto.generate_voter_sk(&voter_tag)?;
    let authority_public_key_json = crypto.authority_public_key_json()?;

    Ok(VoteEncryptionMaterialResponse {
        poll_id: poll_sk_entity.to_string(),
        voter_tag,
        voter_secret_key_json,
        authority_public_key_json,
    })
}
