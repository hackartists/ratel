//! Integration coverage for the Sampling space app: settings validation,
//! cell and population building, the `Open → Sampling → Ongoing`
//! transitions, first-come and random entry, and the role checks that keep
//! non-sampled users out once the space is ongoing.
use super::*;
use crate::common::models::space::{SpaceCommon, SpaceParticipant, SpaceStatusChangeEvent};
use crate::common::types::{Partition, SpacePublishState, SpaceStatus, SpaceVisibility};
use crate::features::auth::User;
use crate::features::spaces::pages::actions::actions::poll::models::SpacePoll;
use crate::features::spaces::pages::actions::actions::poll::types::{ChoiceQuestion, Question};
use crate::features::spaces::pages::actions::models::SpaceAction;
use crate::features::spaces::pages::actions::types::{SpaceActionStatus, SpaceActionType};
use crate::features::spaces::pages::apps::apps::sampling::{
    SamplingMemberStatus, SpaceSamplingCell, SpaceSamplingConfig, SpaceSamplingMember,
};
use axum::http::HeaderMap;
use postgres::PostgresEntity;
use serde_json::{Value, json};

struct Seeded {
    space_id: String,
    poll_id: String,
    discussion_poll_id: String,
}

fn choice(title: &str, options: &[&str]) -> Question {
    Question::SingleChoice(ChoiceQuestion {
        title: title.to_string(),
        description: None,
        image_url: None,
        options: options.iter().map(|o| o.to_string()).collect(),
        is_required: Some(true),
        allow_other: None,
    })
}

/// Seeds an `Open` space owned by the test user with an entry poll
/// (Q0 age `20s/30s`, Q1 gender `Male/Female`, Q2 resident `Yes/No`) marked
/// as prerequisite, one ongoing non-prerequisite poll, and the Sampling app
/// installed through the API.
async fn seed_sampling_space(ctx: &TestContext, join_anytime: bool, editable: bool) -> Seeded {
    let space_id = uuid::Uuid::new_v4().to_string();
    let now = crate::common::utils::time::get_now_timestamp_millis();

    let space = SpaceCommon {
        space_pk: Partition::Space(space_id.clone()).to_string(),
        created_at: now,
        updated_at: now,
        status: Some(SpaceStatus::Open),
        publish_state: SpacePublishState::Published,
        visibility: SpaceVisibility::Public,
        post_pk: Partition::Feed(space_id.clone()).to_string(),
        user_pk: ctx.test_user.0.pk().to_string(),
        author_display_name: ctx.test_user.0.display_name.clone(),
        author_profile_url: ctx.test_user.0.profile_url.clone(),
        author_username: ctx.test_user.0.username.clone(),
        join_anytime,
        quota: 1_000_000,
        remains: 1_000_000,
        ..Default::default()
    };
    space.create().await.expect("create space");

    let post = crate::features::posts::models::Post {
        id: uuid::Uuid::parse_str(&space_id).expect("uuid"),
        title: "Sampling Test Space".to_string(),
        ..Default::default()
    };
    post.create().await.expect("create post");

    let space_partition = crate::common::types::SpacePartition(space_id.clone());

    let mut poll = SpacePoll::new(space_partition.clone()).expect("new poll");
    poll.response_editable = editable;
    poll.questions.0.push(choice("Age group", &["20s", "30s"]));
    poll.questions.0.push(choice("Gender", &["Male", "Female"]));
    poll.questions.0.push(choice("Resident", &["Yes", "No"]));
    SpacePoll::repository()
        .insert(&poll)
        .await
        .expect("save poll");
    let mut action = SpaceAction::new(
        space_partition.clone(),
        poll.poll_id.clone(),
        SpaceActionType::Poll,
    );
    action.prerequisite = true;
    action.status = Some(SpaceActionStatus::Designing);
    action.save().await.expect("save entry action");

    let mut other = SpacePoll::new(space_partition.clone()).expect("new poll");
    other
        .questions
        .0
        .push(choice("Opinion", &["Agree", "Disagree"]));
    SpacePoll::repository()
        .insert(&other)
        .await
        .expect("save other poll");
    let mut other_action = SpaceAction::new(
        space_partition,
        other.poll_id.clone(),
        SpaceActionType::Poll,
    );
    other_action.status = Some(SpaceActionStatus::Ongoing);
    other_action.save().await.expect("save other action");

    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/apps", space_id),
        headers: ctx.test_user.1.clone(),
        body: { "app_type": "Sampling" }
    };
    assert_eq!(status, 200, "install sampling: {:?}", body);

    Seeded {
        space_id,
        poll_id: poll.poll_id,
        discussion_poll_id: other.poll_id,
    }
}

