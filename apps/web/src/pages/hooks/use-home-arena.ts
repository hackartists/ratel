// Controller for the home arena (app/ratel/src/views/index/component.rs `Index`):
// every loader the page reads plus its actions. Rust suspends the page until
// the hot spaces, my spaces, invited spaces, the first "My Posts" page and the
// team context have loaded; `ready` is that condition, so the page renders
// nothing until then — which is also exactly what the prerendered HTML holds,
// so it hydrates without a mismatch.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreatePost,
  useListHotSpaces,
  useListMyHomeSpaces,
  useListMyInvitedSpaces,
  useListUserPostsInfinite,
} from "@ratel/ts-bridges/hooks";
import type { HotSpaceResponse, PostResponse, TeamItem, User } from "@ratel/ts-bridges";
import { LOGIN_MODAL_TITLE, useAuthNavigate, useLoginModal } from "@/components/auth";
import { useAuth } from "@/lib/auth";
import { useTeamContext } from "@/lib/teams";
import { partitionId } from "../components/format";

/** Rust `UserType::SystemAdmin` (common/types/auth/user_type.rs:27). */
const USER_TYPE_SYSTEM_ADMIN = 98;

export interface UseHomeArena {
  ready: boolean;
  hasUser: boolean;
  isAdmin: boolean;
  hotCards: HotSpaceResponse[];
  mineCards: HotSpaceResponse[];
  invitedCards: HotSpaceResponse[];
  posts: PostResponse[];
  teams: TeamItem[];
  /** `go_create_post`: the login modal when signed out, else a new draft in the editor. */
  createPost(): Promise<void>;
  /** `nav.auth_push(route)`. */
  authNavigate(to: string | ((user: User) => string)): void;
}

export function useHomeArena(): UseHomeArena {
  const auth = useAuth();
  const user = auth.userContext.user;
  const hasUser = user !== null;
  const username = user?.username ?? "";
  const navigate = useNavigate();
  const loginModal = useLoginModal();
  const authNavigate = useAuthNavigate();
  const teamCtx = useTeamContext();

  const hot = useListHotSpaces({ retry: false });
  // `use_my_spaces()` / invited: fetched only while logged in, `Default` otherwise.
  const mine = useListMyHomeSpaces(null, { enabled: auth.ready && hasUser, retry: false });
  const invited = useListMyInvitedSpaces(null, { enabled: auth.ready && hasUser, retry: false });

  // "My Posts": seeded with the username at first render and restarted only
  // when a non-empty username resolves or changes (component.rs:56-80).
  const [postsUsername, setPostsUsername] = useState(username);
  useEffect(() => {
    if (username !== "" && username !== postsUsername) setPostsUsername(username);
  }, [username, postsUsername]);
  const posts = useListUserPostsInfinite(postsUsername, { enabled: auth.ready, retry: false });

  // A loader failure reaches the error boundary, like `use_loader(..)?`.
  for (const q of [hot, mine, invited, posts]) {
    if (q.isError) throw q.error;
  }

  const loaded =
    auth.ready &&
    teamCtx.ready &&
    hot.data !== undefined &&
    (!hasUser || (mine.data !== undefined && invited.data !== undefined)) &&
    posts.data !== undefined;
  // Once shown, the page stays mounted while loaders re-run (sign-in, restart).
  const shown = useRef(false);
  if (loaded) shown.current = true;

  const createPost = useCreatePost();

  return {
    ready: shown.current,
    hasUser,
    isAdmin: user?.user_type === USER_TYPE_SYSTEM_ADMIN,
    hotCards: hot.data?.items ?? [],
    mineCards: hasUser ? (mine.data?.items ?? []) : [],
    invitedCards: hasUser ? (invited.data?.items ?? []) : [],
    posts: posts.items,
    teams: teamCtx.teams,
    createPost: async () => {
      if (!hasUser) {
        // component.rs:162-168 — no `on_success`: the modal only signs in.
        loginModal.open({ title: LOGIN_MODAL_TITLE });
        return;
      }
      try {
        const resp = await createPost.mutateAsync(null);
        navigate(`/posts/${partitionId(resp.post_pk)}/edit`);
      } catch (e) {
        console.error("Failed to create post:", e);
      }
    },
    authNavigate,
  };
}
