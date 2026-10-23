import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getPoll, getPollResult, listPanels } from "@ratel/ts-bridges";
import type { PollResponse, PollResultResponse } from "@ratel/ts-bridges";
import { buildExcelData, buildExcelFileName } from "@/components/analyzes/analyze-excel";
import { downloadAnalyzeExcel, SpaceAppLocalError } from "@/components/analyzes/analyze-interop";
import { useSpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/hooks/use_space_analyze_poll.rs
// Controller for the Poll analyze detail page: the three loaders (panels,
// poll, result), the two filter signals, and the Excel export action.

export interface UseSpaceAnalyzePoll {
  poll: PollResponse;
  result: PollResultResponse;
  selectedFilterGroup: string;
  setSelectedFilterGroup: (value: string) => void;
  selectedFilterValue: string;
  setSelectedFilterValue: (value: string) => void;
  /** `handle_export_excel.pending()` */
  exportPending: boolean;
  handleExportExcel: () => void;
  /** `true` while the poll, result and panel loaders are being re-fetched. */
  reanalyzing: boolean;
  /** Re-reads the poll result (computed live from current responses) and panels. */
  handleReanalyze: () => void;
}

export function useSpaceAnalyzePoll(spaceId: string, pollId: string): UseSpaceAnalyzePoll {
  const tr = useSpaceAnalyzesAppI18n();
  const enumText = useEnumI18n();
  const toast = useToast();

  const panels = useSuspenseQuery({ queryKey: ["listPanels", spaceId], queryFn: () => listPanels(spaceId) });
  const poll = useSuspenseQuery({ queryKey: ["getPoll", spaceId, pollId], queryFn: () => getPoll(spaceId, pollId) });
  const result = useSuspenseQuery({
    queryKey: ["getPollResult", spaceId, pollId],
    queryFn: () => getPollResult(spaceId, pollId),
  });

  const [selectedFilterGroup, setSelectedFilterGroup] = useState("overall");
  const [selectedFilterValue, setSelectedFilterValue] = useState("");
  const [exportPending, setExportPending] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  const handleReanalyze = () => {
    if (reanalyzing) return;
    setReanalyzing(true);
    void (async () => {
      try {
        const settled = await Promise.all([panels.refetch(), poll.refetch(), result.refetch()]);
        const failed = settled.find((r) => r.isError);
        if (failed) toast.error(failed.error);
        else toast.info(tr.reanalyzeFinished);
      } catch (err) {
        toast.error(err);
      } finally {
        setReanalyzing(false);
      }
    })();
  };

  const handleExportExcel = () => {
    if (exportPending) return;
    setExportPending(true);
    void (async () => {
      const excel = buildExcelData(poll.data, panels.data, result.data, tr);
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
      } finally {
        setExportPending(false);
      }
    })();
  };

  return {
    poll: poll.data,
    result: result.data,
    selectedFilterGroup,
    setSelectedFilterGroup,
    selectedFilterValue,
    setSelectedFilterValue,
    exportPending,
    handleExportExcel,
    reanalyzing,
    handleReanalyze,
  };
}
