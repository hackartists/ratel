import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getReport, listReportAnalyzes, updateReport } from "@ratel/ts-bridges";
import type { ActionSource, Analyze, AnalyzeItem, ChartType, GetReportResponse } from "@ratel/ts-bridges";
import { canEdit, useSpaceData } from "@/components/space-data/use-space-data";
import type { EditorSlashSignal } from "@/components/editor";
import { useReportDetailI18n, type ReportDetailI18n } from "@/i18n/generated/features/spaces/pages/report/views/detail/report-detail.i18n";
import {
  ACTION_SOURCE_VARIANTS,
  actionSourceToken,
  buildChartFigure,
  buildChartInner,
  chartTypeDefaultForItem,
  chartTypeToken,
  dispatchDeleteChart,
  dispatchInsertHtml,
  dispatchReplaceSlashAndInsert,
  dispatchReplaceSlashToken,
  dispatchSwapChart,
  mintChartId,
  parseChartMeta,
  parseOutline,
  type ChartMeta,
  type OutlineEntry,
} from "../components/chart-figure-html";

// app/ratel/src/features/spaces/pages/report/hooks/use_report_detail_context.rs
//
// Report detail page context — a single rich-text body editor backed by the
// shared `Editor` component, plus the picker / slash / outline UI pieces
// that wrap it. Charts are embedded in the body as
// `<figure contenteditable="false">` elements (chart-figure-html.ts); picker
// selection, chart-type swaps, and chart deletions all flow through direct
// DOM dispatches against the editor's contenteditable so the Editor's own
// debounced `onContentChange` callback handles persistence.

/** Rust `SaveStatus`. */
export type SaveStatus = "Idle" | "Unsaved" | "Saving" | "Saved";

/** How long to wait after the last keystroke before persisting (matches `post_edit`). */
const AUTOSAVE_DEBOUNCE_MS = 3000;

/** Rust `DetailDrawerTarget`. */
export type DetailDrawerTarget = "Closed" | "DataPicker";

/** Rust `OutlineMode`. */
export type OutlineMode = { kind: "Default" } | { kind: "ChartTypeSwap"; chartId: string };

/** Rust `SlashState`. */
export interface SlashState {
  raw: string;
  level: number;
  query: string;
  analyzeId: string | null;
  source: ActionSource | null;
  caretX: number;
  caretY: number;
  placement: string;
  selectedIndex: number;
}

/** Rust `SlashAction`. */
export type SlashAction =
  | { kind: "PickCommand" }
  | { kind: "PickAnalyze"; analyzeId: string }
  | { kind: "PickSource"; source: ActionSource }
  | { kind: "InsertItem"; analyzeId: string; source: ActionSource; itemId: string };

/** Rust `SlashOption`. */
export interface SlashOption {
  id: string;
  title: string;
  meta: string;
  action: SlashAction;
  filters: { source: ActionSource; label: string }[];
}

export interface UseReportDetail {
  spaceId: string;
  reportId: string;
  report: GetReportResponse;
  analyzes: Analyze[];
  canEdit: boolean;
  isPublished: boolean;
  eyebrow: string;
  author: string;
  initialTitle: string;
  createdRelative: string;
  editedRelative: string;

  title: string;
  setTitle: (v: string) => void;
  subtitle: string;
  setSubtitle: (v: string) => void;
  bodyHtml: string;
  setBodyHtml: (v: string) => void;
  /** Snapshot taken once at first render — pass as the Editor's `content` prop. */
  initialBodyHtml: string;
  saveStatus: SaveStatus;

  drawer: DetailDrawerTarget;
  openDataPicker: () => void;
  closeDrawer: () => void;
  pickerAnalyzeId: string;
  setPickerAnalyzeId: (id: string) => void;
  pickerSource: ActionSource;
  setPickerSource: (s: ActionSource) => void;
  currentAnalyze: () => Analyze | undefined;
  currentPickerItems: () => AnalyzeItem[];
  pickerItemsCountFor: (source: ActionSource) => number;
  insertChartFromPicker: (analyze: Analyze, item: AnalyzeItem, source: ActionSource) => void;

