// app/ratel/src/features/spaces/pages/report/views/detail/figure_html.rs — the
// chart `<figure>` HTML builders used to inject inline chart blocks into the
// rich-text editor's contenteditable area. Ported verbatim (string-building
// logic only, no d3/canvas — every chart type renders as plain HTML/CSS/SVG).
//
// Each generated figure:
// - is `contenteditable="false"` so the caret skips it during typing,
// - carries every piece of data needed to re-render the viz (so chart type
//   swaps don't need to round-trip back to the server),
// - exposes `data-act="swap"` / `data-act="delete"` buttons that
//   `detail_actions.js` hooks via event delegation,
// - shares CSS classes with `main.css` so styling keeps working unchanged.
import type { ActionSource, Analyze, AnalyzeItem, ChartOption, ChartType, DiscussionData } from "@ratel/ts-bridges";

// ── ActionSource / ChartType helpers (Rust `ActionSource` / `ChartType` impls) ──

export const ACTION_SOURCE_VARIANTS: ActionSource[] = ["Poll", "Quiz", "Discussion", "Follow"];

export function actionSourceToken(source: ActionSource): string {
  switch (source) {
    case "Poll":
      return "poll";
    case "Quiz":
      return "quiz";
    case "Discussion":
      return "discussion";
    case "Follow":
      return "follow";
  }
}

function parseActionSource(token: string): ActionSource | null {
  switch (token) {
    case "poll":
      return "Poll";
    case "quiz":
      return "Quiz";
    case "discussion":
      return "Discussion";
    case "follow":
      return "Follow";
    default:
      return null;
  }
}

export const CHART_TYPE_VARIANTS: ChartType[] = ["Bar", "Pie", "Table", "Lda", "TfIdf", "Network", "TextList"];

export function chartTypeToken(t: ChartType): string {
  switch (t) {
    case "Bar":
      return "bar";
    case "Pie":
      return "pie";
    case "Table":
      return "table";
    case "Lda":
      return "lda";
    case "TfIdf":
      return "tfidf";
    case "Network":
      return "network";
    case "TextList":
      return "textlist";
  }
}

function parseChartType(token: string): ChartType | null {
  switch (token) {
    case "bar":
      return "Bar";
    case "pie":
      return "Pie";
    case "table":
      return "Table";
    case "lda":
      return "Lda";
    case "tfidf":
      return "TfIdf";
    case "network":
      return "Network";
    case "textlist":
      return "TextList";
    default:
      return null;
  }
}

/** Only `TextList` has no alternate rendering — hides the chart-type swap button. */
export function isSingleModeChart(t: ChartType): boolean {
  return t === "TextList";
}

/** Bar/Pie/Table for poll/quiz/follow; Lda/TfIdf/Network for discussion. */
export function chartTypeOptionsFor(source: ActionSource): ChartType[] {
  return source === "Discussion" ? ["Lda", "TfIdf", "Network"] : ["Bar", "Pie", "Table"];
}

export function chartTypeDefaultFor(source: ActionSource): ChartType {
  return chartTypeOptionsFor(source)[0];
}

function isTextListItem(item: AnalyzeItem): boolean {
  return item.options.length === 0 && item.text_answers.length > 0;
}

/** Default type based on the item's actual data shape, not just its source. */
export function chartTypeDefaultForItem(item: AnalyzeItem, source: ActionSource): ChartType {
  return isTextListItem(item) ? "TextList" : chartTypeDefaultFor(source);
}

// ── HTML / attribute encoding ──────────────────────────────────────────────

/** Encode for a single-quoted HTML attribute. */
function htmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;");
}

/** Encode for text content between tags. */
function htmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Same as `htmlAttr` but for serialized JSON (already `"`-quoted internally). */
function attrSafeJson(json: string): string {
  return htmlAttr(json);
}

/**
 * The browser re-serializes attributes as double-quoted on every `innerHTML`
 * read and HTML-encodes any embedded `"`. Reverse that so JSON payloads
 * round-trip through `data-options` / `data-discussion` correctly. `&amp;` is
 * decoded last so a literal `&amp;quot;` round-trips to `&quot;`, not `"`.
 */