fn resident_yes(poll_id: &str) -> Value {
    json!([{ "poll_action_id": poll_id, "question_index": 2, "allowed_values": ["Yes"] }])
}

async fn put_config(
    ctx: &TestContext,
    s: &Seeded,
    rules: Value,
    dims: Value,
    total: i64,
    method: &str,
    recruit: bool,
) -> (axum::http::StatusCode, Value) {
    let (status, _, body) = crate::test_put! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/sampling", s.space_id),
        headers: ctx.test_user.1.clone(),
        body: {
            "req": {
                "entry_poll_id": s.poll_id,
                "population_rules": rules,
                "dimensions": dims,
                "total_samples": total,
                "allocation": "Equal",
                "method": method,
                "allow_recruit_during_sampling": recruit
            }
        }
    };
    (status, body)
}

async fn patch_space(
    ctx: &TestContext,
    space_id: &str,
    req: Value,
) -> (axum::http::StatusCode, Value) {
    let (status, _, body) = crate::test_patch! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}", space_id),
        headers: ctx.test_user.1.clone(),
        body: { "req": req }
    };
    (status, body)
}

async fn answer(
    ctx: &TestContext,
    s: &Seeded,
    headers: &HeaderMap,
    picks: [i32; 3],
) -> (axum::http::StatusCode, Value) {
    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/polls/{}/respond", s.space_id, s.poll_id),
        headers: headers.clone(),
        body: {
            "req": {
                "answers": [
                    { "answer_type": "single_choice", "answer": picks[0] },
                    { "answer_type": "single_choice", "answer": picks[1] },
                    { "answer_type": "single_choice", "answer": picks[2] }
                ]
            }
        }
    };
    (status, body)
}

/// Creates a participant of the space and answers the entry poll.
async fn join_and_answer(ctx: &TestContext, s: &Seeded, picks: [i32; 3]) -> (User, HeaderMap) {
    let (user, headers) = ctx.create_another_user().await;
    SpaceParticipant::new(Partition::Space(s.space_id.clone()), user.pk())
        .create()
        .await
        .expect("create participant");
    let (status, body) = answer(ctx, s, &headers, picks).await;
    assert_eq!(status, 200, "respond entry poll: {:?}", body);
    (user, headers)
}

async fn enter(
    ctx: &TestContext,
    s: &Seeded,
    headers: &HeaderMap,
) -> (axum::http::StatusCode, Value) {
    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/sampling/enter", s.space_id),
        headers: headers.clone(),
    };
    (status, body)
}

async fn my_state(ctx: &TestContext, s: &Seeded, headers: &HeaderMap) -> String {
    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/sampling/me", s.space_id),
        headers: headers.clone(),
    };
    assert_eq!(status, 200, "my sampling status: {:?}", body);
    body["state"].as_str().unwrap_or_default().to_string()
}

async fn dashboard(ctx: &TestContext, s: &Seeded) -> Value {
    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/sampling/dashboard", s.space_id),
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(status, 200, "dashboard: {:?}", body);
    body
}

async fn role_of(ctx: &TestContext, s: &Seeded, headers: &HeaderMap) -> String {
    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/user-role", s.space_id),
        headers: headers.clone(),
    };
    assert_eq!(status, 200, "user role: {:?}", body);
    body.as_str().unwrap_or_default().to_string()
}

fn error_text(body: &Value) -> String {
    body.to_string()
}

async fn member_status(s: &Seeded, user: &User) -> Option<SamplingMemberStatus> {
    SpaceSamplingMember::get_for(&s.space_id, &user.pk().to_string())
        .await
        .expect("member lookup")
        .map(|m| m.status)
}

