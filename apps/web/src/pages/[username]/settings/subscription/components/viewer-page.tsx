import { useTeamSettingsI18n } from "@/i18n/generated/features/social/pages/setting/team/views/team-settings.i18n";

// app/ratel/src/features/social/pages/setting/team/views/viewer_page.rs — shown
// to non-admins of the team subscription page.
export function ViewerPage({ username }: { username: string }) {
  const tr = useTeamSettingsI18n();
  return (
    <div className="flex flex-col justify-center items-center py-10 w-full h-full text-center">
      <h1 className="text-2xl font-bold text-text-primary">{tr.noPermissionTitle}</h1>
      <p className="mt-2 text-text-secondary">{tr.noPermissionDescription}</p>
      <p className="mt-2 text-gray-400">{`team: ${username}`}</p>
    </div>
  );
}
