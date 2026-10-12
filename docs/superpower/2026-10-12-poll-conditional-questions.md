# Poll conditional questions and termination options

Enhancement to the Poll action. Builds on the Required Attributes matching
introduced in `2026-10-08-discussion-required-attributes.md`.

## Summary

A poll question can carry a display condition on the answers to earlier
single/multiple-choice questions (rules combined with AND or OR), and a
single/multiple-choice question can mark options that end the poll when
picked. Responses ended on the first question are stored but do not count
as completing the action.

## What changes

### Data model

- `Question` structs (jsonb inside `space_polls.questions`, no migration):
  - every struct: `display_condition: Option<QuestionCondition>` (`serde(default)`).
  - `ChoiceQuestion`: `terminate_on: Vec<String>` (`serde(default)`), option texts.
- New types in `poll/types/condition.rs`:
  `QuestionCondition { operator: ConditionOperator, rules: Vec<AnswerRule> }`,
  `ConditionOperator { And, Or }`,
  `AnswerRule { question_index, allowed_values }` (values OR together).
- `SpacePollUserAnswer.completed: bool` — `postgres(version = 1, sql_default = "TRUE")`
  so existing rows read as completed; serde default `true`.

### Server

- `answer_matches_values` is the single matcher for display conditions and
  action Required Attributes (`rule_satisfied`); multiple-choice answers match
  when any picked option is allowed. The "other" text never matches.
- `evaluate_answers` walks questions in order: hidden questions and questions
  after a termination must be unanswered (they are stored as the typed empty
  answer); `is_required` applies to visible questions only. `completed` is
  false only when a termination happened and no earlier visible question was
  answered.
- `respond_poll`: XP outbox event, `bump_response_count` and the dashboard
  counter fire when a response becomes completed — on insert, or on an
  editable re-response that flips `completed` false → true.
- `update_poll` rejects conditions that reference a non-earlier or non-choice
  question or unknown option texts, empty conditions, and termination values
  that are not options of their own question (`SpacePollError::InvalidCondition`).
- "Completed" for prerequisites (`has_completed_poll_action`) and
  `list_actions.user_participated` now requires `completed`. Required
  Attributes, sampling and result aggregation keep reading every response.

### Web

- `poll-flow.ts` mirrors the server flow (visibility, termination, empty
  answers, sanitizing references after edits).
- Response view navigates between visible questions only, shows progress over
  visible questions, drops answers to questions that become hidden, submits
  typed empty answers for unanswered questions, and submits immediately (with
  the existing confirm popup) when a termination option is picked.
- Editor reuses `RequiredAttributeRulesEditor` with an opt-in AND/OR toggle;
  candidates are earlier single/multiple-choice questions. A termination
  option picker is added to choice questions. Deleting a question removes
  rules that referenced it and shifts later references; removing or renaming
  an option drops references to its old text.

## Tests

- Unit tests in `poll/types/condition.rs` and `services/required_attributes.rs`.
- Playwright: `playwright/tests/web/poll-conditional-questions.spec.js`.
