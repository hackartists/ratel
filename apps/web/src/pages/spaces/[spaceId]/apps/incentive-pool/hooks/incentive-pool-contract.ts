// SpaceIncentive contract deployment through the browser wallet (EIP-1193
// `window.ethereum`). Moved unchanged from the former global bundle (shell-js
// `ratel-app-shell/spaces/apps/incentive-pool.js`); ethers loads on the first
// deploy, not with the page.
//
// NOTE: the contract artifact is fetched from `/assets/space-incentive-artifact.json`,
// exactly as before — but no such file exists in the repository or the web build
// (it 404s), so a deploy stops after the wallet steps. Tracked separately in
// docs/superpower/2026-09-15-web-shell-js-modules.md ("Pre-existing bugs").

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

interface ProviderError {
  code?: unknown;
  message?: string;
  data?: { cause?: { message?: string } };
}

interface SpaceIncentiveArtifact {
  abi: import("ethers").InterfaceAbi;
  bytecode: string;
}

const KAIA_TESTNET_CHAIN_ID = "0x3e9"; // 1001
const KAIA_MAINNET_CHAIN_ID = "0x2019"; // 8217

const KAIA_NETWORKS = {
  mainnet: {
    chainId: KAIA_MAINNET_CHAIN_ID,
    chainName: "Kaia Mainnet",
    nativeCurrency: {
      name: "KAIA",
      symbol: "KAIA",
      decimals: 18,
    },
    rpcUrls: ["https://public-en.node.kaia.io"],
    blockExplorerUrls: ["https://kaiascan.io"],
  },
  testnet: {
    chainId: KAIA_TESTNET_CHAIN_ID,
    chainName: "Kaia Kairos Testnet",
    nativeCurrency: {
      name: "KAIA",
      symbol: "KAIA",
      decimals: 18,
    },
    rpcUrls: ["https://public-en-kairos.node.kaia.io"],
    blockExplorerUrls: ["https://kairos.kaiascan.io"],
  },
};

let artifactCache: SpaceIncentiveArtifact | null = null;

function parseEnvNetwork(env: string): "mainnet" | "testnet" {
  const value = String(env || "").toLowerCase();
  return value === "prod" ? "mainnet" : "testnet";
}

async function getEthereum(): Promise<Eip1193Provider> {
  const ethereum = (window as unknown as { ethereum?: Partial<Eip1193Provider> })?.ethereum;
  if (!ethereum || typeof ethereum.request !== "function") {
    throw new Error("MetaMask is not installed");
  }
  return ethereum as Eip1193Provider;
}

function chainsEqual(left: unknown, right: unknown): boolean {
  try {
    return parseInt(String(left), 16) === parseInt(String(right), 16);
  } catch {
    return left === right;
  }
}

async function ensureKaiaNetwork(ethereum: Eip1193Provider, networkName: string): Promise<void> {
  const network = KAIA_NETWORKS[networkName as keyof typeof KAIA_NETWORKS] || KAIA_NETWORKS.testnet;
  const targetChainId = network.chainId;

  let currentChainId = await ethereum.request({ method: "eth_chainId" });
  if (chainsEqual(currentChainId, targetChainId)) {
    return;
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainId }],
    });
  } catch (err) {
    const switchError = err as ProviderError | undefined;
    if (switchError?.code === 4902) {
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [network],
        });
      } catch (err2) {
        const addError = err2 as ProviderError | undefined;
        const message = addError?.data?.cause?.message || addError?.message || "";
        if (message.includes("same RPC endpoint as existing network") || addError?.code === -32603) {
          // Ignore duplicate-network errors.
        } else if (addError?.code === 4001) {
          throw new Error("User rejected network add");
        } else {
          throw err2;
        }
      }
    } else if (switchError?.code === 4001) {
      throw new Error("User rejected network switch");
    } else {
      throw err;
    }
  }

  currentChainId = await ethereum.request({ method: "eth_chainId" });
  if (!chainsEqual(currentChainId, targetChainId)) {
    throw new Error(`Failed to switch network (current=${currentChainId}, target=${targetChainId})`);
  }
}

async function loadSpaceIncentiveArtifact(): Promise<SpaceIncentiveArtifact> {
  if (artifactCache) {
    return artifactCache;
  }

  const response = await fetch("/assets/space-incentive-artifact.json", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load SpaceIncentive artifact (status=${response.status})`);
  }

  const artifact = (await response.json()) as Partial<SpaceIncentiveArtifact> | null;
  if (!artifact?.abi || !artifact?.bytecode) {
    throw new Error("Invalid SpaceIncentive artifact");
  }

  artifactCache = artifact as SpaceIncentiveArtifact;
  return artifactCache;
}

export interface DeploySpaceIncentiveParams {
  admins?: string[];
  incentiveRecipientCount?: number;
  rankingBps?: number;
  mode?: number;
  env?: string;
}

export interface DeploySpaceIncentiveResult {
  incentiveAddress: string;
  deployBlock: number;
  transactionHash: string;
  adminAddress: string;
}

/** Deploys a SpaceIncentive owned by the connected account. */
export async function deploySpaceIncentive(params: DeploySpaceIncentiveParams = {}): Promise<DeploySpaceIncentiveResult> {
  const env = String(params.env || "local");
  const networkName = parseEnvNetwork(env);
  const ethereum = await getEthereum();

  await ensureKaiaNetwork(ethereum, networkName);

  let accounts: unknown;
  try {
    accounts = await ethereum.request({ method: "eth_requestAccounts" });
  } catch (err) {
    if ((err as ProviderError | undefined)?.code === 4001) {
      throw new Error("User rejected wallet connection");
    }
    throw err;
  }

  const account = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null;
  if (!account) {
    throw new Error("Wallet connection cancelled or no accounts");
  }

  const admins = [String(account).toLowerCase()];

  const incentiveRecipientCount = Number(params.incentiveRecipientCount ?? 10);
  if (!Number.isFinite(incentiveRecipientCount) || incentiveRecipientCount <= 0) {
    throw new Error("Incentive recipient count must be greater than 0");
  }

  const mode = Number(params.mode ?? 0);
  const rankingBps = Number(params.rankingBps ?? 0);

  const artifact = await loadSpaceIncentiveArtifact();

  const { ethers } = await import("ethers");
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);

  const contract = await factory.deploy(admins, {
    mode,
    numOfTargets: incentiveRecipientCount,
    rankingBps,
  });

  await contract.waitForDeployment();

  const incentiveAddress = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();
  const receipt = deploymentTx ? await deploymentTx.wait() : null;

  return {
    incentiveAddress,
    deployBlock: Number(receipt?.blockNumber || 0),
    transactionHash: deploymentTx?.hash || "",
    adminAddress: String(account),
  };
}