function decodeAttr(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

const SVG_SETTINGS =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

const SVG_TRASH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

function pushActionButton(chartId: string, act: "swap" | "delete", svg: string, aria: string): string {
  const cls =
    act === "delete" ? "report-detail__chart-action report-detail__chart-action--danger" : "report-detail__chart-action";
  return `<button type="button" class="${cls}" data-act="${act}" data-chart-id='${htmlAttr(chartId)}' aria-label="${aria}">${svg}</button>`;
}

function pushChartCaption(): string {
  return `<figcaption class="report-detail__chart-caption" contenteditable="true" data-placeholder="캡션 (예: 그림 1. 응답 비중)"></figcaption>`;
}

function pushChartEmpty(): string {
  return `<div class="report-detail__chart-canvas report-detail__chart-canvas--empty">표시할 데이터가 없습니다</div>`;
}

// ── Viz renderers ───────────────────────────────────────────────────────────

function renderTextList(answers: string[]): string {
  if (answers.length === 0) return pushChartEmpty();
  let out = `<div class="report-detail__chart-canvas report-detail__chart-canvas--textlist">`;
  out += `<table class="report-detail__chart-table">`;
  out += `<thead><tr><th class="report-detail__textlist-rank-h">#</th><th>응답</th></tr></thead>`;
  out += "<tbody>";
  answers.forEach((ans, i) => {
    out += `<tr><td class="report-detail__textlist-rank">${i + 1}</td><td class="report-detail__textlist-cell">${htmlText(ans)}</td></tr>`;
  });
  out += "</tbody></table></div>";
  return out;
}

function renderBar(options: ChartOption[]): string {
  const max = options.reduce((m, o) => Math.max(m, o.count), 0);
  if (options.length === 0 || max === 0) return pushChartEmpty();
  let out = `<div class="report-detail__chart-canvas report-detail__chart-canvas--bar">`;
  for (const o of options) {
    const height = Math.round((o.count / max) * 100);
    out += `<div class="report-detail__chart-bar" style="height: ${height}%" title="${htmlAttr(o.label)}: ${o.count}" data-label="${htmlAttr(o.label)}"></div>`;
  }
  out += "</div>";
  return out;
}

const PIE_PALETTE = ["#06b6d4", "#a855f7", "#f97316", "#60a5fa", "#fcb300", "#6eedd8"];

function renderPie(options: ChartOption[]): string {
  // Pie slices must sum to 100% of the visible disc — use the sum of option
  // counts (vote share), NOT the respondent count (which is smaller for a
  // multi-response question and would push slices past 360°).
  const total = options.reduce((s, o) => s + o.count, 0);
  if (options.length === 0 || total === 0) return pushChartEmpty();
  const stops: string[] = [];
  let acc = 0;
  options.forEach((o, i) => {
    const pct = (o.count / total) * 100;
    const next = acc + pct;
    const color = PIE_PALETTE[i % PIE_PALETTE.length];
    stops.push(`${color} ${acc.toFixed(2)}% ${next.toFixed(2)}%`);
    acc = next;
  });
  const conic = `conic-gradient(${stops.join(", ")})`;
  let out = `<div class="report-detail__chart-canvas report-detail__chart-canvas--pie">`;
  out += `<div class="report-detail__chart-pie" style="background: ${htmlAttr(conic)};"></div>`;
  out += `<div class="report-detail__chart-pie-legend">`;
  options.forEach((o, i) => {
    const pct = Math.round((o.count / total) * 100);
    const color = PIE_PALETTE[i % PIE_PALETTE.length];
    out += `<div class="report-detail__chart-pie-row">`;
    out += `<span class="report-detail__chart-pie-swatch" style="background: ${htmlAttr(color)};"></span>`;
    out += `<span>${htmlText(o.label)}</span>`;
    out += `<strong>${pct}%</strong>`;
    out += "</div>";
  });
  out += "</div></div>";
  return out;
}

function renderTable(options: ChartOption[], respondentCount: number): string {
  if (options.length === 0) return pushChartEmpty();
  let out = `<div class="report-detail__chart-canvas report-detail__chart-canvas--table">`;
  out += `<table class="report-detail__chart-table">`;
  out += `<thead><tr><th>옵션</th><th>응답 수</th><th>비율</th></tr></thead>`;
  out += "<tbody>";
  for (const o of options) {
    const pct = respondentCount === 0 ? "–" : `${Math.round((o.count / respondentCount) * 100)}%`;
    out += `<tr><td>${htmlText(o.label)}</td><td>${o.count}</td><td>${htmlText(pct)}</td></tr>`;
  }
  out += "</tbody></table></div>";
  return out;
}

function renderLda(discussion: DiscussionData | null): string {
  const topics = discussion?.topics ?? [];
  if (topics.length === 0) return pushChartEmpty();
  let out = `<div class="report-detail__chart-canvas report-detail__chart-canvas--lda">`;
  topics.forEach((topic, i) => {
    const label = topic.topic ? topic.topic : `토픽 ${i + 1}`;
    out += `<div class="report-detail__lda-topic">`;
    out += `<div class="report-detail__lda-topic-head"><span class="report-detail__lda-topic-id">${htmlText(label)}</span></div>`;
    out += `<div class="report-detail__lda-keywords">`;
    for (const kw of topic.keywords) {
      out += `<span class="report-detail__lda-kw">${htmlText(kw)}</span>`;
    }
    out += "</div></div>";
  });
  out += "</div>";
  return out;
}

function renderTfidf(discussion: DiscussionData | null): string {
  const terms = discussion?.tfidf_terms ?? [];
  if (terms.length === 0) return pushChartEmpty();
  let out = `<div class="report-detail__chart-canvas report-detail__chart-canvas--tfidf">`;
  out += `<table class="report-detail__chart-table">`;
  out += `<thead><tr><th class="report-detail__tfidf-rank-h">Rank</th><th>Term</th><th class="report-detail__tfidf-score-h">TF-IDF</th></tr></thead>`;
  out += "<tbody>";
  terms.forEach((t, i) => {
    out += `<tr><td class="report-detail__tfidf-rank">${i + 1}</td><td>${htmlText(t.term)}</td><td class="report-detail__tfidf-score">${t.score.toFixed(3)}</td></tr>`;
  });
  out += "</tbody></table></div>";
  return out;
}

function renderNetwork(discussion: DiscussionData | null): string {
  if (!discussion || discussion.network_nodes.length === 0) return pushChartEmpty();
  const d = discussion;
  const cx = 250;
  const cy = 140;
  const radius = 110;
  const n = d.network_nodes.length;
  const maxWeight = Math.max(1, ...d.network_nodes.map((node) => node.weight));
  const laid = d.network_nodes.map((node, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      r: 8 + (node.weight / maxWeight) * 14,
      term: node.term,
    };
  });
  const byTerm = new Map(laid.map((node) => [node.term, node]));
  const maxEdgeWeight = Math.max(1, ...d.network_edges.map((e) => e.weight));

  let out = `<div class="report-detail__chart-canvas report-detail__chart-canvas--network">`;
  out += `<svg class="report-detail__network-svg" viewBox="0 0 500 280">`;
  for (const e of d.network_edges) {
    const a = byTerm.get(e.source);
    const b = byTerm.get(e.target);
    if (a && b) {
      const stroke = 0.5 + (e.weight / maxEdgeWeight) * 0.5;
      out += `<line class="report-detail__network-edge" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" style="stroke: rgba(168, 85, 247, 0.08); stroke-width: ${stroke};"/>`;
    }
  }
  for (const node of laid) {
    const opacity = Math.min(0.18 + node.r / 80, 0.32);
    out += `<circle class="report-detail__network-node" cx="${node.x}" cy="${node.y}" r="${node.r}" style="fill: rgba(168, 85, 247, ${opacity}); stroke: rgba(168, 85, 247, 0.35);"/>`;
  }
  for (const node of laid) {
    out += `<text class="report-detail__network-label" x="${node.x}" y="${node.y + 4}">${htmlText(node.term)}</text>`;
  }
  out += "</svg>";
  out += `<div class="report-detail__network-stats"><span><strong>${laid.length}</strong>노드</span><span><strong>${d.network_edges.length}</strong>엣지</span></div>`;
  out += "</div>";
  return out;
}

