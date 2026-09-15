import { useSuspenseQuery } from "@tanstack/react-query";
import { getUserRewardsHandler } from "@ratel/ts-bridges";
import type { RewardsResponse } from "@ratel/ts-bridges";

// app/ratel/src/features/social/pages/reward/user/views/mod.rs `Home`:
// `use_loader(get_user_rewards_handler(username(), None))?` — suspends, and a
// failure reaches the error boundary.

export function useUserRewards(username: string): RewardsResponse {
  return useSuspenseQuery({
    queryKey: ["getUserRewards", username, null],
    queryFn: () => getUserRewardsHandler(username, null),
  }).data;
}
