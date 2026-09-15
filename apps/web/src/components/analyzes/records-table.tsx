import type { AnalyzeFilterSource, AnalyzeRecordRow } from "@ratel/ts-bridges";
import { useSpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/records/component.rs
// `RecordsTable` + `UserCell` — shared by the records page and the CREATE
// wizard's preview card. Header and body are two `<table>`s inside the wrap
// so the body can scroll under a pinned header.

export function RecordsTable({ source, rows }: { source: AnalyzeFilterSource; rows: AnalyzeRecordRow[] }) {
  const tr = useSpaceAnalyzesAppI18n();
  if (rows.length === 0) return null;
  const choice = source === "poll" || source === "quiz";

  return (
    <div className="records-table-wrap" data-source={source}>
      <div className="records-table-header">
        <table className="records-table">
          <thead>
            <tr>
              <th>{tr.recordsColUser}</th>
              {choice ? (
                <>
                  <th>{tr.recordsColQuestion}</th>
                  <th>{tr.recordsColAnswer}</th>
                </>
              ) : source === "discussion" ? (
                <>
                  <th>{tr.recordsColPostTitle}</th>
                  <th>{tr.recordsColComment}</th>
                </>
              ) : (
                <th>{tr.recordsColTarget}</th>
              )}
            </tr>
          </thead>
        </table>
      </div>
      <div className="records-table-body">
        <table className="records-table">
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`rec-${idx}`}>
                <td>
                  <UserCell
                    displayName={row.user_display_name}
                    username={row.user_username}
                    profileUrl={row.user_profile_url}
                    fallbackPk={row.user_pk}
                  />
                </td>
                {choice ? (
                  <>
                    <td>{row.question_text}</td>
                    <td>{row.answer_text}</td>
                  </>
                ) : source === "discussion" ? (
                  <>
                    <td>{row.post_title}</td>
                    <td>{row.comment_text}</td>
                  </>
                ) : (
                  <td>
                    <UserCell
                      displayName={row.target_display_name}
                      username={row.target_username}
                      profileUrl=""
                      fallbackPk={row.target_pk}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UserCell({
  displayName,
  username,
  profileUrl,
  fallbackPk,
}: {
  displayName: string;
  username: string;
  profileUrl: string;
  fallbackPk: string;
}) {
  let name: string;
  if (displayName !== "") name = displayName;
  else if (username !== "") name = username;
  else {
    // Last resort: a truncated pk so the row never reads as anonymous.
    const trimmed = fallbackPk.split("#").pop() ?? fallbackPk;
    name = trimmed.length > 8 ? `${trimmed.slice(0, 8)}…` : trimmed;
  }
  const handle = username !== "" ? `@${username}` : "";
  const first = Array.from(name)[0];
  const initial = first === undefined ? "" : first.toUpperCase();

  return (
    <div className="records-cell-user">
      {profileUrl !== "" ? (
        <img className="records-avatar" src={profileUrl} alt="" />
      ) : (
        <span className="records-avatar-fallback">{initial}</span>
      )}
      <span className="records-user-meta">
        <span className="records-user-name">{name}</span>
        {handle !== "" && <span className="records-user-handle">{handle}</span>}
      </span>
    </div>
  );
}
