import { useAdminLiteralsI18n } from "../admin-literals.i18n";
import { useModerationFlags } from "../hooks/use-admin-main";
import { MoreElement } from "./more-element";

// Comment moderation queue of `AdminMainPage` (admin/views/main/mod.rs):
// users flagged `PendingReview`, paged 50 at a time.
export function ModerationSection() {
  const lit = useAdminLiteralsI18n();
  const { list, block, dismiss } = useModerationFlags();
  const flags = list.items;

  return (
    <section className="admin-arena__section">
      <div className="admin-arena__section-head">
        <span className="admin-arena__section-title">{lit.text("moderation_title")}</span>
      </div>
      <p className="admin-arena__section-description">{lit.text("moderation_description")}</p>
      <table className="admin-arena__table">
        <thead>
          <tr>
            <th>{lit.text("moderation_col_user")}</th>
            <th>{lit.text("moderation_col_reports")}</th>
            <th className="text-right">{lit.text("moderation_col_action")}</th>
          </tr>
        </thead>
        <tbody>
          {flags.length === 0 ? (
            <tr>
              <td className="admin-arena__table-empty" colSpan={3}>
                {lit.text("moderation_empty")}
              </td>
            </tr>
          ) : (
            flags.map((flag) => {
              const userId = flag.user_pk.startsWith("USER#") ? flag.user_pk.slice("USER#".length) : flag.user_pk;
              return (
                <tr key={flag.user_pk}>
                  <td>
                    <div>{flag.display_name}</div>
                    <div style={{ color: "#888", fontSize: "12px" }}>{`@${flag.username}`}</div>
                  </td>
                  <td>{flag.report_count}</td>
                  <td className="text-right">
                    <button
                      className="admin-arena__table-link"
                      style={{ color: "#ef4444", marginRight: "12px" }}
                      type="button"
                      onClick={() => void block(userId)}
                    >
                      {lit.text("moderation_block")}
                    </button>
                    <button className="admin-arena__table-link" type="button" onClick={() => void dismiss(userId)}>
                      {lit.text("moderation_dismiss")}
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <MoreElement
        hasMore={list.hasMore}
        isLoading={list.isFetchingNextPage}
        onNext={() => {
          if (!list.isFetchingNextPage) void list.fetchNextPage();
        }}
      />
    </section>
  );
}
