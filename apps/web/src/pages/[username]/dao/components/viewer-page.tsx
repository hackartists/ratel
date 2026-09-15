import { useTeamDaoI18n } from "@/i18n/generated/features/social/pages/dao/views/team-dao.i18n";

// app/ratel/src/features/social/pages/dao/views/viewer_page.rs (`ViewerPage`).
export function ViewerPage({ username }: { username: string }) {
  const tr = useTeamDaoI18n();
  return (
    <div className="flex flex-col w-full max-w-[1152px] items-center justify-center min-h-[400px]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary mb-2">{tr.adminOnly}</h2>
        <p className="text-text-secondary">{tr.adminOnlyDescription}</p>
        <p className="mt-2 text-text-tertiary text-sm">{username}</p>
      </div>
    </div>
  );
}
