// Shared space context — the React counterpart of
//   app/ratel/src/features/spaces/space_common/providers/space_context_provider.rs
//   (`SpaceContextProvider::init`, `use_space_context()`),
//   app/ratel/src/features/spaces/space_common/hooks/{use_space,use_user_role}.rs
//   (`use_space()`, `use_space_role()`, `use_actions()`, `use_ranking()`, `use_my_score()`),
//   app/ratel/src/features/spaces/layout.rs (`SpaceLayoutUiContext`, `use_space_layout_ui()`).
//
// ─── API ────────────────────────────────────────────────────────────────────
// Provided once by `layouts/space-layout.tsx` for every `/spaces/:spaceId/*`
// route. Pages and components under that layout read it back:
//
//   const ctx = useSpaceContext();         // Rust `use_space_context()`
//   ctx.spaceId                            // SpacePartition (route param, no prefix)
//   ctx.space                              // SpaceResponse            (Rust `ctx.space()`)
//   ctx.role                               // SpaceUserRole — server role (Rust `ctx.role()`)
//   ctx.currentRole                        // SpaceUserRole — effective role (Rust `ctx.current_role()`):
//                                          //   Creator on an Ongoing space reads as Participant
//   ctx.setCurrentRole(role)               // Rust `ctx.current_role.set(role)`; like the Rust memo, the
//                                          //   override is dropped when `space` or `role` reloads
//   ctx.toggleRole()                       // Rust `toggle_role()`; returns false for non-creators
//                                          //   (Rust `Err(Error::UnauthorizedAccess)`)
//   ctx.panelRequirements                  // PanelRequirementStatus[]
//   ctx.actions                            // SpaceActionSummary[]    (Rust `use_actions()`)
//   ctx.ranking                            // ListResponse<RankingEntryResponse> (first page, Rust `use_ranking()`)
//   ctx.myScore                            // MyScoreResponse         (Rust `use_my_score()`)
//   ctx.restart()                          // re-fetch everything     (Rust `restart()`)
//   ctx.restartSpace() / restartRole() / restartPanelRequirements()
//      / restartActions() / restartRanking() / restartMyScore()
//                                          // Rust `ctx.space.restart()` etc. Each returns the refetch promise.
//
//   useSpace()          → SpaceResponse       (Rust `use_space()()`)
//   useSpaceRole()      → SpaceUserRole       (Rust `use_space_role()()`, the effective role)
//   useActions() / useRanking() / useMyScore()
//   useSpaceLayoutUi()  → { sidebarVisible, setSidebarVisible } (Rust `use_space_layout_ui()`)
//
// Loading and errors match `use_loader(..)?`: the provider suspends until all six
// loaders have answered (the route `Suspense` renders nothing meanwhile) and any
// failure reaches the route error boundary — e.g. a signed-out viewer on a draft
// space gets 401 from `/user-role` and sees the error page, like Dioxus. A restart
// keeps showing the previous data while it re-fetches (no re-suspend).
//
// Query keys are the scaffolded `@ratel/ts-bridges/hooks` keys (`["getSpace", id]`,
// `["getUserRole", id]`, `["getPanelRequirements", id]`, `["listActions", id]`,
// `["getRanking", id, null]`, `["getMyScore", id]`), so a mutation elsewhere can
// also refresh the context with `queryClient.invalidateQueries`.
import * as React from "react";
import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import {
  getMyScoreHandler,
  getPanelRequirements,
  getRankingHandler,
  getSpace,
  getUserRole,
  listActions,
} from "@ratel/ts-bridges";
import type {
  ListResponse,
  MyScoreResponse,
  PanelRequirementStatus,
  RankingEntryResponse,
  SpaceActionSummary,
  SpacePartition,
  SpaceResponse,
  SpaceUserRole,
} from "@ratel/ts-bridges";

/** `SpaceStatus` wire strings (common/types/space/space_status.rs). */
export const SpaceStatus = {
  Designing: "Designing",
  Open: "Open",
  Ongoing: "Ongoing",
  Processing: "Processing",
  Finished: "Finished",
} as const;

/** `SpaceVisibility` wire strings (DynamoEnum Display). */
export const SpaceVisibility = { Private: "PRIVATE", Public: "PUBLIC" } as const;

/** `SpacePublishState` wire strings (DynamoEnum Display). */
export const SpacePublishState = { Draft: "DRAFT", Published: "PUBLISHED" } as const;

/** `SpaceUserRole::is_admin()` (common/types/space_user_role.rs). */
export function isSpaceAdmin(role: SpaceUserRole): boolean {
  return role === "Creator";
}

export const spaceQueryKeys = {
  space: (spaceId: SpacePartition) => ["getSpace", spaceId] as const,
  role: (spaceId: SpacePartition) => ["getUserRole", spaceId] as const,
  panelRequirements: (spaceId: SpacePartition) => ["getPanelRequirements", spaceId] as const,
  actions: (spaceId: SpacePartition) => ["listActions", spaceId] as const,
  ranking: (spaceId: SpacePartition) => ["getRanking", spaceId, null] as const,
  myScore: (spaceId: SpacePartition) => ["getMyScore", spaceId] as const,
};

export interface SpaceContextValue {
  spaceId: SpacePartition;
  space: SpaceResponse;
  role: SpaceUserRole;
  currentRole: SpaceUserRole;
  setCurrentRole(role: SpaceUserRole): void;
  toggleRole(): boolean;
  panelRequirements: PanelRequirementStatus[];
  actions: SpaceActionSummary[];
  ranking: ListResponse<RankingEntryResponse>;
  myScore: MyScoreResponse;
  restart(): Promise<void>;
  restartSpace(): Promise<void>;
  restartRole(): Promise<void>;
  restartPanelRequirements(): Promise<void>;
  restartActions(): Promise<void>;
  restartRanking(): Promise<void>;
  restartMyScore(): Promise<void>;
}

