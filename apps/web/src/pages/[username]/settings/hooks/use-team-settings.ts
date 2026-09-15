import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  getTeamBillingInfoHandler,
  getTeamMembershipHandler,
  getTeamSettingsHandler,
  updateTeamBillingCardHandler,
  updateTeamHandler,
} from "@ratel/ts-bridges";
import type {
  BillingInfoResponse,
  CardInfo,
  SocialSettingTeamResponse,
  TeamMembershipResponse,
  UpdateTeamRequest,
} from "@ratel/ts-bridges";

// Loaders and mutations of app/ratel/src/features/social/pages/setting/team/views/mod.rs
// (`Home` and `TsSubscriptionCard`). Only the settings components import this file.

export type { BillingInfoResponse, SocialSettingTeamResponse, TeamMembershipResponse } from "@ratel/ts-bridges";

const teamSettingsKey = (username: string) => ["getTeamSettings", username] as const;
const teamMembershipKey = (username: string) => ["getTeamMembership", username] as const;
const teamBillingKey = (username: string) => ["getTeamBillingInfo", username] as const;

/** `use_loader(get_team_settings_handler(username))?` + `update_team_handler`. */
export function useTeamSettings(username: string) {
  const queryClient = useQueryClient();
  const team = useSuspenseQuery({
    queryKey: teamSettingsKey(username),
    queryFn: () => getTeamSettingsHandler(username),
  });

  const updateTeam = useCallback(
    async (req: UpdateTeamRequest): Promise<SocialSettingTeamResponse> => {
      const updated = await updateTeamHandler(username, req);
      // `team.restart()`
      await queryClient.invalidateQueries({ queryKey: teamSettingsKey(username) });
      return updated;
    },
    [queryClient, username],
  );

  return { team: team.data, updateTeam };
}

/** `TsSubscriptionCard` loaders (membership + billing) and the card update. */
export function useTeamBilling(username: string) {
  const queryClient = useQueryClient();
  const membership = useSuspenseQuery<TeamMembershipResponse>({
    queryKey: teamMembershipKey(username),
    queryFn: () => getTeamMembershipHandler(username),
  });
  const billing = useSuspenseQuery<BillingInfoResponse>({
    queryKey: teamBillingKey(username),
    queryFn: () => getTeamBillingInfoHandler(username),
  });

  const updateCard = useCallback(
    async (cardInfo: CardInfo) => {
      await updateTeamBillingCardHandler(username, { cardInfo });
      // `billing_loader.restart()`
      void queryClient.invalidateQueries({ queryKey: teamBillingKey(username) });
    },
    [queryClient, username],
  );

  return { membership: membership.data, billing: billing.data, updateCard };
}
