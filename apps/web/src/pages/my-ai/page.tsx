import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useMyAiI18n } from "./i18n";
import { dataBool } from "@/lib/dom";
import { CapPill } from "./components/cap-pill";
import { GuidePanel, GuideTabButton, type GuideTab } from "./components/guide-panel";
import { useMyAi } from "./hooks/use-my-ai";

// app/ratel/src/features/me/pages/my_ai/component.rs (`MyAiPage`, `/my-ai`) —
// personal MCP endpoint: status, generate/regenerate, capabilities, and the
// per-client setup guide.

const MCP_DOCS_URL = "https://modelcontextprotocol.io/";

export function Component() {
  const tr = useMyAiI18n();
  const navigate = useNavigate();
  const { hasSecret, mcpUrl, displayUrl, generating, urlCopied, errorMessage, generate, copyUrl } = useMyAi();
  const [activeTab, setActiveTab] = useState<GuideTab>("ClaudeCode");

  return (
    <>
      <SeoMeta title={tr.pageTitle} />

      <div className="my-ai">
        <header className="my-ai__topbar">
          <div className="my-ai__topbar-left">
            <button className="my-ai__back" aria-label={tr.back} data-testid="my-ai-back" onClick={() => navigate(-1)}>
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="my-ai__title">
              <span className="my-ai__title-main">{tr.pageTitle}</span>
              <span className="my-ai__status" data-state={hasSecret ? "on" : "off"}>
                {hasSecret ? tr.statusOnline : tr.statusOffline}
              </span>
            </div>
          </div>
          <a className="my-ai__topbar-link" href={MCP_DOCS_URL} target="_blank" rel="noopener noreferrer">
            <svg
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" x2="21" y1="14" y2="3" />
            </svg>
            {tr.mcpDocs}
          </a>
        </header>

        <main className="my-ai__page">
          <section className="my-ai__hero" data-testid="my-ai-hero">
            <div className="my-ai__hero-head">
              <div className="my-ai__hero-crest">
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 3 13.6 9.4 20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3Z" />
                  <path
                    d="M19 4 19.7 6.3 22 7l-2.3 0.7L19 10l-0.7-2.3L16 7l2.3-0.7L19 4Z"
                    opacity="0.7"
                    strokeWidth="1.2"
                  />
                </svg>
              </div>
              <div className="my-ai__hero-head-body">
                <div className="my-ai__hero-eyebrow">
                  <strong>{tr.heroEyebrowLabel}</strong>
                  {` · ${tr.heroEyebrowTransport}`}
                </div>
                <h1 className="my-ai__hero-title">{tr.heroTitle}</h1>
                <p className="my-ai__hero-sub">{tr.heroSub}</p>
              </div>
            </div>

            <div className="my-ai__url">
              <span className="my-ai__url-label">
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect height="11" rx="2" width="18" x="3" y="11" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {tr.endpointLabel}
              </span>
              {mcpUrl !== null ? (
                <>
                  <input className="my-ai__url-value" data-testid="my-ai-endpoint-url" readOnly value={displayUrl} />
                  <button
                    className="my-ai__url-copy"
                    data-copied={dataBool(urlCopied)}
                    data-testid="my-ai-copy-url"
                    onClick={() => void copyUrl()}
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect height="13" rx="2" width="13" x="9" y="9" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    {urlCopied ? tr.btnCopied : tr.btnCopyUrl}
                  </button>
                </>
              ) : (
                <div className="my-ai__url-value my-ai__url-value--placeholder">
                  {hasSecret ? tr.placeholderExisting : tr.placeholderNone}
                </div>
              )}
            </div>

            <div className="my-ai__note">
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
              <div>
                <strong>{tr.noteHeadsUp}</strong>
                {` ${tr.noteBody}`}
              </div>
            </div>

            {errorMessage !== null && <div className="my-ai__error">{errorMessage}</div>}

            <div className="my-ai__actions">
              <button
                className="my-ai__btn my-ai__btn--primary"
                data-testid="my-ai-generate"
                disabled={generating}
                onClick={() => void generate()}
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                {generating ? tr.btnGenerating : hasSecret ? tr.btnRegenerate : tr.btnGenerate}
              </button>
              <span className="my-ai__actions-hint">{tr.actionsHint}</span>
            </div>
          </section>

          <div className="my-ai__section-head">
            <div className="my-ai__section-title">{tr.capsSectionTitle}</div>
            <div className="my-ai__section-sub">{tr.capsSectionSub}</div>
          </div>
          <section className="my-ai__caps">
            <CapPill flavor="cyan" label={tr.capPostsLabel} value={tr.capPostsValue}>
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </CapPill>
            <CapPill flavor="gold" label={tr.capPollsLabel} value={tr.capPollsValue}>
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 4 4 5-5" />
              </svg>
            </CapPill>
            <CapPill flavor="violet" label={tr.capSpacesLabel} value={tr.capSpacesValue}>
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </CapPill>
            <CapPill flavor="teal" label={tr.capDiscussionsLabel} value={tr.capDiscussionsValue}>
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="9" x2="15" y1="10" y2="10" />
              </svg>
            </CapPill>
            <CapPill flavor="pink" label={tr.capInboxLabel} value={tr.capInboxValue}>
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </CapPill>
          </section>

          <div className="my-ai__section-head">
            <div className="my-ai__section-title">{tr.guideSectionTitle}</div>
            <div className="my-ai__section-sub">{tr.guideSectionSub}</div>
          </div>

          <section className="my-ai__guide">
            <div className="my-ai__guide-tabs" role="tablist">
              <GuideTabButton
                activeTab={activeTab}
                tab="ClaudeCode"
                label={tr.tabClaudeCode}
                testId="my-ai-tab-claude-code"
                onSelect={setActiveTab}
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </GuideTabButton>
              <GuideTabButton
                activeTab={activeTab}
                tab="ClaudeDesktop"
                label={tr.tabClaudeDesktop}
                testId="my-ai-tab-claude-desktop"
                onSelect={setActiveTab}
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect height="14" rx="2" width="20" x="2" y="3" />
                  <line x1="8" x2="16" y1="21" y2="21" />
                  <line x1="12" x2="12" y1="17" y2="21" />
                </svg>
              </GuideTabButton>
              <GuideTabButton
                activeTab={activeTab}
                tab="Cursor"
                label={tr.tabCursor}
                testId="my-ai-tab-cursor"
                onSelect={setActiveTab}
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M2 2l8 18 2-8 8-2L2 2z" />
                </svg>
              </GuideTabButton>
              <GuideTabButton
                activeTab={activeTab}
                tab="Generic"
                label={tr.tabGeneric}
                testId="my-ai-tab-generic"
                onSelect={setActiveTab}
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </GuideTabButton>
            </div>

            <GuidePanel tab={activeTab} url={displayUrl} />
          </section>
        </main>
      </div>
    </>
  );
}
