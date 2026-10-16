import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { enterSampling, getMySamplingStatus } from "@ratel/ts-bridges";
import type { MySamplingState } from "@ratel/ts-bridges";
import { useSpaceContext } from "@/components/space/space-context";
import { dataBool } from "@/lib/dom";
import { useToast } from "@/lib/toast";
import { WaitingGreeting, hasGreeting } from "./waiting-greeting";
import { useSamplingEntryCardI18n, type SamplingEntryCardI18n } from "./sampling-entry-card.i18n";

/** `MySamplingState` → kebab-case suffix of the `sampling-state-*` test id. */
function stateSlug(state: MySamplingState): string {
  return state.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function stateMessage(state: MySamplingState, tr: SamplingEntryCardI18n): string {
  switch (state) {
    case "NotAnswered":
      return tr.notAnswered;
    case "RecruitClosed":
      return tr.recruitClosed;
    case "NotEligible":
      return tr.notEligible;
    case "Waiting":
      return tr.waiting;
    case "CanEnter":
      return tr.canEnter;
    case "CellFull":
      return tr.cellFull;
    case "Selected":
      return tr.selected;
    case "NotSelected":
      return tr.notSelected;
    case "Entered":
      return tr.entered;
    case "SampleClosed":
      return tr.sampleClosed;
    case "ParticipationOpen":
      return tr.participationOpen;
  }
}

/**
 * Participant-facing Sampling card: tells a Candidate where they stand in
 * the sample (waiting, can enter, full, selected, not selected, closed …)
 * and offers the enter button while a seat is available.
 */
export function SamplingEntryCard() {
  const tr = useSamplingEntryCardI18n();
  const toast = useToast();
  const ctx = useSpaceContext();
  const spaceId = ctx.space.id;
  const query = useQuery({
    queryKey: ["getMySamplingStatus", spaceId, ctx.space.status],
    queryFn: () => getMySamplingStatus(spaceId),
  });
  const [entering, setEntering] = React.useState(false);

  if (!query.data) return null;
  const { state, cell_labels } = query.data;
  const canEnter = state === "CanEnter" || state === "Selected";

  const onEnter = async () => {
    if (entering) return;
    setEntering(true);
    try {
      await enterSampling(spaceId);
    } catch (err) {
      toast.error(err);
    }
    await query.refetch();
    await ctx.restart();
    setEntering(false);
  };

  return (
    <div
      className="waiting-card sampling-entry-card"
      data-testid="card-sampling"
      data-has-greeting={dataBool(hasGreeting(ctx.space.greeting))}
    >
      <WaitingGreeting />
      <span className="waiting-card__heading">{tr.title}</span>
      {cell_labels.length > 0 && (
        <div className="waiting-card__participants">
          <span className="waiting-card__participants-label">{tr.group}</span>
          <span className="waiting-card__participants-count" data-testid="sampling-cell-labels">
            {cell_labels.join(" · ")}
          </span>
        </div>
      )}
      <div className={`sampling-entry-card__state sampling-entry-card__state--${stateSlug(state)}`} data-testid={`sampling-state-${stateSlug(state)}`}>
        {stateMessage(state, tr)}
      </div>
      {canEnter && (
        <button type="button" className="sampling-save-btn" data-testid="btn-sampling-enter" disabled={entering} onClick={() => void onEnter()}>
          {entering ? tr.entering : tr.enter}
        </button>
      )}
    </div>
  );
}
