import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, FileText, Hash, Lock, Search, TriangleAlert, Users, X } from "@/components/icons/lucide";
import { MoreElement } from "@/components/ui/more-element";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useSubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";
import { useFindTeam } from "@ratel/ts-bridges/hooks";
import { DirectAnnouncementCard } from "./components/direct-announcement-card";
import { formatLastActive, useSubTeamActivity } from "./hooks/use-sub-team-activity";

// app/ratel/src/features/sub_team/pages/detail/component.rs
// (`TeamSubTeamDetailPage`, `/:username/sub-teams/:subTeamId`) — parent-admin
// activity dashboard for one recognized sub-team. `:username` is the PARENT.
export function Component() {
  const t = useSubTeamI18n();
  const { username = "", subTeamId = "" } = useParams<{ username: string; subTeamId: string }>();

  // This route is declared OUTSIDE SocialLayout in both apps (route.rs:274,
  // route-tree.ts) — no shared wall/team context is mounted here, so Rust
  // also loads the team locally via `find_team_handler`.
  const teamQuery = useFindTeam(username);
  if (teamQuery.data === undefined) return null;
  const teamId = teamQuery.data.pk.replace(/^TEAM#/, "");

  return (
    <>
      <SeoMeta title={`Sub-team · ${t.tabSubTeams}`} />
      <DetailView username={username} subTeamId={subTeamId} teamId={teamId} />
    </>
  );
}

function DetailView({ username, subTeamId, teamId }: { username: string; subTeamId: string; teamId: string }) {
  const t = useSubTeamI18n();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const ctx = useSubTeamActivity(teamId, subTeamId);
  const [memberSearch, setMemberSearch] = useState("");

  if (!ctx.ready) return null;

  const overview = ctx.detail;
  const displayName = overview.display_name;
  const handle = overview.username;
  const isKo = i18n.language.startsWith("ko");
  const privacyNoticeText = isKo ? overview.privacy_notice.ko : overview.privacy_notice.en;

  const initials = displayName.slice(0, 2).toUpperCase();
  const query = memberSearch.toLowerCase();
  const memberRows = ctx.members.items.filter(
    (m) => query === "" || m.handle.toLowerCase().includes(query) || m.display_name.toLowerCase().includes(query),
  );

  return (
    <div className="sub-team-detail">
      <div className="arena-topbar">
        <div className="arena-topbar__brand">
          <div className="brand-home" aria-label="Back" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4 [&>path]:stroke-current" />
          </div>
          <span className="brand-home__divider" />
          <div className="arena-topbar__logo arena-topbar__logo--child">{initials}</div>
          <div className="u-col">
            <span className="arena-topbar__title arena-topbar__title--child">{displayName}</span>
            <span className="arena-topbar__handle">@{handle}</span>
          </div>
          <span className="arena-topbar__status arena-topbar__status--active">Active</span>
        </div>
      </div>

      <div className="page page--wide">
        <div className="team-hero">
          <div className="avatar avatar--lg avatar--teal">{initials}</div>
          <div className="team-hero__main">
            <div className="team-hero__title">{displayName}</div>
            <div className="team-hero__handle">@{handle}</div>
          </div>
        </div>

        <div className="metric-grid">
          <div className="metric metric--posts">
            <div className="metric__label">
              <FileText className="w-3 h-3 [&>path]:stroke-current" />
              {t.postCount}
            </div>
            <div className="metric__value" id="m-posts" data-testid="sub-team-detail-post-count">
              {overview.post_count}
            </div>
          </div>
          <div className="metric metric--spaces">
            <div className="metric__label">
              <Hash className="w-3 h-3 [&>path]:stroke-current" />
              {t.spaceCount}
            </div>
            <div className="metric__value" id="m-spaces" data-testid="sub-team-detail-space-count">
              {overview.space_count}
            </div>
          </div>
          <div className="metric metric--members">
            <div className="metric__label">
              <Users className="w-3 h-3 [&>path]:stroke-current" />
              {t.activeMemberCount}
            </div>
            <div className="metric__value" id="m-members" data-testid="sub-team-detail-active-members">
              {overview.active_member_count}
            </div>
          </div>
        </div>

        <div className="notice notice--teal" data-testid="sub-team-detail-privacy-notice">
          <div className="notice__icon">
            <Lock className="w-4 h-4 [&>path]:stroke-current" />
          </div>
          <div className="notice__body">
            <span className="notice__title">{t.privacyNoticeShort}</span>
            <span className="notice__text">{privacyNoticeText}</span>
          </div>
        </div>

        <section className="card">
          <div className="card__head">
            <h2 className="card__title">{t.perMemberActivity}</h2>
            <span className="card__dash" />
            <span className="card__meta">{memberRows.length}</span>
          </div>
          <div className="member-head">
            <div className="member-search">
              <span className="member-search__icon">
                <Search className="w-3 h-3 [&>path]:stroke-current" />
              </span>
              <input
                className="member-search__input"
                placeholder={t.memberSearchPlaceholder}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>
            <span className="member-sort">{t.memberSortActive}</span>
          </div>
          {memberRows.length === 0 ? (
            <div className="inline-note">{t.emptyList}</div>
          ) : (
            <table className="member-table">
              <thead>
                <tr>
                  <th>{t.memberHandleHeader}</th>
                  <th>{t.memberPostsHeader}</th>
                  <th>{t.memberSpacesHeader}</th>
                  <th>{t.memberLastActiveHeader}</th>
                </tr>
              </thead>
              <tbody id="member-rows">
                {memberRows.map((m) => (
                  <tr key={m.user_id}>
                    <td>
                      <span className="member-handle">
                        <span className="avatar avatar--sm avatar--teal">{m.display_name.slice(0, 2).toUpperCase()}</span>
                        <span className="member-handle__info">
                          <span className="member-handle__name">@{m.handle}</span>
                          <span className="member-handle__role">{m.display_name}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="member-metric">{m.post_count}</span>
                    </td>
                    <td>
                      <span className="member-metric">{m.space_count_participated}</span>
                    </td>
                    <td>{m.last_active_at !== null ? formatLastActive(m.last_active_at, isKo) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <MoreElement hasMore={ctx.members.hasMore} loading={ctx.members.loading} onNext={ctx.members.next} />
        </section>

        <DirectAnnouncementCard username={username} subTeamId={subTeamId} items={ctx.directMessages} />

        <section className="card">
          <div className="card__head">
            <h2 className="card__title card__title--danger">{t.dangerZone}</h2>
            <span className="card__dash" />
          </div>
          <div className="danger-zone">
            <div className="danger-zone__icon">
              <TriangleAlert className="w-4 h-4 [&>path]:stroke-current" />
            </div>
            <div className="danger-zone__body">
              <div className="danger-zone__title">{t.deregisterTitle}</div>
            </div>
            <a
              className="btn btn--danger"
              data-testid="sub-team-detail-deregister-btn"
              onClick={() => navigate(`/${username}/sub-teams/${subTeamId}/deregister`)}
            >
              <X className="w-3 h-3 [&>path]:stroke-current" />
              {t.deregisterConfirm}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
