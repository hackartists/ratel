use crate::{
    common::{types::UserType, Error, TeamItem},
    posts::types::TeamGroupPermissions,
    social::controllers::{create_team_handler, get_user_teams_handler, CreateTeamRequest},
    social::pages::setting::team::controllers::delete_team_handler,
    *,
};

#[derive(Clone, Copy, DioxusController)]
pub struct TeamContext {
    pub teams: Loader<Vec<TeamItem>>,
    pub selected_index: Signal<usize>,
}

impl TeamContext {
    pub async fn create_team(
        &mut self,
        payload: crate::common::TeamCreationPayload,
    ) -> crate::Result<TeamItem> {
        let crate::common::TeamCreationPayload {
            profile_url,
            username,
            nickname,
            description,
        } = payload;

        let req = CreateTeamRequest {
            username: username.clone(),
            nickname: nickname.clone(),
            profile_url: profile_url.clone(),
            description: description.clone(),
        };
        let response = create_team_handler(req.clone()).await?;
        let permissions: Vec<u8> = TeamGroupPermissions::all()
            .0
            .into_iter()
            .map(|p| p as u8)
            .collect();
        let CreateTeamRequest {
            profile_url,
            username,
            nickname,
            description,
        } = req;
        let team_item = TeamItem {
            pk: response.team_pk.clone(),
            nickname: nickname.clone(),
            username: username.clone(),
            profile_url: profile_url.clone(),
            user_type: UserType::Team,
            permissions: permissions.clone(),
            description: description.clone(),
            created_at: 0,
            member_count: 1,
        };
        self.teams.push(team_item.clone());

        Ok(team_item)
    }

    /// Delete a team the caller owns, and drop it from the cached list.
    ///
    /// The list is a `Loader` installed once at the app root whose only
    /// reactive dependency is `logged_in`, so nothing re-fetches it after a
    /// mutation. Both delete call sites just navigate away afterwards, so
    /// without this the deleted team lingered in "YOUR TEAMS" for the rest of
    /// the app session — and on mobile, where the process is rarely killed,
    /// that reads as permanent. Mirrors `create_team`, which pushes on the
    /// way in.
    pub async fn delete_team(&mut self, username: String) -> crate::Result<()> {
        delete_team_handler(username.clone()).await?;

        // Removing an entry shifts every later index, so keep the selection
        // anchored to the team it actually pointed at rather than to a number
        // that now means a different team. Falls back to the first team when
        // the deleted one was the selected one.
        let selected_pk = self.selected_team().map(|t| t.pk);
        self.teams.write().retain(|t| t.username != username);
        let index = selected_pk
            .and_then(|pk| self.teams.read().iter().position(|t| t.pk == pk))
            .unwrap_or(0);
        self.selected_index.set(index);

        Ok(())
    }

    pub fn set_teams(&mut self, teams: Vec<TeamItem>) {
        self.teams.set(teams);
    }

    pub fn add_team(&mut self, team: TeamItem) {
        self.teams.push(team);
    }

    pub fn selected_team(&self) -> Option<TeamItem> {
        let teams = self.teams.read();
        let idx = *self.selected_index.read();
        teams.get(idx).cloned()
    }

    pub fn select_team_by_idx(&mut self, index: usize) {
        self.selected_index.set(index);
    }

    pub fn select_team(&mut self, team_pk: &str) {
        let teams = self.teams.read();
        if let Some((idx, _)) = teams.iter().enumerate().find(|(_, t)| t.pk == team_pk) {
            self.selected_index.set(idx);
        }
    }
}

pub fn use_team_context_provider() -> Result<TeamContext, Loading> {
    let AuthContext { logged_in, .. } = use_auth_context();
    let teams = use_loader(move || {
        let logged_in = logged_in();
        debug!("Loading teams, logged_in: {}", logged_in);

        async move {
            if !logged_in {
                return Ok(Vec::new());
            }

            Ok::<_, Error>(get_user_teams_handler().await.unwrap_or_default().items)
        }
    })?;
    let selected_index = use_signal(|| 0);

    let ctx = use_context_provider(move || TeamContext {
        teams,
        selected_index,
    });
    Ok(ctx)
}

#[track_caller]
pub fn use_team_context() -> TeamContext {
    use_context::<TeamContext>()
}

pub fn consume_team_context() -> TeamContext {
    consume_context::<TeamContext>()
}
