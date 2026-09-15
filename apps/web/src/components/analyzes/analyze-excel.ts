import type {
  Age,
  Answer,
  PanelAttribute,
  PollResponse,
  PollResultResponse,
  Question,
  SpacePanelQuotaResponse,
  SpacePollUserAnswer,
} from "@ratel/ts-bridges";
import type { SpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import type { AnalyzeExcelMerge } from "./analyze-interop";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/hooks/use_space_analyze_poll.rs
// — the pure Excel builder (`build_excel_data` & co.), shared by the poll
// analyze page and the saved-report page's per-poll export.

export interface AnalyzeExcelData {
  rows: string[][];
  merges: AnalyzeExcelMerge[];
}

interface AnalyzeExportAttributes {
  includeGender: boolean;
  includeAge: boolean;
  includeUniversity: boolean;
}

interface AnalyzeResponseRow {
  displayName: string;
  gender: string;
  age: string;
  university: string;
  sample: SpacePollUserAnswer | null;
  finalAnswer: SpacePollUserAnswer | null;
}

export function humanizeGroupValue(value: string, tr: SpaceAnalyzesAppI18n): string {
  switch (value) {
    case "male":
      return tr.genderMale;
    case "female":
      return tr.genderFemale;
    case "UNKNOWN":
      return tr.genderUnknown;
    default:
      return value;
  }
}

export function buildExcelFileName(spaceId: string): string {
  return `${spaceId}-analysis.xlsx`;
}

/** Rust `Age` Display. */
function ageDisplay(age: Age): string {
  return age.age_type === "specific" ? String(age.value) : `${age.value.inclusive_min}-${age.value.inclusive_max}`;
}

/** Rust `Question::title()`. */
export function questionTitle(question: Question): string {
  return question.title;
}

export function buildExcelData(
  poll: PollResponse,
  panels: SpacePanelQuotaResponse[],
  result: PollResultResponse,
  tr: SpaceAnalyzesAppI18n,
): AnalyzeExcelData {
  const attrs = buildExportAttributes(panels);
  const userRows = buildResponseRows(result, tr);
  const questionCount = poll.questions.length;

  let col = 0;
  const colId = col;
  col += 1;
  const colAttrStart = col;
  let colGender: number | null = null;
  if (attrs.includeGender) colGender = col++;
  let colAge: number | null = null;
  if (attrs.includeAge) colAge = col++;
  let colUniversity: number | null = null;
  if (attrs.includeUniversity) colUniversity = col++;
  const attrCount = Number(attrs.includeGender) + Number(attrs.includeAge) + Number(attrs.includeUniversity);
  const colCategory = col++;
  const colType = col++;
  const colQuestionStart = col;
  const totalColumns = colQuestionStart + questionCount;

  const blank = () => new Array<string>(totalColumns).fill("");

  const headerTop = blank();
  headerTop[colId] = tr.id;
  if (attrCount > 0) headerTop[colAttrStart] = tr.attribute;
  headerTop[colCategory] = tr.category;
  headerTop[colType] = tr.type;
  if (questionCount > 0) headerTop[colQuestionStart] = tr.questionnaire;

  const headerBottom = blank();
  if (colGender !== null) headerBottom[colGender] = tr.filterGender;
  if (colAge !== null) headerBottom[colAge] = tr.filterAge;
  if (colUniversity !== null) headerBottom[colUniversity] = tr.university;

  const rows: string[][] = [headerTop, headerBottom];
  const merges: AnalyzeExcelMerge[] = [
    { start_row: 0, start_col: colId, end_row: 1, end_col: colId },
    { start_row: 0, start_col: colCategory, end_row: 1, end_col: colCategory },
    { start_row: 0, start_col: colType, end_row: 1, end_col: colType },
  ];
  if (attrCount > 0) {
    merges.push({ start_row: 0, start_col: colAttrStart, end_row: 0, end_col: colAttrStart + attrCount - 1 });
  }
  if (questionCount > 0) {
    merges.push({
      start_row: 0,
      start_col: colQuestionStart,
      end_row: 1,
      end_col: colQuestionStart + questionCount - 1,
    });
  }

  const categoryLabel = poll.space_action.prerequisite ? tr.sampleSurvey : tr.finalSurvey;

  const pushBlock = (response: SpacePollUserAnswer, category: string) => {
    const startRow = rows.length;
    const questionRow = blank();
    questionRow[colCategory] = category;
    questionRow[colType] = tr.question;
    poll.questions.forEach((q, index) => {
      questionRow[colQuestionStart + index] = questionTitle(q);
    });
    const answerRow = blank();
    answerRow[colCategory] = category;
    answerRow[colType] = tr.answer;
    poll.questions.forEach((q, index) => {
      answerRow[colQuestionStart + index] = toAnswerDisplay(q, response.answers[index]);
    });
    rows.push(questionRow, answerRow);
    merges.push({ start_row: startRow, start_col: colCategory, end_row: startRow + 1, end_col: colCategory });
  };

  for (const row of userRows) {
    const startRow = rows.length;
    if (row.sample) pushBlock(row.sample, categoryLabel);
    if (row.finalAnswer) pushBlock(row.finalAnswer, tr.finalSurvey);
    if (rows.length === startRow) continue;

    const endRow = rows.length - 1;
    merges.push({ start_row: startRow, start_col: colId, end_row: endRow, end_col: colId });
    if (colGender !== null) {
      merges.push({ start_row: startRow, start_col: colGender, end_row: endRow, end_col: colGender });
      rows[startRow][colGender] = row.gender;
    }
    if (colAge !== null) {
      merges.push({ start_row: startRow, start_col: colAge, end_row: endRow, end_col: colAge });
      rows[startRow][colAge] = row.age;
    }
    if (colUniversity !== null) {
      merges.push({ start_row: startRow, start_col: colUniversity, end_row: endRow, end_col: colUniversity });
      rows[startRow][colUniversity] = row.university;
    }
    rows[startRow][colId] = row.displayName;
  }
  return { rows, merges };
}

function buildExportAttributes(panels: SpacePanelQuotaResponse[]): AnalyzeExportAttributes {
  const attrs: AnalyzeExportAttributes = { includeGender: false, includeAge: false, includeUniversity: false };
  for (const panel of panels) {
    const list: PanelAttribute[] =
      panel.attributes_vec.length === 0 && panel.attributes.type !== "none" ? [panel.attributes] : panel.attributes_vec;
    for (const attribute of list) {
      if (attribute.type === "collective_attribute") {
        if (attribute.value === "gender") attrs.includeGender = true;
        else if (attribute.value === "age") attrs.includeAge = true;
        else if (attribute.value === "university") attrs.includeUniversity = true;
      } else if (attribute.type === "verifiable_attribute") {
        if (attribute.value.type === "gender") attrs.includeGender = true;
        else if (attribute.value.type === "age") attrs.includeAge = true;
      }
    }
  }
  return attrs;
}

/** Rust `pk.split("#USER#").nth(1).unwrap_or(pk)`. */
function userKeyFromPk(pk: string): string {
  const parts = pk.split("#USER#");
  return parts.length > 1 ? parts[1] : pk;
}

/** Rust `str::cmp` (code-unit order). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function buildResponseRows(result: PollResultResponse, tr: SpaceAnalyzesAppI18n): AnalyzeResponseRow[] {
  const finalByUser = new Map<string, SpacePollUserAnswer>();
  for (const a of result.final_answers) finalByUser.set(userKeyFromPk(a.actor_pk), a);
  const sampleByUser = new Map<string, SpacePollUserAnswer>();
  for (const a of result.sample_answers) sampleByUser.set(userKeyFromPk(a.actor_pk), a);

  const order: string[] = [...finalByUser.keys()];
  for (const user of sampleByUser.keys()) if (!finalByUser.has(user)) order.push(user);
  order.sort(cmp);

  const out: AnalyzeResponseRow[] = [];
  for (const userKey of order) {
    const finalAnswer = finalByUser.get(userKey) ?? null;
    const sample = sampleByUser.get(userKey) ?? null;
    const meta = finalAnswer ?? sample;
    if (!meta) continue;
    out.push({
      displayName: meta.display_name ?? meta.username ?? userKey,
      gender: meta.respondent?.gender ? humanizeGroupValue(meta.respondent.gender, tr) : "",
      age: meta.respondent?.age ? ageDisplay(meta.respondent.age) : "",
      university: meta.respondent?.school ?? "",
      sample,
      finalAnswer,
    });
  }
  return out;
}

function labelOfOption(options: string[], index: number): string | null {
  if (index < 0) return null;
  return options[index] ?? null;
}

function nonEmptyOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function combineParts(parts: (string | null)[]): string {
  return parts
    .filter((p): p is string => p !== null)
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .join(", ");
}

function optionLabels(options: string[], indices: number[]): string {
  return indices
    .map((v) => labelOfOption(options, v))
    .filter((v): v is string => v !== null)
    .join(", ");
}

function toAnswerDisplay(question: Question, answer: Answer | undefined): string {
  if (!answer) return "";
  if (question.answer_type === "single_choice" || question.answer_type === "multiple_choice") {
    if (answer.answer_type === "single_choice") {
      return combineParts([
        answer.answer === null ? null : labelOfOption(question.options, answer.answer),
        nonEmptyOptionalText(answer.other),
      ]);
    }
    if (answer.answer_type === "multiple_choice") {
      return combineParts([
        answer.answer === null ? null : optionLabels(question.options, answer.answer),
        nonEmptyOptionalText(answer.other),
      ]);
    }
    return "";
  }
  if (
    (question.answer_type === "short_answer" && answer.answer_type === "short_answer") ||
    (question.answer_type === "subjective" && answer.answer_type === "subjective")
  ) {
    return nonEmptyOptionalText(answer.answer) ?? "";
  }
  if (question.answer_type === "checkbox" && answer.answer_type === "checkbox") {
    return optionLabels(question.options, answer.answer ?? []);
  }
  if (question.answer_type === "dropdown" && answer.answer_type === "dropdown") {
    return answer.answer === null ? "" : (labelOfOption(question.options, answer.answer) ?? "");
  }
  if (question.answer_type === "linear_scale" && answer.answer_type === "linear_scale") {
    return answer.answer === null ? "" : String(answer.answer);
  }
  return "";
}