#[by_macros::pg_test]
async fn test_upsert_config_validation() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, true, false).await;

    let other = Seeded {
        space_id: s.space_id.clone(),
        poll_id: s.discussion_poll_id.clone(),
        discussion_poll_id: String::new(),
    };
    let (status, body) =
        put_config(&ctx, &other, json!([]), json!([0]), 4, "FirstCome", false).await;
    assert_eq!(status, 400, "non-prerequisite poll: {:?}", body);
    assert!(error_text(&body).contains("InvalidEntryPoll"), "{body}");

    let (status, body) =
        put_config(&ctx, &s, json!([]), json!([0, 0]), 4, "FirstCome", false).await;
    assert_eq!(status, 400);
    assert!(error_text(&body).contains("InvalidDimension"), "{body}");

    let foreign_rule = json!([{ "poll_action_id": s.discussion_poll_id, "question_index": 0, "allowed_values": ["Agree"] }]);
    let (status, body) =
        put_config(&ctx, &s, foreign_rule, json!([0]), 4, "FirstCome", false).await;
    assert_eq!(status, 400);
    assert!(error_text(&body).contains("InvalidRule"), "{body}");

    let (status, body) = put_config(&ctx, &s, json!([]), json!([0]), 0, "FirstCome", false).await;
    assert_eq!(status, 400);
    assert!(error_text(&body).contains("InvalidTotal"), "{body}");

    let (_, outsider) = ctx.create_another_user().await;
    let (status, _, _) = crate::test_put! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/sampling", s.space_id),
        headers: outsider,
        body: { "req": { "entry_poll_id": s.poll_id, "total_samples": 4 } }
    };
    assert_ne!(status, 200, "non-creator must not save settings");
}

#[by_macros::pg_test]
async fn test_upsert_config_builds_cells_and_population() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, true, false).await;

    let (a, _) = join_and_answer(&ctx, &s, [0, 0, 0]).await;
    let (b, _) = join_and_answer(&ctx, &s, [1, 1, 0]).await;
    let (c, _) = join_and_answer(&ctx, &s, [1, 0, 1]).await;

    let (status, body) = put_config(
        &ctx,
        &s,
        resident_yes(&s.poll_id),
        json!([0, 1]),
        6,
        "FirstCome",
        false,
    )
    .await;
    assert_eq!(status, 200, "save: {:?}", body);
    let targets: Vec<i64> = body["cells"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["target"].as_i64().unwrap())
        .collect();
    assert_eq!(targets, vec![2, 2, 1, 1]);
    assert_eq!(body["cells"][1]["labels"], json!(["20s", "Female"]));

    let a_member = SpaceSamplingMember::get_for(&s.space_id, &a.pk().to_string())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(a_member.cell_key, "0-0");
    let b_member = SpaceSamplingMember::get_for(&s.space_id, &b.pk().to_string())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(b_member.cell_key, "1-1");
    assert!(
        member_status(&s, &c).await.is_none(),
        "resident=No must be excluded"
    );

    let cells = SpaceSamplingCell::list_by_space(&s.space_id).await.unwrap();
    assert_eq!(
        cells.iter().map(|c| c.remains).collect::<Vec<_>>(),
        vec![2, 2, 1, 1]
    );
}

#[by_macros::pg_test]
async fn test_preview_remainder() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, true, false).await;

    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/sampling/preview", s.space_id),
        headers: ctx.test_user.1.clone(),
        body: { "req": { "entry_poll_id": s.poll_id, "dimensions": [0, 1], "total_samples": 7 } }
    };
    assert_eq!(status, 200, "preview: {:?}", body);
    let targets: Vec<i64> = body
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["target"].as_i64().unwrap())
        .collect();
    assert_eq!(targets, vec![2, 2, 2, 1]);
    assert!(
        SpaceSamplingConfig::get_for(&s.space_id)
            .await
            .unwrap()
            .is_none()
    );
    assert!(
        SpaceSamplingCell::list_by_space(&s.space_id)
            .await
            .unwrap()
            .is_empty()
    );
}

