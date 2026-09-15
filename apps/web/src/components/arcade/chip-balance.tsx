import { useArcadeLayoutI18n } from "@/i18n/generated/features/arcade/arcade-layout.i18n";
import { useArcadeWalletState } from "./hooks/use-arcade-wallet";

// app/ratel/src/features/arcade/components/chip_balance.rs — the chip balance
// button in the ArcadeLayout top bar (and its mobile drawer). Suspends on the
// wallet state like `wallet.state()?`.

export interface ChipBalanceProps {
  onClick: () => void;
  /** Distinct testid for the drawer copy so the two buttons don't collide. */
  testid?: string;
}

export function ChipBalance({ onClick, testid = "ff-arcade-chip" }: ChipBalanceProps) {
  const tr = useArcadeLayoutI18n();
  const { chip_balance } = useArcadeWalletState();

  return (
    <button className="stat-chip gold ff-arcade__chip-btn" data-testid={testid} aria-label={tr.chipAria} onClick={onClick}>
      <span className="stat-chip-icon">◆</span>
      <span>{`${chip_balance} ${tr.chipUnit}`}</span>
    </button>
  );
}
