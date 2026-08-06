use crate::common::types::UserType;
use crate::features::auth::User;
#[cfg(feature = "server")]
use crate::features::posts::models::Team;

use crate::features::posts::*;

#[derive(Debug, Clone)]
pub struct Author {
    pub pk: Partition,
    pub display_name: String,
    pub profile_url: String,
    pub username: String,
    pub user_type: UserType,
}

impl From<User> for Author {
    fn from(user: User) -> Self {
        let pk = user.pk();
        let User {
            display_name,
            profile_url,
            username,
            ..
        } = user;
        Self {
            pk,
            display_name,
            profile_url,
            username,
            user_type: UserType::Individual,
        }
    }
}

#[cfg(feature = "server")]
impl From<Team> for Author {
    fn from(team: Team) -> Self {
        Self {
            pk: team.partition(),
            display_name: team.display_name,
            profile_url: team.profile_url,
            username: team.username,
            user_type: UserType::Team,
        }
    }
}
