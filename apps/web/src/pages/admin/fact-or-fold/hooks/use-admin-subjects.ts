import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  createSubjectHandler,
  deleteSubjectHandler,
  getSettingsHandler,
  listSubjectsHandler,
  publishSubjectHandler,
} from "@ratel/ts-bridges";
import type { CreateSubjectRequest, SubjectResponse, SubjectStatus } from "@ratel/ts-bridges";

// app/ratel/src/features/arcade/games/fact_or_fold/hooks/use_admin_subjects.rs
// (`UseFactFoldAdminSubjects`): the admin subject list (one page, ≤50 rows) and
// its mutations, each of which re-fetches every subject list afterwards.

const SUBJECTS_KEY = "listSubjects";
export const FF_SETTINGS_KEY = ["getSettings"] as const;

/** `list_subjects_handler(None, status)` → `resp.items`. Shared with the Schedule page. */
export function subjectsQuery(status: SubjectStatus | null) {
  return {
    queryKey: [SUBJECTS_KEY, null, status] as const,
    queryFn: () => listSubjectsHandler(null, status).then((resp) => resp.items),
  };
}

/** `UseFactFoldAdminSubjects::subjects()` — suspends until the list loads. */
export function useSubjectList(status: SubjectStatus | null): SubjectResponse[] {
  return useSuspenseQuery(subjectsQuery(status)).data;
}

export interface AdminSubjectActions {
  create: (req: CreateSubjectRequest) => Promise<SubjectResponse>;
  publishNow: (subjectId: string) => Promise<SubjectResponse>;
  remove: (subjectId: string) => Promise<SubjectResponse>;
}

export function useAdminSubjects(): AdminSubjectActions {
  const queryClient = useQueryClient();
  // The Rust provider reads the settings singleton once for
  // `queue_alert_threshold_days`; failures are ignored and nothing renders it.
  useQuery({ queryKey: FF_SETTINGS_KEY, queryFn: () => getSettingsHandler(), retry: false });

  const refresh = () => queryClient.invalidateQueries({ queryKey: [SUBJECTS_KEY] });

  return {
    create: async (req) => {
      const res = await createSubjectHandler(req);
      void refresh();
      return res;
    },
    publishNow: async (subjectId) => {
      const res = await publishSubjectHandler(subjectId, { scheduled_at: null, expires_at: null });
      void refresh();
      return res;
    },
    remove: async (subjectId) => {
      const res = await deleteSubjectHandler(subjectId);
      void refresh();
      return res;
    },
  };
}