function renderChartViz(
  chartType: ChartType,
  options: ChartOption[],
  respondentCount: number,
  discussion: DiscussionData | null,
  textAnswers: string[],
): string {
  switch (chartType) {
    case "Bar":
      return renderBar(options);
    case "Pie":
      return renderPie(options);
    case "Table":
      return renderTable(options, respondentCount);
    case "Lda":
      return renderLda(discussion);
    case "TfIdf":
      return renderTfidf(discussion);
    case "Network":
      return renderNetwork(discussion);
    case "TextList":
      return renderTextList(textAnswers);
  }
}

// ── Public builders ──────────────────────────────────────────────────────

/** Build the entire `<figure>` for one chart block, ready for `insertHTML`. */
export function buildChartFigure(
  chartId: string,
  source: ActionSource,
  chartType: ChartType,
  analyze: Analyze,
  item: AnalyzeItem,
): string {
  const srcToken = actionSourceToken(source);
  const typeToken = chartTypeToken(chartType);
  const metaText = item.meta === "" ? analyze.name : `${analyze.name} · ${item.meta}`;

  const optionsJson = attrSafeJson(JSON.stringify(item.options ?? []));
  const discussionJson = item.discussion_data ? attrSafeJson(JSON.stringify(item.discussion_data)) : "";
  const answersJson = item.text_answers.length === 0 ? "" : attrSafeJson(JSON.stringify(item.text_answers));

  let out = `<figure id='${htmlAttr(chartId)}' class="report-detail__chart-block" `;
  out += `data-source="${srcToken}" data-type="${typeToken}" data-chart-id='${htmlAttr(chartId)}' `;
  out += `data-analyze-id='${htmlAttr(analyze.id)}' data-analyze-name='${htmlAttr(analyze.name)}' `;
  out += `data-item-id='${htmlAttr(item.id)}' data-item-title='${htmlAttr(item.title)}' data-meta='${htmlAttr(item.meta)}' `;
  out += `data-respondent-count="${item.respondent_count}" data-options='${optionsJson}' data-discussion='${discussionJson}' data-answers='${answersJson}' `;
  out += `contenteditable="false">`;

  out += `<div class="report-detail__chart-top">`;
  out += `<span class="report-detail__chart-title">${htmlText(item.title)}</span>`;
  out += `<div class="report-detail__chart-actions">`;
  if (!isSingleModeChart(chartType)) out += pushActionButton(chartId, "swap", SVG_SETTINGS, "Change chart type");
  out += pushActionButton(chartId, "delete", SVG_TRASH, "Delete chart");
  out += "</div></div>";

  out += `<div class="report-detail__chart-meta">${htmlText(metaText)}</div>`;

  out += renderChartViz(chartType, item.options, item.respondent_count, item.discussion_data, item.text_answers);
  out += pushChartCaption();
  out += "</figure>";
  return out;
}

