import { useNavigate } from "react-router-dom";
import type { SubTeamDocumentResponse } from "@ratel/ts-bridges";
import { MessageSquare, ThumbsUp } from "@/components/icons/lucide";
import { useSubTeamI18n } from "@/pages/[username]/sub-teams/sub-team.i18n";

// app/ratel/src/features/sub_team/types/text.rs (`strip_html_to_plain`) — tag
// stripper + soft-whitespace collapse + a small entity-decode allowlist, used
// so list-card excerpts don't show literal `<b>` / `<div>` markup.
function stripHtmlToPlain(html: string): string {
  let out = "";
  let inTag = false;
  let lastWasSpace = false;
  for (const c of html) {
    if (c === "<") {
      inTag = true;
    } else if (c === ">") {
      inTag = false;
      if (!lastWasSpace && out.length > 0) {
        out += " ";
        lastWasSpace = true;
      }
    } else if (inTag) {
      // skip
    } else if (/\s/.test(c)) {
      if (!lastWasSpace && out.length > 0) {
        out += " ";
        lastWasSpace = true;
      }
    } else {
      out += c;
      lastWasSpace = false;
    }
  }
  return out
    .replace(/\s+$/, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function formatYmdUtc(ms: number): string {
  if (ms <= 0) return "";
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// app/ratel/src/features/sub_team/pages/bylaws/component.rs (`BylawCard`).
export function BylawCard({ index, doc, parent }: { index: number; doc: SubTeamDocumentResponse; parent: boolean }) {
  const t = useSubTeamI18n();
  const navigate = useNavigate();
  const excerpt = stripHtmlToPlain(doc.body).slice(0, 240);
  const variantClass = parent ? "bylaw-card bylaw-card--parent" : "bylaw-card";
  const testid = parent ? "sub-team-bylaws-parent-card" : "sub-team-bylaws-team-card";
  const numLabel = (parent ? t.bylawsCardBylawNum : t.bylawsCardRuleNum)({ n: String(index + 1).padStart(2, "0") });
  const metaLabel = formatYmdUtc(doc.updated_at);
  const backingPostId = doc.backing_post_id;

  return (
    <article
      className={variantClass}
      data-testid={testid}
      onClick={() => {
        if (backingPostId === null || !backingPostId.startsWith("FEED#")) return;
        navigate(`/posts/${backingPostId.slice(5)}`);
      }}
    >
      <div className="bylaw-card__top">
        <span className="bylaw-card__num">{numLabel}</span>
        {doc.required ? (
          <span className="bylaw-card__meta">{t.bylawsRequiredMeta}</span>
        ) : (
          <span className="bylaw-card__meta">{metaLabel}</span>
        )}
      </div>
      <h3 className="bylaw-card__title">{doc.title}</h3>
      <p className="bylaw-card__excerpt">{excerpt}</p>
      <div className="bylaw-card__foot">
        <div className="bylaw-card__stats">
          <span className="bylaw-card__stat">
            <ThumbsUp className="w-3 h-3 [&>path]:stroke-current" />
            {doc.likes}
          </span>
          <span className="bylaw-card__stat">
            <MessageSquare className="w-3 h-3 [&>path]:stroke-current" />
            {doc.comments}
          </span>
        </div>
      </div>
    </article>
  );
}
