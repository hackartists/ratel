//! Auto analysis pipeline — runs once per AnalyzeReport on insert via
//! the DDB stream Lambda. Computes the matched-user intersection from
//! the saved filters, then fans out per-source aggregations:
//!
//! - **Poll**: for every poll in the space, walk every response by a
//!   matched user and bucket choice indices into `OptionTally`s.
//!   Free-text answers (Short/Subjective) get collected as raw strings
//!   so the panel can list them verbatim.
//! - **Quiz**: for every quiz × matched user, fetch the latest attempt
//!   from the `quiz_user`-keyed GSI (one O(1) hit per pair), bucket
//!   answer indices, and count matches against the quiz's
//!   `correct_answers`.
//! - **Follow**: for every space-defined follow target, query its
//!   followers and intersect with the matched-user set. Top-N targets
//!   by follower-count-among-matched are surfaced; the rest dropped.
//!
//! The result row is written FIRST, then `AnalyzeReport.status` is
//! flipped to `Finish`. If the Lambda crashes mid-write, a retry would
//! find the result already exists; the upsert path overwrites cleanly.

use crate::common::utils::time::get_now_timestamp_millis;
use crate::features::spaces::pages::apps::apps::analyzes::*;
use postgres::PostgresEntity;
use std::collections::HashMap;
use std::collections::HashSet;

const TOP_N_FOLLOW: usize = 30;

pub async fn process_analyze_report(
    cli: &aws_sdk_dynamodb::Client,
    report: &SpaceAnalyzeReport,
) -> Result<()> {
    let space_pk = report.space_partition();
    let report_id = report.report_id();

    // 1. Determine matched user_pks. Empty filter list means "all
    //    space participants" — same semantics as the preview endpoint.
    let matched_users: HashSet<String> = if report.filters.is_empty() {
        services::intersection::list_participant_user_pks(cli, &space_pk)
            .await?
            .into_iter()
            .map(|p| p.to_string())
            .collect()
    } else {
        let (set, _, _) =
            services::intersection::intersect_filters(cli, &space_pk, &report.filters).await?;
        set
    };

    // 2. Run aggregations concurrently — they're independent reads.
    let (poll_aggregates, quiz_aggregates, follow_aggregates) = futures::future::try_join3(
        aggregate_polls(cli, &space_pk, &matched_users),
        aggregate_quizzes(cli, &space_pk, &matched_users),
        aggregate_follows(cli, &space_pk, &matched_users),
    )
    .await?;

    // 3. Persist the result row. Error::Aws from the underlying SDK
    //    converts via `#[from]` so `?` is enough.
    let mut result = SpaceAnalyzeReportResult::new(space_pk.clone(), report_id.clone());
    result.respondent_count = matched_users.len() as i64;
    result.poll_aggregates = PollAggregates(poll_aggregates);
    result.quiz_aggregates = QuizAggregates(quiz_aggregates);
    result.follow_aggregates = FollowAggregates(follow_aggregates);
    SpaceAnalyzeReportResult::repository().insert(&result).await?;

    // 4. Flip the parent report's status. Any consumers gated on
    //    `status==Finish` (list-card click, refetch) start working here.
    SpaceAnalyzeReport::repository()
        .update(
            report.id,
            SpaceAnalyzeReport::update()
                .status(AnalyzeReportStatus::Finish)
                .respondent_count(matched_users.len() as i64)
                .updated_at(get_now_timestamp_millis()),
        )
        .await?;

    Ok(())
}

// ── Poll aggregation ──────────────────────────────────────────────

