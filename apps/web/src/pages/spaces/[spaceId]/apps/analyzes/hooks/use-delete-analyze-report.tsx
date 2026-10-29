import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { deleteAnalyzeReport } from "@ratel/ts-bridges";
import type { AnalyzeReport, ListResponse } from "@ratel/ts-bridges";
import { ConfirmPopup } from "@/components/ui/confirm-popup";
import { usePopup } from "@/lib/popup";
import { useToast } from "@/lib/toast";
import { useSpaceAnalyzesAppI18n } from "../space-analyzes-app.i18n";

/** Opens the delete confirmation for one report; `onDeleted` runs after the server confirms the delete. */
export type OpenDeleteAnalyzeReport = (reportId: string, onDeleted?: () => void) => void;

/**
 * Report delete flow shared by the list carousel and the detail page:
 * danger confirm popup → `delete_analyze_report` → drop the report from the
 * cached list (so the carousel updates without waiting for the refetch) →
 * refetch the list → `onDeleted`. Failures (e.g. the report is still being
 * analyzed) are surfaced as a toast and keep the popup open.
 */
export function useDeleteAnalyzeReport(spaceId: string): OpenDeleteAnalyzeReport {
  const tr = useSpaceAnalyzesAppI18n();
  const popup = usePopup();
  const toast = useToast();
  const queryClient = useQueryClient();

  return (reportId, onDeleted) => {
    const confirm = async () => {
      try {
        await deleteAnalyzeReport(spaceId, reportId);
      } catch (err) {
        console.error(`delete_analyze_report failed: ${err}`);
        toast.error(err);
        return;
      }
      popup.close();
      toast.info(tr.deleteReportSuccess);
      onDeleted?.();
      dropReportFromLists(queryClient, spaceId, reportId);
      void queryClient.invalidateQueries({ queryKey: ["listAnalyzeReports", spaceId] });
    };

    popup.open(
      <ConfirmPopup
        tone="danger"
        testId="delete-report-popup"
        title={tr.deleteReportConfirmTitle}
        description={tr.deleteReportConfirmDesc}
        confirmLabel={tr.deleteReportConfirmOk}
        cancelLabel={tr.deleteReportCancel}
        onConfirm={confirm}
        onCancel={() => popup.close()}
      />,
    );
  };
}

/** Removes `reportId` from every cached `listAnalyzeReports` page of the space. */
function dropReportFromLists(queryClient: QueryClient, spaceId: string, reportId: string) {
  queryClient.setQueriesData<ListResponse<AnalyzeReport>>({ queryKey: ["listAnalyzeReports", spaceId] }, (prev) =>
    prev ? { ...prev, items: prev.items.filter((r) => r.id !== reportId) } : prev,
  );
}
