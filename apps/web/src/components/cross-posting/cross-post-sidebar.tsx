import type { ConnectionResponse, SocialPlatform } from "@ratel/ts-bridges";
import { useComposeSidebarI18n } from "./compose-sidebar.i18n";
import { dataBool } from "@/lib/dom";
import { stripHtml } from "@/lib/content-body";
import { charLimit, displayName, PlatformLogo } from "./social-platform";
import type { UseCrossPosting } from "./use-cross-posting";

// app/ratel/src/features/cross_posting/components/compose_sidebar/component.rs
// (`CrossPostSidebar`) — compose-time per-post platform toggles + reach
// summary. The parent (post-edit) mounts this only for Public visibility
// (FR-9 #50); disconnected platforms fire `onConnectRequest` so the parent
// can route to LinkedIn OAuth or Settings → Connections.

export interface CrossPostSidebarProps {
  content: string;
  crossPosting: UseCrossPosting;
  onConnectRequest: (platform: SocialPlatform) => void;
}

function isActive(
  conn: ConnectionResponse | undefined,
  overrides: Partial<Record<SocialPlatform, boolean>>,
  platform: SocialPlatform,
): boolean {
  if (!conn || conn.status !== "connected") return false;
  return overrides[platform] ?? conn.auto_post_enabled;
}

export function CrossPostSidebar({ content, crossPosting, onConnectRequest }: CrossPostSidebarProps) {
  const { connections, perPostEnabled, setPerPostEnabled, reachCount } = crossPosting;
  const t = useComposeSidebarI18n();

  const bsky = connections.find((c) => c.platform === "bluesky");
  const linkedin = connections.find((c) => c.platform === "linkedin");
  const threads = connections.find((c) => c.platform === "threads");

  const charCount = stripHtml(content).length;

  return (
    <div className="crosspost" data-testid="cross-post-sidebar">
      <div className="crosspost-head">
        <span className="crosspost-head__eyebrow">{t.eyebrow}</span>
        <h2 className="crosspost-head__title">
          <span className="crosspost-head__title-accent">{t.title}</span>
          <svg
            className="crosspost-head__title-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </h2>
        <p className="crosspost-head__sub">{t.sub}</p>
      </div>

      <div className="reach-summary">
        <div className="reach-summary__left">
          <span className="reach-summary__label">{t.reaching}</span>
          <span className="reach-summary__value">
            <strong data-testid="reach-summary-count">{reachCount}</strong> {t.networksSuffix}
          </span>
        </div>
        <div className="reach-summary__icons">
          <ReachChip platform="bluesky" active={isActive(bsky, perPostEnabled, "bluesky")} />
          <ReachChip platform="linkedin" active={isActive(linkedin, perPostEnabled, "linkedin")} />
          <ReachChip platform="threads" active={isActive(threads, perPostEnabled, "threads")} />
        </div>
      </div>

      <PlatformCard
        platform="bluesky"
        connection={bsky}
        enabled={isActive(bsky, perPostEnabled, "bluesky")}
        charCount={charCount}
        onToggle={(v) => setPerPostEnabled("bluesky", v)}
        onConnect={() => onConnectRequest("bluesky")}
      />
      <PlatformCard
        platform="linkedin"
        connection={linkedin}
        enabled={isActive(linkedin, perPostEnabled, "linkedin")}
        charCount={charCount}
        onToggle={(v) => setPerPostEnabled("linkedin", v)}
        onConnect={() => onConnectRequest("linkedin")}
      />
      <PlatformCard
        platform="threads"
        connection={threads}
        enabled={isActive(threads, perPostEnabled, "threads")}
        charCount={charCount}
        onToggle={(v) => setPerPostEnabled("threads", v)}
        onConnect={() => onConnectRequest("threads")}
      />
    </div>
  );
}

function ReachChip({ platform, active }: { platform: SocialPlatform; active: boolean }) {
  const chipClass =
    platform === "bluesky"
      ? "reach-chip reach-chip--bsky"
      : platform === "linkedin"
        ? "reach-chip reach-chip--linkedin"
        : "reach-chip reach-chip--threads";
  return (
    <span className={chipClass} data-off={dataBool(!active)}>
      <PlatformLogo platform={platform} />
    </span>
  );
}

function PlatformCard({
  platform,
  connection,
  enabled,
  charCount,
  onToggle,
  onConnect,
}: {
  platform: SocialPlatform;
  connection: ConnectionResponse | undefined;
  enabled: boolean;
  charCount: number;
  onToggle: (v: boolean) => void;
  onConnect: () => void;
}) {
  const t = useComposeSidebarI18n();
  const connected = connection?.status === "connected";
  const platformData = platform;
  const logoClass =
    platform === "bluesky" ? "pp-logo pp-logo--bsky" : platform === "linkedin" ? "pp-logo pp-logo--linkedin" : "pp-logo pp-logo--threads";

  const limit = charLimit(platform);
  const warnThreshold = (limit * 90) / 100;
  const countState = charCount > limit ? "over" : charCount > warnThreshold ? "warn" : "ok";
  const barPct = Math.min((Math.min(charCount, limit) * 100) / limit, 100);

  const connectHint =
    platform === "bluesky" ? t.connectHintBluesky : platform === "linkedin" ? t.connectHintLinkedin : t.connectHintThreads;
  const connectLabel =
    platform === "bluesky" ? t.connectBtnBluesky : platform === "linkedin" ? t.connectBtnLinkedin : t.connectBtnThreads;

  return (
    <article className="pp-card" data-platform={platformData} data-enabled={dataBool(enabled)} data-connected={dataBool(connected)}>
      <header className="pp-head">
        <div className="pp-head__left">
          <span className={logoClass}>
            <PlatformLogo platform={platform} />
          </span>
          <div>
            <span className="pp-name">
              {displayName(platform)}
              {connected && connection ? (
                <span className="pp-name__handle">@{connection.external_handle}</span>
              ) : (
                <span className="pp-name__status">{t.notConnected}</span>
              )}
            </span>
          </div>
        </div>
        {connected && (
          <button
            className="switch pp-head__switch"
            aria-checked={dataBool(enabled)}
            aria-label={displayName(platform)}
            onClick={() => onToggle(!enabled)}
          />
        )}
      </header>

      {platform === "threads" ? (
        <div className="connect-cta">
          <p className="connect-cta__hint">{connectHint}</p>
          <span className="connect-cta__coming-soon">{t.comingSoon}</span>
        </div>
      ) : !connected ? (
        <div className="connect-cta">
          <p className="connect-cta__hint">{connectHint}</p>
          <button className="connect-cta__btn" onClick={onConnect}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="5 12 19 12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            {connectLabel}
          </button>
        </div>
      ) : enabled ? (
        <footer className="pp-foot">
          <div className="pp-foot__count" data-state={countState}>
            <strong>{charCount}</strong> / {limit}
            <div className="pp-foot__count-bar">
              <div className="pp-foot__count-bar-fill" style={{ width: `${barPct}%` }} />
            </div>
          </div>
          {countState === "over" && (
            <div className="pp-foot__badges">
              <span className="pp-badge pp-badge--truncated">{t.truncatedBadge}</span>
            </div>
          )}
        </footer>
      ) : null}
    </article>
  );
}