#[by_macros::pg_test]
async fn test_start_blocked_without_sampling() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, true, false).await;

    let (status, body) = patch_space(&ctx, &s.space_id, json!({ "start": true })).await;
    assert_eq!(status, 400, "{body}");
    assert!(error_text(&body).contains("SamplingRequired"), "{body}");
}

#[by_macros::pg_test]
async fn test_sampling_requires_config() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, true, false).await;

    let (status, body) = patch_space(&ctx, &s.space_id, json!({ "sampling": true })).await;
    assert_eq!(status, 400, "{body}");
    assert!(error_text(&body).contains("NotConfigured"), "{body}");
}

#[by_macros::pg_test]
async fn test_sampling_rejects_outdated_config() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, true, false).await;
    let (status, _) = put_config(&ctx, &s, json!([]), json!([0]), 2, "FirstCome", false).await;
    assert_eq!(status, 200);

    let space_partition = crate::common::types::SpacePartition(s.space_id.clone());
    let mut poll = SpacePoll::get_one(
        &space_partition,
        &crate::SpacePollEntityType(s.poll_id.clone()),
    )
    .await
    .unwrap()
    .unwrap();
    poll.questions.0[0] = choice("Age group", &["Teens", "30s"]);
    SpacePoll::repository()
        .update(
            poll.id,
            SpacePoll::update().questions(poll.questions.clone()),
        )
        .await
        .unwrap();

    let (status, body) = patch_space(&ctx, &s.space_id, json!({ "sampling": true })).await;
    assert_eq!(status, 400, "{body}");
    assert!(error_text(&body).contains("ConfigOutdated"), "{body}");
}

#[by_macros::pg_test]
async fn test_open_sampling_ongoing_transitions_and_lock() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, true, false).await;
    let (status, _) = put_config(&ctx, &s, json!([]), json!([0]), 2, "FirstCome", false).await;
    assert_eq!(status, 200);

    let (status, body) = patch_space(&ctx, &s.space_id, json!({ "sampling": true })).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(body["status"], "Sampling");

    let (status, body) = put_config(&ctx, &s, json!([]), json!([0]), 3, "FirstCome", false).await;
    assert_eq!(status, 400, "config must be locked: {body}");
    assert!(error_text(&body).contains("ConfigLocked"), "{body}");

    let (status, _, body) = crate::test_delete! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/apps", s.space_id),
        headers: ctx.test_user.1.clone(),
        body: { "app_type": "Sampling" }
    };
    assert_eq!(status, 400, "uninstall must be locked: {body}");

    let (status, body) = patch_space(&ctx, &s.space_id, json!({ "start": true })).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(body["status"], "Ongoing");

    let space_pk = Partition::Space(s.space_id.clone()).to_string();
    let events = SpaceStatusChangeEvent::repository()
        .find(SpaceStatusChangeEvent::query().space_pk(postgres::ops::StringOp::Eq(space_pk)))
        .await
        .unwrap()
        .items;
    let pairs: Vec<(Option<SpaceStatus>, SpaceStatus)> = events
        .into_iter()
        .map(|e| (e.old_status, e.new_status))
        .collect();
    assert!(
        pairs.contains(&(Some(SpaceStatus::Open), SpaceStatus::Sampling)),
        "{pairs:?}"
    );
    assert!(
        pairs.contains(&(Some(SpaceStatus::Sampling), SpaceStatus::Ongoing)),
        "{pairs:?}"
    );
}

#[by_macros::pg_test]
async fn test_population_on_respond() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, true, true).await;
    let (status, _) = put_config(
        &ctx,
        &s,
        resident_yes(&s.poll_id),
        json!([0, 1]),
        4,
        "FirstCome",
        false,
    )
    .await;
    assert_eq!(status, 200);

    let (u, headers) = join_and_answer(&ctx, &s, [1, 0, 0]).await;
    let m = SpaceSamplingMember::get_for(&s.space_id, &u.pk().to_string())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(m.cell_key, "1-0");

    let (status, body) = answer(&ctx, &s, &headers, [0, 1, 0]).await;
    assert_eq!(status, 200, "{body}");
    let m = SpaceSamplingMember::get_for(&s.space_id, &u.pk().to_string())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        m.cell_key, "0-1",
        "editing the answer moves a population member"
    );

    let (status, _) = answer(&ctx, &s, &headers, [0, 1, 1]).await;
    assert_eq!(status, 200);
    assert!(
        member_status(&s, &u).await.is_none(),
        "failing the rule removes the member"
    );

    let (v, _) = join_and_answer(&ctx, &s, [0, 0, 1]).await;
    assert!(member_status(&s, &v).await.is_none());
}

