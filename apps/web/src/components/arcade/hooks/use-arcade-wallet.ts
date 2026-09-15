import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { convertRpHandler, getWalletHandler } from "@ratel/ts-bridges";
import type { ConvertRpResponse, WalletStateResponse } from "@ratel/ts-bridges";

// app/ratel/src/features/arcade/hooks/use_arcade_wallet.rs — chip balance +
// RP→chip exchange, shared by the `ArcadeLayout` header chip, the mobile
// drawer chip and the exchange modal. The Rust provider only holds a refresh
// counter; the query cache plays that role here, so every consumer reads the
// same `["getWallet"]` entry (the scaffolded `useGetWallet` key).

const WALLET_KEY = ["getWallet"] as const;

/** `UseArcadeWallet::state()?` — suspends until the wallet loads; a failure reaches the error boundary. */
export function useArcadeWalletState(): WalletStateResponse {
  return useSuspenseQuery({ queryKey: WALLET_KEY, queryFn: () => getWalletHandler() }).data;
}

/** `UseArcadeWallet::convert(rp)` — converts, then refetches the wallet state. */
export function useArcadeWalletConvert(): (rpAmount: number) => Promise<ConvertRpResponse> {
  const queryClient = useQueryClient();
  return async (rpAmount) => {
    const res = await convertRpHandler({ rp_amount: rpAmount });
    void queryClient.invalidateQueries({ queryKey: WALLET_KEY });
    return res;
  };
}