/** Re-render every CHILD of an existing figure (top strip, meta, viz, caption). */
export function buildChartInner(
  chartId: string,
  chartType: ChartType,
  analyzeName: string,
  itemTitle: string,
  itemMeta: string,
  options: ChartOption[],
  respondentCount: number,
  discussion: DiscussionData | null,
  textAnswers: string[],
): string {
  const metaText = itemMeta === "" ? analyzeName : `${analyzeName} · ${itemMeta}`;
  let out = `<div class="report-detail__chart-top">`;
  out += `<span class="report-detail__chart-title">${htmlText(itemTitle)}</span>`;
  out += `<div class="report-detail__chart-actions">`;
  if (!isSingleModeChart(chartType)) out += pushActionButton(chartId, "swap", SVG_SETTINGS, "Change chart type");
  out += pushActionButton(chartId, "delete", SVG_TRASH, "Delete chart");
  out += "</div></div>";
  out += `<div class="report-detail__chart-meta">${htmlText(metaText)}</div>`;
  out += renderChartViz(chartType, options, respondentCount, discussion, textAnswers);
  out += pushChartCaption();
  return out;
}

// ── Chart meta parsing (outline swap needs to read the figure back) ───────

export interface ChartMeta {
  chartId: string;
  source: ActionSource;
  chartType: ChartType;
  analyzeName: string;
  itemTitle: string;
  itemMeta: string;
  respondentCount: number;
  options: ChartOption[];
  discussionData: DiscussionData | null;
  textAnswers: string[];
}