#[by_macros::pg_test]
async fn test_first_come_concurrent_enter() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, false, false).await;
    let (status, _) = put_config(&ctx, &s, json!([]), json!([0]), 2, "FirstCome", false).await;
    assert_eq!(status, 200);

    let mut users = Vec::new();
    for _ in 0..5 {
        users.push(join_and_answer(&ctx, &s, [0, 0, 0]).await);
    }
    let (status, body) = patch_space(&ctx, &s.space_id, json!({ "sampling": true })).await;
    assert_eq!(status, 200, "{body}");
    assert_eq!(my_state(&ctx, &s, &users[0].1).await, "CanEnter");

    let results = futures::future::join_all(users.iter().map(|(_, h)| enter(&ctx, &s, h))).await;
    let ok = results.iter().filter(|(st, _)| *st == 200).count();
    assert_eq!(ok, 1, "exactly one seat in cell 20s: {results:?}");
    for (st, body) in results.iter().filter(|(st, _)| *st != 200) {
        assert_eq!(*st, 400);
        assert!(error_text(body).contains("CellFull"), "{body}");
    }
    let cells = SpaceSamplingCell::list_by_space(&s.space_id).await.unwrap();
    assert_eq!(cells[0].remains, 0);

    let loser = users
        .iter()
        .zip(results.iter())
        .find(|(_, (st, _))| *st != 200)
        .map(|((_, h), _)| h.clone())
        .unwrap();
    assert_eq!(my_state(&ctx, &s, &loser).await, "CellFull");
}

#[by_macros::pg_test]
async fn test_enter_idempotent() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, false, false).await;
    let (status, _) = put_config(&ctx, &s, json!([]), json!([0]), 4, "FirstCome", false).await;
    assert_eq!(status, 200);
    let (_, headers) = join_and_answer(&ctx, &s, [0, 0, 0]).await;
    let (status, _) = patch_space(&ctx, &s.space_id, json!({ "sampling": true })).await;
    assert_eq!(status, 200);

    let (st1, b1) = enter(&ctx, &s, &headers).await;
    let (st2, b2) = enter(&ctx, &s, &headers).await;
    assert_eq!((st1.as_u16(), st2.as_u16()), (200, 200), "{b1} {b2}");
    assert_eq!(b1["state"], "Entered");
    assert_eq!(b2["state"], "Entered");
    let cells = SpaceSamplingCell::list_by_space(&s.space_id).await.unwrap();
    assert_eq!(cells[0].remains, 1);
}

#[by_macros::pg_test]
async fn test_random_selection_counts() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, false, false).await;
    let (status, _) = put_config(&ctx, &s, json!([]), json!([0]), 3, "Random", false).await;
    assert_eq!(status, 200);

    let (_, h20) = join_and_answer(&ctx, &s, [0, 0, 0]).await;
    let mut thirties = Vec::new();
    for _ in 0..3 {
        thirties.push(join_and_answer(&ctx, &s, [1, 0, 0]).await);
    }
    assert_eq!(my_state(&ctx, &s, &h20).await, "Waiting");

    let (status, body) = patch_space(&ctx, &s.space_id, json!({ "sampling": true })).await;
    assert_eq!(status, 200, "{body}");

    let dash = dashboard(&ctx, &s).await;
    assert_eq!(dash["rows"][0]["target"], 2);
    assert_eq!(dash["rows"][0]["selected"], 1);
    assert_eq!(dash["rows"][0]["shortage"], true);
    assert_eq!(dash["rows"][1]["target"], 1);
    assert_eq!(dash["rows"][1]["population"], 3);
    assert_eq!(dash["rows"][1]["selected"], 1);
    let cells = SpaceSamplingCell::list_by_space(&s.space_id).await.unwrap();
    assert_eq!(
        cells.iter().map(|c| c.remains).collect::<Vec<_>>(),
        vec![1, 0]
    );

    let mut selected = 0;
    for (u, h) in &thirties {
        match member_status(&s, u).await {
            Some(SamplingMemberStatus::Selected) => {
                selected += 1;
                assert_eq!(my_state(&ctx, &s, h).await, "Selected");
                let (st, body) = enter(&ctx, &s, h).await;
                assert_eq!(st, 200, "{body}");
            }
            _ => {
                assert_eq!(my_state(&ctx, &s, h).await, "NotSelected");
                let (st, body) = enter(&ctx, &s, h).await;
                assert_eq!(st, 400);
                assert!(error_text(&body).contains("NotSelected"), "{body}");
            }
        }
    }
    assert_eq!(selected, 1);
}

