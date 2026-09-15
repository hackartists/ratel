import { useLaunchpadPartnerI18n } from "@/i18n/generated/features/launchpad_partner/launchpad-partner.i18n";
import { usePopup } from "@/lib/popup";
import { fmtCommasUnsigned } from "./format";
import { useLaunchpadEntryUrl } from "./use-launchpad";

// app/ratel/src/features/launchpad_partner/views/conversion_modal.rs
// (`PointConversionModal`) — shows the balance and hands off to launchpad
// `/connect` through the server-built, token-bearing URL.

/** Suspends on the entry URL lookup. */
export function PointConversionModal({ availablePoints }: { availablePoints: number }) {
  const tr = useLaunchpadPartnerI18n();
  const popup = usePopup();
  const { url } = useLaunchpadEntryUrl();

  return (
    <div className="flex flex-col gap-4 w-[420px] max-w-full">
      <h3 className="text-lg font-bold text-text-primary">{tr.introTitle}</h3>
      <p className="text-sm text-foreground-muted leading-relaxed">{tr.introBody}</p>
      <div
        className="flex justify-between items-center py-3 px-4 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-sm font-semibold text-foreground-muted">{tr.amountBalanceLabel}</span>
        {/* " P" is hardcoded outside translate! (conversion_modal.rs:41). */}
        <span className="text-xl font-extrabold" style={{ color: "#fcb300" }}>
          {`${fmtCommasUnsigned(availablePoints)} P`}
        </span>
      </div>
      <a
        className="w-full inline-flex items-center justify-center min-h-[46px] rounded-xl text-sm font-extrabold transition-transform hover:-translate-y-px"
        style={{
          background: "linear-gradient(135deg,#ffd24a 0%,#fcb300 100%)",
          color: "#0a0a0a",
          boxShadow: "0 12px 26px -12px rgba(252,179,0,0.55)",
        }}
        href={url}
        // Close the popup as we hand off so returning here later (Back /
        // bfcache) doesn't restore this modal open.
        onClick={() => popup.close()}
      >
        {tr.goConvert}
      </a>
      <p className="text-xs text-foreground-muted text-center">{tr.goConvertHint}</p>
    </div>
  );
}