async fn aggregate_polls(
    cli: &aws_sdk_dynamodb::Client,
    space_pk: &Partition,
    matched_users: &HashSet<String>,
) -> Result<Vec<PollQuestionAggregate>> {
    use crate::features::spaces::pages::actions::actions::poll::SpacePollUserAnswer;

    // Pull every poll in the space — same prefix scan list_analyze_polls
    // uses. We need the question definitions to label tallies.
    let polls = list_all_polls(cli, space_pk).await?;
    if polls.is_empty() {
        return Ok(Vec::new());
    }

    let mut aggregates: Vec<PollQuestionAggregate> = Vec::new();

    for poll in polls {
        let poll_id = poll.poll_id.clone();
        let poll_title = poll.title.clone();

        // Gather all answers for this poll.
        let poll_sk = EntityType::SpacePoll(poll_id.clone());
        let mut answers_by_user: HashMap<String, Vec<crate::features::spaces::pages::actions::actions::poll::Answer>> = HashMap::new();
        let rows = SpacePollUserAnswer::list_by_poll(space_pk, &poll_sk).await?;
        for row in rows {
            let user_key = row.actor_pk.clone();
            if matched_users.contains(&user_key) {
                answers_by_user.insert(user_key, row.answers.0);
            }
        }

        // Bucket per question.
        for (q_idx, question) in poll.questions.iter().enumerate() {
            let labels = question_option_labels(question);
            let is_text = matches!(
                question,
                crate::features::spaces::pages::actions::actions::poll::Question::ShortAnswer(_)
                    | crate::features::spaces::pages::actions::actions::poll::Question::Subjective(_)
            );

            let mut option_counts: Vec<u32> = vec![0; labels.len()];
            let mut text_answers: Vec<String> = Vec::new();
            let mut respondent_count: u32 = 0;

            for answers in answers_by_user.values() {
                let answer = match answers.get(q_idx) {
                    Some(a) => a,
                    None => continue,
                };

                if is_text {
                    if let Some(text) = answer_text(answer) {
                        if !text.trim().is_empty() {
                            text_answers.push(text);
                            respondent_count += 1;
                        }
                    }
                } else {
                    let indices = normalize_option_indices(question, &answer.to_option_indices());
                    if indices.is_empty() {
                        continue;
                    }
                    respondent_count += 1;
                    for idx in indices {
                        if (idx as usize) < option_counts.len() {
                            option_counts[idx as usize] += 1;
                        }
                    }
                }
            }

            // Skip questions nobody touched.
            if respondent_count == 0 {
                continue;
            }

            aggregates.push(PollQuestionAggregate {
                poll_id: poll_id.clone(),
                poll_title: poll_title.clone(),
                question_idx: q_idx,
                question_title: question.title().to_string(),
                options: labels
                    .into_iter()
                    .zip(option_counts.into_iter())
                    .map(|(label, count)| OptionTally { label, count })
                    .collect(),
                respondent_count,
                text_answers,
            });
        }
    }

    Ok(aggregates)
}

async fn list_all_polls(
    // No longer used — `SpacePoll` is Postgres-backed now and reads from the
    // global connection pool. Kept so call sites don't need to change.
    _cli: &aws_sdk_dynamodb::Client,
    space_pk: &Partition,
) -> Result<Vec<crate::features::spaces::pages::actions::actions::poll::SpacePoll>> {
    use crate::features::spaces::pages::actions::actions::poll::{SpacePoll, SpacePollColumn};
    use postgres::ops::StringOp;
    use postgres::{Order, PostgresEntity};

    let space_id = match space_pk {
        Partition::Space(id) => id.clone(),
        other => other.to_string(),
    };

    SpacePoll::repository()
        .find(
            SpacePoll::query()
                .space_id(StringOp::Eq(space_id))
                .order_by(SpacePollColumn::CreatedAt, Order::Asc),
        )
        .await
        .map(|p| p.items)
        .map_err(crate::common::Error::from)
}

// ── Quiz aggregation ──────────────────────────────────────────────

