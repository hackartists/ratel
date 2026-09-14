import { useLaunchpadTokenBalance } from "./use-launchpad";

// app/ratel/src/features/launchpad_partner/views/token_card.rs
// (`LaunchpadTokenCard`) — the signed-in user's launchpad token balance.

// Rust hardcodes these outside translate! (token_card.rs:17, :26).
const MY_TOKENS = "내 토큰";
const WALLET_REQUIRED = "지갑 연결 필요";

/** Suspends on the balance lookup; wrap in `<Suspense fallback={null}>` like the Rust `SuspenseBoundary`. */
export function LaunchpadTokenCard() {
  const tb = useLaunchpadTokenBalance();

  return (
    <div
      className="flex justify-between items-center"
      style={{
        background: "var(--bg-glass)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "20px",
        padding: "24px 28px",
      }}
    >
      <span className="text-sm font-bold tracking-wide text-foreground-muted">{MY_TOKENS}</span>
      {tb.has_wallet ? (
        <span className="text-2xl font-extrabold" style={{ fontFamily: "Orbitron,monospace", color: "#6eedd8" }}>
          {`${tb.balance} `}
          <span className="text-sm">{tb.symbol}</span>
        </span>
      ) : (
        <span className="text-sm font-medium text-foreground-muted">{WALLET_REQUIRED}</span>
      )}
    </div>
  );
}
