import { useViewerPageI18n } from "@/i18n/generated/features/social/pages/member/views/viewer-page.i18n";

// app/ratel/src/features/social/pages/member/views/viewer_page.rs (`ViewerPage`) —
// shown when the member permission can't be loaded.
export function ViewerPage({ username }: { username: string }) {
  const tr = useViewerPageI18n();
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-2">
      <h1 className="text-2xl font-bold text-text-primary">{tr.noPermission}</h1>
      <p className="text-foreground-muted">{tr.noPermissionDesc}</p>
      <p className="text-foreground-muted">{`${tr.teamPrefix} ${username}`}</p>
    </div>
  );
}
