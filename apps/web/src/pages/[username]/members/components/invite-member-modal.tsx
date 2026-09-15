import { useState } from "react";
import {
  errorDisplay,
  useTeamMemberActions,
  type FindUserQueryType,
  type FoundUserResponse,
  type TeamRole,
} from "@/components/team-member/use-team-members";
import { useTeamMemberI18n } from "@/pages/[username]/members/i18n";
import { useToast } from "@/lib/toast";
import { RoleDropdown } from "./role-dropdown";

// The page-local `InviteMemberModal` (app/ratel/src/features/social/pages/member/views/mod.rs):
// an overlay rendered after `.tm-page` with a role dropdown, comma-separated
// identifiers resolved on Enter into chips, and a Send button.

/** `detect_query_type` of this modal: all digits / `+` / `-` / spaces with a digit → phone. */
function detectQueryType(value: string): FindUserQueryType {
  if (value.includes("@")) return "email";
  const chars = Array.from(value);
  const digitLike = chars.filter((c) => (c >= "0" && c <= "9") || c === "+" || c === "-" || c === " ").length;
  // Rust compares the char count with the UTF-8 byte length.
  if (digitLike === new TextEncoder().encode(value).length && chars.some((c) => c >= "0" && c <= "9")) {
    return "phone-number";
  }
  return "username";
}

export interface InviteMemberModalProps {
  teamPk: string;
  onClose: () => void;
  onAdded: () => void;
}

export function InviteMemberModal({ teamPk, onClose, onAdded }: InviteMemberModalProps) {
  const tr = useTeamMemberI18n();
  const toast = useToast();
  const { findUser, addMembers } = useTeamMemberActions();
  const [role, setRole] = useState<TeamRole>("member");
  const [identifier, setIdentifier] = useState("");
  const [selected, setSelected] = useState<FoundUserResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");

  const canSend = selected.length > 0 && !sending;

  const doSearch = async () => {
    const identifiers = identifier
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v !== "");
    if (identifiers.length === 0) return;
    setSearching(true);
    setInfoMsg("");
    const notFound: string[] = [];
    const alreadyAdded: string[] = [];
    let current = selected;
    for (const ident of identifiers) {
      try {
        const user = await findUser(detectQueryType(ident), ident);
        if (current.some((u) => u.pk === user.pk)) {
          alreadyAdded.push(user.nickname);
        } else {
          current = [...current, user];
          setSelected((list) => [...list, user]);
        }
      } catch {
        notFound.push(ident);
      }
    }
    setIdentifier("");
    const parts: string[] = [];
    if (notFound.length > 0) parts.push(`${tr.inviteNotFound} ${notFound.join(", ")}`);
    if (alreadyAdded.length > 0) parts.push(`${tr.inviteAlreadyAdded} ${alreadyAdded.join(", ")}`);
    if (parts.length > 0) setInfoMsg(parts.join(" · "));
    setSearching(false);
  };

  const onSubmit = async () => {
    if (!canSend) return;
    const userPks = selected.map((u) => u.pk);
    setSending(true);
    try {
      await addMembers(teamPk, userPks, role);
      onAdded();
    } catch (error) {
      setInfoMsg(errorDisplay(error));
      toast.error(error);
    }
    setSending(false);
  };

  return (
    <div className="tm-modal-overlay" onClick={onClose}>
      <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tm-modal__header">
          <span className="tm-modal__title">{tr.inviteTitle}</span>
          <button className="tm-modal__close" type="button" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="tm-modal__body">
          <div>
            <label className="tm-field__label">{tr.inviteGroupLabel}</label>
            <RoleDropdown role={role} onChange={setRole} />
          </div>
          <div>
            <label className="tm-field__label" htmlFor="tm-invite-input">
              {tr.inviteInputLabel}
            </label>
            <input
              id="tm-invite-input"
              className="tm-field__input"
              type="text"
              placeholder={tr.inviteInputPlaceholder}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void doSearch();
                }
              }}
            />
            <p className="tm-field__hint">{tr.inviteHint}</p>
            {searching && <p className="tm-field__hint">{tr.inviteSearching}</p>}
          </div>

          {selected.length > 0 && (
            <div className="tm-chip-row">
              {selected.map((user) => (
                <div key={user.pk} className="tm-chip">
                  <span className="tm-chip__name">{user.nickname}</span>
                  <button
                    className="tm-chip__close"
                    type="button"
                    aria-label="Remove"
                    onClick={() => setSelected((list) => list.filter((u) => u.pk !== user.pk))}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {infoMsg !== "" && <p className="tm-modal__error">{infoMsg}</p>}

          <button className="tm-modal__submit" type="button" disabled={!canSend} onClick={() => void onSubmit()}>
            {sending ? tr.inviteSending : tr.inviteSend}
          </button>
        </div>
      </div>
    </div>
  );
}
