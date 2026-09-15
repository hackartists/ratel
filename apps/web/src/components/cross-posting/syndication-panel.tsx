import { Link } from "react-router-dom";
import type { FeedPartition, SocialPlatform, SyndicationJobView } from "@ratel/ts-bridges";
import { useSyndicationPanelI18n } from "./syndication-panel.i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { PlatformLogo, displayName } from "./social-platform";
import { useSyndicationPanel } from "./use-syndication-panel";

// app/ratel/src/features/cross_posting/components/syndication_panel/component.rs
// (`SyndicationPanel`) — author-only post-detail panel. Always mounts the
// full Bluesky/LinkedIn/Threads matrix when the parent post is Public, so
// the author sees a coherent view straight after publish.

export function SyndicationPanel({ postId }: { postId: FeedPartition }) {
  const sp = useSyndicationPanel(postId);
  const t = useSyndicationPanelI18n();
  const toast = useToast();
  const auth = useAuth();

  if (sp.panel === null) return null;

  const jobs = sp.panel.jobs;
  const connList = sp.connections;

  const total = jobs.length;
  const totalPublished = jobs.filter((j) => j.state === "published").length;
  const totalFailed = jobs.filter((j) => j.state === "failed").length;

  const sum = (pick: (j: SyndicationJobView) => number | undefined) =>
    jobs.reduce((acc, j) => acc + (pick(j) ?? 0), 0);
  const totalLikes = sum((j) => j.engagement?.likes);
  const totalComments = sum((j) => j.engagement?.comments);
  const totalReposts = sum((j) => j.engagement?.reposts);

  const bskyJob = jobs.find((j) => j.platform === "bluesky");
  const bskyConnected = connList.some((c) => c.platform === "bluesky" && c.status === "connected");
  const linkedinJob = jobs.find((j) => j.platform === "linkedin");
  const linkedinConnected = connList.some((c) => c.platform === "linkedin" && c.status === "connected");

  const username = auth.userContext.user?.username ?? "";

  const onRetry = async (platform: SocialPlatform) => {
    try {
      await sp.retry(platform);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <section className="syn">
      <div className="syn-head">
        <span className="syn-head__title">{t.title}</span>
        {total > 0 && (
          <span className="syn-head__summary">
            <strong>
              {totalPublished} of {total}
            </strong>{" "}
            {t.summarySucceeded}
            {totalFailed > 0 && <> · {totalFailed} {t.summaryFailedSuffix}</>}
          </span>
        )}
        <button className="syn-head__refresh" aria-label={t.btnRefreshAria} data-testid="syn-refresh" onClick={() => sp.refresh()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      <div className="syn-stats">
        <div className="syn-stat">
          <div className="syn-stat__value">
            <span className="syn-stat__value--accent">{totalLikes}</span>
          </div>
          <div className="syn-stat__label">{t.statLikes}</div>
        </div>
        <div className="syn-stat">
          <div className="syn-stat__value">{totalComments}</div>
          <div className="syn-stat__label">{t.statComments}</div>
        </div>
        <div className="syn-stat">
          <div className="syn-stat__value">{totalReposts}</div>
          <div className="syn-stat__label">{t.statReposts}</div>
        </div>
      </div>

      <div className="syn-list">
        {bskyJob ? (
          <SyndicationCard job={bskyJob} onRetry={onRetry} />
        ) : bskyConnected ? (
          <AwaitingDispatchCard platform="bluesky" />
        ) : (
          <NotConnectedCard platform="bluesky" username={username} />
        )}
        {linkedinJob ? (
          <SyndicationCard job={linkedinJob} onRetry={onRetry} />
        ) : linkedinConnected ? (
          <AwaitingDispatchCard platform="linkedin" />
        ) : (
          <NotConnectedCard platform="linkedin" username={username} />
        )}
        <ComingSoonCard platform="threads" hint={t.panelThreadsComingSoonHint} />
      </div>
    </section>
  );
}

function logoClassFor(platform: SocialPlatform): string {
  return platform === "bluesky" ? "syn-logo syn-logo--bsky" : platform === "linkedin" ? "syn-logo syn-logo--linkedin" : "syn-logo syn-logo--threads";
}

function AwaitingDispatchCard({ platform }: { platform: SocialPlatform }) {
  const t = useSyndicationPanelI18n();
  return (
    <article className="syn-card" data-status="awaiting">
      <div className="syn-card__body">
        <span className={logoClassFor(platform)}>
          <PlatformLogo platform={platform} />
        </span>
        <div className="syn-card__main">
          <div className="syn-card__name-row">
            <span className="syn-card__name">{displayName(platform)}</span>
            <span className="status-pill status-pill--pending">{t.awaitingDispatch}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function NotConnectedCard({ platform, username }: { platform: SocialPlatform; username: string }) {
  const t = useSyndicationPanelI18n();
  const [btnLabel, btnTestId] =
    platform === "bluesky"
      ? [t.btnConnectBluesky, "syn-connect-bluesky"]
      : platform === "linkedin"
        ? [t.btnConnectLinkedin, "syn-connect-linkedin"]
        : [t.btnConnectBluesky, "syn-connect-threads"];
  return (
    <article className="syn-card" data-status="not-connected">
      <div className="syn-card__body">
        <span className={logoClassFor(platform)}>
          <PlatformLogo platform={platform} />
        </span>
        <div className="syn-card__main">
          <div className="syn-card__name-row">
            <span className="syn-card__name">{displayName(platform)}</span>
            <span className="status-pill status-pill--off">{t.notConnected}</span>
          </div>
        </div>
        <div className="syn-card__actions">
          <Link to={`/${username}/settings/connections`} className="mini-btn mini-btn--connect" data-testid={btnTestId}>
            {btnLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}

function ComingSoonCard({ platform, hint }: { platform: SocialPlatform; hint: string }) {
  const t = useSyndicationPanelI18n();
  return (
    <article className="syn-card" data-status="coming-soon" data-soon="true">
      <div className="syn-card__body">
        <span className={logoClassFor(platform)}>
          <PlatformLogo platform={platform} />
        </span>
        <div className="syn-card__main">
          <div className="syn-card__name-row">
            <span className="syn-card__name">{displayName(platform)}</span>
            <span className="status-pill status-pill--soon">{t.panelComingSoon}</span>
          </div>
          <div className="syn-card__sub">
            <span className="syn-card__sub-item">{hint}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function SyndicationCard({ job, onRetry }: { job: SyndicationJobView; onRetry: (platform: SocialPlatform) => Promise<void> }) {
  const t = useSyndicationPanelI18n();

  const statusData = job.state === "published" ? "success" : job.state === "pending" ? "pending" : job.state === "failed" ? "failed" : "skipped";
  const pillClass =
    job.state === "published"
      ? "status-pill status-pill--success"
      : job.state === "pending"
        ? "status-pill status-pill--pending"
        : job.state === "failed"
          ? "status-pill status-pill--failed"
          : "status-pill status-pill--skipped";
  const pillLabel = job.state === "published" ? t.statusPublished : job.state === "pending" ? t.statusPending : job.state === "failed" ? t.statusFailed : t.statusSkipped;

  return (
    <article className="syn-card" data-status={statusData}>
      <div className="syn-card__body">
        <span className={logoClassFor(job.platform)}>
          <PlatformLogo platform={job.platform} />
        </span>
        <div className="syn-card__main">
          <div className="syn-card__name-row">
            <span className="syn-card__name">{displayName(job.platform)}</span>
            <span className={pillClass}>{pillLabel}</span>
          </div>
          {job.state === "failed" && job.last_error_message !== null && (
            <div className="syn-card__err">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                {job.last_error_message} · {t.attemptsLabel} <strong>{job.attempts}</strong>
              </span>
            </div>
          )}
          {job.state === "pending" && (
            <div className="syn-card__sub">
              <span className="syn-card__sub-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{t.queuedHint}</span>
              </span>
            </div>
          )}
        </div>
        <div className="syn-card__actions">
          {job.state === "published" ? (
            job.external_post_url !== null && (
              <a className="mini-btn" href={job.external_post_url} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="10 14 21 3" />
                  <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
                </svg>
                {t.btnView}
              </a>
            )
          ) : (
            <button className="mini-btn mini-btn--retry" onClick={() => void onRetry(job.platform)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {t.btnRetry}
            </button>
          )}
        </div>
      </div>

      {job.engagement && (
        <div className="syn-card__engagement">
          <span className="engage">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <strong>{job.engagement.likes}</strong> {t.engageLikes}
          </span>
          <span className="engage">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <strong>{job.engagement.comments}</strong> {t.engageComments}
          </span>
          <span className="engage">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <strong>{job.engagement.reposts}</strong> {t.engageReposts}
          </span>
        </div>
      )}
    </article>
  );
}
