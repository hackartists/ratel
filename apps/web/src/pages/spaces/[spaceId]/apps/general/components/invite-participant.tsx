import type { SpaceInvitationListItem, UserPartition } from "@ratel/ts-bridges";
import { useState } from "react";
import { MoreElement } from "@/components/ui/more-element";
import { useEnumI18n } from "@/i18n/generated/enums.i18n";
import { useGeneralI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/general/general.i18n";
import { useToast } from "@/lib/toast";
import { useSpaceGeneralSettings } from "../hooks/use-space-general-settings";
import { inviteInitials, normalizeEmailInputs } from "./format";
import { CloseX } from "./icons";

// general/views/home/invite_participant.rs — email field (Enter queues, Invite
// sends the queue plus the field), the queued chips, and the paginated list of
// invited accounts with a remove button each.
export function InviteParticipant() {
  const tr = useGeneralI18n();
  const enumText = useEnumI18n();
  const toast = useToast();
  const { invitations, sendInvitations, deleteInvitation } = useSpaceGeneralSettings();

  const [emailInput, setEmailInput] = useState("");
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);

  const invitePending = sendInvitations.pending;
  const invalidEmail = () => toast.error(new Error(enumText("Error", "InvalidEmail")));

  return (
    <section className="sga-section" data-testid="section-invite">
      <div className="sga-section__head">
        <span className="sga-section__label">{tr.inviteParticipant}</span>
        <span className="sga-section__hint">Send email invitations to join this space</span>
      </div>

      <div className="sga-field">
        <span className="sga-field__label">{tr.emailAddress}</span>
        <div className="sga-input-group">
          <input
            className="sga-input"
            type="email"
            placeholder={tr.emailPlaceholder}
            value={emailInput}
            data-testid="invite-email-input"
            onChange={(e) => setEmailInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.stopPropagation();
              const parsed = normalizeEmailInputs(emailInput);
              if (parsed === null) {
                invalidEmail();
                return;
              }
              setInvitedEmails((emails) => {
                const next = [...emails];
                for (const email of parsed) if (!next.includes(email)) next.push(email);
                return next;
              });
              setEmailInput("");
            }}
          />
          <button
            type="button"
            className="sga-btn sga-btn--accent"
            data-testid="invite-send-btn"
            disabled={invitePending}
            onClick={() => {
              const emails = [...invitedEmails];
              if (emailInput.trim() !== "") {
                const parsed = normalizeEmailInputs(emailInput);
                if (parsed === null) {
                  invalidEmail();
                  return;
                }
                for (const email of parsed) if (!emails.includes(email)) emails.push(email);
              }
              if (emails.length === 0) return;
              setInvitedEmails([]);
              setEmailInput("");
              sendInvitations.call(emails);
            }}
          >
            {invitePending ? tr.inviting : tr.invite}
          </button>
        </div>
      </div>

      {invitedEmails.length > 0 && (
        <div className="sga-creator-row" data-testid="invite-queue">
          {invitedEmails.map((value, idx) => (
            <InviteEmailChip
              key={`${idx}-${value}`}
              value={value}
              onRemove={() => setInvitedEmails((emails) => emails.filter((_, i) => i !== idx))}
            />
          ))}
        </div>
      )}

      <div className="sga-field">
        <span className="sga-field__label">{tr.invitedAccounts}</span>
        <div className="sga-creator-row" data-testid="invite-list">
          {invitations.items.length === 0 && invitations.isLoading ? (
            <div className="sga-empty">{tr.loadingInvitations}</div>
          ) : invitations.items.length === 0 ? (
            <div className="sga-empty">{tr.noInvitedAccounts}</div>
          ) : (
            invitations.items.map((item) => (
              <InvitedAccountChip key={item.user_id} item={item} onRemove={(userId) => deleteInvitation.call(userId)} />
            ))
          )}
        </div>
        <div>
          <MoreElement hasMore={invitations.hasMore} loading={invitations.isLoading} onNext={invitations.next} />
        </div>
      </div>
    </section>
  );
}

export function InviteEmailChip({ value, onRemove }: { value: string; onRemove: () => void }) {
  return (
    <div className="sga-creator-chip">
      <span className="sga-creator-chip__avatar">{inviteInitials(value, value)}</span>
      <span className="sga-creator-chip__name">{value}</span>
      <button type="button" className="sga-creator-chip__x" onClick={onRemove}>
        <CloseX />
      </button>
    </div>
  );
}

/** `InvitationStatus` is `serde_repr`: Pending 1, Invited 2, Accepted 3, Declined 4. */
function statusRole(status: number): { className: string; text: string } {
  if (status === 3) return { className: "sga-creator-chip__role sga-creator-chip__role--admin", text: "Accepted" };
  if (status === 4) return { className: "sga-creator-chip__role", text: "Declined" };
  return { className: "sga-creator-chip__role sga-creator-chip__role--pending", text: "Pending" };
}

function InvitedAccountChip({
  item,
  onRemove,
}: {
  item: SpaceInvitationListItem;
  onRemove: (userId: UserPartition) => void;
}) {
  const initials = inviteInitials(item.display_name, item.email);
  const nameDisplay = item.display_name.trim() === "" ? item.email : item.display_name;
  const role = statusRole(item.status);

  return (
    <div className="sga-creator-chip">
      {item.profile_url.trim() === "" ? (
        <span className="sga-creator-chip__avatar">{initials}</span>
      ) : (
        <span className="sga-creator-chip__avatar">
          <img src={item.profile_url} alt={nameDisplay} />
        </span>
      )}
      <span className="sga-creator-chip__name">{nameDisplay}</span>
      <span className={role.className}>{role.text}</span>
      <button type="button" className="sga-creator-chip__x" onClick={() => onRemove(item.user_id)}>
        <CloseX />
      </button>
    </div>
  );
}