const SpaceContext = React.createContext<SpaceContextValue | null>(null);

/** Rust `current_role` memo: `(Creator, Some(Ongoing))` reads as Participant. */
function deriveCurrentRole(space: SpaceResponse, role: SpaceUserRole): SpaceUserRole {
  return role === "Creator" && space.status === SpaceStatus.Ongoing ? "Participant" : role;
}

/** Builds and provides the context (Rust `SpaceContextProvider::init`). Suspends until loaded. */
export function SpaceContextProvider({ spaceId, children }: { spaceId: SpacePartition; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [roleQ, spaceQ, panelQ, actionsQ, rankingQ, myScoreQ] = useSuspenseQueries({
    queries: [
      { queryKey: spaceQueryKeys.role(spaceId), queryFn: () => getUserRole(spaceId) },
      { queryKey: spaceQueryKeys.space(spaceId), queryFn: () => getSpace(spaceId) },
      { queryKey: spaceQueryKeys.panelRequirements(spaceId), queryFn: () => getPanelRequirements(spaceId) },
      { queryKey: spaceQueryKeys.actions(spaceId), queryFn: () => listActions(spaceId) },
      { queryKey: spaceQueryKeys.ranking(spaceId), queryFn: () => getRankingHandler(spaceId, null) },
      { queryKey: spaceQueryKeys.myScore(spaceId), queryFn: () => getMyScoreHandler(spaceId) },
    ],
  });

  const space = spaceQ.data;
  const role = roleQ.data;
  // The memo's inputs: a manual `set` survives only until either loader writes again.
  const basis = `${spaceQ.dataUpdatedAt}:${roleQ.dataUpdatedAt}`;
  const [override, setOverride] = React.useState<{ role: SpaceUserRole; basis: string } | null>(null);
  const currentRole = override && override.basis === basis ? override.role : deriveCurrentRole(space, role);

  const value = React.useMemo<SpaceContextValue>(() => {
    const refetch = (queryKey: readonly unknown[]) => () =>
      queryClient.refetchQueries({ queryKey, exact: true }).then(() => undefined);
    const restartSpace = refetch(spaceQueryKeys.space(spaceId));
    const restartRole = refetch(spaceQueryKeys.role(spaceId));
    const restartPanelRequirements = refetch(spaceQueryKeys.panelRequirements(spaceId));
    const restartActions = refetch(spaceQueryKeys.actions(spaceId));
    const restartRanking = refetch(spaceQueryKeys.ranking(spaceId));
    const restartMyScore = refetch(spaceQueryKeys.myScore(spaceId));
    const setCurrentRole = (next: SpaceUserRole) => setOverride({ role: next, basis });
    return {
      spaceId,
      space,
      role,
      currentRole,
      setCurrentRole,
      toggleRole: () => {
        if (role !== "Creator") return false;
        setCurrentRole(currentRole === "Creator" ? "Participant" : "Creator");
        return true;
      },
      panelRequirements: panelQ.data,
      actions: actionsQ.data,
      ranking: rankingQ.data,
      myScore: myScoreQ.data,
      restart: () =>
        Promise.all([
          restartRole(),
          restartSpace(),
          restartPanelRequirements(),
          restartActions(),
          restartRanking(),
          restartMyScore(),
        ]).then(() => undefined),
      restartSpace,
      restartRole,
      restartPanelRequirements,
      restartActions,
      restartRanking,
      restartMyScore,
    };
  }, [queryClient, spaceId, space, role, currentRole, basis, panelQ.data, actionsQ.data, rankingQ.data, myScoreQ.data]);

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

/** Rust `use_space_context()`. */
export function useSpaceContext(): SpaceContextValue {
  const ctx = React.useContext(SpaceContext);
  if (!ctx) throw new Error("useSpaceContext must be used under SpaceContextProvider (space layout)");
  return ctx;
}

/** Rust `use_space()()`. */
export function useSpace(): SpaceResponse {
  return useSpaceContext().space;
}

/** Rust `use_space_role()()` — the effective (current) role. */
export function useSpaceRole(): SpaceUserRole {
  return useSpaceContext().currentRole;
}

/** Rust `use_actions()()`. */
export function useActions(): SpaceActionSummary[] {
  return useSpaceContext().actions;
}

/** Rust `use_ranking()()`. */
export function useRanking(): ListResponse<RankingEntryResponse> {
  return useSpaceContext().ranking;
}

/** Rust `use_my_score()()`. */
export function useMyScore(): MyScoreResponse {
  return useSpaceContext().myScore;
}

// ─── SpaceLayoutUiContext ───────────────────────────────────────────────────

export interface SpaceLayoutUi {
  sidebarVisible: boolean;
  setSidebarVisible(visible: boolean): void;
}

const SpaceLayoutUiContext = React.createContext<SpaceLayoutUi | null>(null);

export function SpaceLayoutUiProvider({ children }: { children: React.ReactNode }) {
  const [sidebarVisible, setSidebarVisible] = React.useState(true);
  const value = React.useMemo(() => ({ sidebarVisible, setSidebarVisible }), [sidebarVisible]);
  return <SpaceLayoutUiContext.Provider value={value}>{children}</SpaceLayoutUiContext.Provider>;
}

/** Rust `use_space_layout_ui()`. */
export function useSpaceLayoutUi(): SpaceLayoutUi {
  const ctx = React.useContext(SpaceLayoutUiContext);
  if (!ctx) throw new Error("useSpaceLayoutUi must be used under the space layout");
  return ctx;
}
