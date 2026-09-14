import { useRef, useState } from "react";
import { useUpdateSpaceAction } from "@ratel/ts-bridges/hooks";
import { AutosaveStatusBadge, type SaveStatus } from "@/components/space-actions/autosave-status-badge";
import { useDebouncedAutosave } from "@/components/space-actions/use-debounced-autosave";
import { useFollowCreatorI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/follow/views/main/creator/follow-creator.i18n";
import { useToast } from "@/lib/toast";
import { FollowerSetting } from "./follower-setting";

// follow/views/main/creator/targets_card — title (3s debounced + blur autosave
// through `update_space_action` `Title`) and the follow target list.
export function FollowTargetsCard({
  spaceId,
  followId,
  initialTitle,
}: {
  spaceId: string;
  followId: string;
  initialTitle: string;
}) {
  const tr = useFollowCreatorI18n();
  const toast = useToast();
  const update = useUpdateSpaceAction();
  const [title, setTitle] = useState(initialTitle);
  const [titleStatus, setTitleStatus] = useState<SaveStatus>("Idle");
  const titleRef = useRef(initialTitle);
  const lastSavedTitle = useRef(initialTitle);

  const saveTitle = () => {
    const current = titleRef.current;
    if (current === lastSavedTitle.current) return;
    setTitleStatus("Saving");
    update
      .mutateAsync({ spaceId, actionId: followId, req: { title: current } })
      .then(() => {
        lastSavedTitle.current = current;
        setTitleStatus("Saved");
      })
      .catch((err) => {
        console.error("Failed to save follow title:", err);
        setTitleStatus("Unsaved");
        toast.error(err);
      });
  };
  // Autosave with a 3-second debounce.
  const scheduleSave = useDebouncedAutosave(saveTitle);

  return (
    <section className="pager__page" data-page="0">
      <article className="page-card" data-testid="page-card-targets">
        <header className="page-card__head">
          <div className="page-card__title-wrap">
            <span className="page-card__num">{tr.cardIndex1}</span>
            <div>
              <h1 className="page-card__title">{tr.cardTargetsTitle}</h1>
              <div className="page-card__subtitle">{tr.cardTargetsSubtitle}</div>
            </div>
          </div>
        </header>

        <section className="section" data-testid="section-content">
          <div className="section__head">
            <span className="section__label">{tr.sectionContentLabel}</span>
          </div>
          <div className="field">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <label className="field__label">{tr.titleLabel}</label>
              <AutosaveStatusBadge status={titleStatus} labels={tr} />
            </div>
            <input
              className="input"
              data-testid="follow-title"
              placeholder={tr.titlePlaceholder}
              value={title}
              onChange={(e) => {
                titleRef.current = e.target.value;
                setTitle(e.target.value);
                setTitleStatus("Unsaved");
                scheduleSave();
              }}
              onBlur={() => saveTitle()}
            />
          </div>
        </section>

        <section className="section" data-testid="section-targets">
          <div className="section__head">
            <span className="section__label">{tr.sectionTargetsLabel}</span>
            <span className="section__hint">{tr.sectionTargetsHint}</span>
          </div>
          <FollowerSetting spaceId={spaceId} />
        </section>
      </article>
    </section>
  );
}