  outlineMode: OutlineMode;
  outline: OutlineEntry[];
  openChartSwap: (chartId: string) => void;
  closeOutlineSwap: () => void;
  chartMeta: (chartId: string) => ChartMeta | null;
  swapChartType: (chartId: string, newType: ChartType) => void;
  deleteChart: (chartId: string) => void;

  slash: SlashState | null;
  slashOptions: SlashOption[];
  handleSlashSignal: (signal: EditorSlashSignal) => void;
  closeSlash: () => void;
  moveSlashSelection: (delta: number) => void;
  applySlashSelected: () => void;
  applySlashAction: (action: SlashAction) => void;

  publishModalOpen: boolean;
  openPublishModal: () => void;
  closePublishModal: () => void;
  publishPending: boolean;
  handlePublish: () => void;
}

const Ctx = createContext<UseReportDetail | null>(null);
export const ReportDetailProvider = Ctx.Provider;

export function useReportDetailContext(): UseReportDetail {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useReportDetailContext must be used under ReportDetailProvider");
  return ctx;
}

function itemsFor(analyze: Analyze, source: ActionSource): AnalyzeItem[] {
  switch (source) {
    case "Poll":
      return analyze.poll;
    case "Quiz":
      return analyze.quiz;
    case "Discussion":
      return analyze.discussion;
    case "Follow":
      return analyze.follow;
  }
}

function sourceLabel(s: ActionSource): string {
  switch (s) {
    case "Poll":
      return "Poll";
    case "Quiz":
      return "Quiz";
    case "Discussion":
      return "Discussion";
    case "Follow":
      return "Follow";
  }
}

function parseSourceToken(s: string): ActionSource | null {
  switch (s) {
    case "poll":
      return "Poll";
    case "quiz":
      return "Quiz";
    case "discussion":
      return "Discussion";
    case "follow":
      return "Follow";
    default:
      return null;
  }
}

interface ParsedSlash {
  raw: string;
  level: number;
  query: string;
  analyzeId: string | null;
  source: ActionSource | null;
}

/** Rust `parse_slash_token`. `/data` → `:analyze` → `:source` → `:item`. */
function parseSlashToken(raw: string): ParsedSlash | null {
  if (!raw.startsWith("/")) return null;
  const parts = raw.slice(1).split(":");
  if (parts.length === 1) {
    return { raw, level: 0, query: parts[0], analyzeId: null, source: null };
  }
  if (parts.length === 2 && parts[0] === "data") {
    return { raw, level: 1, query: parts[1], analyzeId: null, source: null };
  }
  if (parts.length === 3 && parts[0] === "data") {
    return { raw, level: 2, query: parts[2], analyzeId: parts[1], source: null };
  }
  if (parts.length === 4 && parts[0] === "data") {
    return { raw, level: 3, query: parts[3], analyzeId: parts[1], source: parseSourceToken(parts[2]) };
  }
  return null;
}

/** Rust `build_slash_options`. */
function buildSlashOptions(state: SlashState, analyzes: Analyze[], tr: ReportDetailI18n): SlashOption[] {
  const q = state.query.toLowerCase();
  if (state.level === 0) {
    if (q === "" || "data".startsWith(q)) {
      return [{ id: "data", title: "/data:", meta: tr.slashCommandMeta, action: { kind: "PickCommand" }, filters: [] }];
    }
    return [];
  }
  if (state.level === 1) {
    return analyzes
      .filter((a) => q === "" || a.name.toLowerCase().includes(q))
      .map((a) => ({
        id: a.id,
        title: a.name,
        meta: tr.slashRespondentsFmt({ n: a.respondents }),
        action: { kind: "PickAnalyze", analyzeId: a.id } as SlashAction,
        filters: a.filters,
      }));
  }
  if (state.level === 2) {
    if (!state.analyzeId) return [];
    const analyze = analyzes.find((a) => a.id === state.analyzeId);
    if (!analyze) return [];
    return ACTION_SOURCE_VARIANTS.filter((s) => {
      const token = actionSourceToken(s);
      return itemsFor(analyze, s).length > 0 && (q === "" || token.startsWith(q));
    }).map((s) => ({
      id: actionSourceToken(s),
      title: sourceLabel(s),
      meta: tr.slashItemsCountFmt({ n: itemsFor(analyze, s).length }),
      action: { kind: "PickSource", source: s } as SlashAction,
      filters: [],
    }));
  }
  if (state.level === 3) {
    if (!state.analyzeId || !state.source) return [];
    const analyze = analyzes.find((a) => a.id === state.analyzeId);
    if (!analyze) return [];
    const analyzeId = state.analyzeId;
    const source = state.source;
    return itemsFor(analyze, source)
      .filter((item) => q === "" || item.title.toLowerCase().includes(q))
      .map((item) => ({
        id: item.id,
        title: item.title,
        meta: item.meta,
        action: { kind: "InsertItem", analyzeId, source, itemId: item.id } as SlashAction,
        filters: [],
      }));
  }
  return [];
}

