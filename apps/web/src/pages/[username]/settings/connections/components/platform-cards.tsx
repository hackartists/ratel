import type { ReactNode } from "react";
import { useConnectionsPageI18n } from "@/i18n/generated/features/cross_posting/connections-page.i18n";
import { dataBool } from "@/lib/dom";
import type { ConnectionResponse } from "../hooks/use-cross-posting";

// Platform cards of views/connections_page/component.rs. Bluesky and LinkedIn
// share one structure (`ActivePlatformCard`); Threads and Farcaster are the
// static "coming soon" cards.

export interface ActivePlatformCardProps {
  /** `data-platform` value and the `plat__logo--*` / `connections-btn--connect-*` suffix. */
  platform: "bsky" | "linkedin";
  logo: ReactNode;
  name: string;
  limit: string;
  subtitleDefault: string;
  /** The user's row for this platform, in any status. */
  connection: ConnectionResponse | undefined;
  /** Bluesky shows `@handle`; LinkedIn shows the display name as-is. */
  handlePrefix: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleAutoPost: (enabled: boolean) => void;
}

export function ActivePlatformCard({
  platform,
  logo,
  name,
  limit,
  subtitleDefault,
  connection,
  handlePrefix,
  onConnect,
  onDisconnect,
  onToggleAutoPost,
}: ActivePlatformCardProps) {
  const t = useConnectionsPageI18n();
  const connected = connection?.status === "connected";

  return (
    <article className="plat" data-platform={platform} data-connected={dataBool(connected)}>
      <div className="plat__body">
        <span className={`plat__logo plat__logo--${platform}`}>{logo}</span>
        <div className="plat__main">
          <div className="plat__name-row">
            <span className="plat__name">{name}</span>
            {connected ? (
              <span className="status-pill status-pill--connected">{t.statusConnected}</span>
            ) : (
              <span className="status-pill status-pill--off">{t.statusNotConnected}</span>
            )}
            <span className="plat__limit">{limit}</span>
          </div>
          <div className="plat__handle">
            {connection ? (
              <span>{`${handlePrefix}${connection.external_handle}`}</span>
            ) : (
              <span>{subtitleDefault}</span>
            )}
          </div>
        </div>
        <div className="plat__actions">
          {connected ? (
            <button className="connections-btn connections-btn--ghost" onClick={onDisconnect}>
              {t.btnDisconnect}
            </button>
          ) : (
            <button className={`connections-btn connections-btn--connect-${platform}`} onClick={onConnect}>
              {t.btnConnect}
            </button>
          )}
        </div>
      </div>
      {connection && connected && (
        <div className="plat__subrow">
          <div className="plat__subrow-item">
            <strong>{connection.posts_syndicated_count}</strong>
            <span>{t.postsSyndicatedCountLabel}</span>
          </div>
          <span className="plat__subrow-sep" />
          <div className="plat__subrow-item">
            <span>{t.autoPost}</span>
            <button
              className="switch"
              aria-checked={dataBool(connection.auto_post_enabled)}
              aria-label={t.autoPost}
              onClick={() => onToggleAutoPost(!connection.auto_post_enabled)}
            />
          </div>
        </div>
      )}
    </article>
  );
}

export interface SoonPlatformCardProps {
  platform: "threads" | "farcaster";
  logo: ReactNode;
  name: string;
  status: string;
  limit: string;
  subtitle: string;
}

export function SoonPlatformCard({ platform, logo, name, status, limit, subtitle }: SoonPlatformCardProps) {
  const t = useConnectionsPageI18n();

  return (
    <article className="plat" data-platform={platform} data-soon="true">
      <div className="plat__body">
        <span className={`plat__logo plat__logo--${platform}`}>{logo}</span>
        <div className="plat__main">
          <div className="plat__name-row">
            <span className="plat__name">{name}</span>
            <span className="status-pill status-pill--soon">{status}</span>
            <span className="plat__limit">{limit}</span>
          </div>
          <div className="plat__handle">
            <span>{subtitle}</span>
          </div>
        </div>
        <div className="plat__actions">
          <button className="connections-btn connections-btn--ghost" disabled>
            {t.btnNotify}
          </button>
        </div>
      </div>
    </article>
  );
}
