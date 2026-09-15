// app/ratel/src/features/social/pages/draft/team/views/viewer_page.rs (`ViewerPage`).
// Rust hardcodes these strings outside translate! (viewer_page.rs:7-9).
const NO_PERMISSION = "No permission";
const NO_PERMISSION_DESC = "You do not have permission to view team drafts.";

export function ViewerPage({ username }: { username: string }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full py-10 text-center">
      <h1 className="text-2xl font-bold text-text-primary">{NO_PERMISSION}</h1>
      <p className="mt-2 text-text-secondary">{NO_PERMISSION_DESC}</p>
      <p className="mt-2 text-gray-400">{`team: ${username}`}</p>
    </div>
  );
}
