import { useNavigate } from "react-router-dom";
import type { SubTeamAnnouncementResponse } from "@ratel/ts-bridges";
import { ChevronRight, Clock, Hash, MessageSquare, Pencil, Pin, Send, Trash2, Users } from "@/components/icons/lucide";
import { useSubTeamI18n, type SubTeamI18n } from "@/pages/[username]/sub-teams/sub-team.i18n";
import { charCount, diffDays, formatYmd, stripHtmlChars } from "../hooks/format";
import { useSubTeamManagement } from "../hooks/use-sub-team-management";
import { MoreElement } from "./more-element";

// app/ratel/src/features/sub_team/pages/management/broadcast_tab.rs (`BroadcastTab`).
export function BroadcastTab({ teamDisplayName }: { teamDisplayName: string }) {
  const tr = useSubTeamI18n();
  const { announcements, handleDelete, handlePublish, username } = useSubTeamManagement();
  const navigate = useNavigate();

  const items = announcements.items;
  const drafts = items.filter((a) => a.status === "Draft");
  const published = items.filter((a) => a.status === "Published");

  return (
    <>
      <a
        className="bc-cta"
        data-testid="sub-team-broadcast-compose-cta"
        onClick={() => {
          // Route::TeamSubTeamBroadcastComposePage
          navigate(`/${encodeURIComponent(username)}/sub-teams/announcements/compose`);
        }}
      >
        <div className="bc-cta__icon">
          <Send className="w-5 h-5 [&>path]:stroke-current" />
        </div>
        <div className="bc-cta__body">
          <div className="bc-cta__label">{tr.broadcastCompose}</div>
          <div className="bc-cta__sub">{tr.broadcastComposeSub}</div>
        </div>
        <ChevronRight className="bc-cta__arrow [&>path]:stroke-current" />
      </a>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">{tr.broadcastDraftsCardTitle}</h2>
          <span className="card__dash" />
          <span className="card__meta">{tr.broadcastDraftsCount({ n: drafts.length })}</span>
        </div>
        {drafts.length === 0 ? (
          <div className="inline-note">{tr.emptyList}</div>
        ) : (
          <div className="u-col u-gap-10" id="drafts-list">
            {drafts.map((draft) => (
              <DraftRow
                key={draft.id}
                item={draft}
                username={username}
                teamDisplayName={teamDisplayName}
                onDelete={handleDelete}
                onPublish={handlePublish}
              />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">{tr.broadcastPublishedCardTitle}</h2>
          <span className="card__dash" />
          <span className="card__meta">{tr.broadcastPublishedCount({ n: published.length })}</span>
        </div>
        {published.length === 0 ? (
          <div className="inline-note">{tr.emptyList}</div>
        ) : (
          <div className="u-col u-gap-10">
            {published.map((item, i) => (
              <PublishedItem key={item.id} item={item} isPinned={i === 0} />
            ))}
          </div>
        )}
        <MoreElement query={announcements} />
      </section>
    </>
  );
}

interface DraftRowProps {
  item: SubTeamAnnouncementResponse;
  username: string;
  teamDisplayName: string;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
}

function DraftRow({ item, username, teamDisplayName, onDelete, onPublish }: DraftRowProps) {
  const tr = useSubTeamI18n();
  const navigate = useNavigate();

  const savedAtLabel = formatAutosaved(item.updated_at, tr);
  const chars = item.html_contents !== "" ? stripHtmlChars(item.html_contents) : charCount(item.body);
  const charsLabel = tr.broadcastDraftChars({ n: chars });
  const titleDisplay = item.title.trim() === "" ? tr.broadcastUntitled : item.title;

  return (
    <div className="draft-row">
      <div className="draft-row__dot" />
      <div className="draft-row__body">
        <div className="draft-row__title">{titleDisplay}</div>
        <div className="draft-row__meta">
          <span className="draft-row__meta-cell">
            <Clock className="w-3 h-3 [&>circle]:stroke-current [&>polyline]:stroke-current" />
            <span>{`${savedAtLabel} · ${charsLabel}`}</span>
          </span>
          <span>
            {`${tr.broadcastDraftPostingAs} `}
            <strong>{teamDisplayName}</strong>
          </span>
          <span>{tr.broadcastDraftTarget}</span>
        </div>
      </div>
      <a
        className="draft-row__edit"
        data-testid="sub-team-broadcast-draft-edit"
        onClick={() => {
          // Route::TeamSubTeamBroadcastEditPage
          navigate(`/${encodeURIComponent(username)}/sub-teams/announcements/${encodeURIComponent(item.id)}/edit`);
        }}
      >
        <Pencil className="w-3 h-3 [&>path]:stroke-current" />
        {tr.edit}
      </a>
      <button className="draft-row__edit" data-testid="sub-team-broadcast-draft-publish" onClick={() => onPublish(item.id)}>
        <Send className="w-3 h-3 [&>path]:stroke-current" />
        {tr.broadcastPublish}
      </button>
      <button className="draft-row__del" aria-label="Delete" onClick={() => onDelete(item.id)}>
        <Trash2 className="w-3 h-3 [&>path]:stroke-current" />
      </button>
    </div>
  );
}

function PublishedItem({ item, isPinned }: { item: SubTeamAnnouncementResponse; isPinned: boolean }) {
  const tr = useSubTeamI18n();
  const ts = item.published_at ?? item.updated_at;
  const relative = formatRelativeShort(ts, tr);
  const absolute = formatAbsoluteDate(ts);

  return (
    <div className="bc-item">
      <div className="bc-item__top">
        <span
          className="bc-item__kind"
          style={
            isPinned
              ? {}
              : {
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--sub-team-muted)",
                  borderColor: "var(--sub-team-border)",
                }
          }
        >
          {isPinned ? (
            <Pin className="w-3 h-3 [&>path]:stroke-current [&>line]:stroke-current" />
          ) : (
            <Hash className="w-3 h-3 [&>line]:stroke-current" />
          )}
          {isPinned ? tr.broadcastPinned : tr.broadcastUnpinned}
        </span>
        <span className="bc-item__time">{`${relative} · ${absolute}`}</span>
      </div>
      <div className="bc-item__title-text">{item.title}</div>
      <div className="bc-item__meta">
        <span className="bc-item__meta-cell">
          <Users className="w-3 h-3 [&>path]:stroke-current [&>circle]:stroke-current" />
          {tr.broadcastFanoutMeta({ n: item.fan_out_count })}
        </span>
        <span className="bc-item__meta-cell">
          <MessageSquare className="w-3 h-3 [&>path]:stroke-current" />
          {tr.broadcastCommentsMeta({ n: item.comments_count })}
        </span>
      </div>
    </div>
  );
}

/** `format_autosaved`. */
function formatAutosaved(tsMs: number, tr: SubTeamI18n): string {
  if (tsMs <= 0) return tr.broadcastAutosavedIdle;
  const diffMs = Math.max(Date.now() - tsMs, 0);
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const days = Math.floor(diffHours / 24);
  if (diffSecs < 60) return tr.broadcastAutosavedJustNow;
  if (diffMins < 60) return tr.broadcastAutosavedMinutes({ n: diffMins });
  if (diffHours < 24) return tr.broadcastAutosavedHours({ n: diffHours });
  if (days === 1) return tr.broadcastAutosavedYesterday;
  if (days < 7) return tr.broadcastAutosavedDays({ n: days });
  return formatAbsoluteDate(tsMs);
}

/** `format_relative_short`. */
function formatRelativeShort(tsMs: number, tr: SubTeamI18n): string {
  if (tsMs <= 0) return "—";
  const d = diffDays(tsMs);
  if (d === 0) return tr.broadcastTimeToday;
  if (d === 1) return tr.broadcastTimeYesterday;
  if (d <= 6) return tr.broadcastTimeDaysAgo({ n: d });
  return formatAbsoluteDate(tsMs);
}

/** `format_absolute_date`. */
function formatAbsoluteDate(tsMs: number): string {
  if (tsMs <= 0) return "";
  return formatYmd(tsMs);
}
