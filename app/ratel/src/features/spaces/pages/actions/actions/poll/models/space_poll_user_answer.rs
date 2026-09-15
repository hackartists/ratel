#[cfg(feature = "server")]
use std::collections::HashMap;

#[cfg(feature = "server")]
use crate::common::attribute::*;
use crate::features::spaces::pages::actions::actions::poll::*;
#[cfg(feature = "server")]
use crate::common::utils::time::get_now_timestamp_millis;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

/// jsonb wrapper for the embedded `Vec<Answer>` column. Cross-platform because
/// `SpacePollUserAnswer` is embedded in the client-facing `PollResultResponse`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
#[serde(transparent)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct PollUserAnswers(pub Vec<Answer>);

impl std::ops::Deref for PollUserAnswers {
    type Target = Vec<Answer>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// jsonb wrapper for the optional embedded `RespondentAttr` column.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
#[serde(transparent)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct RespondentJson(pub RespondentAttr);

impl std::ops::Deref for RespondentJson {
    type Target = RespondentAttr;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// One user's answer to a poll.
///
/// Postgres migration: the DynamoDB identity was `pk = user_pk` +
/// `sk = SpacePollUserAnswer#{space}#{poll}`, with a GSI on `sk`. It becomes a
/// surrogate `id` PK plus the flattened `actor_pk` / `space_id` / `poll_id`
/// columns; `(actor_pk, space_id, poll_id)` is the natural key. Stays
/// cross-platform because it is embedded in the client-facing
/// `PollResultResponse`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
// Serialize through `SpacePollUserAnswerWire` so the shipped mobile build still
// finds the legacy `pk`/`sk` keys. See `SpacePollUserAnswerWire`.
#[serde(into = "SpacePollUserAnswerWire")]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "space_poll_user_answers", unique(actor_pk, space_id, poll_id)))]
pub struct SpacePollUserAnswer {
    #[serde(default)]
    pub id: uuid::Uuid,

    /// Voter as full `Partition` string (`USER#…`).
    #[cfg_attr(feature = "server", postgres(index))]
    pub actor_pk: String,
    #[cfg_attr(feature = "server", postgres(index))]
    pub poll_id: String,
    #[serde(default)]
    pub space_id: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,

    #[serde(default)]
    pub answers: PollUserAnswers,

    #[serde(default)]
    pub respondent: Option<RespondentJson>,

    #[serde(default)]
    pub user_pk: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub profile_url: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
}

#[cfg(feature = "server")]
fn poll_id_of(poll_sk: &EntityType) -> String {
    match poll_sk {
        EntityType::SpacePoll(id) => id.clone(),
        other => other.to_string(),
    }
}

#[cfg(feature = "server")]
fn space_id_of(space_pk: &Partition) -> String {
    match space_pk {
        Partition::Space(id) => id.clone(),
        other => other.to_string(),
    }
}

#[cfg(feature = "server")]
impl SpacePollUserAnswer {
    pub fn new(
        space_pk: Partition,
        poll_sk: EntityType,
        answers: Vec<Answer>,
        respondent: Option<RespondentAttr>,
        author: crate::common::models::space::SpaceUser,
    ) -> Self {
        let actor_pk = author.pk.to_string();
        let created_at = get_now_timestamp_millis();

        Self {
            id: uuid::Uuid::now_v7(),
            actor_pk: actor_pk.clone(),
            poll_id: poll_id_of(&poll_sk),
            space_id: space_id_of(&space_pk),
            created_at,
            answers: PollUserAnswers(answers),
            respondent: respondent.map(RespondentJson),
            user_pk: Some(actor_pk),
            display_name: Some(author.display_name),
            profile_url: Some(author.profile_url),
            username: Some(author.username),
        }
    }

