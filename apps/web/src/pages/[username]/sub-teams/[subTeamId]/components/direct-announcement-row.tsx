import type * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { dataBool } from "@/lib/dom";
import { formatLastActive } from "../hooks/use-sub-team-activity";

// app/ratel/src/features/sub_team/pages/detail/component.rs (`DirectAnnouncementRow`).
// `target_post_pk` is a bare uuid (no "FEED#" prefix, per the DTO doc comment);
// `space_pk` carries the "SPACE#" prefix and needs stripping. Space wins over
// post when both are present, like the Rust `if let Some(space_id) = ... else`.
export function DirectAnnouncementRow({
  targetPostPk,
  spacePk,
  title,
  body,
  createdAt,
}: {
  targetPostPk: string | null;
  spacePk: string | null;
  title: string;
  body: string;
  createdAt: number;
}) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const when = formatLastActive(createdAt, i18n.language.startsWith("ko"));
  const spaceId = spacePk !== null ? spacePk.replace(/^SPACE#/, "") : null;
  const postId = targetPostPk;
  const clickable = spaceId !== null || postId !== null;

  const anchorTypeAttr = { type: "button" } as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>;

  return (
    <a
      className="direct-msg__row"
      data-testid="sub-team-direct-msg-row"
      data-clickable={dataBool(clickable)}
      {...anchorTypeAttr}
      onClick={() => {
        if (spaceId !== null) {
          navigate(`/spaces/${spaceId}`);
        } else if (postId !== null) {
          navigate(`/posts/${postId}`);
        }
      }}
    >
      <div className="direct-msg__row-head">
        <span className="direct-msg__row-title">{title}</span>
        <span className="direct-msg__row-when">{when}</span>
      </div>
      {body !== "" && <div className="direct-msg__row-body" dangerouslySetInnerHTML={{ __html: body }} />}
    </a>
  );
}
