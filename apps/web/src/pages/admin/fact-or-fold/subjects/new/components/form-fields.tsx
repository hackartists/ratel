import type { ReactNode } from "react";
import type { RevealSource, Verdict } from "@ratel/ts-bridges";
import { useFactFoldAdminNewSubjectI18n } from "@/i18n/generated/features/arcade/games/fact_or_fold/pages/admin/new_subject/fact-fold-admin-new-subject.i18n";
import { dataBool } from "@/lib/dom";
import { useAdminLiteralsI18n } from "../../../../admin-literals.i18n";
import { useDioxusInput } from "../../../../hooks/use-dioxus-input";

// Sub-components of fact_or_fold/pages/admin/new_subject/component.rs.

/** `HEADLINE_DIFFICULTY_MIN..=HEADLINE_DIFFICULTY_MAX` (fact_or_fold/types). */
export const HEADLINE_DIFFICULTY_MIN = 1;
export const HEADLINE_DIFFICULTY_MAX = 5;
export const HEADLINE_TEXT_MAX = 200;
export const HEADLINE_BODY_MAX = 500;
export const REVEAL_SOURCES_MAX = 5;

export function FormSection({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="ff-new-subject__section">
      <header className="ff-new-subject__section-head">
        <span className="ff-new-subject__section-title">{title}</span>
        <span className="ff-new-subject__section-sub">{sub}</span>
      </header>
      <div className="ff-new-subject__panel">{children}</div>
    </section>
  );
}

export function VerdictPicker({ value, onChange }: { value: Verdict; onChange: (verdict: Verdict) => void }) {
  const tr = useFactFoldAdminNewSubjectI18n();
  const lit = useAdminLiteralsI18n();
  return (
    <div className="ff-new-subject__field">
      <div className="ff-new-subject__label">{tr.verdictLabel}</div>
      <div className="ff-new-subject__verdict-row">
        <button
          type="button"
          className="ff-new-subject__verdict-btn"
          data-variant="real"
          aria-selected={dataBool(value === "REAL")}
          onClick={() => onChange("REAL")}
        >
          {lit.text("ff_verdict_real")}
        </button>
        <button
          type="button"
          className="ff-new-subject__verdict-btn"
          data-variant="fake"
          aria-selected={dataBool(value === "FAKE")}
          onClick={() => onChange("FAKE")}
        >
          {lit.text("ff_verdict_fake")}
        </button>
      </div>
      <div className="ff-new-subject__hint">{tr.verdictHint}</div>
    </div>
  );
}

export function DifficultyPicker({ value, onChange }: { value: number; onChange: (difficulty: number) => void }) {
  const tr = useFactFoldAdminNewSubjectI18n();
  const stars: number[] = [];
  for (let star = HEADLINE_DIFFICULTY_MIN; star <= HEADLINE_DIFFICULTY_MAX; star += 1) stars.push(star);
  return (
    <div className="ff-new-subject__field">
      <div className="ff-new-subject__label">{tr.difficultyLabel}</div>
      <div className="ff-new-subject__star-row">
        {stars.map((star) => (
          <button
            key={star}
            type="button"
            className="ff-new-subject__star"
            aria-selected={dataBool(star <= value)}
            onClick={() => onChange(star)}
          >
            ★
          </button>
        ))}
        <span className="ff-new-subject__star-label">{`${value} / ${HEADLINE_DIFFICULTY_MAX}`}</span>
      </div>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  counter: string;
  invalid: boolean;
  testid: string;
}

function LabelRow({ label, counter, invalid }: Pick<TextFieldProps, "label" | "counter" | "invalid">) {
  return (
    <div className="ff-new-subject__label-row">
      <div className="ff-new-subject__label">{label}</div>
      {counter !== "" && (
        <span className="ff-new-subject__counter" data-invalid={dataBool(invalid)}>
          {counter}
        </span>
      )}
    </div>
  );
}

export function TextInputField({ label, placeholder, value, onChange, counter, invalid, testid }: TextFieldProps) {
  return (
    <div className="ff-new-subject__field">
      <LabelRow label={label} counter={counter} invalid={invalid} />
      <input
        className="ff-new-subject__input"
        data-testid={testid}
        data-invalid={dataBool(invalid)}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function TextAreaField({
  label,
  placeholder,
  value,
  onChange,
  rows,
  counter,
  invalid,
  testid,
}: TextFieldProps & { rows: number }) {
  // A React-controlled textarea mirrors its value into its text content;
  // the Dioxus one only sets the property.
  const textarea = useDioxusInput<HTMLTextAreaElement>(value);
  return (
    <div className="ff-new-subject__field">
      <LabelRow label={label} counter={counter} invalid={invalid} />
      <textarea
        className="ff-new-subject__textarea"
        data-testid={testid}
        data-invalid={dataBool(invalid)}
        rows={rows}
        placeholder={placeholder}
        {...textarea}
        onInput={(e) => onChange(e.currentTarget.value)}
      />
    </div>
  );
}

export function RevealSourcesEditor({
  value,
  onChange,
}: {
  value: RevealSource[];
  onChange: (sources: RevealSource[]) => void;
}) {
  const tr = useFactFoldAdminNewSubjectI18n();
  const lit = useAdminLiteralsI18n();
  const update = (index: number, patch: Partial<RevealSource>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="ff-new-subject__field">
      <div className="ff-new-subject__label-row">
        <div className="ff-new-subject__label">{tr.revealSources}</div>
        <span className="ff-new-subject__counter">{`${value.length} / ${REVEAL_SOURCES_MAX}`}</span>
      </div>
      <div className="ff-new-subject__sources">
        {value.map((source, index) => (
          <div className="ff-new-subject__source-row" key={index}>
            <input
              className="ff-new-subject__input ff-new-subject__source-label"
              type="text"
              placeholder={tr.revealSourceLabelPlaceholder}
              value={source.label}
              onChange={(e) => update(index, { label: e.target.value })}
            />
            <input
              className="ff-new-subject__input ff-new-subject__source-url"
              type="url"
              placeholder={lit.text("ff_source_url_placeholder")}
              value={source.url}
              onChange={(e) => update(index, { url: e.target.value })}
            />
            <button
              type="button"
              className="ff-new-subject__source-remove"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        ))}
        {value.length < REVEAL_SOURCES_MAX && (
          <button
            type="button"
            className="ff-new-subject__source-add"
            onClick={() => onChange([...value, { label: "", url: "" }])}
          >
            {`+ ${tr.revealSourceAdd}`}
          </button>
        )}
      </div>
    </div>
  );
}

function DateTimeField({
  label,
  hint,
  testid,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  testid: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ff-new-subject__field">
      <div className="ff-new-subject__label">{label}</div>
      <input
        className="ff-new-subject__input"
        data-testid={testid}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="ff-new-subject__hint">{hint}</div>
    </div>
  );
}

export function ScheduleField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const tr = useFactFoldAdminNewSubjectI18n();
  return (
    <DateTimeField
      label={tr.scheduleLabel}
      hint={tr.scheduleHint}
      testid="ff-admin-scheduled-at"
      value={value}
      onChange={onChange}
    />
  );
}

export function ExpiresField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const tr = useFactFoldAdminNewSubjectI18n();
  return (
    <DateTimeField
      label={tr.expiresLabel}
      hint={tr.expiresHint}
      testid="ff-admin-expires-at"
      value={value}
      onChange={onChange}
    />
  );
}
