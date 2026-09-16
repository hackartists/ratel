import { useEffect, useState } from "react";
import type { MembershipGrantTargetType } from "@ratel/ts-bridges";
import { useAdminRewardsI18n } from "./i18n";
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

  // The list pages user grants first and team grants second, so with no user
  // grants the first page comes back empty and every team sits on the next
  // one. Pull it in instead of waiting for the 1px scroll sentinel, which the
  // reader never reaches while the table shows nothing.
  useEffect(() => {
    if (memberships.length === 0 && list.hasMore && !list.isFetching) void list.fetchNextPage();
  }, [memberships.length, list.hasMore, list.isFetching, list.fetchNextPage]);

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

        {/* The list API pages user grants first and team grants second, so the
            first page can be empty while `hasMore` still points at the team
            phase. Keep loading instead of showing "none granted". */}
        {memberships.length === 0 ? (
          list.isFetching || list.hasMore ? (
            <div className="admin-arena__table-empty">{tr.loading}</div>
          ) : (
            <div className="admin-arena__table-empty">{tr.enterpriseGrantedEmpty}</div>
          )
        ) : (
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
        )}

        {list.hasMore && (
          // `isFetching`, not `isFetchingNextPage`: granting refreshes the
          // first page, which drops the loaded team page. Only a fetch the
          // sentinel can see makes it re-arm and load the team phase again —
          // otherwise a team granted while no user grants exist never appears.
          <MoreElement
            hasMore={list.hasMore}
            isLoading={list.isFetching}
            onNext={() => {
              if (!list.isFetching) void list.fetchNextPage();
            }}
          />
        )}
      </div>
    </section>
  );
}
