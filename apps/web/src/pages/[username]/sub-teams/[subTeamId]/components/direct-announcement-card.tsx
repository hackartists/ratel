import { useNavigate } from "react-router-dom";
import type { SubTeamAnnouncementResponse } from "@ratel/ts-bridges";
import { Send } from "@/components/icons/lucide";
import { Button, ButtonShape, ButtonSize, ButtonStyle } from "@/components/ui/button";
import { useSubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";
import { DirectAnnouncementRow } from "./direct-announcement-row";

// app/ratel/src/features/sub_team/pages/detail/component.rs
// (`DirectAnnouncementCard`) — "이 하위팀에만 공지" card: CTA to the shared
// broadcast composer (direct-to-one-sub-team) plus a history list.
export function DirectAnnouncementCard({
  username,
  subTeamId,
  items,
}: {
  username: string;
  subTeamId: string;
  items: SubTeamAnnouncementResponse[];
}) {
  const t = useSubTeamI18n();
  const navigate = useNavigate();

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">{t.directAnnounceTitle}</h2>
        <span className="card__dash" />
      </div>

      <div className="direct-msg">
        <div className="direct-msg__foot">
          <span className="direct-msg__note">{t.directAnnounceNote}</span>
          <Button
            size={ButtonSize.Small}
            buttonStyle={ButtonStyle.Primary}
            shape={ButtonShape.Rounded}
            className="inline-flex gap-2 items-center"
            data-testid="sub-team-direct-msg-compose-cta"
            onClick={() => navigate(`/${username}/sub-teams/${subTeamId}/compose`)}
          >
            <Send className="w-3 h-3 [&>path]:stroke-current" />
            {t.directCompose}
          </Button>
        </div>
      </div>

      <div className="direct-msg__history">
        <div className="direct-msg__history-title">{t.directAnnounceHistoryTitle}</div>
        {items.length === 0 ? (
          <div className="direct-msg__empty">{t.directAnnounceHistoryEmpty}</div>
        ) : (
          items.map((ann) => (
            <DirectAnnouncementRow
              key={ann.id}
              targetPostPk={ann.target_post_pk}
              spacePk={ann.space_pk}
              title={ann.title}
              body={ann.html_contents}
              createdAt={ann.created_at}
            />
          ))
        )}
      </div>
    </section>
  );
}
