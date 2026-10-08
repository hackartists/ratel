import { ActionDependencySelector } from "@/components/space-actions/action-dependency-selector";
import { ActionRequiredAttributeSelector } from "@/components/space-actions/action-required-attribute-selector";
import { ActionRewardSetting } from "@/components/space-actions/action-reward-setting";
import { ActionStatusControl } from "@/components/space-actions/action-status-control";
import { ActionDeleteButton } from "@/components/space-actions/delete-action";
import { AiModeratorSetting } from "@/components/space-actions/ai-moderator-setting";
import { PrerequisiteTile } from "@/components/space-actions/prerequisite-tile";
import { useDiscussionEditorI18n } from "@/pages/spaces/[spaceId]/actions/discussions/[discussionId]/edit/i18n";
import { useDiscussion } from "../hooks/use-discussion";

// discussion/views/editor/config_card/component.rs (`ConfigCard`).
export function DiscussionConfigCard() {
  const tr = useDiscussionEditorI18n();
  const { spaceId, discussionId, discussion, refresh } = useDiscussion();
  const action = discussion.space_action;

  return (
    <section className="pager__page" data-page="1">
      <article className="page-card" data-testid="page-card-config">
        <header className="page-card__head">
          <div className="page-card__title-wrap">
            <span className="page-card__num">{tr.cardIndex2}</span>
            <div>
              <h1 className="page-card__title">{tr.cardConfigTitle}</h1>
              <div className="page-card__subtitle">{tr.cardConfigSubtitle}</div>
            </div>
          </div>
        </header>

        <section className="section" data-testid="section-dependencies">
          <div className="section__head">
            <span className="section__label">{tr.sectionDependenciesLabel}</span>
          </div>
          <ActionDependencySelector spaceId={spaceId} actionId={discussionId} initialDependsOn={action.depends_on} />
        </section>

        <section className="section" data-testid="section-required-attributes">
          <div className="section__head">
            <span className="section__label">{tr.sectionRequiredAttributesLabel}</span>
          </div>
          <ActionRequiredAttributeSelector
            spaceId={spaceId}
            actionId={discussionId}
            initialRequiredAttributes={action.required_attributes}
          />
        </section>

        <section className="section" data-testid="section-participation">
          <div className="section__head">
            <span className="section__label">{tr.sectionParticipationLabel}</span>
          </div>
          <ActionRewardSetting spaceId={spaceId} actionId={discussionId} savedCredits={action.credits} actionStatus={action.status} />
          <PrerequisiteTile spaceId={spaceId} actionId={discussionId} initialPrerequisite={action.prerequisite} onChanged={refresh} />
        </section>

        <section className="section" data-testid="section-moderation">
          <div className="section__head">
            <span className="section__label">{tr.sectionModerationLabel}</span>
          </div>
          <AiModeratorSetting spaceId={spaceId} discussionId={discussionId} />
        </section>

        <section className="section" data-testid="section-status">
          <div className="section__head">
            <span className="section__label">{tr.sectionStatusLabel}</span>
          </div>
          <ActionStatusControl spaceId={spaceId} actionId={discussionId} initialStatus={action.status} onChanged={refresh} />
        </section>

        <section className="section section--danger" data-testid="section-danger">
          <div className="section__head">
            <span className="section__label" style={{ color: "var(--accent-red)", opacity: 0.85 }}>
              {tr.sectionDangerLabel}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "220px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--qc-text-primary)", marginBottom: "4px" }}>{tr.deleteTitle}</div>
              <div style={{ fontSize: "12px", color: "var(--qc-text-muted)" }}>{tr.deleteDesc}</div>
            </div>
            <ActionDeleteButton spaceId={spaceId} actionId={discussionId} />
          </div>
        </section>
      </article>
    </section>
  );
}