/** "Xs ago" relative to now, localised through `ReportDetailI18n`. */
function formatRelative(timestampMillis: number, tr: ReportDetailI18n): string {
  const diffMs = Math.max(Date.now() - timestampMillis, 0);
  if (diffMs < 60_000) return tr.timeJustNow;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return tr.timeMinutesFmt({ n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tr.timeHoursFmt({ n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return tr.timeDaysFmt({ n: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return tr.timeWeeksFmt({ n: weeks });
  const months = Math.floor(days / 30);
  if (months < 12) return tr.timeMonthsFmt({ n: months });
  return tr.timeYearsFmt({ n: Math.floor(days / 365) });
}

export function useReportDetail(spaceId: string, reportId: string): UseReportDetail {
  const tr = useReportDetailI18n();
  const queryClient = useQueryClient();

  const reportQuery = useSuspenseQuery({
    queryKey: ["getReport", spaceId, reportId],
    queryFn: () => getReport(spaceId, reportId),
  });
  const analyzesQuery = useSuspenseQuery({
    queryKey: ["listReportAnalyzes", spaceId],
    queryFn: () => listReportAnalyzes(spaceId),
  });
  const report = reportQuery.data;
  const analyzes = analyzesQuery.data.items;

  // space-context: stand-in for `use_space_context().role` until the shared
  // space layout context lands. Editability is purely role-based — admins
  // stay in edit mode even after publishing (subsequent edits stream into
  // the published copy via the autosave effect below).
  const { role } = useSpaceData(spaceId);
  const canEditReport = canEdit(role);

  // Edit-buffer state seeded ONCE from the loader snapshot — the exception
  // to "no signal duplication": the editor needs writable local state
  // independent of the server value until a save persists it. Does NOT
  // auto-resync when `reportQuery` refetches (would clobber in-flight
  // edits).
  const [title, setTitle] = useState(() => report.title);
  const [subtitle, setSubtitle] = useState(() => report.description);
  const [bodyHtml, setBodyHtml] = useState(() => report.html_contents ?? "");
  const [initialBodyHtml] = useState(() => report.html_contents ?? "");
  const lastSavedRef = useRef({ title: report.title, subtitle: report.description, bodyHtml: report.html_contents ?? "" });

  const [status, setStatus] = useState<SaveStatus>("Idle");
  const [drawer, setDrawer] = useState<DetailDrawerTarget>("Closed");
  const [pickerAnalyzeId, setPickerAnalyzeId] = useState(() => analyzes[0]?.id ?? "");
  const [pickerSource, setPickerSource] = useState<ActionSource>("Poll");
  const [outlineMode, setOutlineMode] = useState<OutlineMode>({ kind: "Default" });
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishPending, setPublishPending] = useState(false);

  const outline = useMemo(() => parseOutline(bodyHtml), [bodyHtml]);

  const invalidateReport = () => queryClient.invalidateQueries({ queryKey: ["getReport", spaceId, reportId] });

  // Debounced autosave. Every edit to title/subtitle/bodyHtml re-runs this
  // effect; the cleanup cancels the previous timer, so only the LAST edit
  // within the debounce window actually persists (mirrors the Rust
  // `save_version` staleness check via `useEffect`'s own cleanup).
  useEffect(() => {
    const saved = lastSavedRef.current;
    if (title === saved.title && subtitle === saved.subtitle && bodyHtml === saved.bodyHtml) {
      setStatus((s) => (s === "Unsaved" || s === "Saving" ? "Saved" : s));
      return;
    }
    setStatus("Unsaved");
    const timer = setTimeout(() => {
      void (async () => {
        setStatus("Saving");
        try {
          await updateReport(spaceId, reportId, {
            title,
            description: subtitle,
            blocks: null,
            status: null,
            html_contents: bodyHtml,
          });
          lastSavedRef.current = { title, subtitle, bodyHtml };
          setStatus("Saved");
          void invalidateReport();
        } catch (e) {
          console.error("report autosave failed", e);
          setStatus("Unsaved");
        }
      })();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, bodyHtml]);

  const handlePublish = () => {
    setPublishPending(true);
    void (async () => {
      try {
        await updateReport(spaceId, reportId, {
          title,
          description: subtitle,
          blocks: null,
          status: "PUBLISHED",
          html_contents: bodyHtml,
        });
        lastSavedRef.current = { title, subtitle, bodyHtml };
        setStatus("Saved");
        await invalidateReport();
      } catch (e) {
        console.error("report publish failed", e);
      } finally {
        setPublishPending(false);
      }
    })();
  };

  const openDataPicker = () => {
    // Reset the analyze selection to the first analyze every time the modal
    // opens — otherwise reopening the picker keeps the analyze the user last
    // clicked, which feels stale.
    setPickerAnalyzeId(analyzes[0]?.id ?? "");
    setPickerSource("Poll");
    setDrawer("DataPicker");
  };
  const closeDrawer = () => setDrawer("Closed");

  const currentAnalyze = (): Analyze | undefined =>
    analyzes.find((a) => a.id === pickerAnalyzeId) ?? analyzes[0];
  const currentPickerItems = (): AnalyzeItem[] => {
    const a = currentAnalyze();
    return a ? itemsFor(a, pickerSource) : [];
  };
  const pickerItemsCountFor = (source: ActionSource): number => {
    const a = currentAnalyze();
    return a ? itemsFor(a, source).length : 0;
  };

  const insertChartFromPicker = (analyze: Analyze, item: AnalyzeItem, source: ActionSource) => {
    const chartId = mintChartId();
    const chartType = chartTypeDefaultForItem(item, source);
    const figure = buildChartFigure(chartId, source, chartType, analyze, item);
    dispatchInsertHtml(`${figure}<p><br></p>`);
    closeDrawer();
  };

  const applySlashChart = (analyze: Analyze, item: AnalyzeItem, source: ActionSource) => {
    const chartId = mintChartId();
    const chartType = chartTypeDefaultForItem(item, source);
    const figure = buildChartFigure(chartId, source, chartType, analyze, item);
    const raw = slash?.raw ?? "";
    setSlash(null);
    dispatchReplaceSlashAndInsert(raw, `${figure}<p><br></p>`);
  };

  const handleSlashSignal = (signal: EditorSlashSignal) => {
    if (signal.raw === "") {
      setSlash(null);
      return;
    }
    const parsed = parseSlashToken(signal.raw);
    if (!parsed) {
      setSlash(null);
      return;
    }
    const prevIdx = slash && slash.level === parsed.level ? slash.selectedIndex : 0;
    setSlash({
      raw: parsed.raw,
      level: parsed.level,
      query: parsed.query,
      analyzeId: parsed.analyzeId,
      source: parsed.source,
      caretX: signal.caretX,
      caretY: signal.caretY,
      placement: signal.placement,
      selectedIndex: prevIdx,
    });
  };
  const closeSlash = () => setSlash(null);

  const slashOptions = slash ? buildSlashOptions(slash, analyzes, tr) : [];

  const moveSlashSelection = (delta: number) => {
    if (!slash || slashOptions.length === 0) return;
    const len = slashOptions.length;
    let next = (slash.selectedIndex + delta) % len;
    if (next < 0) next += len;
    setSlash({ ...slash, selectedIndex: next });
  };

  const applySlashAction = (action: SlashAction) => {
    if (!slash) return;
    const oldRaw = slash.raw;
    switch (action.kind) {
      case "PickCommand": {
        const raw = "/data:";
        setSlash({ ...slash, level: 1, query: "", raw, selectedIndex: 0 });
        dispatchReplaceSlashToken(oldRaw, raw);
        break;
      }
      case "PickAnalyze": {
        const raw = `/data:${action.analyzeId}:`;
        setSlash({ ...slash, level: 2, query: "", analyzeId: action.analyzeId, raw, selectedIndex: 0 });
        dispatchReplaceSlashToken(oldRaw, raw);
        break;
      }
      case "PickSource": {
        const raw = `/data:${slash.analyzeId ?? ""}:${actionSourceToken(action.source)}:`;
        setSlash({ ...slash, level: 3, query: "", source: action.source, raw, selectedIndex: 0 });
        dispatchReplaceSlashToken(oldRaw, raw);
        break;
      }
      case "InsertItem": {
        const analyze = analyzes.find((a) => a.id === action.analyzeId);
        const item = analyze ? itemsFor(analyze, action.source).find((i) => i.id === action.itemId) : undefined;
        if (analyze && item) applySlashChart(analyze, item, action.source);
        break;
      }
    }
  };
  const applySlashSelected = () => {
    if (slashOptions.length === 0 || !slash) return;
    const idx = Math.min(slash.selectedIndex, slashOptions.length - 1);
    applySlashAction(slashOptions[idx].action);
  };

  const chartMeta = (chartId: string): ChartMeta | null => parseChartMeta(bodyHtml, chartId);
  const openChartSwap = (chartId: string) => setOutlineMode({ kind: "ChartTypeSwap", chartId });
  const closeOutlineSwap = () => setOutlineMode({ kind: "Default" });
  const swapChartType = (chartId: string, newType: ChartType) => {
    const meta = chartMeta(chartId);
    if (!meta) return;
    const newInner = buildChartInner(
      chartId,
      newType,
      meta.analyzeName,
      meta.itemTitle,
      meta.itemMeta,
      meta.options,
      meta.respondentCount,
      meta.discussionData,
      meta.textAnswers,
    );
    dispatchSwapChart(chartId, chartTypeToken(newType), newInner);
    closeOutlineSwap();
  };
  const deleteChart = (chartId: string) => dispatchDeleteChart(chartId);

  return {
    spaceId,
    reportId,
    report,
    analyzes,
    canEdit: canEditReport,
    isPublished: report.status === "PUBLISHED",
    // Hardcoded in the Rust loader too — not run through `translate!`.
    eyebrow: "Action · Report",
    author: report.author,
    initialTitle: report.title,
    createdRelative: formatRelative(report.created_at, tr),
    editedRelative: formatRelative(report.updated_at, tr),

    title,
    setTitle,
    subtitle,
    setSubtitle,
    bodyHtml,
    setBodyHtml,
    initialBodyHtml,
    saveStatus: status,

    drawer,
    openDataPicker,
    closeDrawer,
    pickerAnalyzeId,
    setPickerAnalyzeId,
    pickerSource,
    setPickerSource,
    currentAnalyze,
    currentPickerItems,
    pickerItemsCountFor,
    insertChartFromPicker,

    outlineMode,
    outline,
    openChartSwap,
    closeOutlineSwap,
    chartMeta,
    swapChartType,
    deleteChart,

    slash,
    slashOptions,
    handleSlashSignal,
    closeSlash,
    moveSlashSelection,
    applySlashSelected,
    applySlashAction,

    publishModalOpen,
    openPublishModal: () => setPublishModalOpen(true),
    closePublishModal: () => setPublishModalOpen(false),
    publishPending,
    handlePublish,
  };
}
