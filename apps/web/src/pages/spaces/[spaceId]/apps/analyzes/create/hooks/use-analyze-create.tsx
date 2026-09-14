import { keepPreviousData, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useContext, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAnalyzeReport,
  getPoll,
  getQuiz,
  listAnalyzeDiscussions,
  listAnalyzeFollows,
  listAnalyzePolls,
  listAnalyzeQuizzes,
  listAnalyzeReports,
  previewAnalyzeReport,
} from "@ratel/ts-bridges";
import type {
  AnalyzeDiscussionItem,
  AnalyzeFilterSource,
  AnalyzeFollowItem,
  AnalyzePollItem,
  AnalyzeQuizItem,
  AnalyzeReportFilter,
  ListResponse,
  PollResponse,
  PreviewAnalyzeReportResponse,
  Question,
  QuizCorrectAnswer,
  QuizResponse,
} from "@ratel/ts-bridges";
import { useEnumI18n } from "@/i18n/generated/enums.i18n";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/hooks/use_analyze_create.rs
// Controller for the Analyze CREATE wizard: wizard state (mode, picker
// state machine, chip set, preview name), the four source-list loaders, the
// picked poll/quiz detail loaders, and the preview + submit actions.

/** Rust `CreateMode`. */
export type CreateMode = "create" | "preview";
/** Rust `AddState::as_str`. */
export type AddState = "idle" | "picking-action" | "picking-item";

/** Follow has no item layer — cf-sunji opens directly with the target list. */
const FOLLOW_ITEM_SENTINEL = "__follow__";

/** Rust `AnalyzeFilterSource::type_label`. */
export function typeLabel(src: AnalyzeFilterSource): string {
  switch (src) {
    case "poll":
      return "Poll";
    case "quiz":
      return "Quiz";
    case "discussion":
      return "Discussion";
    case "follow":
      return "Follow";
  }
}

/** Rust `AnalyzeFilterSource::badge`. */
export function badge(src: AnalyzeFilterSource): string {
  return typeLabel(src).toUpperCase();
}

/** Rust `options_of` / `option_label_at`: choice-style questions only. */
export function optionsOf(question: Question): string[] {
  switch (question.answer_type) {
    case "single_choice":
    case "multiple_choice":
    case "checkbox":
    case "dropdown":
      return question.options;
    default:
      return [];
  }
}

/** Rust `correct_indices_for`. */
export function correctIndicesFor(answer: QuizCorrectAnswer): number[] | null {
  if (answer.answer_type === "single") return answer.answer === null ? null : [answer.answer];
  return answer.answers;
}

export interface UseAnalyzeCreate {
  spaceId: string;
  mode: CreateMode;
  addState: AddState;
  pickingType: AnalyzeFilterSource | null;
  pickedItemId: string | null;
  pickedItemTitle: string;
  pickedSunji: ReadonlySet<string>;
  keywordInput: string;
  setKeywordInput: (value: string) => void;
  filters: AnalyzeReportFilter[];
  previewName: string;
  setPreviewName: (value: string) => void;
  polls: ListResponse<AnalyzePollItem>;
  quizzes: ListResponse<AnalyzeQuizItem>;
  discussions: ListResponse<AnalyzeDiscussionItem>;
  follows: ListResponse<AnalyzeFollowItem>;
  selectedPoll: PollResponse | null;
  selectedPollLoading: boolean;
  selectedQuiz: QuizResponse | null;
  selectedQuizLoading: boolean;
  preview: PreviewAnalyzeReportResponse | null;
  startAdd: () => void;
  cancelAdd: () => void;
  pickAction: (src: AnalyzeFilterSource) => void;
  backToAction: () => void;
  pickItem: (id: string, title: string) => void;
  clearItem: () => void;
  toggleSunji: (token: string) => void;
  confirmSunji: () => void;
  removeFilter: (idx: number) => void;
  clearFilters: () => void;
  gotoPreview: () => void;
  backToCreate: () => void;
  handleComputePreview: () => void;
  handleSubmit: () => void;
}

const Ctx = createContext<UseAnalyzeCreate | null>(null);
export const AnalyzeCreateProvider = Ctx.Provider;

export function useAnalyzeCreateContext(): UseAnalyzeCreate {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnalyzeCreateContext must be used under AnalyzeCreateProvider");
  return ctx;
}

