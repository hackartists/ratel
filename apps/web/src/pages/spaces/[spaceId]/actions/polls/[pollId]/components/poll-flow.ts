import type { Answer, AnswerRule, Question, QuestionCondition } from "@ratel/ts-bridges";

/**
 * Client mirror of the server's poll flow rules
 * (`app/ratel/.../poll/types/condition.rs`): display conditions, termination
 * options and the empty answer per question type. Keep both in sync — the
 * server re-evaluates every submission and rejects answers to questions this
 * module would hide.
 */

/** Result of walking a poll's questions against the current answers. */
export interface PollFlow {
  /** `visible[i]` is true when question `i` is shown to the respondent. */
  visible: boolean[];
  /** Index of the visible choice question whose answer ended the poll. */
  terminatedAt: number | null;
}

/** Option texts of a single- or multiple-choice question; `null` for other types. */
export function choiceOptions(question: Question): string[] | null {
  return question.answer_type === "single_choice" || question.answer_type === "multiple_choice" ? question.options : null;
}

/** Option texts that end the poll when picked; empty for non-choice questions. */
export function terminateOn(question: Question): string[] {
  return question.answer_type === "single_choice" || question.answer_type === "multiple_choice" ? (question.terminate_on ?? []) : [];
}

/** True when the answer picked at least one option whose text is in `allowed`. The "other" text never matches. */
export function answerMatchesValues(question: Question, answer: Answer | undefined, allowed: string[]): boolean {
  if (!answer) return false;
  const options = choiceOptions(question);
  if (options === null) return false;
  let picked: number[] = [];
  if (question.answer_type === "single_choice" && answer.answer_type === "single_choice" && answer.answer !== null) {
    picked = [answer.answer];
  } else if (question.answer_type === "multiple_choice" && answer.answer_type === "multiple_choice") {
    picked = answer.answer ?? [];
  }
  return picked.some((idx) => {
    const value = options[idx];
    return value !== undefined && allowed.includes(value);
  });
}

function conditionSatisfied(
  condition: QuestionCondition,
  questions: Question[],
  answerOf: (idx: number) => Answer | undefined,
): boolean {
  if (condition.rules.length === 0) return true;
  const ruleOk = (rule: AnswerRule) => {
    const q = questions[rule.question_index];
    return q !== undefined && answerMatchesValues(q, answerOf(rule.question_index), rule.allowed_values);
  };
  return condition.operator === "Or" ? condition.rules.some(ruleOk) : condition.rules.every(ruleOk);
}

/** Resolves which questions are shown and whether a termination option ended the poll. */
export function evaluateFlow(questions: Question[], answers: Record<number, Answer | undefined>): PollFlow {
  const visible = questions.map(() => false);
  let terminatedAt: number | null = null;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const cond = q.display_condition ?? null;
    const shown = cond === null || conditionSatisfied(cond, questions, (j) => (j < i && visible[j] ? answers[j] : undefined));
    visible[i] = shown;
    if (!shown) continue;
    const stops = terminateOn(q);
    if (stops.length > 0 && answerMatchesValues(q, answers[i], stops)) {
      terminatedAt = i;
      break;
    }
  }
  return { visible, terminatedAt };
}

/**
 * Question-by-question navigation state shared by every poll respondent view.
 * Only visible questions are reachable; the question whose answer terminated
 * the poll is the last one.
 */
export interface PollNavigation extends PollFlow {
  /** Indices of the visible questions, in poll order. */
  visibleIndices: number[];
  /** Index of the question on screen: the requested one, or the nearest visible one before it. */
  currentIdx: number;
  /** Visible question before `currentIdx`, if any. */
  prevIdx: number | undefined;
  /** Visible question after `currentIdx`, if any. */
  nextIdx: number | undefined;
  /** 1-based position of `currentIdx` among `visibleIndices`. */
  position: number;
  isFirst: boolean;
  isLast: boolean;
}

/** Resolves the navigation state for `requestedIdx` against the current answers. */
export function resolveNavigation(
  questions: Question[],
  answers: Record<number, Answer | undefined>,
  requestedIdx: number,
): PollNavigation {
  const flow = evaluateFlow(questions, answers);
  const visibleIndices = questions.map((_, i) => i).filter((i) => flow.visible[i]);
  const clamped = Math.min(requestedIdx, Math.max(questions.length - 1, 0));
  const currentIdx = flow.visible[clamped]
    ? clamped
    : ([...visibleIndices].reverse().find((i) => i < clamped) ?? visibleIndices[0] ?? 0);
  const prevIdx = [...visibleIndices].reverse().find((i) => i < currentIdx);
  const nextIdx = visibleIndices.find((i) => i > currentIdx);
  return {
    ...flow,
    visibleIndices,
    currentIdx,
    prevIdx,
    nextIdx,
    position: visibleIndices.indexOf(currentIdx) + 1,
    isFirst: questions.length === 0 || prevIdx === undefined,
    isLast: questions.length === 0 || nextIdx === undefined,
  };
}

