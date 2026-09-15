import { useNavigate } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { useLaunchpadPartnerI18n } from "@/i18n/generated/features/launchpad_partner/launchpad-partner.i18n";
import { useUserContext } from "@/lib/auth";
import { useLaunchpadReturn } from "./hooks/use-launchpad-return";

// app/ratel/src/features/launchpad_partner/views/return_page.rs
// (`LaunchpadReturnPage`, `/launchpad/return?project_id&…&sig`) — the receipt
// after a verified Launchpad conversion, or an error for an invalid/expired
// hand-back.

/** `commas` — thousands separators, sign kept. */
function commas(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** `short_id` — `abcdefgh…uvwxyz` for ids longer than 14 characters. */
function shortId(value: string): string {
  const v = value.trim();
  if (v.length <= 14) return v;
  return `${v.slice(0, 8)}…${v.slice(v.length - 6)}`;
}

const CARD_STYLE = {
  background: "var(--bg-glass)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "24px",
  padding: "32px 28px",
};

const GOLD_BUTTON_STYLE = {
  background: "linear-gradient(135deg,#ffd24a 0%,#fcb300 100%)",
  color: "#0a0a0a",
  boxShadow: "0 10px 24px -10px rgba(252,179,0,0.5)",
};

const BACK_BUTTON_CLASS =
  "inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-semibold cursor-pointer text-foreground-muted border border-[var(--border-subtle)] hover:text-foreground";

export function Component() {
  const tr = useLaunchpadPartnerI18n();
  const navigate = useNavigate();
  // The user started the conversion here, so "back to rewards" goes to their
  // own rewards page; home when the username is unknown.
  const username = useUserContext().user?.username ?? "";
  const view = useLaunchpadReturn();

  const backToRewards = (replace: boolean) => {
    navigate(username.trim() === "" ? "/" : `/${username}/rewards`, { replace });
  };

  return (
    <>
      <Head>
        <title>{tr.retTitle}</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-[460px] flex flex-col gap-6" style={CARD_STYLE}>
          {view.verified ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#fcb300" }}>
                  Launchpad
                </span>
                <h1 className="text-2xl font-extrabold text-foreground">{tr.retTitle}</h1>
                <p className="text-sm text-foreground-muted">{tr.retSubtitle}</p>
              </div>

              <div className="flex flex-col gap-3">
                <ReceiptRow label={tr.retDeducted} value={commas(view.deducted_points)} />
                {view.remaining_points !== null && (
                  <ReceiptRow label={tr.retRemaining} value={commas(view.remaining_points)} />
                )}
                <ReceiptRow label={tr.retBrandTx} value={shortId(view.brand_tx_id)} />
                <ReceiptRow label={tr.retConversion} value={shortId(view.conversion_id)} />
              </div>

              <div className="flex flex-col gap-3">
                {view.community_url.trim() !== "" && (
                  <a
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-extrabold cursor-pointer transition-transform hover:-translate-y-px"
                    style={GOLD_BUTTON_STYLE}
                    href={view.community_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tr.retOpenCommunity}
                  </a>
                )}
                {/* replace (not push) so Back doesn't bring this card back. */}
                <button type="button" className={BACK_BUTTON_CLASS} onClick={() => backToRewards(true)}>
                  {tr.retHome}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="text-xl font-extrabold text-foreground">{tr.retInvalidTitle}</h1>
                <p className="text-sm text-foreground-muted">{tr.retInvalidBody}</p>
              </div>
              <button type="button" className={BACK_BUTTON_CLASS} onClick={() => backToRewards(false)}>
                {tr.retHome}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
      <span className="text-sm text-foreground-muted">{label}</span>
      <strong className="text-sm font-bold text-foreground">{value}</strong>
    </div>
  );
}
