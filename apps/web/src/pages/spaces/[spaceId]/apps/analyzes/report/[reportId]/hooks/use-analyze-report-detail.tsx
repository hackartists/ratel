import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import {
  analyzeDiscussion,
  getAnalyzeReport,
  getMatchedUsers,
  getPoll,
  getPollResult,
  listAnalyzeDiscussionResults,
  listPanels,
  reanalyzeAnalyzeReport,
  updateDiscussionTopics,
} from "@ratel/ts-bridges";
import type {
  AnalyzesResultTopicRow,
  DiscussionAnalysisParams,
  GetAnalyzeReportResponse,
  ListResponse,
  SpaceAnalyzeDiscussionResult,
} from "@ratel/ts-bridges";
import { buildExcelData, buildExcelFileName } from "@/components/analyzes/analyze-excel";
import { downloadAnalyzeExcel, SpaceAppLocalError } from "@/components/analyzes/analyze-interop";
import { useSpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/hooks/use_analyze_report_detail.rs
// Detail-page controller: the combined report payload, the sidebar
// selections, the per-discussion analysis history, the analysis-settings
// form state, and the two actions (run discussion analysis, per-poll Excel).

export const DEFAULT_DISCUSSION_PARAMS: DiscussionAnalysisParams = {
  num_topics: 10,
  top_n_tfidf: 20,
  top_n_network: 15,
  excluded_keywords: [],
};

export interface UseAnalyzeReportDetail {
  spaceId: string;
  reportId: string;
  detail: GetAnalyzeReportResponse;
  selectedPoll: string | null;
  setSelectedPoll: (id: string) => void;
  selectedQuiz: string | null;
  setSelectedQuiz: (id: string) => void;
  selectedDiscussion: string | null;
  setSelectedDiscussion: (id: string) => void;
  /** "poll" / "quiz" / "discussion" / "follow" — initial "poll". */
  activePanel: string;
  setActivePanel: (panel: string) => void;
  discussionResults: ListResponse<SpaceAnalyzeDiscussionResult>;
  restartDiscussionResults: () => void;
  params: DiscussionAnalysisParams;
  setParams: (params: DiscussionAnalysisParams) => void;
  runDiscussionPending: boolean;
  /** `handle_run_discussion` — runs with the given (just-committed) params. */
  handleRunDiscussion: (params: DiscussionAnalysisParams) => void;
  exportPending: boolean;
  handleExportExcel: (pollId: string) => void;
  /** `true` while the re-analyze request is in flight or the report is back in `in_progress`. */
  reanalyzing: boolean;
  /** Re-runs the report's poll/quiz/follow aggregation against the current data and polls until it settles. */
  handleReanalyze: () => void;
  saveTopicsPending: boolean;
  /** LdaCard `save_action`. */
  saveTopics: (row: SpaceAnalyzeDiscussionResult, topics: AnalyzesResultTopicRow[]) => void;
}

const Ctx = createContext<UseAnalyzeReportDetail | null>(null);
export const AnalyzeReportDetailProvider = Ctx.Provider;

export function useAnalyzeReportDetailContext(): UseAnalyzeReportDetail {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnalyzeReportDetailContext must be used under AnalyzeReportDetailProvider");
  return ctx;
}

const EMPTY_RESULTS: ListResponse<SpaceAnalyzeDiscussionResult> = { items: [], bookmark: null };

/** How often the detail payload is refetched while the report is `in_progress`. */
export const REANALYZE_POLL_INTERVAL_MS = 3000;

export function useAnalyzeReportDetail(spaceId: string, reportId: string): UseAnalyzeReportDetail {
  const tr = useSpaceAnalyzesAppI18n();
  const enumText = useEnumI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  // Selection changes re-key the history loader; running them in a
  // transition keeps the previous data on screen while the new key loads,
  // like a Dioxus `Loader` re-run.
  const [, startTransition] = useTransition();

  const detail = useSuspenseQuery({
    queryKey: ["getAnalyzeReport", spaceId, reportId],
    queryFn: () => getAnalyzeReport(spaceId, reportId),
    refetchInterval: (query) =>
      query.state.data?.report.status === "in_progress" ? REANALYZE_POLL_INTERVAL_MS : false,
  });

  const [selectedPoll, setSelectedPoll] = useState<string | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [selectedDiscussion, setSelectedDiscussionState] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState("poll");

  // Explicit selection wins, else the first discussion in the payload.
  const discussionId = selectedDiscussion ?? detail.data.discussions[0]?.discussion_id ?? null;
  const resultsKey = ["listAnalyzeDiscussionResults", spaceId, reportId, discussionId ?? ""];
  const discussionResults = useSuspenseQuery({
    queryKey: resultsKey,
    queryFn: () =>
      discussionId === null || discussionId === ""
        ? Promise.resolve(EMPTY_RESULTS)
        : listAnalyzeDiscussionResults(spaceId, reportId, discussionId, null),
  });

  const [params, setParams] = useState<DiscussionAnalysisParams>(DEFAULT_DISCUSSION_PARAMS);
  const [runDiscussionPending, setRunDiscussionPending] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [saveTopicsPending, setSaveTopicsPending] = useState(false);
  const [reanalyzePending, setReanalyzePending] = useState(false);
  const reportStatus = detail.data.report.status;
  const awaitingReanalyze = useRef(false);

  useEffect(() => {
    if (!awaitingReanalyze.current || reportStatus === "in_progress") return;
    awaitingReanalyze.current = false;
    if (reportStatus === "finish") toast.info(tr.reanalyzeFinished);
    else toast.error(tr.reanalyzeFailed);
  }, [reportStatus, toast, tr.reanalyzeFinished, tr.reanalyzeFailed]);

  const reanalyzing = reanalyzePending || reportStatus === "in_progress";

  const handleReanalyze = () => {
    if (reanalyzing) return;
    setReanalyzePending(true);
    void (async () => {
      try {
        await reanalyzeAnalyzeReport(spaceId, reportId);
        awaitingReanalyze.current = true;
        toast.info(tr.reanalyzeStarted);
        await queryClient.refetchQueries({ queryKey: ["getAnalyzeReport", spaceId, reportId] });
        void queryClient.invalidateQueries({ queryKey: ["listAnalyzeReports", spaceId] });
      } catch (err) {
        console.error(`reanalyze_analyze_report failed: ${err}`);
        toast.error(err);
      } finally {
        setReanalyzePending(false);
      }
    })();
  };

  const restartDiscussionResults = () => {
    void discussionResults.refetch();
  };

  const handleRunDiscussion = (runParams: DiscussionAnalysisParams) => {
    setParams(runParams);
    const did = selectedDiscussion ?? detail.data.discussions[0]?.discussion_id ?? null;
    if (did === null || did === "") return;
    setRunDiscussionPending(true);
    void (async () => {
      try {
        await analyzeDiscussion(spaceId, reportId, did, { params: runParams });
        // The stream-driven Lambda overwrites the row; refetch once so the
        // freshly queued InProgress row shows immediately.
        await queryClient.refetchQueries({ queryKey: ["listAnalyzeDiscussionResults", spaceId, reportId, did] });
      } catch (err) {
        console.error(`analyze_discussion failed: ${err}`);
        toast.error(err);
      } finally {
        setRunDiscussionPending(false);
      }
    })();
  };

  const handleExportExcel = (pollId: string) => {
    if (exportPending) return;
    setExportPending(true);
    void (async () => {
      try {
        let poll;
        let result;
        let panels;
        try {
          poll = await getPoll(spaceId, pollId);
        } catch (err) {
          console.error(`export_excel get_poll failed: ${err}`);
          toast.error(err);
          return;
        }
        try {
          result = await getPollResult(spaceId, pollId);
        } catch (err) {
          console.error(`export_excel get_poll_result failed: ${err}`);
          toast.error(err);
          return;
        }
        try {
          panels = await listPanels(spaceId);
        } catch (err) {
          console.error(`export_excel list_panels failed: ${err}`);
          toast.error(err);
          return;
        }

        // Cross-filter the per-user answers against the report's matched users.
        if (detail.data.report.filters.length > 0) {
          let matched: Set<string>;
          try {
            matched = new Set(await getMatchedUsers(spaceId, reportId));
          } catch (err) {
            console.error(`export_excel get_matched_users failed: ${err}`);
            toast.error(err);
            return;
          }
          result = {
            ...result,
            sample_answers: result.sample_answers.filter((a) => a.user_pk !== null && matched.has(a.user_pk)),
            final_answers: result.final_answers.filter((a) => a.user_pk !== null && matched.has(a.user_pk)),
          };
        }

        const excel = buildExcelData(poll, panels, result, tr);
        try {
          await downloadAnalyzeExcel({
            file_name: buildExcelFileName(spaceId),
            sheet_name: "Responses",
            rows: excel.rows,
            merges: excel.merges,
          });
          toast.info(tr.downloadStarted);
        } catch (err) {
          toast.error(err instanceof SpaceAppLocalError ? enumText("SpaceAppError", err.variant) : err);
        }
      } finally {
        setExportPending(false);
      }
    })();
  };

  const saveTopics = (row: SpaceAnalyzeDiscussionResult, topics: AnalyzesResultTopicRow[]) => {
    setSaveTopicsPending(true);
    void (async () => {
      try {
        await updateDiscussionTopics(spaceId, reportId, row.discussion_id, row.request_id, { topics });
        restartDiscussionResults();
      } catch (err) {
        // `use_action` keeps the error on the action; nothing renders it.
        console.error("update_discussion_topics failed", err);
      } finally {
        setSaveTopicsPending(false);
      }
    })();
  };

  return {
    spaceId,
    reportId,
    detail: detail.data,
    selectedPoll,
    setSelectedPoll,
    selectedQuiz,
    setSelectedQuiz,
    selectedDiscussion,
    setSelectedDiscussion: (id) => startTransition(() => setSelectedDiscussionState(id)),
    activePanel,
    setActivePanel,
    discussionResults: discussionResults.data,
    restartDiscussionResults,
    params,
    setParams,
    runDiscussionPending,
    handleRunDiscussion,
    exportPending,
    handleExportExcel,
    reanalyzing,
    handleReanalyze,
    saveTopicsPending,
    saveTopics,
  };
}