function readAttr(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const single = new RegExp(`\\b${escaped}='([^']*)'`);
  const singleMatch = tag.match(single);
  if (singleMatch) return decodeAttr(singleMatch[1]);
  const double = new RegExp(`\\b${escaped}="([^"]*)"`);
  const doubleMatch = tag.match(double);
  return doubleMatch ? decodeAttr(doubleMatch[1]) : null;
}

/** Read a chart figure's metadata back out of the body HTML. */
export function parseChartMeta(html: string, chartId: string): ChartMeta | null {
  const escapedId = chartId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<figure\\b[^>]*\\bid=['"]${escapedId}['"][^>]*>`, "is");
  const m = html.match(re);
  if (!m) return null;
  const opening = m[0];
  const sourceStr = readAttr(opening, "data-source");
  const typeStr = readAttr(opening, "data-type");
  if (!sourceStr || !typeStr) return null;
  const source = parseActionSource(sourceStr);
  const chartType = parseChartType(typeStr);
  if (!source || !chartType) return null;
  const analyzeName = readAttr(opening, "data-analyze-name") ?? "";
  const itemTitle = readAttr(opening, "data-item-title") ?? "";
  const itemMeta = readAttr(opening, "data-meta") ?? "";
  const respondentCount = parseInt(readAttr(opening, "data-respondent-count") ?? "0", 10) || 0;
  let options: ChartOption[] = [];
  try {
    options = JSON.parse(readAttr(opening, "data-options") ?? "[]");
  } catch {
    options = [];
  }
  let discussionData: DiscussionData | null = null;
  const discussionRaw = readAttr(opening, "data-discussion");
  if (discussionRaw && discussionRaw.trim() !== "") {
    try {
      discussionData = JSON.parse(discussionRaw);
    } catch {
      discussionData = null;
    }
  }
  let textAnswers: string[] = [];
  const answersRaw = readAttr(opening, "data-answers");
  if (answersRaw && answersRaw.trim() !== "") {
    try {
      textAnswers = JSON.parse(answersRaw);
    } catch {
      textAnswers = [];
    }
  }
  return {
    chartId,
    source,
    chartType,
    analyzeName,
    itemTitle,
    itemMeta,
    respondentCount,
    options,
    discussionData,
    textAnswers,
  };
}

// ── Outline parsing ─────────────────────────────────────────────────────

export type OutlineKind = "H1" | "H2" | "H3" | "Chart";

export interface OutlineEntry {
  id: string;
  kind: OutlineKind;
  label: string;
}

/**
 * Two passes — headings and chart figures — over the body HTML. The editor
 * always produces well-formed `<h1>`/`<h2>`/`<h3>`/`<figure>` tags, so a
 * regex pass is sufficient (no full DOM parse needed). Headings have no
 * DOM id, so they're indexed positionally and given a synthesized
 * `h{level}-{n}` id for outline jumps.
 */
export function parseOutline(html: string): OutlineEntry[] {
  const entries: { pos: number; entry: OutlineEntry }[] = [];
  const counters = [0, 0, 0];

  for (let level = 1; level <= 3; level++) {
    const re = new RegExp(`<h${level}\\b[^>]*>(.*?)</h${level}>`, "gis");
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const inner = m[1];
      const text = stripTags(inner).trim();
      if (text === "") continue;
      counters[level - 1] += 1;
      const kind: OutlineKind = level === 1 ? "H1" : level === 2 ? "H2" : "H3";
      entries.push({ pos: m.index, entry: { id: `h${level}-${counters[level - 1]}`, kind, label: text } });
    }
  }

  const figureRe = /<figure\b[^>]*\bid=['"]([^'"]+)['"][^>]*\bdata-item-title=['"]([^'"]*)['"][^>]*>/gis;
  let fm: RegExpExecArray | null;
  while ((fm = figureRe.exec(html)) !== null) {
    const id = fm[1];
    const label = decodeAttr(fm[2]);
    entries.push({ pos: fm.index, entry: { id, kind: "Chart", label } });
  }

  entries.sort((a, b) => a.pos - b.pos);

  // Dedupe by id — a copy-pasted chart can duplicate a `figure[id]`. Keep the
  // first occurrence and suffix later duplicates with `-N` so they still
  // surface as separate outline rows (and satisfy React's `key` uniqueness).
  const seen = new Map<string, number>();
  return entries.map(({ entry }) => {
    const count = seen.get(entry.id) ?? 0;
    seen.set(entry.id, count + 1);
    return count > 0 ? { ...entry, id: `${entry.id}-${count}` } : entry;
  });
}