async fn aggregate_quizzes(
    cli: &aws_sdk_dynamodb::Client,
    space_pk: &Partition,
    matched_users: &HashSet<String>,
) -> Result<Vec<QuizQuestionAggregate>> {
    use crate::features::spaces::pages::actions::actions::quiz::{SpaceQuizAnswer, SpaceQuizAttempt};
    use crate::features::spaces::pages::actions::models::SpaceAction;

    let quizzes = list_all_quizzes(cli, space_pk).await?;
    if quizzes.is_empty() {
        return Ok(Vec::new());
    }

    // Quiz title lives on SpaceAction, `(space_id, action_id=quiz_id)`.
    // Fetch each title concurrently. Fall back to empty title on miss.
    let space_id: SpacePartition = match space_pk {
        Partition::Space(id) => SpacePartition(id.clone()),
        _ => SpacePartition::default(),
    };
    let action_lookups = quizzes.iter().map(|quiz| {
        let quiz_id = quiz.quiz_id.clone();
        let space_id = space_id.clone();
        async move {
            let title = SpaceAction::get_one(&space_id, &quiz_id)
                .await
                .ok()
                .flatten()
                .map(|a| a.title);
            (quiz_id, title)
        }
    });
    let title_by_quiz_id: HashMap<String, String> = futures::future::join_all(action_lookups)
        .await
        .into_iter()
        .filter_map(|(quiz_id, title)| title.map(|t| (quiz_id, t)))
        .collect();

    let mut aggregates: Vec<QuizQuestionAggregate> = Vec::new();

    for quiz in quizzes {
        let quiz_id_str = quiz.quiz_id.clone();
        let quiz_title = title_by_quiz_id
            .get(&quiz_id_str)
            .cloned()
            .unwrap_or_default();
        let quiz_id_st: SpaceQuizEntityType = quiz_id_str.clone().into();

        // Pull correct answers from SpaceQuizAnswer (gated by quiz id).
        // Best-effort: if missing, fall back to empty correct sets.
        let correct_answers = SpaceQuizAnswer::get_one(&space_id, &quiz_id_st)
            .await
            .ok()
            .flatten()
            .map(|a| a.answers.0)
            .unwrap_or_default();

        // For each matched user, fetch their latest attempt for this
        // quiz. Run lookups concurrently.
        let user_partitions: Vec<Partition> = matched_users
            .iter()
            .filter_map(|s| s.parse::<Partition>().ok())
            .collect();

        let lookups = user_partitions.iter().map(|user_pk| {
            let quiz_id = quiz_id_st.clone();
            let user_pk = user_pk.clone();
            async move {
                let attempt =
                    SpaceQuizAttempt::find_latest_by_quiz_user(&quiz_id, &user_pk).await;
                attempt
            }
        });
        let attempt_results = futures::future::join_all(lookups).await;

        // Materialise attempts.
        let mut attempts: Vec<SpaceQuizAttempt> = Vec::new();
        for r in attempt_results {
            if let Ok(Some(attempt)) = r {
                attempts.push(attempt);
            }
        }

        for (q_idx, question) in quiz.questions.iter().enumerate() {
            let labels = question_option_labels(question);
            let is_text = matches!(
                question,
                crate::features::spaces::pages::actions::actions::poll::Question::ShortAnswer(_)
                    | crate::features::spaces::pages::actions::actions::poll::Question::Subjective(_)
            );

            let mut option_counts: Vec<u32> = vec![0; labels.len()];
            let mut text_answers: Vec<String> = Vec::new();
            let mut respondent_count: u32 = 0;
            let mut correct_count: u32 = 0;

            let correct_indices: Vec<u32> = correct_indices_at(&correct_answers, q_idx);

            for attempt in &attempts {
                let answer = match attempt.answers.get(q_idx) {
                    Some(a) => a,
                    None => continue,
                };

                if is_text {
                    if let Some(text) = answer_text(answer) {
                        if !text.trim().is_empty() {
                            text_answers.push(text);
                            respondent_count += 1;
                        }
                    }
                } else {
                    let picked = normalize_option_indices(question, &answer.to_option_indices());
                    if picked.is_empty() {
                        continue;
                    }
                    respondent_count += 1;
                    for idx in &picked {
                        if (*idx as usize) < option_counts.len() {
                            option_counts[*idx as usize] += 1;
                        }
                    }
                    if !correct_indices.is_empty() && picked.iter().any(|i| correct_indices.contains(i)) {
                        correct_count += 1;
                    }
                }
            }

            if respondent_count == 0 {
                continue;
            }

            aggregates.push(QuizQuestionAggregate {
                quiz_id: quiz_id_str.clone(),
                quiz_title: quiz_title.clone(),
                question_idx: q_idx,
                question_title: question.title().to_string(),
                options: labels
                    .into_iter()
                    .zip(option_counts.into_iter())
                    .map(|(label, count)| OptionTally { label, count })
                    .collect(),
                correct_indices,
                correct_count,
                respondent_count,
                text_answers,
            });
        }
    }

    Ok(aggregates)
}

async fn list_all_quizzes(
    // No longer used — `SpaceQuiz` is Postgres-backed now and reads from the
    // global connection pool. Kept so call sites don't need to change.
    _cli: &aws_sdk_dynamodb::Client,
    space_pk: &Partition,
) -> Result<Vec<crate::features::spaces::pages::actions::actions::quiz::SpaceQuiz>> {
    use crate::features::spaces::pages::actions::actions::quiz::{SpaceQuiz, SpaceQuizColumn};
    use postgres::ops::StringOp;
    use postgres::{Order, PostgresEntity};

    let space_id = match space_pk {
        Partition::Space(id) => id.clone(),
        other => other.to_string(),
    };

    SpaceQuiz::repository()
        .find(
            SpaceQuiz::query()
                .space_id(StringOp::Eq(space_id))
                .order_by(SpaceQuizColumn::CreatedAt, Order::Asc),
        )
        .await
        .map(|p| p.items)
        .map_err(crate::common::Error::from)
}

fn correct_indices_at(
    answers: &[crate::features::spaces::pages::actions::actions::quiz::QuizCorrectAnswer],
    idx: usize,
) -> Vec<u32> {
    use crate::features::spaces::pages::actions::actions::quiz::QuizCorrectAnswer;
    match answers.get(idx) {
        Some(QuizCorrectAnswer::Single { answer: Some(v) }) => vec![*v as u32],
        Some(QuizCorrectAnswer::Multiple { answers }) => {
            answers.iter().map(|v| *v as u32).collect()
        }
        _ => Vec::new(),
    }
}

// ── Follow aggregation ────────────────────────────────────────────