    pub async fn find_one(
        space_pk: &Partition,
        poll_sk: &EntityType,
        user_pk: &Partition,
    ) -> crate::features::spaces::pages::actions::actions::poll::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .actor_pk(StringOp::Eq(user_pk.to_string()))
                    .space_id(StringOp::Eq(space_id_of(space_pk)))
                    .poll_id(StringOp::Eq(poll_id_of(poll_sk))),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// All answers for a `(space, poll)`.
    pub async fn list_by_poll(
        space_pk: &Partition,
        poll_sk: &EntityType,
    ) -> crate::common::Result<Vec<Self>> {
        Self::repository()
            .find(
                Self::query()
                    .space_id(StringOp::Eq(space_id_of(space_pk)))
                    .poll_id(StringOp::Eq(poll_id_of(poll_sk))),
            )
            .await
            .map(|p| p.items)
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert on `(actor_pk, space_id, poll_id)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["actor_pk", "space_id", "poll_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn summarize_responses_with_attribute(
        space_pk: &Partition,
        poll_sk: &EntityType,
    ) -> crate::features::spaces::pages::actions::actions::poll::Result<(
        Vec<SpacePollSummary>,
        HashMap<String, Vec<SpacePollSummary>>,
        HashMap<String, Vec<SpacePollSummary>>,
        HashMap<String, Vec<SpacePollSummary>>,
        Vec<SpacePollUserAnswer>,
        Vec<SpacePollUserAnswer>,
    )> {
        let poll_id = SpacePollEntityType(poll_id_of(poll_sk));
        let space_partition = match space_pk {
            Partition::Space(id) => SpacePartition(id.clone()),
            _ => SpacePartition(space_id_of(space_pk)),
        };
        let poll = SpacePoll::get_one(&space_partition, &poll_id)
            .await?
            .ok_or(Error::NotFound("Poll Not found".to_string()))?;

        let question = poll.questions.0;

        let seed: Vec<SpacePollSummary> = question
            .iter()
            .cloned()
            .map(SpacePollSummary::from)
            .collect();

        use std::collections::HashMap as Map;

        let mut overall = seed.clone();
        let mut gender_map: Map<Gender, Vec<SpacePollSummary>> = Map::new();
        let mut age_map: Map<AgeBand, Vec<SpacePollSummary>> = Map::new();
        let mut school_map: Map<String, Vec<SpacePollSummary>> = Map::new();

        let final_all: Vec<SpacePollUserAnswer> = Self::list_by_poll(space_pk, poll_sk).await?;

        for resp in &final_all {
            for (qi, ans) in resp.answers.0.iter().cloned().enumerate() {
                if let Some(s) = overall.get_mut(qi) {
                    s.aggregate_answer(ans);
                }
            }

            if let Some(g) = resp.respondent.as_ref().and_then(|r| r.0.gender.clone()) {
                let entry = gender_map.entry(g).or_insert_with(|| seed.clone());
                for (qi, ans) in resp.answers.0.iter().cloned().enumerate() {
                    if let Some(s) = entry.get_mut(qi) {
                        s.aggregate_answer(ans);
                    }
                }
            }

            if let Some(a) = resp.respondent.as_ref().and_then(|r| r.0.age.clone()) {
                let band = age_to_band(&a);
                let entry = age_map.entry(band).or_insert_with(|| seed.clone());
                for (qi, ans) in resp.answers.0.iter().cloned().enumerate() {
                    if let Some(s) = entry.get_mut(qi) {
                        s.aggregate_answer(ans);
                    }
                }
            }

            if let Some(school) = resp.respondent.as_ref().and_then(|r| r.0.school.clone()) {
                let key = if school.is_empty() {
                    "UNKNOWN".to_string()
                } else {
                    school
                };
                let entry = school_map.entry(key).or_insert_with(|| seed.clone());
                for (qi, ans) in resp.answers.0.iter().cloned().enumerate() {
                    if let Some(s) = entry.get_mut(qi) {
                        s.aggregate_answer(ans);
                    }
                }
            }
        }

        // The DynamoDB implementation split answers into a "sample" set and a
        // "final" set keyed by two sort keys. In the current data model those
        // two keys are always identical, so the sample set is the full set and
        // the final set is empty.
        let sample_aligned = final_all;
        let final_aligned: Vec<SpacePollUserAnswer> = vec![];

        let by_gender: HashMap<String, Vec<SpacePollSummary>> = gender_map
            .into_iter()
            .map(|(k, v)| {
                let key = match k {
                    Gender::Male => "male".to_string(),
                    Gender::Female => "female".to_string(),
                };
                (key, v)
            })
            .collect();

        let by_age: HashMap<String, Vec<SpacePollSummary>> = age_map
            .into_iter()
            .map(|(band, v)| (band.label().to_string(), v))
            .collect();

        Ok((
            overall,
            by_gender,
            by_age,
            school_map,
            sample_aligned,
            final_aligned,
        ))
    }
}

/// Wire form of [`SpacePollUserAnswer`] — identical plus the legacy `pk`/`sk`.
///
/// Same reason as `UserWire`. This is embedded in the client-facing
/// `PollResultResponse`, which the space entry screen loads for every poll card
/// — so a missing key takes down the whole space page, not just the poll.
///
/// The DynamoDB identity was `pk = user_pk` (the voter's partition) +
/// `sk = SpacePollUserAnswer#{space}#{poll}`. `actor_pk` still holds that same
/// `"USER#…"` string, so `pk` is parsed back from it; a malformed value degrades
/// to `Partition::None` rather than dropping the row.
///
/// `answers`/`respondent` need no bridging — both are `#[serde(transparent)]`
/// newtypes over the old `Vec<Answer>` / `RespondentAttr`. `space_id` widened
/// from `Option<String>` to `String`, which the old `Option` field still accepts.
#[derive(Serialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", rename = "SpacePollUserAnswer"))]
pub struct SpacePollUserAnswerWire {
    /// The voter's partition, parsed back from `actor_pk` (`USER#…`).
    pub pk: Partition,
    /// `EntityType::SpacePollUserAnswer(space_id, poll_id)`.
    pub sk: EntityType,

    pub id: uuid::Uuid,
    pub actor_pk: String,
    pub poll_id: String,
    pub space_id: String,
    pub created_at: i64,
    pub answers: PollUserAnswers,
    pub respondent: Option<RespondentJson>,
    pub user_pk: Option<String>,
    pub display_name: Option<String>,
    pub profile_url: Option<String>,
    pub username: Option<String>,
}

impl From<SpacePollUserAnswer> for SpacePollUserAnswerWire {
    fn from(a: SpacePollUserAnswer) -> Self {
        Self {
            pk: a.actor_pk.parse().unwrap_or_default(),
            sk: EntityType::SpacePollUserAnswer(a.space_id.clone(), a.poll_id.clone()),

            id: a.id,
            actor_pk: a.actor_pk,
            poll_id: a.poll_id,
            space_id: a.space_id,
            created_at: a.created_at,
            answers: a.answers,
            respondent: a.respondent,
            user_pk: a.user_pk,
            display_name: a.display_name,
            profile_url: a.profile_url,
            username: a.username,
        }
    }
}

#[cfg(test)]
mod shipped_client_compat_tests {
    use super::*;

    /// The identity fields the shipped mobile build declares on this model.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedKeys {
        pk: Partition,
        sk: EntityType,
    }

    #[test]
    fn shipped_build_can_parse_current_answer() {
        let a = SpacePollUserAnswer {
            actor_pk: "USER#u1".into(),
            space_id: "sp1".into(),
            poll_id: "pl1".into(),
            ..Default::default()
        };
        let json = serde_json::to_value(&a).expect("serialize");
        assert_eq!(json["pk"], serde_json::json!("USER#u1"));
        serde_json::from_value::<ShippedKeys>(json).expect("shipped build must parse this");
    }

    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(SpacePollUserAnswer {
            actor_pk: "USER#u1".into(),
            ..Default::default()
        })
        .expect("serialize");
        json.as_object_mut().unwrap().remove("pk");
        let err = serde_json::from_value::<ShippedKeys>(json).expect_err("must fail");
        assert!(err.to_string().contains("missing field `pk`"), "got: {err}");
    }
}

// TypeScript binding (`make gen-ts` only). `SpacePollUserAnswer` serializes through
// `SpacePollUserAnswerWire`, which is exported under this name; delegate every method so
// references, declarations and the output file all come from the wire struct.
#[cfg(feature = "ts-bridge")]
impl ts_rs::TS for SpacePollUserAnswer {
    type WithoutGenerics = Self;

    fn ident() -> String {
        <SpacePollUserAnswerWire as ts_rs::TS>::ident()
    }
    fn decl() -> String {
        <SpacePollUserAnswerWire as ts_rs::TS>::decl()
    }
    fn decl_concrete() -> String {
        <SpacePollUserAnswerWire as ts_rs::TS>::decl_concrete()
    }
    fn name() -> String {
        <SpacePollUserAnswerWire as ts_rs::TS>::name()
    }
    fn inline() -> String {
        <SpacePollUserAnswerWire as ts_rs::TS>::inline()
    }
    fn inline_flattened() -> String {
        <SpacePollUserAnswerWire as ts_rs::TS>::inline_flattened()
    }
    fn visit_dependencies(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <SpacePollUserAnswerWire as ts_rs::TS>::visit_dependencies(v)
    }
    fn visit_generics(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <SpacePollUserAnswerWire as ts_rs::TS>::visit_generics(v)
    }
    fn output_path() -> Option<&'static std::path::Path> {
        <SpacePollUserAnswerWire as ts_rs::TS>::output_path()
    }
}
