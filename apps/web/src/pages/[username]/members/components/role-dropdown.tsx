import { useState } from "react";
import type { TeamRole } from "@/components/team-member/use-team-members";
import { useTeamMemberI18n } from "@/pages/[username]/members/i18n";
import { dataBool } from "@/lib/dom";

// `RoleDropdown` (app/ratel/src/features/social/pages/member/views/mod.rs):
// the invite modal's Admin / Member picker with a click-away backdrop.

function Check() {
  return (
    <svg className="tm-role-dd__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function RoleDropdown({ role, onChange }: { role: TeamRole; onChange: (role: TeamRole) => void }) {
  const tr = useTeamMemberI18n();
  const [open, setOpen] = useState(false);
  const label = role === "member" ? tr.inviteRoleMember : tr.inviteRoleAdmin;

  return (
    <div className="tm-role-dd">
      <button
        className="tm-role-dd__trigger"
        type="button"
        aria-expanded={dataBool(open)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="tm-role-dd__value">{label}</span>
        <svg className="tm-role-dd__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 5 }} onClick={() => setOpen(false)} />
          <div className="tm-role-dd__menu" role="menu">
            <button
              className="tm-role-dd__item"
              type="button"
              onClick={() => {
                onChange("admin");
                setOpen(false);
              }}
            >
              <span>{tr.inviteRoleAdmin}</span>
              {role === "admin" && <Check />}
            </button>
            <button
              className="tm-role-dd__item"
              type="button"
              onClick={() => {
                onChange("member");
                setOpen(false);
              }}
            >
              <span>{tr.inviteRoleMember}</span>
              {role === "member" && <Check />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
