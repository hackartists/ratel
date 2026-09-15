import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { getMeet, updateMeet, updateSpaceAction } from "@ratel/ts-bridges";
import type { MeetMode, MeetResponse } from "@ratel/ts-bridges";

// meet/components/meet_page/hooks/use_meet.rs (`UseMeet`): the meet loader and
// its mutations; every mutation reloads the meet on success. Like the Rust
// `use_action`s, failures are not surfaced.

export interface UseMeet {
  spaceId: string;
  meetId: string;
  meet: MeetResponse;
  updateMode: (mode: MeetMode) => void;
  updateStartTime: (startTime: number) => void;
  updateDuration: (durationMin: number) => void;
  publish: () => void;
}

const MeetContext = createContext<UseMeet | null>(null);
export const MeetProvider = MeetContext.Provider;

export function useMeet(): UseMeet {
  const ctx = useContext(MeetContext);
  if (!ctx) throw new Error("useMeet must be used under MeetProvider");
  return ctx;
}

export function useMeetProvider(spaceId: string, meetId: string): UseMeet {
  const queryClient = useQueryClient();
  const queryKey = ["getMeet", spaceId, meetId];
  const meet = useSuspenseQuery({ queryKey, queryFn: () => getMeet(spaceId, meetId) }).data;

  const run = (task: () => Promise<unknown>) => {
    task()
      .then(() => queryClient.invalidateQueries({ queryKey }))
      .catch((e) => console.error("meet action failed:", e));
  };

  return {
    spaceId,
    meetId,
    meet,
    updateMode: (mode) => run(() => updateMeet(spaceId, meetId, { Mode: { mode } })),
    updateStartTime: (startTime) => run(() => updateMeet(spaceId, meetId, { StartTime: { start_time: startTime } })),
    updateDuration: (durationMin) =>
      run(() => updateMeet(spaceId, meetId, { DurationMin: { duration_min: durationMin } })),
    publish: () =>
      run(async () => {
        if (meet.mode === "Instant") {
          await updateMeet(spaceId, meetId, { StartTime: { start_time: Date.now() } });
        }
        await updateSpaceAction(spaceId, meetId, { status: "Ongoing" });
      }),
  };
}
