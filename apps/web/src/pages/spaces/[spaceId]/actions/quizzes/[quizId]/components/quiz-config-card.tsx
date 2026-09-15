import { ActionDependencySelector } from "@/components/space-actions/action-dependency-selector";
import { ActionRewardSetting } from "@/components/space-actions/action-reward-setting";
import { ActionStatusControl } from "@/components/space-actions/action-status-control";
import { ActionDeleteButton } from "@/components/space-actions/delete-action";
import { PrerequisiteTile } from "@/components/space-actions/prerequisite-tile";
import { useQuizCreatorI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/quiz/views/main/creator/quiz-creator.i18n";
import { useQuiz } from "../hooks/use-quiz";

// quiz/views/main/creator/config_card/component.rs (`ConfigCard`).
export function QuizConfigCard() {
  const tr = useQuizCreatorI18n();
  const { spaceId, quizId, quiz, refreshQuiz } = useQuiz();

  return (
    <section className="pager__page" data-page="2">
      <article className="page-card" data-testid="page-card-config">
        <header className="page-card__head">
          <div className="page-card__title-wrap">
            <span className="page-card__num">{tr.cardIndex3}</span>
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
          <ActionDependencySelector spaceId={spaceId} actionId={quizId} initialDependsOn={quiz.space_action.depends_on} />
        </section>

        <section className="section" data-testid="section-participation">
          <div className="section__head">
            <span className="section__label">{tr.sectionParticipationLabel}</span>
          </div>
          <ActionRewardSetting
            spaceId={spaceId}
            actionId={quizId}
            savedCredits={quiz.space_action.credits}
            actionStatus={quiz.space_action.status}
          />
          <PrerequisiteTile spaceId={spaceId} actionId={quizId} initialPrerequisite={quiz.space_action.prerequisite} onChanged={refreshQuiz} />
        </section>

        <section className="section" data-testid="section-status">
          <div className="section__head">
            <span className="section__label">{tr.sectionStatusLabel}</span>
          </div>
          <ActionStatusControl spaceId={spaceId} actionId={quizId} initialStatus={quiz.space_action.status} onChanged={refreshQuiz} />
        </section>

        <section className="section section--danger" data-testid="section-danger">
          <div className="section__head">
            <span className="section__label" style={{ color: "var(--accent-red)", opacity: 0.85 }}>
              {tr.sectionDangerLabel}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "220px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--qc-text-primary)", marginBottom: "4px" }}>{tr.deleteQuizTitle}</div>
              <div style={{ fontSize: "12px", color: "var(--qc-text-muted)" }}>{tr.deleteQuizDesc}</div>
            </div>
            <ActionDeleteButton spaceId={spaceId} actionId={quizId} />
          </div>
        </section>
      </article>
    </section>
  );
}