export function useAnalyzeCreate(spaceId: string): UseAnalyzeCreate {
  const toast = useToast();
  const enumText = useEnumI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<CreateMode>("create");
  const [addState, setAddState] = useState<AddState>("idle");
  const [pickingType, setPickingType] = useState<AnalyzeFilterSource | null>(null);
  const [pickedItemId, setPickedItemId] = useState<string | null>(null);
  const [pickedItemTitle, setPickedItemTitle] = useState("");
  const [pickedSunji, setPickedSunji] = useState<ReadonlySet<string>>(() => new Set());
  const [keywordInput, setKeywordInput] = useState("");
  const [filters, setFilters] = useState<AnalyzeReportFilter[]>([]);
  const [previewName, setPreviewName] = useState("");
  const [preview, setPreview] = useState<PreviewAnalyzeReportResponse | null>(null);

  // The async actions read the latest wizard values, like the Rust actions
  // read signals when they run.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const previewNameRef = useRef(previewName);
  previewNameRef.current = previewName;

  const polls = useSuspenseQuery({
    queryKey: ["listAnalyzePolls", spaceId, null],
    queryFn: () => listAnalyzePolls(spaceId, null),
  });
  const quizzes = useSuspenseQuery({
    queryKey: ["listAnalyzeQuizzes", spaceId, null],
    queryFn: () => listAnalyzeQuizzes(spaceId, null),
  });
  const discussions = useSuspenseQuery({
    queryKey: ["listAnalyzeDiscussions", spaceId, null],
    queryFn: () => listAnalyzeDiscussions(spaceId, null),
  });
  const follows = useSuspenseQuery({
    queryKey: ["listAnalyzeFollows", spaceId, null],
    queryFn: () => listAnalyzeFollows(spaceId, null),
  });
  // `use_analyze_reports(space_id)?` — the LIST loader restarted after submit.
  useSuspenseQuery({
    queryKey: ["listAnalyzeReports", spaceId, null],
    queryFn: () => listAnalyzeReports(spaceId, null),
  });

  // Picked poll / quiz detail. A `Loader` keeps its previous value while a
  // new pick loads, hence `keepPreviousData` + the fetching flag.
  const pollId = pickingType === "poll" && pickedItemId ? pickedItemId : null;
  const selectedPoll = useQuery({
    queryKey: ["analyzeCreateSelectedPoll", spaceId, pollId],
    queryFn: () => (pollId === null ? Promise.resolve(null) : getPoll(spaceId, pollId)),
    placeholderData: keepPreviousData,
  });
  const quizId = pickingType === "quiz" && pickedItemId ? pickedItemId : null;
  const selectedQuiz = useQuery({
    queryKey: ["analyzeCreateSelectedQuiz", spaceId, quizId],
    queryFn: () => (quizId === null ? Promise.resolve(null) : getQuiz(spaceId, quizId)),
    placeholderData: keepPreviousData,
  });

  const resetPicker = () => {
    setPickingType(null);
    setPickedItemId(null);
    setPickedItemTitle("");
    setPickedSunji(new Set());
    setKeywordInput("");
  };

  const buildChoiceFilter = (
    src: AnalyzeFilterSource,
    itemId: string,
    itemTitle: string,
    questions: Question[],
    token: string,
    correct: boolean,
  ): AnalyzeReportFilter | null => {
    const [qRaw, oRaw] = splitToken(token);
    const qIdx = parseUsize(qRaw);
    const oIdx = parseUsize(oRaw);
    if (qIdx === null || oIdx === null) return null;
    const question = questions[qIdx];
    if (!question) return null;
    const optionText = optionsOf(question)[oIdx];
    if (optionText === undefined) return null;
    const questionTitle = question.title;
    const label =
      questions.length > 1
        ? `${questionTitle} · ${optionText}`
        : itemTitle !== ""
          ? `${itemTitle} · ${optionText}`
          : optionText;
    return {
      source: src,
      source_label: typeLabel(src),
      label,
      item_id: itemId,
      question_id: String(qIdx),
      option_id: String(oIdx),
      option_text: optionText,
      question_title: questionTitle,
      correct,
    };
  };

  const confirmSunji = () => {
    const itemId = pickedItemId;
    const src = pickingType;
    if (itemId === null || src === null) return;
    const newFilters: AnalyzeReportFilter[] = [];

    if (src === "discussion") {
      const seen = new Set<string>();
      for (const kw of keywordInput
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "")) {
        if (seen.has(kw)) continue;
        seen.add(kw);
        newFilters.push({
          source: src,
          source_label: typeLabel(src),
          label: kw,
          item_id: itemId,
          question_id: "keywords",
          option_id: `kw-${kw}`,
          option_text: kw,
          question_title: pickedItemTitle,
          correct: false,
        });
      }
    } else if (src === "follow") {
      const byPk = new Map(follows.data.items.map((t) => [t.user_pk, t]));
      for (const token of pickedSunji) {
        const target = byPk.get(token);
        if (!target) continue;
        const label = target.display_name === "" ? target.username : target.display_name;
        newFilters.push({
          source: src,
          source_label: typeLabel(src),
          label,
          item_id: target.user_pk,
          question_id: "",
          option_id: target.user_pk,
          option_text: label,
          question_title: "",
          correct: false,
        });
      }
    } else if (src === "poll") {
      const detail = selectedPoll.data ?? null;
      const questions = detail?.questions ?? [];
      const title = detail?.title ?? pickedItemTitle;
      for (const token of pickedSunji) {
        const f = buildChoiceFilter(src, itemId, title, questions, token, false);
        if (f) newFilters.push(f);
      }
    } else {
      const detail = selectedQuiz.data ?? null;
      const questions = detail?.questions ?? [];
      const title = detail?.title ?? pickedItemTitle;
      const correctLookup = new Map<number, number[]>();
      (detail?.correct_answers ?? []).forEach((a, i) => {
        const v = correctIndicesFor(a);
        if (v !== null) correctLookup.set(i, v);
      });
      for (const token of pickedSunji) {
        const [qRaw, oRaw] = splitToken(token);
        const qIdx = parseUsize(qRaw);
        const oIdx = parseUsize(oRaw);
        if (qIdx === null || oIdx === null) continue;
        const correct = correctLookup.get(qIdx)?.includes(oIdx) ?? false;
        const f = buildChoiceFilter(src, itemId, title, questions, token, correct);
        if (f) newFilters.push(f);
      }
    }

    if (newFilters.length > 0) setFilters((all) => [...all, ...newFilters]);
    setAddState("idle");
    resetPicker();
  };

  const handleComputePreview = () => {
    void (async () => {
      try {
        const resp = await previewAnalyzeReport(spaceId, { filters: filtersRef.current });
        setPreview(resp);
      } catch (err) {
        console.error(`preview_analyze_report failed: ${err}`);
        toast.error(err);
      }
    })();
  };

  const handleSubmit = () => {
    void (async () => {
      const name = previewNameRef.current.trim();
      if (name === "") {
        toast.error(enumText("Error", "InvalidFormat"));
        return;
      }
      try {
        await createAnalyzeReport(spaceId, { name, filters: filtersRef.current });
        setFilters([]);
        setPreviewName("");
        setPreview(null);
        setMode("create");
        await queryClient.invalidateQueries({ queryKey: ["listAnalyzeReports", spaceId] });
        navigate(`/spaces/${spaceId}/apps/analyzes`);
      } catch (err) {
        console.error(`create_analyze_report failed: ${err}`);
        toast.error(err);
      }
    })();
  };

  return {
    spaceId,
    mode,
    addState,
    pickingType,
    pickedItemId,
    pickedItemTitle,
    pickedSunji,
    keywordInput,
    setKeywordInput,
    filters,
    previewName,
    setPreviewName,
    polls: polls.data,
    quizzes: quizzes.data,
    discussions: discussions.data,
    follows: follows.data,
    selectedPoll: selectedPoll.data ?? null,
    selectedPollLoading: selectedPoll.isFetching,
    selectedQuiz: selectedQuiz.data ?? null,
    selectedQuizLoading: selectedQuiz.isFetching,
    preview,
    startAdd: () => {
      setAddState("picking-action");
      resetPicker();
    },
    cancelAdd: () => {
      setAddState("idle");
      resetPicker();
    },
    pickAction: (src) => {
      setPickingType(src);
      setPickedSunji(new Set());
      setKeywordInput("");
      setPickedItemId(src === "follow" ? FOLLOW_ITEM_SENTINEL : null);
      setPickedItemTitle("");
      setAddState("picking-item");
    },
    backToAction: () => {
      resetPicker();
      setAddState("picking-action");
    },
    pickItem: (id, title) => {
      setPickedItemId(id);
      setPickedItemTitle(title);
      setPickedSunji(new Set());
      setKeywordInput("");
    },
    clearItem: () => {
      setPickedItemId(null);
      setPickedItemTitle("");
      setPickedSunji(new Set());
      setKeywordInput("");
    },
    toggleSunji: (token) =>
      setPickedSunji((prev) => {
        const next = new Set(prev);
        if (next.has(token)) next.delete(token);
        else next.add(token);
        return next;
      }),
    confirmSunji,
    removeFilter: (idx) => setFilters((all) => (idx < all.length ? all.filter((_, i) => i !== idx) : all)),
    clearFilters: () => setFilters([]),
    gotoPreview: () => setMode("preview"),
    backToCreate: () => setMode("create"),
    handleComputePreview,
    handleSubmit,
  };
}

/** Rust `token.splitn(2, ':')`. */
function splitToken(token: string): [string | undefined, string | undefined] {
  const i = token.indexOf(":");
  return i < 0 ? [token, undefined] : [token.slice(0, i), token.slice(i + 1)];
}

/** Rust `str::parse::<usize>()`. */
function parseUsize(raw: string | undefined): number | null {
  if (raw === undefined || !/^\+?\d+$/.test(raw)) return null;
  return Number(raw);
}
