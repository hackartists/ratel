// app/ratel/src/features/spaces/pages/index/action_dashboard/dependency_lock.rs —
// dependency gating for quest cards: whether a card is locked, which unmet
// actions block it, and the popup listing them.
import { createElement } from "react";
import type { SpaceActionSummary, SpacePartition } from "@ratel/ts-bridges";
import type { PopupService } from "@/lib/popup";
import { LockedDependenciesPopup } from "./locked-dependencies-popup";

/** Rust `DependencyLock`. */
export interface DependencyLock {
  locked: boolean;
}

/** Rust `DependencyLock::none()`. */
export function dependencyLockNone(): DependencyLock {
  return { locked: false };
}

/** Rust `build_action_lookup`: action id → (title, user_participated). */
export function buildActionLookup(actions: SpaceActionSummary[]): Map<string, [string, boolean]> {
  return new Map(actions.map((a) => [a.action_id, [a.title, a.user_participated]]));
}

/** Rust `resolve_outstanding_actions`: the unmet dependencies of `action`, in `depends_on` order. */
export function resolveOutstandingActions(
  action: SpaceActionSummary,
  allActions: SpaceActionSummary[],
): SpaceActionSummary[] {
  if (action.depends_on.length === 0 || action.dependencies_met) return [];
  const outstanding: SpaceActionSummary[] = [];
  for (const depId of action.depends_on) {
    const found = allActions.find((a) => a.action_id === depId && !a.user_participated);
    if (found) outstanding.push(found);
  }
  return outstanding;
}

/** Rust `resolve_dependency_lock`. */
export function resolveDependencyLock(
  action: SpaceActionSummary,
  _lookup: Map<string, [string, boolean]>,
): DependencyLock {
  if (action.depends_on.length === 0 || action.dependencies_met) return dependencyLockNone();
  return { locked: true };
}

/** Rust `open_locked_popup`. */
export function openLockedPopup(popup: PopupService, spaceId: SpacePartition, outstanding: SpaceActionSummary[]): void {
  popup.open(
    createElement(LockedDependenciesPopup, {
      spaceId,
      outstanding,
      onClose: () => popup.close(),
    }),
  );
}
