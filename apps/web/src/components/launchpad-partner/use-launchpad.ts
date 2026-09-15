import { useSuspenseQuery } from "@tanstack/react-query";
import { launchpadEntryUrlHandler, launchpadRoundInfoHandler, launchpadTokenBalanceHandler } from "@ratel/ts-bridges";
import type { LaunchpadEntryUrlResponse, LaunchpadRoundInfo, LaunchpadTokenBalance } from "@ratel/ts-bridges";
import { useUserContext } from "@/lib/auth";

// The `use_loader` calls of app/ratel/src/features/launchpad_partner/views/*.rs.
// Each suspends until the data arrives; a failure reaches the error boundary,
// exactly like the Rust `use_loader(...)?`.

/** reward_hero.rs: `launchpad_round_info_handler()` (public). */
export function useLaunchpadRoundInfo(): LaunchpadRoundInfo {
  return useSuspenseQuery({
    queryKey: ["launchpadRoundInfo"],
    queryFn: () => launchpadRoundInfoHandler(),
  }).data;
}

/**
 * token_card.rs: `launchpad_token_balance_handler()` — requires a session
 * (a signed-out viewer gets 401 → error boundary, as in Dioxus). Keyed by the
 * viewer so a sign-in/out re-fetches.
 */
export function useLaunchpadTokenBalance(): LaunchpadTokenBalance {
  const viewer = useUserContext().user?.pk ?? null;
  return useSuspenseQuery({
    queryKey: ["launchpadTokenBalance", viewer],
    queryFn: () => launchpadTokenBalanceHandler(),
  }).data;
}

/** conversion_modal.rs: `launchpad_entry_url_handler()` — the token-bearing `/connect` URL. */
export function useLaunchpadEntryUrl(): LaunchpadEntryUrlResponse {
  const viewer = useUserContext().user?.pk ?? null;
  return useSuspenseQuery({
    queryKey: ["launchpadEntryUrl", viewer],
    queryFn: () => launchpadEntryUrlHandler(),
  }).data;
}
