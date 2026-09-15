import { usePrefetchInfiniteQuery, usePrefetchQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  adminBlockUser,
  adminDismissUser,
  createReward,
  createTestAccount,
  deleteTestAccount,
  getAnalyzeQuota,
  grantEnterpriseMembership,
  listEnterpriseMemberships,
  listModerationFlags,
  listRewards,
  listTestAccounts,
  updateAnalyzeQuota,
  updateReward,
} from "@ratel/ts-bridges";
import type {
  CreateGlobalRewardRequest,
  CreateTestAccountRequest,
  EnterpriseMembershipGrantListItem,
  GrantEnterpriseMembershipRequest,
  ModerationFlagResponse,
} from "@ratel/ts-bridges";
import { infiniteListOptions, useSuspenseInfiniteList } from "@ratel/ts-bridges/hooks";

// Data + mutations of app/ratel/src/features/admin/views/main/mod.rs
// (`AdminMainPage`, `AnalyzeQuotaSection`, `TestAccountsSection`). Every
// loader suspends like `use_loader(...)?` / `use_infinite_query(...)?`, and a
// successful mutation restarts the loader it changed.

const QUOTA_KEY = ["getAnalyzeQuota"] as const;
const TEST_ACCOUNTS_KEY = ["listTestAccounts"] as const;
const REWARDS_KEY = ["listRewards"] as const;
const ENTERPRISE_KEY = ["listEnterpriseMemberships", "infinite"] as const;
const MODERATION_KEY = ["listModerationFlags", "PendingReview", "infinite"] as const;

const quotaQuery = { queryKey: QUOTA_KEY, queryFn: () => getAnalyzeQuota() };
const testAccountsQuery = { queryKey: TEST_ACCOUNTS_KEY, queryFn: () => listTestAccounts() };
const rewardsQuery = { queryKey: REWARDS_KEY, queryFn: () => listRewards() };
const fetchEnterprise = (bookmark?: string) => listEnterpriseMemberships(bookmark ?? null);
// Rust: `list_moderation_flags(Some("PendingReview"), bookmark)`.
const fetchModeration = (bookmark?: string) => listModerationFlags("PendingReview", bookmark ?? null);

/**
 * Starts every loader of the page at once. The sections suspend one after
 * another; without this each would wait for the previous one to resolve.
 */
export function usePrefetchAdminMain(): void {
  usePrefetchQuery(quotaQuery);
  usePrefetchQuery(testAccountsQuery);
  usePrefetchQuery(rewardsQuery);
  usePrefetchInfiniteQuery(infiniteListOptions<EnterpriseMembershipGrantListItem>(ENTERPRISE_KEY, fetchEnterprise));
  usePrefetchInfiniteQuery(infiniteListOptions<ModerationFlagResponse>(MODERATION_KEY, fetchModeration));
}

export function useAnalyzeQuota() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(quotaQuery);
  return {
    quota: data,
    save: async (limit: number) => {
      const result = await updateAnalyzeQuota({ non_enterprise_limit: limit });
      void queryClient.invalidateQueries({ queryKey: QUOTA_KEY });
      return result;
    },
  };
}

export function useTestAccounts() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(testAccountsQuery);
  const restart = () => queryClient.invalidateQueries({ queryKey: TEST_ACCOUNTS_KEY });
  return {
    accounts: data,
    add: async (req: CreateTestAccountRequest) => {
      const result = await createTestAccount(req);
      void restart();
      return result;
    },
    /** Rust ignores the delete result and always restarts the list. */
    remove: async (email: string) => {
      await deleteTestAccount(email).catch(() => undefined);
      void restart();
    },
  };
}

export function useRewards() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(rewardsQuery);
  return {
    rewards: data.items,
    /** `update_reward` when editing, else `create_reward`. */
    save: async (isEdit: boolean, req: CreateGlobalRewardRequest) => {
      const result = isEdit ? await updateReward(req) : await createReward(req);
      void queryClient.invalidateQueries({ queryKey: REWARDS_KEY });
      return result;
    },
  };
}

export function useEnterpriseMemberships() {
  const list = useSuspenseInfiniteList<EnterpriseMembershipGrantListItem>(ENTERPRISE_KEY, fetchEnterprise);
  return {
    list,
    grant: async (req: GrantEnterpriseMembershipRequest) => {
      const result = await grantEnterpriseMembership(req);
      void list.refresh();
      return result;
    },
  };
}

export function useModerationFlags() {
  const list = useSuspenseInfiniteList<ModerationFlagResponse>(MODERATION_KEY, fetchModeration);
  return {
    list,
    /** Rust ignores the result of both actions and restarts the queue. */
    block: async (userId: string) => {
      await adminBlockUser(userId).catch(() => undefined);
      void list.refresh();
    },
    dismiss: async (userId: string) => {
      await adminDismissUser(userId).catch(() => undefined);
      void list.refresh();
    },
  };
}
