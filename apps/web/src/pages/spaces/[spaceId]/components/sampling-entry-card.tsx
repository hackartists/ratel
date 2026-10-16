import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

/** Outcome of a sampling entry, shown as a result banner above the state message. */
type SamplingOutcome = "selected" | "closed";

function outcomeOf(state: MySamplingState): SamplingOutcome | null {
  switch (state) {
    case "Entered":
      return "selected";
    case "CellFull":
    case "NotSelected":
      return "closed";
    default:
      return null;
  }
}

function outcomeHeading(state: MySamplingState, tr: SamplingEntryCardI18n): string | null {
  switch (state) {
    case "Entered":
      return tr.enteredHeading;
    case "CellFull":
      return tr.cellFullHeading;
    case "NotSelected":
      return tr.notSelectedHeading;
    default:
      return null;
  }
}

/** Check mark for a confirmed seat, cross for a closed-out member. */
function OutcomeIcon({ outcome }: { outcome: SamplingOutcome }) {
  return (
    <div className={`sampling-entry-card__icon sampling-entry-card__icon--${outcome}`} data-testid={`sampling-outcome-icon-${outcome}`}>
      <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" />
        {outcome === "selected" ? <polyline points="16.5 9 10.5 15 7.5 12" /> : <path d="M15 9l-6 6M9 9l6 6" />}
      </svg>
    </div>
  );
}

/**
 * Participant-facing Sampling card: tells a Candidate where they stand in
 * the sample (waiting, can enter, full, selected, not selected, closed …)
 * and offers the enter button while a seat is available. Once the member
 * has taken a seat the greeting is hidden and a congratulation banner
 * replaces the card heading; a member closed out by a full group or the
 * random draw gets a matching result banner instead.
 */
export function SamplingEntryCard() {
  const tr = useSamplingEntryCardI18n();
  const toast = useToast();
  const ctx = useSpaceContext();
  const queryClient = useQueryClient();
  const spaceId = ctx.space.id;
  const queryKey = ["getMySamplingStatus", spaceId, ctx.space.status];
  const query = useQuery({
    queryKey,
    queryFn: () => getMySamplingStatus(spaceId),
  });
  const [entering, setEntering] = React.useState(false);

  if (!query.data) return null;
  const { state, cell_labels } = query.data;
  const canEnter = state === "CanEnter" || state === "Selected";
  const outcome = outcomeOf(state);
  const heading = outcomeHeading(state, tr);
  const showGreeting = outcome !== "selected" && hasGreeting(ctx.space.greeting);

  const onEnter = async () => {
    if (entering) return;
    setEntering(true);
    try {
      const status = await enterSampling(spaceId);
      queryClient.setQueryData(queryKey, status);
    } catch (err) {
      toast.error(err);
      await query.refetch();
    }
    setEntering(false);
    void ctx.restart();
  };

  return (
    <div
      className="waiting-card sampling-entry-card"
      data-testid="card-sampling"
      data-has-greeting={dataBool(showGreeting)}
      data-outcome={outcome ?? undefined}
    >
      {showGreeting && <WaitingGreeting />}
      {outcome && heading ? (
        <div
          key={state}
          className={`sampling-entry-card__result sampling-entry-card__result--${outcome}`}
          data-testid={`sampling-outcome-${outcome}`}
          role="status"
          aria-live="polite"
        >
          <OutcomeIcon outcome={outcome} />
          <span className="waiting-card__heading" data-testid="sampling-outcome-heading">
            {heading}
          </span>
        </div>
      ) : (
        <span className="waiting-card__heading">{tr.title}</span>
      )}
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
