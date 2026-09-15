import { useState } from "react";
import { useGeneralI18n } from "@/pages/spaces/[spaceId]/apps/general/i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { useSpaceGeneralSettings } from "../hooks/use-space-general-settings";
import { normalizeIdentifierInputs, wordInitials } from "./format";
import { CloseX } from "./icons";
import { InviteEmailChip } from "./invite-participant";

// general/views/home/administrators.rs — for the creator: an identifier field
// (Enter queues, Add Admin submits), the queued chips; for everyone: the
// current admins, each non-owner removable.
export function Administrators() {
  const tr = useGeneralI18n();
  const { role } = useSpaceAppsContext();
  const { admins, addAdmins, removeAdmin } = useSpaceGeneralSettings();

  const [identifierInput, setIdentifierInput] = useState("");
  const [queuedIdentifiers, setQueuedIdentifiers] = useState<string[]>([]);

  const isAdminRole = role === "Creator";
  const addPending = addAdmins.pending;

  return (
    <section className="sga-section" data-testid="section-administrators">
      <div className="sga-section__head">
        <span className="sga-section__label">{tr.administrator}</span>
        <span className="sga-section__hint">Users with admin access to this space</span>
      </div>

      {isAdminRole && (
        <>
          <div className="sga-field">
            <span className="sga-field__label">{tr.addAdmin}</span>
            <div className="sga-input-group">
              <input
                className="sga-input"
                type="text"
                placeholder={tr.enterUsername}
                value={identifierInput}
                data-testid="admin-identifier-input"
                onChange={(e) => setIdentifierInput(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.stopPropagation();
                  const parsed = normalizeIdentifierInputs(identifierInput);
                  if (parsed.length === 0) return;
                  setQueuedIdentifiers((values) => {
                    const next = [...values];
                    for (const value of parsed) if (!next.includes(value)) next.push(value);
                    return next;
                  });
                  setIdentifierInput("");
                }}
              />
              <button
                type="button"
                className="sga-btn sga-btn--accent"
                data-testid="admin-add-btn"
                disabled={addPending || (queuedIdentifiers.length === 0 && identifierInput.trim() === "")}
                onClick={() => {
                  const targets = [...queuedIdentifiers];
                  for (const value of normalizeIdentifierInputs(identifierInput)) {
                    if (!targets.includes(value)) targets.push(value);
                  }
                  if (targets.length === 0) return;
                  setQueuedIdentifiers([]);
                  setIdentifierInput("");
                  addAdmins.call(targets);
                }}
              >
                {tr.addAdmin}
              </button>
            </div>
          </div>

          {queuedIdentifiers.length > 0 && (
            <div className="sga-creator-row" data-testid="admin-queue">
              {queuedIdentifiers.map((value, idx) => (
                <InviteEmailChip
                  key={`q-${idx}-${value}`}
                  value={value}
                  onRemove={() => setQueuedIdentifiers((values) => values.filter((_, i) => i !== idx))}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="sga-field">
        <span className="sga-field__label">Current admins</span>
        {admins.length === 0 ? (
          <div className="sga-empty">{tr.administratorNotFound}</div>
        ) : (
          <div className="sga-creator-row" data-testid="admin-list">
            {admins.map((admin) => (
              <AdminChip
                key={admin.user_id}
                name={admin.display_name}
                username={admin.username}
                profileUrl={admin.profile_url}
                isOwner={admin.is_owner}
                onRemove={() => removeAdmin.call(admin.user_id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AdminChip({
  name,
  username,
  profileUrl,
  isOwner,
  onRemove,
}: {
  name: string;
  username: string;
  profileUrl: string;
  isOwner: boolean;
  onRemove: () => void;
}) {
  const tr = useGeneralI18n();
  const roleClass = isOwner ? "sga-creator-chip__role" : "sga-creator-chip__role sga-creator-chip__role--admin";

  return (
    <div className="sga-creator-chip">
      {profileUrl.trim() === "" ? (
        <span className="sga-creator-chip__avatar">{wordInitials(name)}</span>
      ) : (
        <span className="sga-creator-chip__avatar">
          <img src={profileUrl} alt={name} />
        </span>
      )}
      <span className="sga-creator-chip__name">{name.trim() === "" ? `@${username}` : name}</span>
      <span className={roleClass}>{isOwner ? tr.owner : tr.admin}</span>
      {!isOwner && (
        <button type="button" className="sga-creator-chip__x" onClick={onRemove}>
          <CloseX />
        </button>
      )}
    </div>
  );
}
