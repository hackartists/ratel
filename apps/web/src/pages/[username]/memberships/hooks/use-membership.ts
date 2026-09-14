import { useSuspenseQueries } from "@tanstack/react-query";
import {
  getMembershipHandlerGetApiMeMembership,
  getPurchaseHistoryHandler,
  getTeamMembershipHandler,
  getTeamPurchaseHistoryHandler,
} from "@ratel/ts-bridges";
import type {
  ListResponse,
  MembershipGetMembershipMembershipResponse,
  MembershipGetMembershipTransferPurchaseHistoryItem,
  TeamMembershipResponse,
} from "@ratel/ts-bridges";
import { useUserContext } from "@/lib/auth";

export type PurchaseHistoryItem = MembershipGetMembershipTransferPurchaseHistoryItem;

export interface UseUserMembership {
  membership: MembershipGetMembershipMembershipResponse;
  history: ListResponse<PurchaseHistoryItem>;
}

/**
 * app/ratel/src/features/social/pages/membership/user/views/mod.rs:358-360 —
 * two `use_loader`s (`get_membership_handler`, `get_purchase_history_handler(None)`).
 * Suspends until both resolve; a failure (e.g. signed out) reaches the error
 * boundary like the Rust `?`. Both fetch the *signed-in* user's data, whatever
 * `:username` is — same as Rust. Only the first page of history is loaded
 * (Rust never passes a bookmark).
 */
export function useUserMembership(): UseUserMembership {
  // Rust remounts (and refetches) per navigation; keying on the viewer keeps a
  // cached result from leaking across a sign-in/sign-out.
  const viewer = useUserContext().user?.pk ?? null;
  const [membership, history] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["getMembershipHandlerGetApiMeMembership", viewer],
        queryFn: () => getMembershipHandlerGetApiMeMembership(),
      },
      {
        queryKey: ["getPurchaseHistory", viewer, null],
        queryFn: () => getPurchaseHistoryHandler(null),
      },
    ],
  });
  return { membership: membership.data, history: history.data };
}

export interface UseTeamMembership {
  /** `None` when the viewer isn't the team's admin/owner (or is signed out). */
  membership: TeamMembershipResponse | null;
  history: PurchaseHistoryItem[];
}

/**
 * app/ratel/src/features/social/pages/membership/team/views/mod.rs:793-804 —
 * both loaders swallow errors (`.ok()`), so a permission failure renders the
 * no-permission hero instead of the error boundary.
 */
export function useTeamMembership(username: string): UseTeamMembership {
  const viewer = useUserContext().user?.pk ?? null;
  const [membership, history] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["getTeamMembership", username, viewer],
        queryFn: () => getTeamMembershipHandler(username).catch(() => null),
      },
      {
        queryKey: ["getTeamPurchaseHistory", username, viewer, null],
        queryFn: () =>
          getTeamPurchaseHistoryHandler(username, null)
            .then((r) => r.items)
            .catch(() => [] as PurchaseHistoryItem[]),
      },
    ],
  });
  return { membership: membership.data, history: history.data };
}
