import { useSuspenseQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { launchpadVerifyReturnHandler } from "@ratel/ts-bridges";
import type { LaunchpadReturnRequest, LaunchpadReturnView } from "@ratel/ts-bridges";

// app/ratel/src/features/launchpad_partner/views/return_page.rs — the signed
// hand-back fields from the query string, verified server-side
// (`launchpad_verify_return_handler`) before the page trusts any of them.

const FIELDS = [
  "project_id",
  "conversion_id",
  "brand_tx_id",
  "deducted_points",
  "remaining_points",
  "round_id",
  "community_url",
  "ts",
  "sig",
] as const satisfies readonly (keyof LaunchpadReturnRequest)[];

/** Suspends until verification answers; a request failure reaches the error boundary. */
export function useLaunchpadReturn(): LaunchpadReturnView {
  const [params] = useSearchParams();
  // Each `Option<String>` query arg, `unwrap_or_default()`.
  const req = Object.fromEntries(FIELDS.map((field) => [field, params.get(field) ?? ""])) as LaunchpadReturnRequest;

  const view = useSuspenseQuery({
    queryKey: ["launchpadVerifyReturn", req],
    queryFn: () => launchpadVerifyReturnHandler(req),
  });
  return view.data;
}
