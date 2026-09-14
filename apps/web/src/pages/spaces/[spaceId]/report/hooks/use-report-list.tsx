import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useContext, useState, useTransition } from "react";
import { useNavigate } from "react-router-dom";
import { createReport, deleteReport, listReports } from "@ratel/ts-bridges";
import type { ListResponse, ReportListItem, ReportStatus } from "@ratel/ts-bridges";
import { isReportPublished } from "../report-status";

// app/ratel/src/features/spaces/pages/report/hooks/use_report_list_context.rs
// Reports list context: the unfiltered list (stats), the status-filtered list
// (carousel), chip / menu / delete-target state, and the create + delete
// actions.

/** Rust `ReportFilter`. */
export type ReportFilter = "All" | "Drafts" | "Published";

function toStatus(filter: ReportFilter): ReportStatus | null {
  return filter === "All" ? null : filter === "Drafts" ? "Draft" : "Published";
}

export interface PendingDelete {
  id: string;
  title: string;
}

export interface UseReportList {
  spaceId: string;
  allReports: ListResponse<ReportListItem>;
  items: ReportListItem[];
  draftsCount: number;
  publishedCount: number;
  totalCount: number;
  filter: ReportFilter;
  setFilter: (filter: ReportFilter) => void;
  isMenuOpenFor: (id: string) => boolean;
  toggleMenu: (id: string) => void;
  requestDelete: (item: ReportListItem) => void;
  deleteTarget: PendingDelete | null;
  cancelDelete: () => void;
  createPending: boolean;
  handleCreate: () => void;
  deletePending: boolean;
  handleDelete: () => void;
}

const Ctx = createContext<UseReportList | null>(null);
export const ReportListProvider = Ctx.Provider;

export function useReportListContext(): UseReportList {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useReportListContext must be used under ReportListProvider");
  return ctx;
}

export function useReportList(spaceId: string): UseReportList {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Chip clicks re-key the filtered loader; the transition keeps the current
  // cards on screen while the new status loads (Dioxus `Loader` behaviour).
  const [, startTransition] = useTransition();

  const [filter, setFilterState] = useState<ReportFilter>("All");
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PendingDelete | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const allReports = useSuspenseQuery({
    queryKey: ["listReports", spaceId, null, null],
    queryFn: () => listReports(spaceId, null, null),
  });
  const status = toStatus(filter);
  const filteredReports = useSuspenseQuery({
    queryKey: ["listReports", spaceId, null, status],
    queryFn: () => listReports(spaceId, null, status),
  });

  const restartLoaders = () => queryClient.invalidateQueries({ queryKey: ["listReports", spaceId] });

  const handleCreate = () => {
    if (createPending) return;
    setCreatePending(true);
    void (async () => {
      try {
        const resp = await createReport(spaceId, { title: null, description: null });
        void restartLoaders();
        navigate(`/spaces/${spaceId}/report/${resp.id}`);
      } catch (err) {
        // `use_action` keeps the error on the action; nothing renders it.
        console.error("create_report failed", err);
      } finally {
        setCreatePending(false);
      }
    })();
  };

  const handleDelete = () => {
    const pending = deleteTarget;
    if (pending === null || deletePending) return;
    setDeletePending(true);
    void (async () => {
      try {
        await deleteReport(spaceId, pending.id);
        setDeleteTarget(null);
        await restartLoaders();
      } catch (err) {
        console.error("delete_report failed", err);
      } finally {
        setDeletePending(false);
      }
    })();
  };

  const all = allReports.data.items;
  return {
    spaceId,
    allReports: allReports.data,
    items: filteredReports.data.items,
    draftsCount: all.filter((r) => !isReportPublished(r.status)).length,
    publishedCount: all.filter((r) => isReportPublished(r.status)).length,
    totalCount: all.length,
    filter,
    setFilter: (next) => startTransition(() => setFilterState(next)),
    isMenuOpenFor: (id) => menuOpenFor === id,
    toggleMenu: (id) => setMenuOpenFor((open) => (open === id ? null : id)),
    requestDelete: (item) => {
      setMenuOpenFor(null);
      setDeleteTarget({ id: item.id, title: item.title });
    },
    deleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    createPending,
    handleCreate,
    deletePending,
    handleDelete,
  };
}