#[by_macros::pg_test]
async fn test_recruit_during_sampling_on() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, false, false).await;
    let (status, _) = put_config(&ctx, &s, json!([]), json!([0]), 2, "FirstCome", true).await;
    assert_eq!(status, 200);
    let (status, _) = patch_space(&ctx, &s.space_id, json!({ "sampling": true })).await;
    assert_eq!(status, 200);

    let (late, headers) = join_and_answer(&ctx, &s, [1, 0, 0]).await;
    assert_eq!(
        member_status(&s, &late).await,
        Some(SamplingMemberStatus::Population)
    );
    assert_eq!(my_state(&ctx, &s, &headers).await, "CanEnter");
}

#[by_macros::pg_test]
async fn test_recruit_during_sampling_off() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, false, false).await;
    let (status, _) = put_config(&ctx, &s, json!([]), json!([0]), 2, "FirstCome", false).await;
    assert_eq!(status, 200);
    let (status, _) = patch_space(&ctx, &s.space_id, json!({ "sampling": true })).await;
    assert_eq!(status, 200);

    let (_, newcomer) = ctx.create_another_user().await;
    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/participate", s.space_id),
        headers: newcomer.clone(),
        body: { "body": { "informed_agreed": true } }
    };
    assert_ne!(status, 200, "participation must be closed: {body}");
    assert!(error_text(&body).contains("ParticipationNotOpen"), "{body}");

    let (u, h) = ctx.create_another_user().await;
    SpaceParticipant::new(Partition::Space(s.space_id.clone()), u.pk())
        .create()
        .await
        .unwrap();
    let (status, body) = answer(&ctx, &s, &h, [0, 0, 0]).await;
    assert_ne!(
        status, 200,
        "candidate cannot answer while recruiting is closed: {body}"
    );
    assert!(error_text(&body).contains("PollNotInProgress"), "{body}");
    assert_eq!(my_state(&ctx, &s, &h).await, "RecruitClosed");
}

#[by_macros::pg_test]
async fn test_role_after_ongoing_join_anytime_off() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, false, false).await;
    let (status, _) = put_config(&ctx, &s, json!([]), json!([0]), 1, "FirstCome", false).await;
    assert_eq!(status, 200);
    let (_, entered) = join_and_answer(&ctx, &s, [0, 0, 0]).await;
    let (_, waiting) = join_and_answer(&ctx, &s, [0, 0, 0]).await;
    let (status, _) = patch_space(&ctx, &s.space_id, json!({ "sampling": true })).await;
    assert_eq!(status, 200);
    let (st, body) = enter(&ctx, &s, &entered).await;
    assert_eq!(st, 200, "{body}");
    let (status, _) = patch_space(&ctx, &s.space_id, json!({ "start": true })).await;
    assert_eq!(status, 200);

    assert_eq!(role_of(&ctx, &s, &entered).await, "Participant");
    assert_eq!(role_of(&ctx, &s, &waiting).await, "Candidate");
    assert_eq!(my_state(&ctx, &s, &waiting).await, "SampleClosed");

    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/polls/{}/respond", s.space_id, s.discussion_poll_id),
        headers: waiting.clone(),
        body: { "req": { "answers": [{ "answer_type": "single_choice", "answer": 0 }] } }
    };
    assert_ne!(status, 200, "non-sampled member must not act: {body}");
}

