import { useMemo } from "react";
import { useSuspenseQueries } from "@tanstack/react-query";
import { getQueueAlarmHandler } from "@ratel/ts-bridges";
import type { QueueAlarmResponse, SubjectResponse } from "@ratel/ts-bridges";
import { subjectsQuery } from "./use-admin-subjects";

// app/ratel/src/features/arcade/games/fact_or_fold/hooks/use_admin_schedule.rs
// (`UseFactFoldAdminSchedule`): `Scheduled` subjects sorted by `scheduled_at`
// ascending, plus the FR-45 queue alarm. Both suspend.
export function useAdminSchedule(): { rows: SubjectResponse[]; alarm: QueueAlarmResponse } {
  const [scheduled, alarm] = useSuspenseQueries({
    queries: [subjectsQuery("Scheduled"), { queryKey: ["getQueueAlarm"], queryFn: () => getQueueAlarmHandler() }],
  });

  const rows = useMemo(
    () => [...scheduled.data].sort((a, b) => (a.scheduled_at ?? 0) - (b.scheduled_at ?? 0)),
    [scheduled.data],
  );

  return { rows, alarm: alarm.data };
}
