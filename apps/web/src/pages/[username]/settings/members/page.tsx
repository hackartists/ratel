import { UserPlus } from "@/components/icons/lucide";
import { InviteMemberModal, type InviteResult } from "@/components/team-member/invite-member-modal";
import { MoreElement, useSentinelKey } from "@/components/team-member/more-element";
import { Button, ButtonShape, ButtonSize, ButtonStyle } from "@/components/ui/button";
import { ScrollArea, ScrollDirection } from "@/components/ui/scroll-area";
import { useRouteUsername } from "@/components/social/use-wall-context";
import { useTeamSettingsI18n } from "@/i18n/generated/features/social/pages/setting/team/views/team-settings.i18n";
import { PopupProvider, PopupZone, usePopup } from "@/lib/popup";
import { MemberRow } from "./components/member-row";
import { useManagementPage } from "./hooks/use-management-page";

// app/ratel/src/features/social/pages/setting/team/views/management_page.rs
// (`ManagementPage`, route `TeamSettingMember`, `/:username/settings/members`).
// Like Rust it installs its own popup service and renders a `PopupZone` right
// after the page, so the invite modal opens in this page-scoped zone.
export function Component() {
  const username = useRouteUsername();
  return (
    <PopupProvider>
      <ManagementPage key={username} username={username} />
      <PopupZone />
    </PopupProvider>
  );
}

function ManagementPage({ username }: { username: string }) {
  const tr = useTeamSettingsI18n();
  const popup = usePopup();
  const page = useManagementPage(username);
  const sentinelKey = useSentinelKey();
  const { list, canManage, teamPk } = page;
  const members = list.items;

  const onAddMembersClick = () => {
    popup.open(
      <InviteMemberModal
        teamPk={teamPk}
        username={username}
        onClose={() => popup.close()}
        onInvited={(result: InviteResult) => {
          if (result.totalAdded > 0) list.refresh();
        }}
      />,
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-text-primary">{tr.teamManagement}</h1>
        {canManage && (
          <Button
            buttonStyle={ButtonStyle.Primary}
            shape={ButtonShape.Rounded}
            size={ButtonSize.Small}
            className="flex gap-2 items-center"
            onClick={onAddMembersClick}
          >
            <UserPlus className="w-4 h-4 [&>path]:stroke-btn-primary-text [&>line]:stroke-btn-primary-text" />
            {tr.addMembers}
          </Button>
        )}
      </div>

      {page.errorMsg !== null && (
        <div className="py-3 px-4 text-sm border rounded-[10px] border-destructive bg-destructive/10 text-destructive">{page.errorMsg}</div>
      )}

      <div className="flex flex-col border rounded-[10px] border-border">
        <div className="py-3 px-4 border-b border-border">
          <span className="text-sm font-semibold text-text-primary">{`${tr.members} (${members.length})`}</span>
        </div>

        {/* Rust passes `class: "flex flex-col max-h-[540px]"`, but dioxus_primitives'
            ScrollArea sets its own `class` before spreading `..attributes`, so the
            spread class is dropped and only `scroll-area-auto-hide` renders. */}
        <ScrollArea direction={ScrollDirection.Vertical}>
          {members.map((member, idx) => (
            <MemberRow
              key={member.user_id}
              member={member}
              isLast={idx === members.length - 1}
              canManage={canManage}
              isSelf={page.currentUserPk === member.user_id}
              onRemove={() => void page.removeMember(member.user_id)}
              onChangeRole={(userId, role) => void page.changeRole(userId, role)}
            />
          ))}

          {members.length === 0 && !list.isLoading && (
            <div className="py-8 px-4 text-sm text-center text-foreground-muted">{tr.noMembers}</div>
          )}

          <MoreElement hasMore={list.hasMore} loading={list.isLoading} onNext={list.next} sentinelKey={sentinelKey} />
        </ScrollArea>
      </div>
    </div>
  );
}
