import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { getPoll } from "@ratel/ts-bridges";
import type { PollResponse } from "@ratel/ts-bridges";

// poll/context.rs (`Context::init`): the poll loader shared by the creator
// cards and the response views. Local edit state (title/questions drafts)
// lives in each card, seeded from this snapshot — like the Rust
// `use_signal(|| ctx.poll.read().title.clone())` pattern.

export interface UsePoll {
  spaceId: string;
  pollId: string;
  poll: PollResponse;
  refresh: () => void;
}

const PollContext = createContext<UsePoll | null>(null);
export const PollProvider = PollContext.Provider;

export function usePoll(): UsePoll {
  const ctx = useContext(PollContext);
  if (!ctx) throw new Error("usePoll must be used under PollProvider");
  return ctx;
}

export function usePollProvider(spaceId: string, pollId: string): UsePoll {
  const queryClient = useQueryClient();
  const queryKey = ["getPoll", spaceId, pollId];
  const poll = useSuspenseQuery({ queryKey, queryFn: () => getPoll(spaceId, pollId) }).data;

  return {
    spaceId,
    pollId,
    poll,
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  };
}
