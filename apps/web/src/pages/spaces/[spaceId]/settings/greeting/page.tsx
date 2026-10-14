import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useUpdateSpace } from "@ratel/ts-bridges/hooks";
import { Editor } from "@/components/editor";
import { isGreetingEditable, isSpaceAdmin, useSpaceContext } from "@/components/space/space-context";
import { dataBool } from "@/lib/dom";
import { useToast } from "@/lib/toast";
import { useSpaceGreetingSettingsI18n } from "./i18n";

const DEFAULT_SPACE_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

/**
 * `/spaces/:spaceId/settings/greeting` — full-page editor for the waiting
 * greeting, opened from the settings panel. Only the creator may edit; it
 * turns read-only once the space has started.
 */
export function Component() {
  const { role } = useSpaceContext();
  return isSpaceAdmin(role) ? <GreetingEditorPage /> : <NoAccessPage />;
}

function GreetingEditorPage() {
  const tr = useSpaceGreetingSettingsI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const ctx = useSpaceContext();
  const update = useUpdateSpace();
  const { space } = ctx;
  const editable = isGreetingEditable(space.status);
  const [saved, setSaved] = React.useState(space.greeting);
  const [draft, setDraft] = React.useState(space.greeting);
  const [saving, setSaving] = React.useState(false);
  const dirty = draft !== saved;
  const spaceLogo = space.logo === "" ? DEFAULT_SPACE_LOGO : space.logo;

  const onSave = async () => {
    if (saving || !editable || !dirty) return;
    setSaving(true);
    try {
      const res = await update.mutateAsync({ spaceId: space.id, req: { greeting: draft } });
      setSaved(res.greeting);
      setDraft(res.greeting);
      toast.info(tr.saved);
      await ctx.restartSpace();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const status = !editable ? tr.statusLocked : dirty ? tr.statusDirty : tr.statusClean;

  return (
    <div className="space-general-arena greeting-settings" data-testid="greeting-settings-page">
      <header className="sga-topbar" role="banner">
        <div className="sga-topbar__left">
          <button type="button" className="sga-back-btn" aria-label={tr.backAria} data-testid="topbar-back" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <img className="sga-topbar__logo" alt="Space logo" src={spaceLogo} />
          <nav className="sga-breadcrumb">
            <span className="sga-breadcrumb__item">{space.title}</span>
            <span className="sga-breadcrumb__sep">›</span>
            <span className="sga-breadcrumb__item">{tr.breadcrumbSettings}</span>
            <span className="sga-breadcrumb__sep">›</span>
            <span className="sga-breadcrumb__item sga-breadcrumb__current">{tr.breadcrumbGreeting}</span>
          </nav>
          <span className="sga-type-badge">{tr.typeBadge}</span>
          <span className="sga-topbar-title">{tr.topbarTitle}</span>
        </div>
      </header>

      <main className="sga-body greeting-settings__body">
        <h1 className="sga-body__title">{tr.heading}</h1>
        <section className="sga-section greeting-settings__section">
          <div className="sga-section__head">
            <span className="sga-section__label">{tr.label}</span>
            <span className="sga-section__hint">{tr.description}</span>
          </div>
          {!editable && (
            <div className="greeting-settings__locked" data-testid="greeting-locked-notice">
              {tr.locked}
            </div>
          )}
          <div className="greeting-settings__editor" data-testid="greeting-editor" data-editable={dataBool(editable)}>
            <Editor
              key={editable ? "editable" : "readonly"}
              content={saved}
              editable={editable}
              placeholder={tr.placeholder}
              onContentChange={(html) => setDraft(html)}
            />
          </div>
        </section>
      </main>

      <footer className="sga-footer greeting-settings__footer">
        <div className="sga-footer__left">
          <span className="sga-footer__pill" data-testid="greeting-status" data-dirty={dataBool(dirty)}>
            <span className="greeting-settings__dot" data-dirty={dataBool(dirty)} />
            {status}
          </span>
        </div>
        {editable && (
          <button
            type="button"
            className="sga-btn sga-btn--accent greeting-settings__save"
            data-testid="greeting-save"
            disabled={!dirty || saving}
            onClick={() => void onSave()}
          >
            {saving ? tr.saving : tr.save}
          </button>
        )}
      </footer>
    </div>
  );
}

function NoAccessPage() {
  const tr = useSpaceGreetingSettingsI18n();
  const navigate = useNavigate();
  return (
    <div className="space-general-arena greeting-settings" data-testid="greeting-settings-no-access">
      <div className="greeting-settings__no-access">
        <span className="greeting-settings__no-access-title">{tr.noAccess}</span>
        <button type="button" className="sga-btn" onClick={() => navigate(-1)}>
          {tr.viewerBack}
        </button>
      </div>
    </div>
  );
}
