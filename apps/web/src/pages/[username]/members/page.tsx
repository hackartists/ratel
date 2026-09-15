import { MoreElement, useSentinelKey } from "@/components/team-member/more-element";
import { isAdminOrOwner, useTeamMemberPermissionResult } from "@/components/team-member/use-team-members";
import { TeamArenaTab, useTeamArena, useTeamArenaTab } from "@/components/social/team-arena-context";
import { useTeamMemberI18n } from "@/i18n/generated/features/social/pages/member/views/team-member.i18n";
import { useToast } from "@/lib/toast";
import { InviteMemberModal } from "./components/invite-member-modal";
import { MemberCard } from "./components/member-card";
import { RoleTab } from "./components/role-tab";
import { ViewerPage } from "./components/viewer-page";
import { useTeamMemberPage } from "./hooks/use-team-member-page";

// app/ratel/src/features/social/pages/member/views/mod.rs (`Home`, route
// `TeamMember`, `/:username/members`) — the team arena's member management
// page: section label, header with Add Member, search + role tabs, member
// cards with a role/remove menu, and the inline invite modal.
export function Component() {
  // `useTeamArena()` panics (throws) unless the wall is a team, matching
  // Rust's `use_team_arena()` — and syncs the arena topbar's active tab.
  const { username } = useTeamArena();
  useTeamArenaTab(TeamArenaTab.Members);
  const permission = useTeamMemberPermissionResult(username);
  if (!permission.ok) return <ViewerPage username={username} />;
  return (
    <TeamMemberHome
      key={`${username}:${permission.data.team_pk}`}
      teamPk={permission.data.team_pk}
      canEdit={isAdminOrOwner(permission.data.role)}
    />
  );
}

function TeamMemberHome({ teamPk, canEdit }: { teamPk: string; canEdit: boolean }) {
  const tr = useTeamMemberI18n();
  const toast = useToast();
  const page = useTeamMemberPage(teamPk);
  const sentinelKey = useSentinelKey();
  const { list } = page;

  return (
    <>
      <div className="tm-section-label">
        <span className="tm-section-label__dash" />
        <span className="tm-section-label__title">
          {"Team "}
          <strong>{tr.membersLabel}</strong>
        </span>
        <span className="tm-section-label__dash" />
      </div>

      <div className="tm-page" onClick={page.closeMenu}>
        <div className="tm-page-header">
          <div className="tm-page-header__left">
            <h1 className="tm-page-header__title">{tr.teamManagement}</h1>
            <span className="tm-page-header__sub">
              <strong>{page.total}</strong>
              {` ${tr.membersSubhead}`}
            </span>
          </div>
          {canEdit && (
            <button
              className="tm-btn-primary"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                page.setInviteOpen(true);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              {tr.addMemberBtn}
            </button>
          )}
        </div>

        <div className="tm-filter-bar">
          <div className="tm-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="tm-search-input"
              type="text"
              placeholder={tr.searchPlaceholder}
              value={page.search}
              onChange={(e) => page.setSearch(e.target.value)}
            />
          </div>
          <div className="tm-role-tabs">
            <RoleTab label={tr.filterAll} count={page.total} active={page.roleFilter === "All"} onClick={() => page.setRoleFilter("All")} />
            <RoleTab
              label={tr.filterOwner}
              count={page.ownerCount}
              active={page.roleFilter === "Owner"}
              onClick={() => page.setRoleFilter("Owner")}
            />
            <RoleTab
              label={tr.filterAdmin}
              count={page.adminCount}
              active={page.roleFilter === "Admin"}
              onClick={() => page.setRoleFilter("Admin")}
            />
            <RoleTab
              label={tr.filterMember}
              count={page.memberCount}
              active={page.roleFilter === "Member"}
              onClick={() => page.setRoleFilter("Member")}
            />
          </div>
        </div>

        {page.filtered.length === 0 ? (
          <div className="tm-empty-state">
            <div className="tm-empty-state__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <div className="tm-empty-state__title">{tr.emptyTitle}</div>
            <div className="tm-empty-state__desc">{tr.emptyDesc}</div>
            {/* Search filters the loaded pages only; keep paging while matches may still be unloaded. */}
            <MoreElement hasMore={list.hasMore} loading={list.isLoading} onNext={list.next} sentinelKey={sentinelKey} />
          </div>
        ) : (
          <div className="tm-members-grid">
            {page.filtered.map((member) => (
              <MemberCard
                key={member.user_id}
                member={member}
                teamPk={teamPk}
                canEdit={canEdit}
                menuOpen={page.openMenuPk === member.user_id}
                onToggleMenu={page.toggleMenu}
                onChanged={list.refresh}
              />
            ))}
            <MoreElement hasMore={list.hasMore} loading={list.isLoading} onNext={list.next} sentinelKey={sentinelKey} />
          </div>
        )}
      </div>

      {page.inviteOpen && (
        <InviteMemberModal
          teamPk={teamPk}
          onClose={() => page.setInviteOpen(false)}
          onAdded={() => {
            page.setInviteOpen(false);
            list.refresh();
            toast.info(tr.inviteSuccess);
          }}
        />
      )}
    </>
  );
}