/** Outcome of answering one question: the answers to keep and where the flow goes next. */
export interface AnswerChange {
  /** Answers with every question that became hidden dropped. */
  answers: Record<number, Answer>;
  /** True when this answer picked a termination option, so the poll ends here. */
  terminated: boolean;
  /** First visible question after the answered one, if any. */
  upcomingIdx: number | undefined;
}

/** Applies `answer` to question `idx` and re-evaluates the flow. */
export function applyAnswerChange(
  questions: Question[],
  answers: Record<number, Answer | undefined>,
  idx: number,
  answer: Answer,
): AnswerChange {
  const updated: Record<number, Answer | undefined> = { ...answers, [idx]: answer };
  const flow = evaluateFlow(questions, updated);
  const kept: Record<number, Answer> = {};
  questions.forEach((_, i) => {
    const value = updated[i];
    if (flow.visible[i] && value !== undefined) kept[i] = value;
  });
  const upcoming = questions.findIndex((_, i) => i > idx && flow.visible[i]);
  return { answers: kept, terminated: flow.terminatedAt === idx, upcomingIdx: upcoming === -1 ? undefined : upcoming };
}

/** Request payload for `respond_poll`: hidden and post-termination questions carry their empty answer. */
export function submissionAnswers(questions: Question[], answers: Record<number, Answer | undefined>): Answer[] {
  const flow = evaluateFlow(questions, answers);
  return questions.map((q, i) => {
    const ans = answers[i];
    return flow.visible[i] && ans !== undefined ? ans : emptyAnswerFor(q);
  });
}

/** The unanswered value matching the question's answer type. */
export function emptyAnswerFor(question: Question): Answer {
  switch (question.answer_type) {
    case "single_choice":
      return { answer_type: "single_choice", answer: null, other: null };
    case "multiple_choice":
      return { answer_type: "multiple_choice", answer: null, other: null };
    case "short_answer":
      return { answer_type: "short_answer", answer: null };
    case "subjective":
      return { answer_type: "subjective", answer: null };
    case "checkbox":
      return { answer_type: "checkbox", answer: null };
    case "dropdown":
      return { answer_type: "dropdown", answer: null };
    case "linear_scale":
      return { answer_type: "linear_scale", answer: null };
    case "privacy_consent":
      return { answer_type: "privacy_consent", agreed: false, phone: null, code: null };
  }
}

/**
 * Drops condition rules and termination options that no longer point at a
 * valid target — a later or non-choice question, or an option text that was
 * removed or renamed — and clears conditions left without rules. Matches
 * what the server accepts in `update_poll`.
 */
export function sanitizeQuestionFlow(questions: Question[]): Question[] {
  return questions.map((q, i) => {
    let next = q;
    const cond = q.display_condition ?? null;
    if (cond !== null) {
      const rules = cond.rules
        .map((rule) => {
          const target = rule.question_index < i ? questions[rule.question_index] : undefined;
          const options = target ? choiceOptions(target) : null;
          if (options === null) return null;
          const allowed = rule.allowed_values.filter((v) => options.includes(v));
          return allowed.length > 0 ? { ...rule, allowed_values: allowed } : null;
        })
        .filter((r): r is AnswerRule => r !== null);
      const nextCond = rules.length > 0 ? { ...cond, rules } : null;
      if (JSON.stringify(nextCond) !== JSON.stringify(cond)) next = { ...next, display_condition: nextCond } as Question;
    }
    if (next.answer_type === "single_choice" || next.answer_type === "multiple_choice") {
      const options = next.options;
      const stops = (next.terminate_on ?? []).filter((v) => options.includes(v));
      if (stops.length !== (next.terminate_on ?? []).length) next = { ...next, terminate_on: stops };
    }
    return next;
  });
}

/** Removes question `idx`, dropping rules that referenced it and re-pointing rules at later questions. */
export function removeQuestionAt(questions: Question[], idx: number): Question[] {
  const remaining = questions
    .filter((_, i) => i !== idx)
    .map((q) => {
      const cond = q.display_condition ?? null;
      if (cond === null) return q;
      const rules = cond.rules
        .filter((r) => r.question_index !== idx)
        .map((r) => (r.question_index > idx ? { ...r, question_index: r.question_index - 1 } : r));
      return { ...q, display_condition: rules.length > 0 ? { ...cond, rules } : null } as Question;
    });
  return sanitizeQuestionFlow(remaining);
}
