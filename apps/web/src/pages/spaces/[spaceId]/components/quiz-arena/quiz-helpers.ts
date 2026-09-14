// app/ratel/src/features/spaces/pages/index/action_pages/quiz/component.rs:28-29, 608-705 —
// constants and the answer helpers of the quiz arena.
import type { Answer, Question, QuizCorrectAnswer } from "@ratel/ts-bridges";

export const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
export const RING_CIRCUMFERENCE = 2.0 * Math.PI * 20.0;

/**
 * Rust `f64` Display: shortest round-trip digits, never exponent notation
 * (JS switches to `1e-7` style for tiny/huge values).
 */
export function formatF64(value: number): string {
  const s = String(value);
  if (!/e/i.test(s)) return s;
  return value.toFixed(20).replace(/\.?0+$/, "");
}

/** Rust `default_answer`. */
export function defaultAnswer(question: Question): Answer {
  switch (question.answer_type) {
    case "single_choice":
      return { answer_type: "single_choice", answer: null, other: null };
    case "multiple_choice":
      return { answer_type: "multiple_choice", answer: [], other: null };
    default:
      return { answer_type: "single_choice", answer: null, other: null };
  }
}

/** Rust `has_answer`. */
export function hasAnswer(question: Question, answer: Answer | undefined): boolean {
  if (question.answer_type === "single_choice" && answer?.answer_type === "single_choice") {
    return answer.answer !== null;
  }
  if (question.answer_type === "multiple_choice" && answer?.answer_type === "multiple_choice") {
    return answer.answer !== null && answer.answer.length > 0;
  }
  return false;
}

/** Rust `check_selected`. */
export function checkSelected(answer: Answer | null, optIdx: number, isMulti: boolean): boolean {
  if (!isMulti && answer?.answer_type === "single_choice" && answer.answer !== null) {
    return answer.answer === optIdx;
  }
  if (isMulti && answer?.answer_type === "multiple_choice" && answer.answer !== null) {
    return answer.answer.includes(optIdx);
  }
  return false;
}

/** Rust `check_correct`. */
export function checkCorrect(correct: QuizCorrectAnswer | null, optIdx: number, isMulti: boolean): boolean {
  if (!isMulti && correct?.answer_type === "single" && correct.answer !== null) {
    return correct.answer === optIdx;
  }
  if (isMulti && correct?.answer_type === "multiple") {
    return correct.answers.includes(optIdx);
  }
  return false;
}

/** Rust `toggle_single`. */
export function toggleSingle(answer: Answer | null, optIdx: number): Answer {
  const current = answer?.answer_type === "single_choice" ? answer.answer : null;
  return { answer_type: "single_choice", answer: current === optIdx ? null : optIdx, other: null };
}

/** Rust `toggle_multi`. */
export function toggleMulti(answer: Answer | null, optIdx: number): Answer {
  const selected =
    answer?.answer_type === "multiple_choice" && answer.answer !== null ? [...answer.answer] : [];
  const pos = selected.indexOf(optIdx);
  if (pos >= 0) {
    selected.splice(pos, 1);
  } else {
    selected.push(optIdx);
  }
  return { answer_type: "multiple_choice", answer: selected, other: null };
}
