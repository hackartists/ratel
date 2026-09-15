import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BlueskyConnectModal } from "@/components/cross-posting/bluesky-connect-modal";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useOnboardingPageI18n } from "./i18n";
import { useUserContext } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { useOnboarding } from "./hooks/use-onboarding";

// app/ratel/src/features/cross_posting/views/onboarding_page/component.rs
// (`OnboardingPage`, `/onboarding/connections`) — the post-signup "Connect your
// networks" interstitial. Continue / Skip flip `interstitial_seen` and go home;
// a user who already dismissed it is sent straight home.
export function Component() {
  const t = useOnboardingPageI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useUserContext().user;
  const { connections, markSeen, connectBluesky, connectLinkedin } = useOnboarding();
  const [modalOpen, setModalOpen] = useState(false);

  const alreadySeen = user?.interstitial_seen ?? false;
  useEffect(() => {
    if (alreadySeen) navigate("/", { replace: true });
  }, [alreadySeen, navigate]);

  const bsky = connections.find((c) => c.platform === "bluesky");
  const bskyConnected = bsky?.status === "connected";
  const linkedin = connections.find((c) => c.platform === "linkedin");
  const linkedinConnected = linkedin?.status === "connected";

  // Failing to set the flag is non-fatal: toast it and still go home so the
  // user isn't stuck here.
  const dismissAndContinue = async () => {
    try {
      await markSeen();
    } catch (e) {
      console.warn("mark_onboarding_seen failed; continuing anyway", e);
      toast.error(e);
    }
    navigate("/", { replace: true });
  };

  return (
    <>
      <SeoMeta title={t.seoTitle} />

      <BlueskyConnectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={(handle, appPassword) => {
          void (async () => {
            try {
              await connectBluesky(handle, appPassword);
            } catch (e) {
              toast.error(e);
              return;
            }
            setModalOpen(false);
          })();
        }}
      />

      <div className="onboarding-arena">
        <header className="onboarding-topbar">
          <div className="onboarding-brand">
            <span className="onboarding-brand__dot">R</span>
            Ratel
          </div>
          <button
            className="onboarding-topbar__skip"
            data-testid="onboarding-skip-link"
            onClick={() => void dismissAndContinue()}
          >
            {t.topbarSkip}
          </button>
        </header>

        <main className="onboarding-page">
          <div className="onboarding-wizard">
            <span className="onboarding-wizard__eyebrow">
              <ShareIcon />
              {t.eyebrow}
            </span>

            <h1 className="onboarding-wizard__title">
              {t.titleLead}
              <br />
              <span className="onboarding-wizard__title-accent">{t.titleAccent}</span>
            </h1>

            <p className="onboarding-wizard__sub">{t.sub}</p>

            <div className="onboarding-grid">
              <article className="onboarding-row" data-platform="bsky" data-connected={String(bskyConnected)}>
                <span className="onboarding-logo onboarding-logo--bsky">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 10.5c-1.3-2.5-4.9-7.2-8.2-9.5C.7-1.2 0 .5 0 1.5c0 1.1.6 9.1 1 10.3.8 4 5.5 5.1 9.6 4.4-6.5 1.1-12.3 3.5-4.7 11.4 2.5 2.6 3.5-2.6 4-5.2.5 2.6 1.6 7.8 4 5.2 7.7-7.9 1.9-10.4-4.6-11.5 4 .7 8.8-.4 9.6-4.4.4-1.2 1-9.2 1-10.3 0-1-.7-2.7-3.8-.5-3.3 2.3-6.9 7-8.2 9.6z" />
                  </svg>
                </span>
                <div className="onboarding-body">
                  <div className="onboarding-name">Bluesky</div>
                  <div className="onboarding-meta">
                    {bsky && bskyConnected ? (
                      <>
                        <strong>{`@${bsky.external_handle}`}</strong>
                        {t.blueskyMetaConnectedSuffix}
                      </>
                    ) : (
                      t.blueskyMetaDefault
                    )}
                  </div>
                </div>
                <div className="onboarding-action">
                  {bskyConnected ? (
                    <ConnectedBadge label={t.statusConnected} />
                  ) : (
                    <button
                      className="onboarding-btn-connect onboarding-btn-connect--bsky"
                      data-testid="onboarding-connect-bluesky"
                      onClick={() => setModalOpen(true)}
                    >
                      <ArrowRightIcon />
                      {t.btnConnect}
                    </button>
                  )}
                </div>
              </article>

              <article className="onboarding-row" data-platform="linkedin" data-connected={String(linkedinConnected)}>
                <span className="onboarding-logo onboarding-logo--linkedin">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </span>
                <div className="onboarding-body">
                  <div className="onboarding-name">LinkedIn</div>
                  <div className="onboarding-meta">
                    {linkedin && linkedinConnected ? <strong>{linkedin.external_handle}</strong> : t.linkedinMeta}
                  </div>
                </div>
                <div className="onboarding-action">
                  {linkedinConnected ? (
                    <ConnectedBadge label={t.statusConnected} />
                  ) : (
                    <button
                      className="onboarding-btn-connect onboarding-btn-connect--linkedin"
                      data-testid="onboarding-connect-linkedin"
                      onClick={() => {
                        void connectLinkedin(null).catch((e: unknown) => toast.error(e));
                      }}
                    >
                      <ArrowRightIcon />
                      {t.btnConnect}
                    </button>
                  )}
                </div>
              </article>

              <article className="onboarding-row" data-platform="threads" data-connected="false" data-soon="true">
                <span className="onboarding-logo onboarding-logo--threads">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798z" />
                  </svg>
                </span>
                <div className="onboarding-body">
                  <div className="onboarding-name">Threads</div>
                  <div className="onboarding-meta">{t.threadsMeta}</div>
                </div>
                <div className="onboarding-action">
                  <button className="onboarding-btn-connect onboarding-btn-connect--soon" disabled>
                    {t.comingSoon}
                  </button>
                </div>
              </article>
            </div>

            <div className="onboarding-benefits">
              <div className="onboarding-benefit">
                <span className="onboarding-benefit__icon">
                  <ShareIcon />
                </span>
                <span className="onboarding-benefit__label">{t.benefitAutoLabel}</span>
                <span className="onboarding-benefit__hint">{t.benefitAutoHint}</span>
              </div>
              <div className="onboarding-benefit">
                <span className="onboarding-benefit__icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                <span className="onboarding-benefit__label">{t.benefitBacklinksLabel}</span>
                <span className="onboarding-benefit__hint">{t.benefitBacklinksHint}</span>
              </div>
              <div className="onboarding-benefit">
                <span className="onboarding-benefit__icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <span className="onboarding-benefit__label">{t.benefitSecureLabel}</span>
                <span className="onboarding-benefit__hint">{t.benefitSecureHint}</span>
              </div>
            </div>

            <div className="onboarding-cta-row">
              <button
                className="onboarding-cta onboarding-cta--ghost"
                data-testid="onboarding-skip"
                onClick={() => void dismissAndContinue()}
              >
                {t.ctaSkip}
              </button>
              <button
                className="onboarding-cta onboarding-cta--primary"
                data-testid="onboarding-continue"
                onClick={() => void dismissAndContinue()}
              >
                {t.ctaContinue}
                <ArrowRightIcon />
              </button>
            </div>

            <p className="onboarding-footer-note">
              <strong>{t.footerNoteProTip}</strong>
              {` ${t.footerNoteBody}`}
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="5 12 19 12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ConnectedBadge({ label }: { label: string }) {
  return (
    <span className="onboarding-connected-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {label}
    </span>
  );
}