#[by_macros::pg_test]
async fn test_role_after_ongoing_join_anytime_on() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, true, false).await;
    let (status, _) = put_config(&ctx, &s, json!([]), json!([0]), 1, "Random", false).await;
    assert_eq!(status, 200);
    let (_, a) = join_and_answer(&ctx, &s, [0, 0, 0]).await;
    let (_, b) = join_and_answer(&ctx, &s, [0, 0, 0]).await;
    let (status, _) = patch_space(&ctx, &s.space_id, json!({ "sampling": true })).await;
    assert_eq!(status, 200);
    let (status, _) = patch_space(&ctx, &s.space_id, json!({ "start": true })).await;
    assert_eq!(status, 200);

    assert_eq!(role_of(&ctx, &s, &a).await, "Participant");
    assert_eq!(role_of(&ctx, &s, &b).await, "Participant");
}

#[by_macros::pg_test]
async fn test_dashboard_counts() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, false, false).await;
    let (status, _) = put_config(&ctx, &s, json!([]), json!([0]), 3, "FirstCome", false).await;
    assert_eq!(status, 200);
    let (_, a) = join_and_answer(&ctx, &s, [0, 0, 0]).await;
    let (_, b) = join_and_answer(&ctx, &s, [1, 0, 0]).await;
    let (status, _) = patch_space(&ctx, &s.space_id, json!({ "sampling": true })).await;
    assert_eq!(status, 200);
    assert_eq!(enter(&ctx, &s, &a).await.0, 200);
    assert_eq!(enter(&ctx, &s, &b).await.0, 200);

    let dash = dashboard(&ctx, &s).await;
    let row0 = &dash["rows"][0];
    assert_eq!(
        (
            row0["target"].as_i64(),
            row0["population"].as_i64(),
            row0["entered"].as_i64()
        ),
        (Some(2), Some(1), Some(1))
    );
    assert_eq!(row0["shortage"], true);
    assert_eq!(row0["filled"], false);
    let row1 = &dash["rows"][1];
    assert_eq!(
        (
            row1["target"].as_i64(),
            row1["population"].as_i64(),
            row1["entered"].as_i64()
        ),
        (Some(1), Some(1), Some(1))
    );
    assert_eq!(row1["shortage"], false);
    assert_eq!(row1["filled"], true);
    assert_eq!(dash["totals"]["entered"], 2);
    assert_eq!(dash["method"], "FirstCome");
}

#[by_macros::pg_test]
async fn test_uninstall_cleans_up() {
    let ctx = TestContext::setup().await;
    let s = seed_sampling_space(&ctx, true, false).await;
    let (status, _) = put_config(&ctx, &s, json!([]), json!([0]), 2, "FirstCome", true).await;
    assert_eq!(status, 200);
    join_and_answer(&ctx, &s, [0, 0, 0]).await;

    let (status, _, body) = crate::test_delete! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/apps", s.space_id),
        headers: ctx.test_user.1.clone(),
        body: { "app_type": "Sampling" }
    };
    assert_eq!(status, 200, "uninstall: {body}");

    assert!(
        SpaceSamplingConfig::get_for(&s.space_id)
            .await
            .unwrap()
            .is_none()
    );
    assert!(
        SpaceSamplingCell::list_by_space(&s.space_id)
            .await
            .unwrap()
            .is_empty()
    );
    assert!(
        SpaceSamplingMember::list_by_space(&s.space_id)
            .await
            .unwrap()
            .is_empty()
    );
    let space = SpaceCommon::get_by_partition(&Partition::Space(s.space_id.clone()))
        .await
        .unwrap()
        .unwrap();
    assert!(!space.sampling_enabled);
    assert!(!space.sampling_recruit_open);

    let (status, body) = patch_space(&ctx, &s.space_id, json!({ "start": true })).await;
    assert_eq!(status, 200, "{body}");
}
