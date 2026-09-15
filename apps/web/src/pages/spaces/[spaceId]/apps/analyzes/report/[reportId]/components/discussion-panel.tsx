import { Fragment, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";
import type {
  AnalyzesResultTopicRow,
  DiscussionAnalysisParams,
  NetworkEdge,
  NetworkNode,
  SpaceAnalyzeDiscussionResult,
  TermScore,
} from "@ratel/ts-bridges";
import { useSpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { useToast } from "@/lib/toast";
import { DEFAULT_DISCUSSION_PARAMS, useAnalyzeReportDetailContext } from "../hooks/use-analyze-report-detail";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/report/discussion_panel/component.rs
// Discussion analysis panel: settings form (LDA / TF-IDF / network sizes +
// excluded keywords), run state, and the three result cards (TF-IDF bars,
// editable LDA topic table, Fruchterman-Reingold co-occurrence network SVG).

/**
 * An `<input>` whose `value` behaves like a Dioxus `value:` attribute: the DOM
 * value is written only when the rendered value changes, so text the user
 * types that doesn't change the underlying state (e.g. clearing a number
 * field) stays in the box instead of snapping back.
 */
function DxInput({ value, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue"> & { value: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const last = useRef(value);
  useLayoutEffect(() => {
    if (ref.current && last.current !== value) {
      ref.current.value = value;
      last.current = value;
    }
  }, [value]);
  return <input ref={ref} defaultValue={value} {...props} />;
}

export function DiscussionPanel() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeReportDetailContext();
  const selected = ctrl.selectedDiscussion;
  const latest = ctrl.discussionResults.items[0] ?? null;
  const panelTitle =
    ctrl.detail.discussions.find((d) => d.discussion_id === selected)?.title ?? tr.detailDiscussionTitle;

  return (
    <section className="panel" data-panel="discussion" data-active="false">
      <h1 className="main-title">
        <span className="main-title__chip main-title__chip--discussion">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {tr.detailPanelChipDiscussion}
        </span>
        <span data-discussion-title="true">{panelTitle}</span>
      </h1>

      {selected === null ? (
        <section className="card">
          <div className="card__head">
            <div className="card__title">{tr.detailDiscussionPickTitle}</div>
          </div>
          <div className="card__hint">{tr.detailDiscussionPickHint}</div>
        </section>
      ) : (
        <Fragment>
          <DiscussionSettingsCard />
          <DiscussionResultsView latest={latest} />
        </Fragment>
      )}
    </section>
  );
}

function DiscussionSettingsCard() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeReportDetailContext();

  const curDid = ctrl.selectedDiscussion ?? ctrl.detail.discussions[0]?.discussion_id ?? null;
  // Ignore a row belonging to the previously selected discussion while the
  // new one loads.
  const first = ctrl.discussionResults.items[0];
  const latest = first !== undefined && curDid !== null && first.discussion_id === curDid ? first : null;

  const [isEditing, setIsEditing] = useState(false);
  const rowRunning = latest?.status === "in_progress";
  const rowFinished = latest?.status === "finish";
  const isRunning = rowRunning || ctrl.runDiscussionPending;
  const locked = rowRunning || (rowFinished && !isEditing);

  const params: DiscussionAnalysisParams = locked ? (latest?.params ?? ctrl.params) : ctrl.params;

  const [excludedText, setExcludedText] = useState(() => params.excluded_keywords.join(", "));
  const [resetKey, setResetKey] = useState(0);
  const [prevDid, setPrevDid] = useState<string | null | undefined>(undefined);

  // Switching discussions snaps the editable form back to defaults (Rust
  // `prev_did` diff, applied during render).
  let shownExcluded = excludedText;
  if (prevDid !== curDid) {
    setPrevDid(curDid);
    ctrl.setParams(DEFAULT_DISCUSSION_PARAMS);
    setExcludedText("");
    shownExcluded = "";
    setResetKey((k) => k + 1);
    setIsEditing(false);
  }
  if (locked) {
    const want = params.excluded_keywords.join(", ");
    if (excludedText !== want) {
      setExcludedText(want);
    }
    shownExcluded = want;
  }

  const setNumber = (field: "num_topics" | "top_n_tfidf" | "top_n_network", max: number) => (raw: string) => {
    // Rust `parse::<usize>()`: non-negative integers only.
    if (!/^\+?\d+$/.test(raw)) return;
    const n = Math.min(Math.max(Number(raw), 1), max);
    ctrl.setParams({ ...ctrl.params, [field]: n });
  };

  return (
    <section className="card">
      <div className="card__head">
        <div className="card__title">{tr.detailDiscussionSettingsTitle}</div>
        <span className="card__count">{tr.detailDiscussionTopicModelingLabel}</span>
      </div>
      <div className="settings-grid">
        <div className="field">
          <label className="field__label">{tr.detailDiscussionLdaLabel}</label>
          <DxInput
            key={`lda-${resetKey}`}
            className="field__input"
            type="number"
            min="1"
            max="20"
            value={String(params.num_topics)}
            disabled={locked}
            onInput={(e) => setNumber("num_topics", 20)(e.currentTarget.value)}
          />
          <span className="field__hint">{tr.detailDiscussionLdaHint}</span>
        </div>
        <div className="field">
          <label className="field__label">{tr.detailDiscussionTfidfLabel}</label>
          <DxInput
            key={`tfidf-${resetKey}`}
            className="field__input"
            type="number"
            min="1"
            max="20"
            value={String(params.top_n_tfidf)}
            disabled={locked}
            onInput={(e) => setNumber("top_n_tfidf", 20)(e.currentTarget.value)}
          />
          <span className="field__hint">{tr.detailDiscussionLdaHint}</span>
        </div>
        <div className="field">
          <label className="field__label">{tr.detailDiscussionNetworkLabel}</label>
          <DxInput
            key={`network-${resetKey}`}
            className="field__input"
            type="number"
            min="1"
            max="30"
            value={String(params.top_n_network)}
            disabled={locked}
            onInput={(e) => setNumber("top_n_network", 30)(e.currentTarget.value)}
          />
          <span className="field__hint">{tr.detailDiscussionNetworkHint}</span>
        </div>
        <div className="field">
          <label className="field__label">{tr.detailDiscussionExcludedLabel}</label>
          <DxInput
            key={`excluded-${resetKey}`}
            className="field__input"
            type="text"
            placeholder={tr.detailDiscussionExcludedPlaceholder}
            value={shownExcluded}
            disabled={locked}
            onInput={(e) => setExcludedText(e.currentTarget.value)}
          />
          <span className="field__hint">{tr.detailDiscussionExcludedHint}</span>
        </div>
      </div>
      <div className="settings-foot">
        {isRunning ? (
          <span className="settings-running">{tr.detailDiscussionRunningTitle}</span>
        ) : (
          <Fragment>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => {
                ctrl.setParams(DEFAULT_DISCUSSION_PARAMS);
                setExcludedText("");
                setIsEditing(true);
                setResetKey((k) => k + 1);
              }}
            >
              {tr.detailDiscussionBtnReset}
            </button>
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => {
                const parts = excludedText
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s !== "");
                ctrl.handleRunDiscussion({ ...ctrl.params, excluded_keywords: parts });
                setIsEditing(false);
              }}
            >
              {tr.detailDiscussionBtnApply}
            </button>
          </Fragment>
        )}
      </div>
    </section>
  );
}

