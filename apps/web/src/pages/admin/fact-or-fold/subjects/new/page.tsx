import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CreateSubjectRequest, RevealSource, Verdict } from "@ratel/ts-bridges";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useFactFoldAdminNewSubjectI18n } from "./i18n";
import { useAdminLiteralsI18n } from "../../../admin-literals.i18n";
import { charCount, displayError, utf8Length } from "../../../hooks/format";
import { useAdminSubjects } from "../../hooks/use-admin-subjects";
import {
  DifficultyPicker,
  ExpiresField,
  FormSection,
  HEADLINE_BODY_MAX,
  HEADLINE_DIFFICULTY_MAX,
  HEADLINE_DIFFICULTY_MIN,
  HEADLINE_TEXT_MAX,
  RevealSourcesEditor,
  ScheduleField,
  TextAreaField,
  TextInputField,
  VerdictPicker,
} from "./components/form-fields";

const SUBJECTS_PATH = "/admin/fact-or-fold/subjects";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/admin/new_subject/component.rs
// (`FactFoldAdminNewSubjectPage`, `/admin/fact-or-fold/subjects/new`): author a
// draft, or schedule it directly; on success, back to the subject list.
export function Component() {
  const tr = useFactFoldAdminNewSubjectI18n();
  const lit = useAdminLiteralsI18n();
  const actions = useAdminSubjects();
  const navigate = useNavigate();

  const [verdict, setVerdict] = useState<Verdict>("REAL");
  const [headlineText, setHeadlineText] = useState("");
  const [bodyExcerpt, setBodyExcerpt] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [categoryTagsRaw, setCategoryTagsRaw] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [insiderStatement, setInsiderStatement] = useState("");
  const [revealSummary, setRevealSummary] = useState("");
  const [revealSources, setRevealSources] = useState<RevealSource[]>([]);
  const [scheduledAtIso, setScheduledAtIso] = useState("");
  const [expiresAtIso, setExpiresAtIso] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyLen = charCount(bodyExcerpt);
  const bodyInRange = bodyExcerpt.trim() !== "" && bodyLen <= HEADLINE_BODY_MAX;
  // Rust counts the subject in bytes (`str::len`), the body in chars.
  const headlineLen = utf8Length(headlineText);
  const subjectInRange = headlineText.trim() !== "" && headlineLen <= HEADLINE_TEXT_MAX;
  const insiderFilled = insiderStatement.trim() !== "";
  const summaryFilled = revealSummary.trim() !== "";
  const sourceFilled = sourceLabel.trim() !== "";
  const difficultyInRange = difficulty >= HEADLINE_DIFFICULTY_MIN && difficulty <= HEADLINE_DIFFICULTY_MAX;

  const coreOk = subjectInRange && bodyInRange && difficultyInRange && insiderFilled && summaryFilled && sourceFilled;

  const makeRequest = (withSchedule: boolean): CreateSubjectRequest | null => {
    // An empty expiry stays `0` (no auto-retire).
    let expiresTs = 0;
    if (expiresAtIso !== "") {
      const parsed = parseIsoLocalToMillis(expiresAtIso);
      if (parsed === null) return null;
      expiresTs = parsed;
    }
    let scheduledAt: number | null = null;
    if (withSchedule) {
      scheduledAt = parseIsoLocalToMillis(scheduledAtIso);
      if (scheduledAt === null) return null;
    }
    return {
      headline_text: headlineText,
      body_excerpt: bodyExcerpt,
      verdict,
      difficulty,
      category_tags: parseCsv(categoryTagsRaw),
      source_label: sourceLabel,
      insider_statement: insiderStatement,
      reveal_summary: revealSummary,
      reveal_sources: revealSources,
      scheduled_at: scheduledAt,
      expires_at: expiresTs,
    };
  };

  const submit = async (withSchedule: boolean) => {
    if (!coreOk) return;
    setSubmitting(true);
    setError(null);
    const req = makeRequest(withSchedule);
    if (req === null) {
      if (withSchedule) setError(lit.text("ff_schedule_required"));
      setSubmitting(false);
      return;
    }
    try {
      await actions.create(req);
      navigate(SUBJECTS_PATH);
    } catch (e) {
      setError(displayError(e));
    }
    setSubmitting(false);
  };

  return (
    <>
      <SeoMeta title={lit.fill("ff_page_title", { page: tr.pageTitle })} />
      <form className="ff-new-subject" onSubmit={(e) => e.preventDefault()}>
        <FormSection title={tr.sectionTruthTitle} sub={tr.sectionTruthSub}>
          <VerdictPicker value={verdict} onChange={setVerdict} />
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
        </FormSection>

        <FormSection title={tr.sectionTextTitle} sub={tr.sectionTextSub}>
          <TextInputField
            label={tr.headlineText}
            placeholder={tr.headlineTextPlaceholder}
            value={headlineText}
            onChange={setHeadlineText}
            counter={`${headlineLen} / ${HEADLINE_TEXT_MAX}`}
            invalid={!subjectInRange && headlineText !== ""}
            testid="ff-admin-headline"
          />
          <TextAreaField
            label={tr.bodyExcerpt}
            placeholder={tr.bodyExcerptPlaceholder}
            value={bodyExcerpt}
            onChange={setBodyExcerpt}
            rows={6}
            counter={`${bodyLen} / ${HEADLINE_BODY_MAX}`}
            invalid={!bodyInRange && bodyExcerpt !== ""}
            testid="ff-admin-body"
          />
        </FormSection>

        <FormSection title={tr.sectionMetaTitle} sub={tr.sectionMetaSub}>
          <TextInputField
            label={tr.sourceLabel}
            placeholder={tr.sourceLabelPlaceholder}
            value={sourceLabel}
            onChange={setSourceLabel}
            counter=""
            invalid={false}
            testid="ff-admin-source"
          />
          <TextInputField
            label={tr.categoryTags}
            placeholder={tr.categoryTagsPlaceholder}
            value={categoryTagsRaw}
            onChange={setCategoryTagsRaw}
            counter=""
            invalid={false}
            testid="ff-admin-tags"
          />
        </FormSection>

        <FormSection title={tr.sectionInsiderTitle} sub={tr.sectionInsiderSub}>
          <TextAreaField
            label={tr.insiderStatement}
            placeholder={tr.insiderStatementPlaceholder}
            value={insiderStatement}
            onChange={setInsiderStatement}
            rows={4}
            counter=""
            invalid={false}
            testid="ff-admin-insider"
          />
          <p className="ff-new-subject__hint">{tr.insiderHint}</p>
        </FormSection>

        <FormSection title={tr.sectionRevealTitle} sub={tr.sectionRevealSub}>
          <TextAreaField
            label={tr.revealSummary}
            placeholder={tr.revealSummaryPlaceholder}
            value={revealSummary}
            onChange={setRevealSummary}
            rows={3}
            counter=""
            invalid={false}
            testid="ff-admin-summary"
          />
          <RevealSourcesEditor value={revealSources} onChange={setRevealSources} />
        </FormSection>

        <FormSection title={tr.sectionPublishTitle} sub={tr.sectionPublishSub}>
          <ScheduleField value={scheduledAtIso} onChange={setScheduledAtIso} />
          <ExpiresField value={expiresAtIso} onChange={setExpiresAtIso} />
          <div className="ff-new-subject__actions">
            {error !== null && <span className="ff-new-subject__error">{error}</span>}
            {!coreOk && <span className="ff-new-subject__hint">{tr.fieldsIncomplete}</span>}
            <button
              className="btn btn--ghost"
              data-testid="ff-admin-save-draft"
              disabled={submitting || !coreOk}
              onClick={() => void submit(false)}
            >
              {tr.saveDraft}
            </button>
            <button
              className="btn btn--primary"
              data-testid="ff-admin-schedule-publish"
              disabled={submitting || !coreOk || scheduledAtIso === ""}
              onClick={() => void submit(true)}
            >
              {tr.schedulePublish}
            </button>
          </div>
        </FormSection>
      </form>
    </>
  );
}

/** `parse_csv`. */
function parseCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

const DIGITS = /^\d+$/;

/**
 * `parse_iso_local_to_millis`: `YYYY-MM-DDTHH:MM` read as UTC (no timezone
 * handling yet, as in Rust). `null` on anything it can't parse.
 */
function parseIsoLocalToMillis(text: string): number | null {
  if (text.length < 16) return null;
  const part = (from: number, to: number) => {
    const s = text.slice(from, to);
    return DIGITS.test(s) ? Number(s) : null;
  };
  const year = part(0, 4);
  const month = part(5, 7);
  const day = part(8, 10);
  const hour = part(11, 13);
  const minute = part(14, 16);
  if (year === null || month === null || day === null || hour === null || minute === null) return null;
  if (year < 1970 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Day overflow (e.g. 02-31) rolls forward like the Rust day count.
  return Date.UTC(year, month - 1, 1) + (day - 1) * 86_400_000 + hour * 3_600_000 + minute * 60_000;
}
