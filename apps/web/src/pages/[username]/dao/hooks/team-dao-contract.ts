// Team DAO contract deployment through the browser wallet (EIP-1193
// `window.ethereum`). Moved unchanged from the former global bundle (shell-js
// `ratel-app-shell/teams/index.js`); ethers and the TeamDAO artifact load on
// the first deploy, not with the page. Errors keep their `code` values
// (`METAMASK_NOT_INSTALLED`, `USER_REJECTED`, `NO_ACCOUNTS`,
// `CHAIN_SWITCH_FAILED`), which `dao-interop.ts` maps to `DaoWalletError`.

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

interface ProviderError {
  code?: unknown;
  message?: string;
  data?: { cause?: { message?: string } };
}

const KAIA_TESTNET_CHAIN_ID = "0x3e9"; // 1001
const KAIA_MAINNET_CHAIN_ID = "0x2019"; // 8217

class KaiaWalletError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function getTargetChainId(network: string): string {
  return network === "mainnet" ? KAIA_MAINNET_CHAIN_ID : KAIA_TESTNET_CHAIN_ID;
}

async function getEthereum(): Promise<Eip1193Provider> {
  const { ethereum } = window as unknown as { ethereum?: Partial<Eip1193Provider> };
  if (!ethereum || !ethereum.request) {
    throw new KaiaWalletError("METAMASK_NOT_INSTALLED", "MetaMask is not installed");
  }
  return ethereum as Eip1193Provider;
}

function chainsEqual(a: unknown, b: unknown): boolean {
  try {
    return parseInt(String(a), 16) === parseInt(String(b), 16);
  } catch {
    return a === b;
  }
}

async function ensureKaiaNetwork(network: string, rpcUrl: string, explorerUrl: string) {
  const ethereum = await getEthereum();
  const targetChainId = getTargetChainId(network);

  let chainIdHex = await ethereum.request({ method: "eth_chainId" });
  if (chainIdHex === targetChainId) {
    return { ethereum, chainId: chainIdHex };
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainId }],
    });
  } catch (err) {
    const switchError = err as ProviderError | undefined;
    if (switchError?.code === 4902) {
      const baseParams =
        network === "mainnet"
          ? {
              chainId: KAIA_MAINNET_CHAIN_ID,
              chainName: "Kaia Mainnet",
              nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 },
            }
          : {
              chainId: KAIA_TESTNET_CHAIN_ID,
              chainName: "Kaia Kairos Testnet",
              nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 },
            };

      const params = {
        ...baseParams,
        rpcUrls: [rpcUrl].filter(Boolean),
        blockExplorerUrls: [explorerUrl].filter(Boolean),
      };

      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [params],
        });
      } catch (err2) {
        const addError = err2 as ProviderError | undefined;
        const msg = addError?.data?.cause?.message || addError?.message || "";
        if (msg.includes("same RPC endpoint as existing network") || addError?.code === -32603) {
          // ignore
        } else if (addError?.code === 4001) {
          throw new KaiaWalletError("USER_REJECTED", "User rejected network add");
        } else {
          throw err2;
        }
      }
    } else if (switchError?.code === 4001) {
      throw new KaiaWalletError("USER_REJECTED", "User rejected network switch");
    } else {
      throw err;
    }
  }

  chainIdHex = await ethereum.request({ method: "eth_chainId" });
  if (!chainsEqual(chainIdHex, targetChainId)) {
    throw new KaiaWalletError(
      "CHAIN_SWITCH_FAILED",
      `Failed to switch to Kaia network (current=${chainIdHex}, target=${targetChainId})`,
    );
  }

  return { ethereum, chainId: chainIdHex };
}

async function getKaiaSigner(network: string, rpcUrl: string, explorerUrl: string) {
  const { ethereum } = await ensureKaiaNetwork(network, rpcUrl, explorerUrl);

  let accounts: unknown = [];
  try {
    accounts = await ethereum.request({ method: "eth_requestAccounts" });
  } catch (e) {
    if ((e as ProviderError | undefined)?.code === 4001) {
      throw new KaiaWalletError("USER_REJECTED", "User rejected wallet connection");
    }
    throw e;
  }

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new KaiaWalletError("NO_ACCOUNTS", "Wallet connection cancelled or no accounts");
  }

  const { ethers } = await import("ethers");
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  return { provider, signer, account: accounts[0] };
}

/** Deploys a TeamDAO with `admins` (at least 3); resolves to its address and tx hash. */
export async function createDAO(admins: string[], network: string, rpcUrl: string, explorerUrl: string) {
  if (!Array.isArray(admins)) {
    throw new Error("Admins must be an array");
  }
  if (admins.length < 3) {
    throw new Error("At least 3 admins are required to create a DAO");
  }

  const { signer } = await getKaiaSigner(network, rpcUrl, explorerUrl);

  const [{ ethers }, { default: TeamDaoArtifact }] = await Promise.all([
    import("ethers"),
    import("./team-dao-artifact.json"),
  ]);
  const TeamDAO = new ethers.ContractFactory(TeamDaoArtifact.abi, TeamDaoArtifact.bytecode, signer);

  const dao = await TeamDAO.deploy(admins);
  const receipt = await dao.deploymentTransaction()?.wait();

  if (!receipt) {
    throw new Error("Deployment transaction failed");
  }

  const daoAddress = await dao.getAddress();

  return {
    daoAddress,
    transactionHash: receipt.hash,
  };
}

/** Copies `text`, falling back to a hidden textarea + `execCommand("copy")`. */
export async function copyText(text: string): Promise<boolean> {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let success = false;
  try {
    success = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }

  if (!success) {
    throw new Error("Failed to copy text");
  }
  return true;
}
