import type { AnalyzeFilterSource } from "@ratel/ts-bridges";
import { useSpaceAnalyzesAppI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/analyzes/space-analyzes-app.i18n";
import { dataBool } from "@/lib/dom";
import { badge, typeLabel, useAnalyzeCreateContext } from "../hooks/use-analyze-create";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/create/cross_filter/component.rs
// Cross-filter card: `data-add-state` = idle | picking-action | picking-item.

export function CrossFilterCard() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeCreateContext();
  const { addState, filters, pickingType } = ctrl;
  const sunjiOpen = addState === "picking-item" && ctrl.pickedItemId !== null;
  const pickLabelFull =
    pickingType !== null ? `${typeLabel(pickingType)} ${tr.createCfPickItemLabelWithType}` : tr.createCfPickItemLabel;

  return (
    <section
      className="cross-filter"
      id="cross-filter"
      data-add-state={addState}
      data-empty={dataBool(filters.length === 0)}
      data-sunji-open={dataBool(sunjiOpen)}
    >
      <header className="cross-filter__head">
        <h2 className="cross-filter__title">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          {tr.createCfTitle}
        </h2>
        <p className="cross-filter__hint">{tr.createCfHint}</p>
      </header>

      <div className="cross-filter__chips" id="cross-filter-chips">
        {filters.length === 0 ? (
          <span className="cross-filter__chips-all">{tr.createCfChipsAll}</span>
        ) : (
          filters.map((f, idx) => (
            <span key={`chip-${idx}`} className="filter-chip" data-source={f.source}>
              <span className="filter-chip__source">{badge(f.source)}</span>
              <span className="filter-chip__label">{f.label}</span>
              <button
                type="button"
                className="filter-chip__remove"
                aria-label={tr.createCfRemoveFilterAria}
                data-testid={`cf-remove-${idx}`}
                onClick={() => ctrl.removeFilter(idx)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))
        )}
      </div>

      <div className="cross-filter__row" data-when="idle">
        <button
          type="button"
          className="cross-filter__add-btn"
          id="cf-add-start"
          data-testid="cf-add-start"
          onClick={ctrl.startAdd}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {tr.createCfAddFilter}
        </button>
      </div>

      <div className="cross-filter__row" data-when="picking-action">
        <div className="cross-filter__pick-head">
          <span className="cross-filter__pick-label">{tr.createCfPickActionLabel}</span>
          <button
            type="button"
            className="cross-filter__pick-cancel"
            data-cf-back="true"
            data-testid="cf-cancel-action"
            onClick={ctrl.cancelAdd}
          >
            {tr.createCfPickActionCancel}
          </button>
        </div>
        <div className="cf-action-grid">
          <ActionTile
            source="poll"
            label={tr.createActionTilePoll}
            countText={`${ctrl.polls.items.length}${tr.createActionCountUnit}`}
          />
          <ActionTile
            source="quiz"
            label={tr.createActionTileQuiz}
            countText={`${ctrl.quizzes.items.length}${tr.createActionCountUnit}`}
          />
          <ActionTile
            source="discussion"
            label={tr.createActionTileDiscussion}
            countText={`${ctrl.discussions.items.length}${tr.createActionCountUnit}`}
          />
          <ActionTile
            source="follow"
            label={tr.createActionTileFollow}
            countText={`${ctrl.follows.items.length}${tr.createActionCountUnit}`}
          />
        </div>
      </div>

      <div className="cross-filter__row" data-when="picking-item">
        <div className="cross-filter__pick-head">
          <span className="cross-filter__pick-label" id="cf-pick-type-label">
            {pickLabelFull}
          </span>
          <button
            type="button"
            className="cross-filter__pick-cancel"
            data-cf-back-to-action="true"
            data-testid="cf-back-to-action"
            onClick={ctrl.backToAction}
          >
            {tr.createCfBackToAction}
          </button>
        </div>
        <ItemsList />
      </div>
    </section>
  );
}

function ActionTile({ source, label, countText }: { source: AnalyzeFilterSource; label: string; countText: string }) {
  const ctrl = useAnalyzeCreateContext();
  return (
    <button
      type="button"
      className="cf-action-tile"
      data-action-type={source}
      data-testid={`cf-action-${source}`}
      onClick={() => ctrl.pickAction(source)}
    >
      <span className="cf-action-tile__icon">
        <ActionIcon source={source} />
      </span>
      <span className="cf-action-tile__label">{label}</span>
      <span className="cf-action-tile__count">{countText}</span>
    </button>
  );
}

export function ActionIcon({ source }: { source: AnalyzeFilterSource }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (source) {
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
  }
}

interface PickerRow {
  id: string;
  title: string;
  meta: string;
}

function ItemsList() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeCreateContext();
  const { pickingType, pickedItemId } = ctrl;

  // Follow has no item layer; cf-sunji owns the UI.
  if (pickingType === "follow") {
    return <div className="cf-options-list" id="cf-options-list" />;
  }

  let rows: PickerRow[] = [];
  if (pickingType === "poll") {
    rows = ctrl.polls.items.map((p) => ({
      id: p.poll_id,
      title: p.title,
      meta: `${p.questions_count} ${tr.createActionQuestionsUnit}`,
    }));
  } else if (pickingType === "quiz") {
    rows = ctrl.quizzes.items.map((q) => ({
      id: q.quiz_id,
      title: q.title,
      meta: `${q.questions_count} ${tr.createActionQuestionsUnit}`,
    }));
  } else if (pickingType === "discussion") {
    rows = ctrl.discussions.items.map((d) => ({ id: d.discussion_id, title: d.title, meta: "" }));
  }

  return (
    <div className="cf-options-list" id="cf-options-list">
      {rows.map((row) => (
        <label
          key={row.id}
          className="cf-option"
          data-testid={`cf-item-${row.id}`}
          onClick={() => ctrl.pickItem(row.id, row.title)}
        >
          {/* The label's click picks the item; the radio only mirrors it. */}
          <input type="radio" name="cf-item-pick" data-item-id={row.id} checked={pickedItemId === row.id} readOnly />
          <span className="cf-option__body">
            <span className="cf-option__title">{row.title}</span>
            {row.meta !== "" && <span className="cf-option__meta">{row.meta}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