async fn aggregate_follows(
    // No longer used — `SpaceFollowUser` / `UserFollow` are Postgres-backed
    // now and read from the global connection pool. Kept so call sites
    // don't need to change.
    _cli: &aws_sdk_dynamodb::Client,
    space_pk: &Partition,
    matched_users: &HashSet<String>,
) -> Result<Vec<FollowTargetAggregate>> {
    use crate::common::models::auth::UserFollow;
    use crate::features::spaces::pages::actions::actions::follow::SpaceFollowUser;

    // Space-defined follow targets — the same list the cross-filter
    // picker shows.
    let space_partition: SpacePartition = space_pk.clone().into();
    let mut targets: Vec<SpaceFollowUser> = Vec::new();
    let mut bookmark: Option<String> = None;
    loop {
        let (rows, next) =
            SpaceFollowUser::list_by_space(&space_partition, bookmark, 50).await?;
        targets.extend(rows);
        match next {
            Some(b) => bookmark = Some(b),
            None => break,
        }
    }
    if targets.is_empty() {
        return Ok(Vec::new());
    }

    // For each target, walk its followers and count matched users.
    let mut aggregates: Vec<FollowTargetAggregate> = Vec::new();
    for target in targets {
        let target_partition = target.user_partition();
        if target_partition == Partition::None {
            continue;
        }

        let mut count: u32 = 0;
        let mut page: i64 = 1;
        const PAGE_SIZE: i64 = 100;
        loop {
            let result = UserFollow::list_followers_page(&target_partition, page, PAGE_SIZE).await?;
            for row in &result.items {
                if matched_users.contains(&row.user_pk) {
                    count += 1;
                }
            }
            if page < result.total_pages {
                page += 1;
            } else {
                break;
            }
        }

        if count == 0 {
            continue;
        }

        aggregates.push(FollowTargetAggregate {
            user_pk: target.user_pk.clone(),
            display_name: target.display_name,
            username: target.username,
            profile_url: target.profile_url,
            count,
        });
    }

    aggregates.sort_by(|a, b| b.count.cmp(&a.count));
    aggregates.truncate(TOP_N_FOLLOW);
    Ok(aggregates)
}

// ── Helpers ───────────────────────────────────────────────────────

/// Convert raw option indices from `Answer::to_option_indices()` into
/// 0-based indices into the labels array `question_option_labels`
/// returns.
///
/// All choice question types (`SingleChoice`, `MultipleChoice`,
/// `Checkbox`, `Dropdown`) are already 0-based — pass through.
///
/// `LinearScale` is the broken case: `Answer::LinearScale.answer`
/// stores the raw scale value (e.g. 1..=5 for a Likert), but the
/// labels are sliced as `(min_value..=max_value)` and stored in
/// option_counts of length `max - min + 1` indexed 0-based. The
/// previous implementation used the raw value as the index, which
/// shifted every count by `min_value` slots and dropped any answer
/// equal to `max_value` entirely (out-of-bounds → silently lost).
/// Subtracting `min_value` puts each scale point at the right slot.
fn normalize_option_indices(
    question: &crate::features::spaces::pages::actions::actions::poll::Question,
    raw: &[u32],
) -> Vec<u32> {
    use crate::features::spaces::pages::actions::actions::poll::Question;
    match question {
        Question::LinearScale(q) => {
            let min = q.min_value;
            raw.iter()
                .filter_map(|v| {
                    let signed = *v as i64 - min as i64;
                    if signed < 0 { None } else { Some(signed as u32) }
                })
                .collect()
        }
        _ => raw.to_vec(),
    }
}

fn question_option_labels(
    question: &crate::features::spaces::pages::actions::actions::poll::Question,
) -> Vec<String> {
    use crate::features::spaces::pages::actions::actions::poll::Question;
    match question {
        Question::SingleChoice(q) | Question::MultipleChoice(q) => q.options.clone(),
        Question::Checkbox(q) => q.options.clone(),
        Question::Dropdown(q) => q.options.clone(),
        Question::LinearScale(q) => (q.min_value..=q.max_value)
            .map(|v| v.to_string())
            .collect(),
        Question::ShortAnswer(_) | Question::Subjective(_) => Vec::new(),
    }
}

fn answer_text(
    answer: &crate::features::spaces::pages::actions::actions::poll::Answer,
) -> Option<String> {
    use crate::features::spaces::pages::actions::actions::poll::Answer;
    match answer {
        Answer::ShortAnswer { answer } | Answer::Subjective { answer } => answer.clone(),
        Answer::SingleChoice { other, .. } | Answer::MultipleChoice { other, .. } => {
            other.clone().filter(|s| !s.trim().is_empty())
        }
        _ => None,
    }
}
