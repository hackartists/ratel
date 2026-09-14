import { useState } from "react";
import { useUpdatePoll } from "@ratel/ts-bridges/hooks";
import { ActionDependencySelector } from "@/components/space-actions/action-dependency-selector";
import { ActionRewardSetting } from "@/components/space-actions/action-reward-setting";
import { ActionStatusControl } from "@/components/space-actions/action-status-control";
import { ActionDeleteButton } from "@/components/space-actions/delete-action";
import { PrerequisiteTile } from "@/components/space-actions/prerequisite-tile";
import { useActionSpace } from "@/components/space-actions/space-data";
import { Switch } from "@/components/ui/switch";
import { usePollCreatorI18n } from "@/i18n/generated/features/spaces/pages/actions/actions/poll/views/main/creator/poll-creator.i18n";
import { isActionLocked } from "@/components/space-actions/access";
import { usePoll } from "../hooks/use-poll";

// poll/views/main/creator/config_card/component.rs (`ConfigCard`).
export function PollConfigCard() {
  const tr = usePollCreatorI18n();
  const { spaceId, pollId, poll, refresh } = usePoll();
  const update = useUpdatePoll();
  const space = useActionSpace(spaceId); // space-context: use_space()
  const locked = isActionLocked(space.status, poll.space_action.status);

  const [responseEditable, setResponseEditable] = useState(poll.response_editable);
  const [encryptedUpload, setEncryptedUpload] = useState(poll.encrypted_upload_enabled);

  const toggleResponseEditable = () => {
    const next = !responseEditable;
    setResponseEditable(next);
    update.mutateAsync({ spacePk: spaceId, pollSk: pollId, req: { response_editable: next } }).then(refresh);
  };

  const toggleEncryptedUpload = () => {
    const next = !encryptedUpload;
    setEncryptedUpload(next);
    // When encrypted upload is enabled, response editing is forced off server-side.
    if (next) setResponseEditable(false);
    update.mutateAsync({ spacePk: spaceId, pollSk: pollId, req: { canister_upload_enabled: next } }).then(refresh);
  };

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
          <ActionDependencySelector spaceId={spaceId} actionId={pollId} initialDependsOn={poll.space_action.depends_on} />
        </section>

        <section className="section" data-testid="section-participation">
          <div className="section__head">
            <span className="section__label">{tr.sectionParticipationLabel}</span>
          </div>
          <ActionRewardSetting
            spaceId={spaceId}
            actionId={pollId}
            savedCredits={poll.space_action.credits}
            actionStatus={poll.space_action.status}
          />
          <PrerequisiteTile
            spaceId={spaceId}
            actionId={pollId}
            initialPrerequisite={poll.space_action.prerequisite}
            onChanged={refresh}
          />
        </section>

        <section className="section" data-testid="section-voting-rules">
          <div className="section__head">
            <span className="section__label">{tr.sectionVotingRulesLabel}</span>
          </div>
          <div className="setting-row" data-testid="poll-response-editable">
            <div className="setting-row__text">
              <span className="setting-row__label">{tr.votingResponseEditableLabel}</span>
              <span className="setting-row__sub">{tr.votingResponseEditableSub}</span>
            </div>
            <Switch
              active={responseEditable}
              disabled={encryptedUpload}
              onToggle={toggleResponseEditable}
              label={tr.votingResponseEditableLabel}
            />
          </div>
          <div className="setting-row" data-testid="poll-encrypted-upload">
            <div className="setting-row__text">
              <span className="setting-row__label">{tr.votingEncryptedLabel}</span>
              <span className="setting-row__sub">{tr.votingEncryptedSub}</span>
            </div>
            <Switch active={encryptedUpload} onToggle={toggleEncryptedUpload} label={tr.votingEncryptedLabel} />
          </div>
        </section>

        <section className="section" data-testid="section-status">
          <div className="section__head">
            <span className="section__label">{tr.sectionStatusLabel}</span>
          </div>
          <ActionStatusControl spaceId={spaceId} actionId={pollId} initialStatus={poll.space_action.status} onChanged={refresh} />
        </section>

        {!locked && (
          <section className="section section--danger" data-testid="section-danger">
            <div className="section__head">
              <span className="section__label" style={{ color: "var(--accent-red)", opacity: 0.85 }}>
                {tr.sectionDangerLabel}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "220px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--qc-text-primary)", marginBottom: "4px" }}>
                  {tr.deletePollTitle}
                </div>
                <div style={{ fontSize: "12px", color: "var(--qc-text-muted)" }}>{tr.deletePollDesc}</div>
              </div>
              <ActionDeleteButton spaceId={spaceId} actionId={pollId} />
            </div>
          </section>
        )}
      </article>
    </section>
  );
}
