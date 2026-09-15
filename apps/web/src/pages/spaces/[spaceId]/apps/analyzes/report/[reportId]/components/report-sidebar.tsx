import type { PollQuestionAggregate, QuizQuestionAggregate } from "@ratel/ts-bridges";
import { useSpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { useAnalyzeReportDetailContext } from "../hooks/use-analyze-report-detail";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/report/sidebar/component.rs
// ANALYZES sidebar: one entry per parent poll / quiz / discussion / follow
// target. Visible-panel switching is JS-owned (`data-target-panel`); React
// owns which item inside a panel is selected.

interface ParentGroup {
  id: string;
  title: string;
  questionCount: number;
  respondentCount: number;
}

/** Groups question aggregates by parent id, in first-appearance order. */
function groupAggregates<T>(aggs: T[], id: (a: T) => string, title: (a: T) => string, respondents: (a: T) => number) {
  const byId = new Map<string, ParentGroup>();
  for (const q of aggs) {
    const key = id(q);
    let entry = byId.get(key);
    if (!entry) {
      entry = { id: key, title: title(q).trim() === "" ? key : title(q), questionCount: 0, respondentCount: 0 };
      byId.set(key, entry);
    }
    entry.questionCount += 1;
    if (respondents(q) > entry.respondentCount) entry.respondentCount = respondents(q);
  }
  return [...byId.values()];
}

interface SbItem {
  title: string;
  meta: string;
  target: string;
  selected: boolean;
  actionId: string;
}

interface SbGroup {
  group: string;
  label: string;
  items: SbItem[];
}

export function ReportSidebar() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeReportDetailContext();
  const detail = ctrl.detail;
  const result = detail.result;
  const activePanel = ctrl.activePanel;

  const pollGroups = groupAggregates<PollQuestionAggregate>(
    result?.poll_aggregates ?? [],
    (q) => q.poll_id,
    (q) => q.poll_title,
    (q) => q.respondent_count,
  );
  const activePoll = ctrl.selectedPoll ?? pollGroups[0]?.id ?? null;
  const pollItems: SbItem[] = pollGroups.map((g) => ({
    title: g.title,
    meta: `${g.questionCount} ${tr.detailSbItemMetaQuestions} · ${g.respondentCount}명 ${tr.detailSbItemMetaResponses}`,
    target: "poll",
    selected: activePanel === "poll" && activePoll === g.id,
    actionId: g.id,
  }));

  const quizGroups = groupAggregates<QuizQuestionAggregate>(
    result?.quiz_aggregates ?? [],
    (q) => q.quiz_id,
    (q) => q.quiz_title,
    (q) => q.respondent_count,
  );
  const activeQuiz = ctrl.selectedQuiz ?? quizGroups[0]?.id ?? null;
  const quizItems: SbItem[] = quizGroups.map((g) => ({
    title: g.title,
    meta: `${g.questionCount} ${tr.detailSbItemMetaQuestions} · ${g.respondentCount}명 ${tr.detailSbItemMetaAttempts}`,
    target: "quiz",
    selected: activePanel === "quiz" && activeQuiz === g.id,
    actionId: g.id,
  }));

  const activeDiscussion = ctrl.selectedDiscussion ?? detail.discussions[0]?.discussion_id ?? null;
  const discussionItems: SbItem[] = detail.discussions.map((d) => ({
    title: d.title,
    meta: `${d.matched_comment_count} ${tr.detailSbItemMetaComments} · ${d.matched_participant_count}명 ${tr.detailSbItemMetaParticipants}`,
    target: "discussion",
    selected: activePanel === "discussion" && activeDiscussion === d.discussion_id,
    actionId: d.discussion_id,
  }));

  const followItems: SbItem[] = (result?.follow_aggregates ?? []).map((f) => ({
    title: f.display_name === "" ? f.username : f.display_name,
    meta: `${f.count} ${tr.detailSbItemMetaFollowers}`,
    target: "follow",
    selected: false,
    actionId: "",
  }));

  const groups: SbGroup[] = [
    { group: "poll", label: tr.detailGroupPoll, items: pollItems },
    { group: "quiz", label: tr.detailGroupQuiz, items: quizItems },
    { group: "discussion", label: tr.detailGroupDiscussion, items: discussionItems },
    { group: "follow", label: tr.detailGroupFollow, items: followItems },
  ].filter((g) => g.items.length > 0);

  return (
    <aside className="sidebar" aria-label="Analyze items">
      <div className="sidebar__head">
        <span className="sidebar__head-label">{tr.detailSidebarLabel}</span>
      </div>
      {groups.map((group) => (
        <ReportSidebarGroup key={group.group} group={group} />
      ))}
    </aside>
  );
}

function ReportSidebarGroup({ group }: { group: SbGroup }) {
  const ctrl = useAnalyzeReportDetailContext();

  return (
    <div className={`sb-group sb-group--${group.group}`} data-group={group.group} data-collapsed="false">
      <div className="sb-group__head" data-group-toggle="true">
        <div className="sb-group__head-left">
          <span className="sb-group__icon">
            <GroupIcon group={group.group} />
          </span>
          <span className="sb-group__label">{group.label}</span>
          <span className="sb-group__count">{String(group.items.length)}</span>
        </div>
        <svg
          className="sb-group__chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <div className="sb-group__list">
        {group.items.map((item, idx) => (
          <button
            key={`${group.group}-${idx}`}
            className="sb-item"
            type="button"
            aria-selected={item.selected ? "true" : "false"}
            data-target-panel={item.target}
            data-testid={`sb-item-${group.group}-${idx}`}
            onClick={() => {
              ctrl.setActivePanel(item.target);
              if (item.actionId === "") return;
              if (item.target === "poll") ctrl.setSelectedPoll(item.actionId);
              else if (item.target === "quiz") ctrl.setSelectedQuiz(item.actionId);
              else if (item.target === "discussion") ctrl.setSelectedDiscussion(item.actionId);
            }}
          >
            <span className="sb-item__indicator" />
            <div className="sb-item__body">
              <span className="sb-item__title">{item.title}</span>
              <span className="sb-item__meta">{item.meta}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupIcon({ group }: { group: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (group) {
    case "poll":
      return (
        <svg {...common}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case "quiz":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9 9a3 3 0 0 1 6 0c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "discussion":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "follow":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      );
    default:
      return null;
  }
}
