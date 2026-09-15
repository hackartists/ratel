import type { SpaceIncentive, SpaceIncentiveToken } from "@ratel/ts-bridges";
import {
  ApiError,
  createSpaceIncentive,
  getSpaceIncentive,
  listSpaceIncentiveTokens,
  refreshSpaceIncentiveTokens,
} from "@ratel/ts-bridges";
import { buildEnv } from "./format";
import { deploySpaceIncentive, type DeploySpaceIncentiveResult } from "./incentive-pool-contract";

// app/ratel/src/features/spaces/pages/apps/apps/incentive_pool/{utils/service.rs,interop/mod.rs}
// — composite calls for the incentive pool page over the generated handlers.
// Only `use-incentive-pool.ts` imports this file.

const TOKEN_PAGE_LIMIT = 100;

/** `load_tokens`: every token page. */
async function loadTokens(spaceId: string): Promise<SpaceIncentiveToken[]> {
  const items: SpaceIncentiveToken[] = [];
  let bookmark: string | null = null;
  for (;;) {
    const page = await listSpaceIncentiveTokens(spaceId, bookmark, TOKEN_PAGE_LIMIT);
    items.push(...page.items);
    if (page.bookmark === null || page.bookmark === "") break;
    bookmark = page.bookmark;
  }
  return items;
}

/** `load_incentive_and_tokens`: a missing pool is `null`, any other error rejects. */
export async function loadIncentiveAndTokens(spaceId: string): Promise<[SpaceIncentive | null, SpaceIncentiveToken[]]> {
  let incentive: SpaceIncentive | null;
  try {
    incentive = await getSpaceIncentive(spaceId);
  } catch (err) {
    if (err instanceof ApiError && err.is("NotFound")) incentive = null;
    else throw err;
  }
  return [incentive, await loadTokens(spaceId)];
}

/** `refresh_tokens`. */
export async function refreshTokens(spaceId: string): Promise<SpaceIncentiveToken[]> {
  await refreshSpaceIncentiveTokens(spaceId);
  return loadTokens(spaceId);
}

/**
 * `deploy_space_incentive`. Before, this looked the deployer up on
 * `window.ratel.space_incentive_pool`, a name the global bundle never
 * registered, so it always rejected; now it is imported directly.
 */
function deployIncentive(mode: number, rankingBps: number, recipientCount: number): Promise<DeploySpaceIncentiveResult> {
  return deploySpaceIncentive({
    admins: [],
    incentiveRecipientCount: recipientCount,
    rankingBps,
    mode,
    env: buildEnv(),
  });
}

/** `register_incentive_pool`: deploy the contract, record it, then load its tokens. */
export async function registerIncentivePool(
  spaceId: string,
  contractMode: number,
  rankingBps: number,
  recipientCount: number,
): Promise<[SpaceIncentive, SpaceIncentiveToken[]]> {
  const deploy = await deployIncentive(contractMode, rankingBps, recipientCount);
  const created = await createSpaceIncentive(spaceId, {
    contract_address: deploy.incentiveAddress,
    deploy_block: deploy.deployBlock,
  });
  return [created, await loadTokens(spaceId)];
}
