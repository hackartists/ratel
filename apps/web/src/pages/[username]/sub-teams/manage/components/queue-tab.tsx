import { useState } from "react";
import type { SubTeamApplicationResponse } from "@ratel/ts-bridges";
import { FileText, X } from "@/components/icons/lucide";
import { useSubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";
import { dataBool } from "@/lib/dom";
import { avatarVariantFor, buildSnapshotRows, formatWhen, shortId, teamInitials } from "../hooks/format";
import { useSubTeamManagement } from "../hooks/use-sub-team-management";
import { MoreElement } from "./more-element";

// app/ratel/src/features/sub_team/pages/management/queue_tab.rs (`QueueTab`).
export function QueueTab() {
  const tr = useSubTeamI18n();
  const { queue, handleApprove, handleReject, handleReturn } = useSubTeamManagement();
  const items = queue.items;
  const itemCount = items.length;

  // Some(application) = the review modal is open.
  const [reviewOpen, setReviewOpen] = useState<SubTeamApplicationResponse | null>(null);

  return (
    <>
      <section className="card">
        <div className="card__head">
          <h2 className="card__title">{tr.tabQueue}</h2>
          <span className="card__dash" />
          <span className="card__meta">{itemCount}</span>
        </div>

        {itemCount === 0 && !queue.isLoading ? (
          <div className="inline-note">{tr.emptyList}</div>
        ) : (
          <>
            <div className="u-col u-gap-10" id="queue-list">
              {items.map((app) => (
                <QueueRow
                  key={app.id}
                  app={app}
                  onReview={setReviewOpen}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onReturn={handleReturn}
                />
              ))}
            </div>
            <MoreElement query={queue} />
          </>
        )}
      </section>

      {reviewOpen && <ReviewApplicationModal app={reviewOpen} onClose={() => setReviewOpen(null)} />}
    </>
  );
}

type QueueRowMode = "Idle" | "Approve" | "Return" | "Reject";

interface QueueRowProps {
  app: SubTeamApplicationResponse;
  onReview: (app: SubTeamApplicationResponse) => void;
  onApprove: (id: string, msg: string) => void;
  onReject: (id: string, reason: string) => void;
  onReturn: (id: string, comment: string) => void;
}

function displayNameOf(app: SubTeamApplicationResponse): string {
  return app.applicant_team_display_name === "" ? `Application ${shortId(app.id)}` : app.applicant_team_display_name;
}

function QueueRow({ app, onReview, onApprove, onReject, onReturn }: QueueRowProps) {
  const tr = useSubTeamI18n();
  const [mode, setMode] = useState<QueueRowMode>("Idle");
  const [text, setText] = useState("");

  const displayName = displayNameOf(app);
  const initials = teamInitials(displayName);
  const avatarVariant = avatarVariantFor(app.id);
  const membersLine = `${Math.max(app.applicant_member_count, 0)} ${tr.queueRowMembersSuffix}`;
  const whenLine = formatWhen(app.submitted_at ?? app.created_at);
  const snapshotLine = `${tr.queueRowFormSnapshot} · ${app.form_snapshot.length} ${tr.reviewModalFieldsSuffix}`;

  const placeholder =
    mode === "Approve"
      ? tr.queueRowApprovePlaceholder
      : mode === "Return"
        ? tr.queueRowReturnPlaceholder
        : mode === "Reject"
          ? tr.queueRowRejectPlaceholder
          : "";

  return (
    <div className="queue-row" data-testid="sub-team-queue-row">
      <div className={`avatar ${avatarVariant}`}>{initials}</div>
      <div className="queue-row__body">
        <span className="queue-row__name">{displayName}</span>
        <div className="queue-row__meta">
          <span>{membersLine}</span>
          <span>{whenLine}</span>
          <span>{snapshotLine}</span>
        </div>
      </div>
      <div className="queue-row__actions">
        <button
          className="queue-row__action queue-row__action--review"
          data-testid="sub-team-queue-review-btn"
          type="button"
          onClick={() => onReview(app)}
        >
          {tr.queueRowReviewBtn}
        </button>
        <button
          className="queue-row__action queue-row__action--approve"
          data-testid="sub-team-queue-approve-btn"
          aria-pressed={dataBool(mode === "Approve")}
          type="button"
          onClick={() => {
            setMode("Approve");
            setText("");
          }}
        >
          {tr.approve}
        </button>
        <button
          className="queue-row__action queue-row__action--return"
          data-testid="sub-team-queue-return-btn"
          aria-pressed={dataBool(mode === "Return")}
          type="button"
          onClick={() => {
            setMode("Return");
            setText("");
          }}
        >
          {tr.return}
        </button>
        <button
          className="queue-row__action queue-row__action--reject"
          data-testid="sub-team-queue-reject-btn"
          aria-pressed={dataBool(mode === "Reject")}
          type="button"
          onClick={() => {
            setMode("Reject");
            setText("");
          }}
        >
          {tr.reject}
        </button>
      </div>
      {mode !== "Idle" && (
        <div className="queue-row__decision">
          <textarea
            className="field__textarea"
            data-testid="sub-team-queue-decision-text"
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
          />
          <div className="u-flex u-gap-10">
            <button className="btn btn--ghost btn--small" type="button" onClick={() => setMode("Idle")}>
              {tr.cancel}
            </button>
            <button
              className="btn btn--primary btn--small"
              data-testid="sub-team-queue-decision-confirm"
              type="button"
              onClick={() => {
                if (mode === "Approve") onApprove(app.id, text);
                else if (mode === "Return") onReturn(app.id, text);
                else if (mode === "Reject") onReject(app.id, text);
                setMode("Idle");
                setText("");
              }}
            >
              {tr.queueRowConfirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewApplicationModal({ app, onClose }: { app: SubTeamApplicationResponse; onClose: () => void }) {
  const tr = useSubTeamI18n();
  const displayName = displayNameOf(app);
  const usernameLine = app.applicant_team_username === "" ? "" : `@${app.applicant_team_username}`;
  const submittedAt = formatWhen(app.submitted_at ?? app.created_at);
  const snapshotRows = buildSnapshotRows(app);
  const fieldCount = app.form_snapshot.length;

  return (
    <div
      className="modal-backdrop sub-team-review-modal"
      data-open="true"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="modal review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="review-modal__head">
          <div className="review-modal__icon">
            <FileText className="w-4 h-4 [&>path]:stroke-current" />
          </div>
          <div className="review-modal__title-wrap">
            <div className="review-modal__kicker">{tr.reviewModalEyebrow}</div>
            <div className="review-modal__title">{displayName}</div>
            {usernameLine !== "" && <div className="review-modal__handle">{usernameLine}</div>}
          </div>
          <button type="button" className="review-modal__close-x" aria-label={tr.reviewModalClose} onClick={onClose}>
            <X className="w-4 h-4 [&>path]:stroke-current" />
          </button>
        </div>

        <div className="review-modal__body">
          <div className="review-modal__meta">
            <div className="review-modal__meta-cell">
              <span className="review-modal__meta-label">{tr.reviewModalSubmittedAt}</span>
              <span className="review-modal__meta-value">{submittedAt}</span>
            </div>
            <div className="review-modal__meta-cell">
              <span className="review-modal__meta-label">{tr.queueRowFormSnapshot}</span>
              <span className="review-modal__meta-value">{`${fieldCount} ${tr.reviewModalFieldsSuffix}`}</span>
            </div>
          </div>
          <div className="review-modal__section-title">{tr.reviewModalFormSection}</div>
          <div className="review-modal__snapshot">
            {snapshotRows.length === 0 && <div className="review-modal__empty">{tr.emptyList}</div>}
            {snapshotRows.map(([key, value], i) => (
              <div key={`${key}-${i}`} className="review-modal__snapshot-row">
                <span className="review-modal__snapshot-key">{key}</span>
                <span className="review-modal__snapshot-value">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="review-modal__foot">
          <button type="button" className="review-modal__close-btn" onClick={onClose}>
            {tr.reviewModalClose}
          </button>
        </div>
      </div>
    </div>
  );
}
