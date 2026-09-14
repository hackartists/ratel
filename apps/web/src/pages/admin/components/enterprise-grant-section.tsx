import { useState } from "react";
import type { MembershipGrantTargetType } from "@ratel/ts-bridges";
import { useAdminRewardsI18n } from "@/i18n/generated/features/admin/views/main/admin-rewards.i18n";
import { displayError, formatWithCommas } from "../hooks/format";
import { useEnterpriseMemberships } from "../hooks/use-admin-main";
import { MoreElement } from "./more-element";

// Enterprise membership grant section of `AdminMainPage`
// (admin/views/main/mod.rs): the grant form and the granted list.
export function EnterpriseGrantSection() {
  const tr = useAdminRewardsI18n();
  const { list, grant } = useEnterpriseMemberships();
  const [targetType, setTargetType] = useState<MembershipGrantTargetType>("user");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<[string, boolean] | null>(null);

  const onGrant = async () => {
    const name = username.trim();
    if (name === "") {
      setMessage([tr.usernamePlaceholder, false]);
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await grant({ username: name, targetType });
      setSubmitting(false);
      setMessage([tr.grantSuccess, true]);
      setUsername("");
    } catch (err) {
      setSubmitting(false);
      console.error("Failed to grant enterprise membership:", err);
      setMessage([`${tr.grantFailed}: ${displayError(err)}`, false]);
    }
  };

  const memberships = list.items;

  return (
    <section className="admin-arena__section">
      <div className="admin-arena__section-head">
        <span className="admin-arena__section-title">{tr.enterpriseTitle}</span>
      </div>
      <p className="admin-arena__section-description">{tr.enterpriseDescription}</p>

      <div className="admin-arena__grant-grid">
        <div className="admin-arena__form-field">
          <label className="admin-arena__form-label">{tr.targetType}</label>
          <select
            className="admin-arena__form-select"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value === "team" ? "team" : "user")}
          >
            <option value="user">{tr.targetUser}</option>
            <option value="team">{tr.targetTeam}</option>
          </select>
        </div>

        <div className="admin-arena__form-field">
          <label className="admin-arena__form-label">{tr.username}</label>
          <input
            className="admin-arena__form-input"
            type="text"
            value={username}
            placeholder={tr.usernamePlaceholder}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <button className="admin-arena__btn" type="button" disabled={submitting} onClick={() => void onGrant()}>
          {tr.grantEnterprise}
        </button>
      </div>

      {message !== null && (
        <p
          className={
            message[1] ? "admin-arena__status admin-arena__status--ok mt-4" : "admin-arena__status admin-arena__status--err mt-4"
          }
        >
          {message[0]}
        </p>
      )}

      <div className="admin-arena__subsection">
        <h3 className="admin-arena__subsection-title">{tr.enterpriseGrantedList}</h3>

        {memberships.length === 0 ? (
          list.isFetchingNextPage ? (
            <div className="admin-arena__table-empty">{tr.loading}</div>
          ) : (
            <div className="admin-arena__table-empty">{tr.enterpriseGrantedEmpty}</div>
          )
        ) : (
          <>
            <div className="admin-arena__table-wrap">
              <table className="admin-arena__table">
                <thead>
                  <tr>
                    <th>{tr.targetType}</th>
                    <th>{tr.username}</th>
                    <th>{tr.grantedCredits}</th>
                    <th>{tr.maxCredit}</th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((item) => (
                    <tr key={item.username}>
                      <td>{item.targetType === "team" ? tr.targetTeam : tr.targetUser}</td>
                      <td>{item.username}</td>
                      <td>{formatWithCommas(item.remainingCredits)}</td>
                      <td>{formatWithCommas(item.maxCreditsPerSpace)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {list.hasMore && (
              <MoreElement
                hasMore={list.hasMore}
                isLoading={list.isFetchingNextPage}
                onNext={() => {
                  if (!list.isFetchingNextPage) void list.fetchNextPage();
                }}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
