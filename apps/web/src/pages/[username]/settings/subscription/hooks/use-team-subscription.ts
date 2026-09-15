import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { changeTeamMembershipHandler, getTeamMembershipHandler, identifyTeamHandler } from "@ratel/ts-bridges";
import type { CardInfo, ChangeTeamMembershipResponse, TeamMembershipResponse, VerifiedCustomer } from "@ratel/ts-bridges";
import { apiTierString, partitionTierToUi, type UiMembershipTier } from "@/components/membership/membership-tier";

// Loaders and mutations of app/ratel/src/features/social/pages/setting/team/views/subscription_page/mod.rs.

const currentMembershipKey = (username: string) => ["getTeamMembership", username, "optional"] as const;

export function useTeamSubscription(username: string) {
  const queryClient = useQueryClient();

  // `get_team_membership_handler(username).await.ok()` — a failure reads as no membership.
  const current = useSuspenseQuery<TeamMembershipResponse | null>({
    queryKey: currentMembershipKey(username),
    queryFn: () => getTeamMembershipHandler(username).catch(() => null),
  });
  const currentTier: UiMembershipTier = current.data ? partitionTierToUi(current.data.tier) : "Free";

  /** `identify_team_handler`. */
  const identifyTeam = useCallback(
    (identityId: string): Promise<VerifiedCustomer> => identifyTeamHandler(username, { id: identityId }),
    [username],
  );

  /** `change_team_membership_handler` (KRW). */
  const changeMembership = useCallback(
    (tier: UiMembershipTier, cardInfo: CardInfo): Promise<ChangeTeamMembershipResponse> =>
      changeTeamMembershipHandler(username, { membership: apiTierString(tier), currency: "KRW", cardInfo }),
    [username],
  );

  /** `current_membership.restart()` (also refreshes the settings card's membership). */
  const restartCurrent = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: currentMembershipKey(username) });
    void queryClient.invalidateQueries({ queryKey: ["getTeamMembership", username], exact: true });
  }, [queryClient, username]);

  return { currentTier, identifyTeam, changeMembership, restartCurrent };
}