function DiscussionResultsView({ latest }: { latest: SpaceAnalyzeDiscussionResult | null }) {
  const tr = useSpaceAnalyzesAppI18n();

  if (latest === null) {
    return (
      <section className="card">
        <div className="card__head">
          <div className="card__title">{tr.detailDiscussionNoRunTitle}</div>
        </div>
        <div className="card__hint">{tr.detailDiscussionNoRunHint}</div>
      </section>
    );
  }

  switch (latest.status) {
    case "in_progress":
      return (
        <section className="card">
          <div className="card__head">
            <div className="card__title">{tr.detailDiscussionRunningTitle}</div>
          </div>
          <div className="card__hint">{tr.detailDiscussionRunningHint}</div>
        </section>
      );
    case "failed":
      return (
        <section className="card">
          <div className="card__head">
            <div className="card__title">{tr.detailDiscussionFailedTitle}</div>
          </div>
          <div className="card__hint">{tr.detailDiscussionFailedHint}</div>
        </section>
      );
    case "finish":
      return (
        <Fragment>
          <TfidfCard rows={latest.tfidf_terms} />
          <LdaCard row={latest} />
          <NetworkCard nodes={latest.network_nodes} edges={latest.network_edges} />
        </Fragment>
      );
  }
}

function TfidfCard({ rows }: { rows: TermScore[] }) {
  const tr = useSpaceAnalyzesAppI18n();
  return (
    <section className="card">
      <div className="card__head">
        <div className="card__title">{tr.detailTfidfCardTitle}</div>
        <span className="card__count">{`${rows.length}${tr.detailTfidfCardCountSuffix}`}</span>
      </div>
      {rows.length === 0 ? (
        <div className="card__hint">{tr.detailPanelEmptyTextAnswers}</div>
      ) : (
        <div className="tfidf-chart">
          {rows.map((term, idx) => (
            <button
              key={`tfidf-${idx}`}
              type="button"
              className="tfidf-row"
              aria-pressed="false"
              data-filter-source="discussion"
              data-filter-kind="keyword"
              data-filter-value={term.term}
            >
              <span className="tfidf-row__keyword">{term.term}</span>
              <div className="tfidf-row__track">
                <div className="tfidf-row__fill" style={{ width: `${(term.relative * 100).toFixed(1)}%` }} />
              </div>
              <span className="tfidf-row__value">{term.score.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function LdaCard({ row }: { row: SpaceAnalyzeDiscussionResult }) {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeReportDetailContext();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [renames, setRenames] = useState<Map<string, string>>(() => new Map());

  return (
    <section className="card">
      <div className="card__head">
        <div className="card__title">
          {`${tr.detailLdaCardTitle} (${row.topics.length}${tr.detailLdaCardCountSuffix})`}
        </div>
        <button
          className="card__action"
          type="button"
          aria-pressed={editing ? "true" : "false"}
          onClick={() => {
            const next = !editing;
            setEditing(next);
            if (!next) setRenames(new Map());
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
      </div>
      {row.topics.length === 0 ? (
        <div className="card__hint">{tr.detailPanelEmptyTextAnswers}</div>
      ) : (
        <Fragment>
          <div className="topic-table" id="lda-table" data-edit={editing ? "true" : "false"}>
            <div className="topic-table__head">
              <span>{tr.detailLdaColTopic}</span>
              <span>{tr.detailLdaColKeywords}</span>
            </div>
            {row.topics.map((topic, idx) => {
              const originalId = topic.topic;
              const displayName = renames.get(originalId) ?? originalId;
              return (
                <div key={`lda-${idx}`} className="topic-table__row">
                  <span className="topic-table__id">{displayName}</span>
                  <DxInput
                    className="topic-table__id-input"
                    type="text"
                    value={displayName}
                    onInput={(e) => {
                      const val = e.currentTarget.value;
                      setRenames((prev) => {
                        const next = new Map(prev);
                        if (val.trim() === "") next.delete(originalId);
                        else next.set(originalId, val);
                        return next;
                      });
                    }}
                  />
                  <span className="topic-table__keywords">{topic.keywords.join(", ")}</span>
                </div>
              );
            })}
          </div>
          {editing && (
            <div className="topic-table-foot">
              <button
                className="btn btn--primary"
                type="button"
                disabled={ctrl.saveTopicsPending}
                onClick={() => {
                  const merged: AnalyzesResultTopicRow[] = row.topics.map((t) => ({
                    topic: renames.get(t.topic) ?? t.topic,
                    keywords: t.keywords,
                  }));
                  ctrl.saveTopics(row, merged);
                  setEditing(false);
                  setRenames(new Map());
                  // Hardcoded in the Rust view as well.
                  toast.info("토픽 이름을 저장했습니다");
                }}
              >
                저장
              </button>
            </div>
          )}
        </Fragment>
      )}
    </section>
  );
}

function NetworkCard({ nodes, edges }: { nodes: NetworkNode[]; edges: NetworkEdge[] }) {
  const tr = useSpaceAnalyzesAppI18n();
  return (
    <section className="card">
      <div className="card__head">
        <div className="card__title">
          {`${tr.detailNetworkCardTitle} (${nodes.length}${tr.detailNetworkCardCountSuffix})`}
        </div>
        <span className="card__count">
          {`${nodes.length}${tr.detailNetworkCardCountSuffix} · ${edges.length}${tr.detailNetworkCardEdgeSuffix}`}
        </span>
      </div>
      {nodes.length === 0 ? (
        <div className="card__hint">{tr.detailPanelEmptyTextAnswers}</div>
      ) : (
        <div className="network-wrap">
          <NetworkChart nodes={nodes} edges={edges} />
        </div>
      )}
    </section>
  );
}

/**
 * Force-directed (Fruchterman-Reingold) SVG of the word co-occurrence graph,
 * the same deterministic layout as the Rust `NetworkChart`.
 */
function NetworkChart({ nodes, edges }: { nodes: NetworkNode[]; edges: NetworkEdge[] }) {
  const n = nodes.length;
  if (n === 0) return null;

  const width = 700;
  const height = 580;
  const maxNodeW = Math.max(nodes.reduce((m, x) => Math.max(m, x.weight), Number.NEGATIVE_INFINITY), 1);
  const maxEdgeW = Math.max(
    edges.length === 0 ? 1 : edges.reduce((m, x) => Math.max(m, x.weight), Number.NEGATIVE_INFINITY),
    1,
  );

  const termIdx = new Map<string, number>();
  nodes.forEach((node, i) => termIdx.set(node.term, i));
  const edgePairs: [number, number, number][] = [];
  for (const e of edges) {
    const i = termIdx.get(e.source);
    const j = termIdx.get(e.target);
    if (i !== undefined && j !== undefined) edgePairs.push([i, j, e.weight]);
  }

  const pos: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = (Math.min(width, height) / 2) * 0.45;
    const perturbX = ((i * 73 + 17) % 41) - 20;
    const perturbY = ((i * 113 + 31) % 41) - 20;
    pos.push([width / 2 + r * Math.cos(theta) + perturbX, height / 2 + r * Math.sin(theta) + perturbY]);
  }

  const k = Math.sqrt((width * height) / n);
  let t = width / 8;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  for (let iter = 0; iter < 120; iter++) {
    const disp: [number, number][] = Array.from({ length: n }, () => [0, 0]);
    for (let v = 0; v < n; v++) {
      for (let u = 0; u < n; u++) {
        if (u === v) continue;
        const dx = pos[v][0] - pos[u][0];
        const dy = pos[v][1] - pos[u][1];
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const f = (k * k) / d;
        disp[v][0] += (dx / d) * f;
        disp[v][1] += (dy / d) * f;
      }
    }
    for (const [i, j, w] of edgePairs) {
      const dx = pos[j][0] - pos[i][0];
      const dy = pos[j][1] - pos[i][1];
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const f = ((d * d) / k) * (w / maxEdgeW);
      disp[i][0] += (dx / d) * f;
      disp[i][1] += (dy / d) * f;
      disp[j][0] -= (dx / d) * f;
      disp[j][1] -= (dy / d) * f;
    }
    for (let v = 0; v < n; v++) {
      const [dx, dy] = disp[v];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0) {
        const limit = Math.min(d, t);
        pos[v][0] += (dx / d) * limit;
        pos[v][1] += (dy / d) * limit;
      }
      pos[v][0] = clamp(pos[v][0], 50, width - 50);
      pos[v][1] = clamp(pos[v][1], 50, height - 50);
    }
    t *= 0.94;
  }

  return (
    <svg
      className="network-svg"
      viewBox="0 0 700 580"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Word co-occurrence network"
    >
      <g className="network-links">
        {edges.map((edge, idx) => {
          const a = termIdx.get(edge.source);
          const b = termIdx.get(edge.target);
          if (a === undefined || b === undefined) return null;
          const sw = 0.6 + (edge.weight / maxEdgeW) * 2.4;
          return (
            <line
              key={`edge-${idx}`}
              className="network-link"
              x1={pos[a][0].toFixed(1)}
              y1={pos[a][1].toFixed(1)}
              x2={pos[b][0].toFixed(1)}
              y2={pos[b][1].toFixed(1)}
              strokeWidth={sw.toFixed(2)}
            />
          );
        })}
      </g>
      <g className="network-nodes">
        {nodes.map((node, idx) => {
          const [x, y] = pos[idx];
          const r = 14 + (node.weight / maxNodeW) * 24;
          return (
            <g key={`node-${idx}`}>
              <circle className="network-bubble" cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(1)} />
              <text className="network-bubble-text" x={x.toFixed(1)} y={y.toFixed(1)}>
                {node.term}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
