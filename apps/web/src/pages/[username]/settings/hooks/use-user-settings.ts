import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  changePasswordHandler,
  getBillingInfoHandler,
  getMcpSecretHandler,
  getMembershipHandlerGetV3MeMemberships,
  getUserDetailHandler,
  regenerateMcpSecretHandler,
  updateBillingCardHandler,
  updateProfileHandler,
} from "@ratel/ts-bridges";
import type {
  BillingInfoResponse,
  CardInfo,
  ChangePasswordRequest,
  McpSecretResponse,
  SocialSettingUserDetailResponse,
  UpdateProfileRequest,
  UserMembershipResponse,
} from "@ratel/ts-bridges";

// Loaders and mutations of app/ratel/src/features/social/pages/setting/user/views/mod.rs
// (`Home`, `PasswordCard`, `SubscriptionCard`, `McpServerCard`). Only the user
// settings components import this file.

/** `use_loader(get_user_detail_handler())?` + `update_profile_handler`. */
export function useUserDetail() {
  const detail = useSuspenseQuery<SocialSettingUserDetailResponse>({
    queryKey: ["getUserDetail"],
    queryFn: () => getUserDetailHandler(),
  });
  const updateProfile = useCallback((req: UpdateProfileRequest) => updateProfileHandler(req), []);
  return { detail: detail.data, updateProfile };
}

/** `change_password_handler`. */
export function useChangePassword() {
  return useCallback(async (req: ChangePasswordRequest) => {
    await changePasswordHandler(req);
  }, []);
}

/** `SubscriptionCard`: `get_membership_handler` + `get_billing_info_handler` + `update_billing_card_handler`. */
export function useUserBilling() {
  const queryClient = useQueryClient();
  const membership = useSuspenseQuery<UserMembershipResponse>({
    queryKey: ["getMembershipHandlerGetV3MeMemberships"],
    queryFn: () => getMembershipHandlerGetV3MeMemberships(),
  });
  const billing = useSuspenseQuery<BillingInfoResponse>({
    queryKey: ["getBillingInfo"],
    queryFn: () => getBillingInfoHandler(),
  });
  const updateCard = useCallback(
    async (cardInfo: CardInfo) => {
      await updateBillingCardHandler({ cardInfo });
      // `billing_info.restart()`
      void queryClient.invalidateQueries({ queryKey: ["getBillingInfo"] });
    },
    [queryClient],
  );
  return { membership: membership.data, billing: billing.data, updateCard };
}

/** `McpServerCard`: `get_mcp_secret_handler` + `regenerate_mcp_secret_handler`. */
export function useMcpSecret() {
  const queryClient = useQueryClient();
  const status = useSuspenseQuery<McpSecretResponse>({
    queryKey: ["getMcpSecret"],
    queryFn: () => getMcpSecretHandler(),
  });
  const regenerate = useCallback(async () => {
    const resp = await regenerateMcpSecretHandler();
    // `mcp_status.restart()`
    void queryClient.invalidateQueries({ queryKey: ["getMcpSecret"] });
    return resp;
  }, [queryClient]);
  return { hasSecret: status.data.has_secret, regenerate };
}
