import { useRef, useState } from "react";
import { useArcadeExchangeModalI18n } from "@/i18n/generated/features/arcade/arcade-exchange-modal.i18n";
import { errorMessage } from "@/lib/server-error";
import { fill } from "./format";
import { useArcadeWalletConvert, useArcadeWalletState } from "./hooks/use-arcade-wallet";

// app/ratel/src/features/arcade/components/exchange_modal.rs — RP → chip
// exchange, mounted once by ArcadeLayout and toggled by the chip button. It
// stays mounted while closed (rendering nothing), so the typed amount survives
// closing and reopening, as in Rust.

const DEFAULT_RP_INPUT = 500;

/** `preview_chips` — `rp * ratio_bps / 10_000`, integer division. */
function previewChips(rpAmount: number, ratioBps: number): number {
  if (rpAmount <= 0 || ratioBps <= 0) return 0;
  return Math.trunc((rpAmount * ratioBps) / 10_000);
}

/** Rust `str::parse::<i64>()`. */
function parseI64(value: string): number | null {
  return /^[+-]?\d+$/.test(value) ? Number(value) : null;
}

export interface ArcadeExchangeModalProps {
  open: boolean;
  onClose: () => void;
}

export function ArcadeExchangeModal({ open, onClose }: ArcadeExchangeModalProps) {
  const tr = useArcadeExchangeModalI18n();
  const state = useArcadeWalletState();
  const convert = useArcadeWalletConvert();
  const ratioBps = Math.max(state.rp_to_chip_ratio_bps, 0);

  const [rpInput, setRpInput] = useState(DEFAULT_RP_INPUT);
  // What the number field shows: Dioxus leaves unparsable text in the field
  // while the amount keeps its last valid value.
  const [rpText, setRpText] = useState(String(DEFAULT_RP_INPUT));
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const chipsPreview = previewChips(rpInput, ratioBps);
  const ratioLabel = fill(tr.ratioValue, { chips: previewChips(1, ratioBps) });

  const onInput = (raw: string) => {
    const v = parseI64(raw);
    if (v === null) {
      setRpText(raw);
      return;
    }
    const clamped = Math.max(v, 0);
    setRpInput(clamped);
    setRpText(v < 0 ? String(clamped) : raw);
    setError(null);
  };

  const onConfirm = async () => {
    if (submittingRef.current) return;
    const amount = rpInput;
    if (amount <= 0) {
      setError(tr.errorAmount);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setSummary(null);
    try {
      const res = await convert(amount);
      setSummary(fill(tr.successSummary, { balance: res.balance_after }));
    } catch (e) {
      setError(errorMessage(e));
    }
    submittingRef.current = false;
    setSubmitting(false);
  };

  if (!open) return null;

  return (
    <div className="ff-arcade__modal-scrim" onClick={onClose}>
      <div className="ff-arcade__modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="section-head">
          <h2>{tr.title}</h2>
          <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={onClose}>
            {tr.cancelBtn}
          </button>
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 18px" }}>{tr.subtitle}</p>

        <div className="ff-arcade__modal-row">
          <span className="ff-arcade__modal-label">{tr.ratioLabel}</span>
          <span className="ff-arcade__modal-value">{ratioLabel}</span>
        </div>

        <div className="rp-slider-wrap">
          <div className="rp-slider-head">
            <span className="rp-slider-label">{tr.inputLabel}</span>
            <span className="rp-slider-value">{`${rpInput} RP`}</span>
          </div>
          <input
            type="number"
            className="ff-arcade__modal-input"
            min="0"
            step="100"
            value={rpText}
            onChange={(e) => onInput(e.target.value)}
          />
        </div>

        <div className="ff-arcade__modal-row">
          <span className="ff-arcade__modal-label">{tr.receiveLabel}</span>
          <span className="ff-arcade__modal-value ff-arcade__modal-value--accent">
            {fill(tr.receiveValue, { chips: chipsPreview })}
          </span>
        </div>

        {error !== null && (
          <div className="reason-warn" style={{ marginTop: "10px" }}>
            {error}
          </div>
        )}
        {summary !== null && <div className="ff-arcade__modal-success">{summary}</div>}

        <div className="submit-row">
          <button className="btn btn-primary" disabled={submitting || rpInput <= 0} onClick={() => void onConfirm()}>
            {tr.confirmBtn}
          </button>
          <span style={{ fontSize: "11px", color: "var(--text-faint)", fontFamily: "'JetBrains Mono', monospace" }}>
            {tr.redeemDisabledNote}
          </span>
        </div>
      </div>
    </div>
  );
}
