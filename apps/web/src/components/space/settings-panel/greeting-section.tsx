import * as React from "react";
import { useUpdateSpace } from "@ratel/ts-bridges/hooks";
import type { SpaceStatus as SpaceStatusType } from "@ratel/ts-bridges";
import { Editor } from "@/components/editor";
import { SpaceStatus, useSpaceContext } from "@/components/space/space-context";
import { dataBool } from "@/lib/dom";
import { useToast } from "@/lib/toast";
import { useGreetingSectionI18n } from "./greeting-section.i18n";

/**
 * Whether the waiting greeting may still change: only before the space starts
 * (Rust `SpaceCommon::is_greeting_editable`).
 */
export function isGreetingEditable(status: SpaceStatusType | null): boolean {
  return status !== SpaceStatus.Ongoing && status !== SpaceStatus.Processing && status !== SpaceStatus.Finished;
}

/**
 * Admin-only editor for the space waiting greeting, pinned to the top of the
 * settings panel. Saves through `PATCH /api/spaces/{id}` (`{ greeting }`) and
 * turns read-only once the space has started.
 */
export function GreetingSection({ spaceId }: { spaceId: string }) {
  const tr = useGreetingSectionI18n();
  const ctx = useSpaceContext();
  const toast = useToast();
  const update = useUpdateSpace();
  const editable = isGreetingEditable(ctx.space.status);
  const [saved, setSaved] = React.useState(ctx.space.greeting);
  const [draft, setDraft] = React.useState(ctx.space.greeting);
  const [saving, setSaving] = React.useState(false);
  const dirty = draft !== saved;

  const onSave = async () => {
    if (saving || !editable) return;
    setSaving(true);
    try {
      const res = await update.mutateAsync({ spaceId, req: { greeting: draft } });
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

  return (
    <section className="settings-group greeting-section" data-testid="greeting-section">
      <span className="settings-group__label">{tr.label}</span>
      <p className="greeting-section__desc">{editable ? tr.description : tr.locked}</p>
      <div className="greeting-section__editor" data-testid="greeting-editor" data-editable={dataBool(editable)}>
        <Editor
          key={editable ? "editable" : "readonly"}
          content={saved}
          editable={editable}
          placeholder={tr.placeholder}
          onContentChange={(html) => setDraft(html)}
        />
      </div>
      {editable && (
        <button
          type="button"
          className="greeting-section__save"
          data-testid="greeting-save"
          disabled={!dirty || saving}
          onClick={() => void onSave()}
        >
          {saving ? tr.saving : tr.save}
        </button>
      )}
    </section>
  );
}
