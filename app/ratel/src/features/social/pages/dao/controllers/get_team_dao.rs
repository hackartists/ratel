use super::super::dto::{EligibleAdminResponse, TeamDao, TeamDaoTeamResponse};
use super::super::*;

#[cfg(feature = "server")]
use crate::features::posts::models::{Team, TeamOwner};
#[cfg(feature = "server")]
use postgres::PostgresEntity;
use std::collections::{HashMap, HashSet};

#[get("/api/teams/:username/dao/context", user: crate::features::auth::OptionalUser, team: Team)]
pub async fn get_team_dao_handler(username: String) -> Result<TeamDao> {
    let conf = super::super::config::get();
    let cli = conf.common.dynamodb();

    let user: Option<crate::features::auth::User> = user.into();
    let role = match &user {
        Some(u) => Team::get_user_role(cli, &team.partition(), &u.pk())
            .await?
            .unwrap_or_default(),
        None => crate::features::social::pages::member::dto::TeamRole::default(),
    };
    let is_admin = role.is_owner();
    #[cfg(feature = "server")]
    let eligible_admins = if is_admin {
        list_eligible_admins(&team.partition()).await?
    } else {
        Vec::new()
    };
    #[cfg(not(feature = "server"))]
    let eligible_admins = Vec::new();

    Ok(TeamDao {
        team: TeamDaoTeamResponse {
            team_pk: team.partition().into(),
            username: team.username,
            nickname: team.display_name,
            dao_address: team.dao_address,
        },
        permissions: role.to_legacy_permissions(),
        eligible_admins,
        role,
    })
}

#[cfg(feature = "server")]
async fn list_eligible_admins(team_pk: &Partition) -> Result<Vec<EligibleAdminResponse>> {
    let team_owner = if let Partition::Team(id) = team_pk {
        match uuid::Uuid::parse_str(id) {
            Ok(uuid) => TeamOwner::find_by_team(uuid).await?,
            Err(_) => None,
        }
    } else {
        None
    };
    let owner_pk = team_owner.as_ref().map(|owner| owner.user_pk.to_string());

    let all_user_team_groups =
        crate::features::auth::UserTeamGroup::find_by_team_pk(team_pk).await?;

    let mut user_has_group: HashSet<String> = HashSet::new();
    for utg in &all_user_team_groups {
        user_has_group.insert(utg.user_pk.to_string());
    }

    let mut unique_user_pks: Vec<String> = Vec::new();
    let mut seen = HashSet::new();
    for utg in &all_user_team_groups {
        let key = utg.user_pk.clone();
        if seen.insert(key.clone()) {
            unique_user_pks.push(key);
        }
    }
    if let Some(owner) = &team_owner {
        let key = owner.user_pk.clone();
        if seen.insert(key.clone()) {
            unique_user_pks.push(key);
        }
    }

    let users: Vec<crate::features::auth::User> = futures::future::join_all(
        unique_user_pks
            .iter()
            .map(|pk| async move { crate::features::auth::User::find_by_pk_str(pk).await.ok().flatten() }),
    )
    .await
    .into_iter()
    .flatten()
    .collect();

    let evm_items: Vec<crate::features::auth::UserEvmAddress> = {
        use postgres::ops::StringOp;
        futures::future::join_all(unique_user_pks.iter().map(|pk| async move {
            crate::features::auth::UserEvmAddress::repository()
                .find_one(
                    crate::features::auth::UserEvmAddress::query()
                        .user_pk(StringOp::Eq(pk.clone())),
                )
                .await
                .ok()
                .flatten()
        }))
        .await
        .into_iter()
        .flatten()
        .collect()
    };

    let evm_map: HashMap<String, String> = evm_items
        .into_iter()
        .map(|item| (item.user_pk.clone(), item.evm_address))
        .collect();

    let mut eligible_admins: Vec<EligibleAdminResponse> = users
        .into_iter()
        .filter_map(|user| {
            let user_pk = user.pk().to_string();
            let evm_address = evm_map.get(&user_pk)?.clone();
            let is_owner = owner_pk.as_ref().map(|pk| pk == &user_pk).unwrap_or(false);
            let has_group = user_has_group.contains(&user_pk);
            if !(is_owner || has_group) {
                return None;
            }
            let profile_url = if user.profile_url.is_empty() {
                None
            } else {
                Some(user.profile_url)
            };
            Some(EligibleAdminResponse {
                user_id: user_pk,
                username: user.username,
                display_name: user.display_name,
                profile_url,
                is_owner,
                evm_address,
            })
        })
        .collect();

    if let Some(owner) = team_owner {
        let owner_pk_str = owner.user_pk.to_string();
        let exists = eligible_admins
            .iter()
            .any(|item| item.user_id == owner_pk_str);
        if !exists {
            if let Some(evm_address) = evm_map.get(&owner_pk_str).cloned() {
                eligible_admins.push(EligibleAdminResponse {
                    user_id: owner_pk_str,
                    username: owner.username,
                    display_name: owner.display_name,
                    profile_url: if owner.profile_url.is_empty() {
                        None
                    } else {
                        Some(owner.profile_url)
                    },
                    is_owner: true,
                    evm_address,
                });
            }
        }
    }

    eligible_admins.sort_by(|a, b| match (a.is_owner, b.is_owner) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.username.cmp(&b.username),
    });

    Ok(eligible_admins)
}
