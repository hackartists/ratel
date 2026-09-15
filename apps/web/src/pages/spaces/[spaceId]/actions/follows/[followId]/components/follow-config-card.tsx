import type { SpaceAction } from "@ratel/ts-bridges";
import { ActionDependencySelector } from "@/components/space-actions/action-dependency-selector";
import { ActionRewardSetting } from "@/components/space-actions/action-reward-setting";
import { ActionStatusControl } from "@/components/space-actions/action-status-control";
import { ActionDeleteButton } from "@/components/space-actions/delete-action";
import { PrerequisiteTile } from "@/components/space-actions/prerequisite-tile";
import { useFollowCreatorI18n } from "./follow-creator.i18n";

// follow/views/main/creator/config_card — dependencies, reward, prerequisite,
// lifecycle status and the danger zone.
export function FollowConfigCard({
  spaceId,
  followId,
  action,
}: {
  spaceId: string;
  followId: string;
  action: SpaceAction;
}) {
  const tr = useFollowCreatorI18n();

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
          <ActionDependencySelector spaceId={spaceId} actionId={followId} initialDependsOn={action.depends_on} />
        </section>

        <section className="section" data-testid="section-participation">
          <div className="section__head">
            <span className="section__label">{tr.sectionParticipationLabel}</span>
          </div>
          <ActionRewardSetting
            spaceId={spaceId}
            actionId={followId}
            savedCredits={action.credits}
            actionStatus={action.status}
          />
          <PrerequisiteTile spaceId={spaceId} actionId={followId} initialPrerequisite={action.prerequisite} />
        </section>

        <section className="section" data-testid="section-status">
          <div className="section__head">
            <span className="section__label">{tr.sectionStatusLabel}</span>
          </div>
          <ActionStatusControl spaceId={spaceId} actionId={followId} initialStatus={action.status} />
        </section>

        <section className="section section--danger" data-testid="section-danger">
          <div className="section__head">
            <span className="section__label" style={{ color: "var(--accent-red)", opacity: 0.85 }}>
              {tr.sectionDangerLabel}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: "220px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--qc-text-primary)",
                  marginBottom: "4px",
                }}
              >
                {tr.deleteTitle}
              </div>
              <div style={{ fontSize: "12px", color: "var(--qc-text-muted)" }}>{tr.deleteDesc}</div>
            </div>
            <ActionDeleteButton spaceId={spaceId} actionId={followId} />
          </div>
        </section>
      </article>
    </section>
  );
}
