// app/ratel/src/features/spaces/pages/index/action_pages/quiz/component.rs:11-26 —
// `ActiveActionOverlay` / `ActiveActionOverlaySignal` and `CompletedActionCard`.
//
// `SpaceIndexPage` provides both; the quiz arena, poll viewer, discussion arena
// and the action dashboard read them. The discussion arena is also mounted
// standalone on `/spaces/:spaceId/discussions/:discussionId`, where there is no
// provider — use `useOptionalActionOverlay()` there (Rust `try_consume_context`).
import * as React from "react";
import type { SpacePartition } from "@ratel/ts-bridges";

/** Rust `ActiveActionOverlay` — ids are SubPartition strings (no prefix). */
export type ActiveActionOverlay =
  | { kind: "Poll"; spaceId: SpacePartition; pollId: string }
  | { kind: "Quiz"; spaceId: SpacePartition; quizId: string }
  | { kind: "Discussion"; spaceId: SpacePartition; discussionId: string };

export interface ActionOverlayState {
  overlay: ActiveActionOverlay | null;
  setOverlay(next: ActiveActionOverlay | null): void;
}

export interface CompletedActionCardState {
  /** The action id to fly into the archive, or null. */
  completed: string | null;
  setCompleted(actionId: string | null): void;
}

const OverlayContext = React.createContext<ActionOverlayState | null>(null);
const CompletedContext = React.createContext<CompletedActionCardState | null>(null);

export function ActionOverlayProvider({ children }: { children: React.ReactNode }) {
  const [overlay, setOverlay] = React.useState<ActiveActionOverlay | null>(null);
  const [completed, setCompleted] = React.useState<string | null>(null);
  const overlayValue = React.useMemo(() => ({ overlay, setOverlay }), [overlay]);
  const completedValue = React.useMemo(() => ({ completed, setCompleted }), [completed]);
  return (
    <OverlayContext.Provider value={overlayValue}>
      <CompletedContext.Provider value={completedValue}>{children}</CompletedContext.Provider>
    </OverlayContext.Provider>
  );
}

/** Rust `use_context::<ActiveActionOverlaySignal>()`. */
export function useActionOverlay(): ActionOverlayState {
  const ctx = React.useContext(OverlayContext);
  if (!ctx) throw new Error("useActionOverlay must be used under ActionOverlayProvider");
  return ctx;
}

/** Rust `try_consume_context::<ActiveActionOverlaySignal>()`. */
export function useOptionalActionOverlay(): ActionOverlayState | null {
  return React.useContext(OverlayContext);
}

/** Rust `use_context::<CompletedActionCard>()`. */
export function useCompletedActionCard(): CompletedActionCardState {
  const ctx = React.useContext(CompletedContext);
  if (!ctx) throw new Error("useCompletedActionCard must be used under ActionOverlayProvider");
  return ctx;
}

/** Rust `try_consume_context::<CompletedActionCard>()`. */
export function useOptionalCompletedActionCard(): CompletedActionCardState | null {
  return React.useContext(CompletedContext);
}