// ── UUIDv7 (matches Rust `uuid::Uuid::now_v7()`) ───────────────────────────

function uuidV7(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ts = Date.now().toString(16).padStart(12, "0");
  for (let i = 0; i < 6; i++) bytes[i] = parseInt(ts.slice(i * 2, i * 2 + 2), 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function mintChartId(): string {
  return `chart-${uuidV7()}`;
}

// ── DOM dispatchers ─────────────────────────────────────────────────────
//
// Rust bridges these through `dioxus::document::eval` because the wasm side
// has no direct DOM access; React already runs in the DOM, so these are
// plain synchronous helpers doing the exact same Range-API operations the
// Rust JS strings describe.

function editorContentEl(): HTMLElement | null {
  return document.querySelector(".report-detail .ratel-editor .re-content");
}

/**
 * Insert `html` at the current selection (or at the end of the editor when
 * the selection isn't inside it), then re-collapse the caret after the
 * inserted block and fire a synthetic `input` so the Editor's own listener
 * mirrors the change into `bodyHtml`.
 */
export function dispatchInsertHtml(html: string): void {
  const editor = editorContentEl();
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  let range: Range;
  if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
    range = sel.getRangeAt(0);
  } else {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const frag = document.createDocumentFragment();
  let lastNode: Node | null = null;
  while (tmp.firstChild) {
    lastNode = tmp.firstChild;
    frag.appendChild(tmp.firstChild);
  }
  range.deleteContents();
  range.insertNode(frag);
  if (lastNode && sel) {
    const r = document.createRange();
    r.setStartAfter(lastNode);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Walk back from the caret to find the range covering exactly the last
 * `oldLen` characters — the `/data:...` token being replaced. Returns null
 * when the walk can't find that much text without leaving the editor.
 */
function findSlashRange(editor: HTMLElement, oldLen: number): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const caret = sel.getRangeAt(0);
  if (!editor.contains(caret.startContainer)) return null;
  const endContainer = caret.startContainer;
  const endOffset = caret.startOffset;
  let needed = oldLen;
  let startNode: Node | null = endContainer;
  let startOffset = endOffset;
  while (needed > 0 && startNode) {
    if (startNode.nodeType === 3) {
      if (startOffset > 0) {
        const take = Math.min(startOffset, needed);
        startOffset -= take;
        needed -= take;
        if (needed === 0) break;
      }
      let cursor: Node | null = startNode;
      while (cursor && !cursor.previousSibling && cursor !== editor) {
        cursor = cursor.parentNode;
      }
      if (!cursor || cursor === editor) return null;
      let prev: Node | null = cursor.previousSibling;
      while (prev && prev.nodeType !== 3) {
        prev = prev.lastChild ?? prev.previousSibling;
      }
      if (!prev || prev.nodeType !== 3) return null;
      startNode = prev;
      startOffset = (prev.textContent ?? "").length;
    } else {
      return null;
    }
  }
  if (needed > 0 || !startNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endContainer, endOffset);
  return range;
}

export function dispatchReplaceSlashToken(oldRaw: string, newRaw: string): void {
  const editor = editorContentEl();
  if (!editor) return;
  const r = findSlashRange(editor, oldRaw.length);
  if (!r) return;
  r.deleteContents();
  const textNode = document.createTextNode(newRaw);
  r.insertNode(textNode);
  // Caret must land INSIDE the text node so the Editor's slash watcher (which
  // only parses when the caret is in a text node) re-emits the new token.
  const finalRange = document.createRange();
  finalRange.setStart(textNode, (textNode.textContent ?? "").length);
  finalRange.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(finalRange);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function dispatchReplaceSlashAndInsert(oldRaw: string, figureHtml: string): void {
  const editor = editorContentEl();
  if (!editor) return;
  const r = findSlashRange(editor, oldRaw.length);
  const tmp = document.createElement("div");
  tmp.innerHTML = figureHtml;
  const frag = document.createDocumentFragment();
  let lastNode: Node | null = null;
  while (tmp.firstChild) {
    lastNode = tmp.firstChild;
    frag.appendChild(tmp.firstChild);
  }
  const sel = window.getSelection();
  if (!r) {
    // Fall through: insert at the end so the picked item isn't lost even
    // when the slash chain is weirdly placed.
    const fallback = document.createRange();
    fallback.selectNodeContents(editor);
    fallback.collapse(false);
    fallback.insertNode(frag);
  } else {
    r.deleteContents();
    r.insertNode(frag);
  }
  if (lastNode && sel) {
    const c = document.createRange();
    c.setStartAfter(lastNode);
    c.collapse(true);
    sel.removeAllRanges();
    sel.addRange(c);
  }
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function dispatchSwapChart(chartId: string, typeToken: string, newInner: string): void {
  const editor = editorContentEl();
  if (!editor) return;
  const figure = editor.querySelector(`figure[data-chart-id="${chartId}"]`);
  if (!figure) return;
  // Preserve the user-edited caption across the chart-type swap.
  const oldCap = figure.querySelector(":scope > .report-detail__chart-caption");
  const savedCaption = oldCap ? oldCap.innerHTML : null;
  figure.innerHTML = newInner;
  figure.setAttribute("data-type", typeToken);
  if (savedCaption !== null) {
    const newCap = figure.querySelector(":scope > .report-detail__chart-caption");
    if (newCap) newCap.innerHTML = savedCaption;
  }
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function dispatchDeleteChart(chartId: string): void {
  const editor = editorContentEl();
  if (!editor) return;
  const figure = editor.querySelector(`figure[data-chart-id="${chartId}"]`);
  if (!figure) return;
  figure.remove();
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Place the caret at the end of the body editor's contenteditable. */
export function focusBodyEditor(): void {
  const el = editorContentEl();
  if (!el) return;
  el.focus();
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Scroll to an outline entry's underlying DOM node inside the body editor. */
export function scrollToOutlineEntry(id: string, kind: OutlineKind): void {
  const editor = editorContentEl();
  if (!editor) return;
  let target: Element | null = null;
  if (kind === "Chart") {
    target = editor.querySelector(`figure[data-chart-id="${id}"]`);
  } else {
    const m = id.match(/^h([1-3])-(\d+)$/);
    if (m) {
      const tag = `h${m[1]}`;
      const nth = parseInt(m[2], 10) - 1;
      const list = editor.querySelectorAll(tag);
      target = list[nth] ?? null;
    }
  }
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}
