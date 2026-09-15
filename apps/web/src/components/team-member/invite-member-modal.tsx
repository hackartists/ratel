import { useState } from "react";
import { Button, ButtonShape, ButtonStyle } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clear } from "@/components/icons/validations";
import { useInviteMemberI18n } from "./i18n";
import { errorMessage } from "@/lib/server-error";
import { useTeamMemberActions, type FindUserQueryType, type FoundUserResponse, type TeamRole } from "./use-team-members";

// app/ratel/src/features/social/pages/member/components/invite_member_modal.rs
// (`InviteMemberModal`) — the popup content opened from the team settings
// member page: role select, identifier search (Enter), chips, Send.

export interface InviteResult {
  role: TeamRole;
  totalAdded: number;
  failedPks: string[];
}

export interface InviteMemberModalProps {
  teamPk: string;
  username: string;
  onClose: () => void;
  onInvited: (result: InviteResult) => void;
}

/** `detect_query_type` of the popup modal (≥ 8 digits/`+` → phone). */
function detectQueryType(value: string): FindUserQueryType {
  if (value.includes("@")) return "email";
  const isPhone = [...value].every((c) => (c >= "0" && c <= "9") || c === "+");
  if (isPhone && new TextEncoder().encode(value).length >= 8) return "phone-number";
  return "username";
}

export function InviteMemberModal({ teamPk, onClose, onInvited }: InviteMemberModalProps) {
  const tr = useInviteMemberI18n();
  const { findUser, addMembers } = useTeamMemberActions();
  const [roleIndex, setRoleIndex] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState<FoundUserResponse[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const roles: [string, TeamRole][] = [
    [tr.groupAdmin, "admin"],
    [tr.groupMember, "member"],
  ];

  const onSearch = async () => {
    const input = searchValue;
    if (input.trim() === "") return;
    const identifiers = input
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v !== "");
    if (identifiers.length === 0) return;
    // The selection list as the loop sees it (Rust reads the signal each pass).
    let current = selectedUsers;
    for (const identifier of identifiers) {
      setIsSearching(true);
      let user: FoundUserResponse | null = null;
      try {
        user = await findUser(detectQueryType(identifier), identifier);
      } catch {
        user = null;
      }
      setIsSearching(false);
      if (user) {
        const found = user;
        if (!current.some((u) => u.pk === found.pk)) {
          current = [...current, found];
          setSelectedUsers((list) => [...list, found]);
        } else {
          setMessage(`${found.nickname} ${tr.alreadyAdded}`);
        }
      } else {
        setMessage(tr.userNotFound);
      }
    }
    setSearchValue("");
  };

  const onInvite = async () => {
    const role = roles[roleIndex]?.[1] ?? "member";
    if (selectedUsers.length === 0) {
      setMessage(tr.failedInvite);
      return;
    }
    const userPks = selectedUsers.map((u) => u.pk);
    setIsSubmitting(true);
    try {
      const resp = await addMembers(teamPk, userPks, role);
      setIsSubmitting(false);
      onInvited({ role, totalAdded: resp.total_added, failedPks: resp.failed_pks });
      onClose();
    } catch (error) {
      setIsSubmitting(false);
      setMessage(errorMessage(error));
    }
  };

  return (
    <div className="flex flex-col w-tablet min-h-[400px] max-w-[calc(100vw-90px)] min-w-[400px] max-mobile:w-full! max-mobile:max-w-full! max-mobile:min-w-0! gap-5">
      <div className="flex flex-col w-full gap-[10px]">
        <div className="font-bold text-[15px]/[28px] text-modal-label-text">{tr.selectGroup}</div>
        <select
          className="w-full px-4 py-3 rounded-[8px] border border-input-box-border bg-input-box-bg text-text-primary"
          value={roleIndex}
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10);
            if (!Number.isNaN(next)) setRoleIndex(next);
          }}
        >
          {roles.map(([name], idx) => (
            <option key={idx} value={idx}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col w-full">
        <div className="font-bold text-[15px]/[28px] text-modal-label-text">{tr.emailLabel}</div>
        <div className="mt-2.5">
          <Input
            value={searchValue}
            placeholder={tr.emailHint}
            onChange={(e) => setSearchValue(e.target.value)}
            onConfirm={() => void onSearch()}
          />
        </div>
        {isSearching && <div className="text-sm text-foreground-muted mt-2">{tr.searching}</div>}
      </div>

      <div className="flex flex-col w-full gap-[10px]">
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map((user) => (
            <div
              key={user.pk}
              className="flex flex-row w-fit gap-1 justify-start items-center bg-primary rounded-[100px] px-[12px] py-[2px]"
            >
              <div className="font-medium text-btn-primary-text text-[15px]/[24px]">{user.nickname}</div>
              <div
                className="w-fit h-fit"
                onClick={() => setSelectedUsers((list) => list.filter((u) => u.pk !== user.pk))}
              >
                <Clear width="24" height="24" className="w-6 h-6 cursor-pointer [&>path]:stroke-btn-primary-text" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {message !== null && <div className="text-sm text-post-required-marker">{message}</div>}

      <div className="flex flex-col w-full">
        <Button
          buttonStyle={ButtonStyle.Primary}
          shape={ButtonShape.Square}
          className="w-full my-[15px] py-[15px]"
          disabled={selectedUsers.length === 0}
          loading={isSubmitting}
          onClick={() => void onInvite()}
        >
          {tr.send}
        </Button>
      </div>
    </div>
  );
}
