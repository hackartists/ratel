import type { SpaceIncentive, SpaceIncentiveToken } from "@ratel/ts-bridges";
import {
  ApiError,
  createSpaceIncentive,
  getSpaceIncentive,
  listSpaceIncentiveTokens,
  refreshSpaceIncentiveTokens,
} from "@ratel/ts-bridges";
import { buildEnv } from "./format";

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

interface JsDeployResponse {
  incentiveAddress: string;
  deployBlock: number;
  transactionHash: string;
  adminAddress: string;
}

interface IncentivePoolBridge {
  deploySpaceIncentive(req: {
    admins: string[];
    incentiveRecipientCount: number;
    rankingBps: number;
    mode: number;
    env: string;
  }): Promise<JsDeployResponse>;
}

/**
 * `deploy_space_incentive`: `window.ratel.space_incentive_pool.deploySpaceIncentive`
 * (the same JS entry point the Rust interop binds). Rejects when it is absent.
 */
async function deploySpaceIncentive(mode: number, rankingBps: number, recipientCount: number): Promise<JsDeployResponse> {
  const bridge = (window as unknown as { ratel?: { space_incentive_pool?: IncentivePoolBridge } }).ratel
    ?.space_incentive_pool;
  if (!bridge) throw new Error("window.ratel.space_incentive_pool is not loaded");
  return bridge.deploySpaceIncentive({
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
  const deploy = await deploySpaceIncentive(contractMode, rankingBps, recipientCount);
  const created = await createSpaceIncentive(spaceId, {
    contract_address: deploy.incentiveAddress,
    deploy_block: deploy.deployBlock,
  });
  return [created, await loadTokens(spaceId)];
}
