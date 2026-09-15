// app/ratel/src/features/social/hooks/use_wall_context.rs (`UseWallContext`)
// and the `Signal<Option<String>>` category filter that `SocialLayout` /
// `TeamArenaLayout` provide to child routes.
//
// `SocialLayout` (layouts/social-layout.tsx) installs `WallProvider` for the
// `:username` route param; every page under the layout reads the resolved wall
// with `useWallContext()` and branches on `isUser` / `isTeam`, like the Rust
// `SocialIndex` / `SocialDraft` / … dispatchers.
import * as React from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { Wall } from "@ratel/ts-bridges";
import { getWallByUsername } from "@ratel/ts-bridges";
import { useUserContext } from "@/lib/auth";

export type UserWall = Extract<Wall, { user_type: "User" }>;
export type TeamWall = Extract<Wall, { user_type: "Team" }>;

export interface WallContextValue {
  /** The `:username` route param the wall was resolved from. */
  username: string;
  /** `GET /api/social/:username` (Rust `get_wall_by_username`). */
  wall: Wall;
  /** Rust `UseWallContext::is_user`. */
  isUser: boolean;
  /** Rust `UseWallContext::is_team`. */
  isTeam: boolean;
  /** Re-fetches the wall (Rust `data.restart()`). */
  refresh(): Promise<void>;
  /** Writes a new value into the cached wall without a round-trip. */
  update(next: (wall: Wall) => Wall): void;
}

const WallContext = React.createContext<WallContextValue | null>(null);

export function wallQueryKey(username: string) {
  return ["getWallByUsername", username] as const;
}

/**
 * Rust `use_wall_context_provider(username)`: suspends until the wall loads; a
 * failure (unknown username → `SocialError::InvalidUserName`) reaches the
 * error boundary, like the Rust `use_loader`.
 */
export function WallProvider({ username, children }: { username: string; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const key = wallQueryKey(username);
  const query = useSuspenseQuery({ queryKey: key, queryFn: () => getWallByUsername(username) });

  // `role`, `following`, `can_edit` depend on the viewer. Refetch in the
  // background when the session changes (sign-in from a modal) — the cached
  // wall keeps rendering meanwhile, so the layout never falls back to empty.
  const viewer = useUserContext().user?.pk ?? null;
  const firstViewer = React.useRef(viewer);
  React.useEffect(() => {
    if (firstViewer.current === viewer) return;
    firstViewer.current = viewer;
    void queryClient.invalidateQueries({ queryKey: key });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, username]);

  const wall = query.data;
  const value = React.useMemo<WallContextValue>(
    () => ({
      username,
      wall,
      isUser: wall.user_type === "User",
      isTeam: wall.user_type === "Team",
      refresh: async () => {
        await queryClient.invalidateQueries({ queryKey: wallQueryKey(username) });
      },
      update: (next) => queryClient.setQueryData<Wall>(wallQueryKey(username), (prev) => (prev ? next(prev) : prev)),
    }),
    [username, wall, queryClient],
  );

  return <WallContext.Provider value={value}>{children}</WallContext.Provider>;
}

/** Rust `use_wall_context()`. */
export function useWallContext(): WallContextValue {
  const ctx = React.useContext(WallContext);
  if (!ctx) throw new Error("useWallContext must be used under SocialLayout");
  return ctx;
}

/** `UserWall` when the wall is a user, else `null`. */
export function useUserWall(): UserWall | null {
  const { wall } = useWallContext();
  return wall.user_type === "User" ? wall : null;
}

/** `TeamWall` when the wall is a team, else `null`. */
export function useTeamWall(): TeamWall | null {
  const { wall } = useWallContext();
  return wall.user_type === "Team" ? wall : null;
}

// ── Selected category (Rust `use_context::<Signal<Option<String>>>()`) ──────

export interface SelectedCategory {
  /** `None` = "All". */
  category: string | null;
  setCategory(category: string | null): void;
}

const SelectedCategoryContext = React.createContext<SelectedCategory | null>(null);

/** Rust `use_context_provider(|| Signal::new(Option::<String>::None))`. */
export function SelectedCategoryProvider({ children }: { children: React.ReactNode }) {
  const [category, setCategory] = React.useState<string | null>(null);
  const value = React.useMemo(() => ({ category, setCategory }), [category]);
  return <SelectedCategoryContext.Provider value={value}>{children}</SelectedCategoryContext.Provider>;
}

/** The category filter shared by the sidebar and the home feed. */
export function useSelectedCategory(): SelectedCategory {
  const ctx = React.useContext(SelectedCategoryContext);
  if (!ctx) throw new Error("useSelectedCategory must be used under SocialLayout");
  return ctx;
}
