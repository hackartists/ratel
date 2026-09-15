import { useRef, useState, type ReactNode } from "react";
import type { SubTeamFormFieldResponse, SubTeamFormFieldType, TeamProfileLink } from "@ratel/ts-bridges";
import { useSubTeamI18n, type SubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";
import { dataBool } from "@/lib/dom";
import { useDismissOnOutsideClick } from "@/lib/use-dismiss-on-outside-click";
import { useDomProp, useNativeChange } from "../hooks/use-dom-value";
import { useSubTeamManagement } from "../hooks/use-sub-team-management";
import { EMPTY_FIELD_UPDATE, useSubTeamForm } from "../hooks/use-sub-team-form";
import type { UpdateSubTeamFormFieldRequest } from "@ratel/ts-bridges";

// app/ratel/src/features/sub_team/pages/management/form_tab.rs (`FormTab`).
export function FormTab() {
  const tr = useSubTeamI18n();
  const { teamId } = useSubTeamManagement();
  const { fields, handleCreateField, handleUpdateField, handleDeleteField, handleReorder } = useSubTeamForm(teamId);

  const rows = fields.items;
  const rowCount = rows.length;
  const requiredCount = rows.filter((f) => f.required).length;

  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="card card--collapsible" id="form" data-collapsed={dataBool(collapsed)}>
      <div className="card__head" id="form-head" onClick={() => setCollapsed((c) => !c)}>
        <h2 className="card__title">{tr.formCardTitle}</h2>
        <span className="card__dash" />
        <span className="card__meta" id="form-meta">
          {`${rowCount} ${tr.formMetaFields} · ${requiredCount} ${tr.formMetaRequired}`}
        </span>
        <div className="card__head-toolbar">
          <button
            className="card__toggle"
            id="form-toggle"
            aria-label="Toggle form builder"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((c) => !c);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      <div className="card__body">
        <div className="notice" style={{ marginBottom: "10px" }}>
          <div className="notice__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div className="notice__body">
            <span className="notice__title">{tr.formNoticeTitle}</span>
            <span className="notice__text">{tr.formNoticeText}</span>
          </div>
        </div>

        <div className="field-list" id="field-list">
          {rows.map((field, idx) => (
            <FieldRow
              key={field.id}
              field={field}
              isFirst={idx === 0}
              isLast={idx + 1 === rowCount}
              rowsSnapshot={rows}
              idx={idx}
              onUpdate={handleUpdateField}
              onDelete={handleDeleteField}
              onReorder={handleReorder}
            />
          ))}
        </div>

        <button
          className="add-field-btn"
          id="add-field"
          data-testid="sub-team-form-field-create-btn"
          onClick={() =>
            handleCreateField({
              label: tr.formNewField,
              field_type: "ShortText",
              required: false,
              order: null,
              options: null,
              linked_to: null,
            })
          }
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {tr.addField}
        </button>
      </div>
    </section>
  );
}

interface FieldRowProps {
  field: SubTeamFormFieldResponse;
  isFirst: boolean;
  isLast: boolean;
  rowsSnapshot: SubTeamFormFieldResponse[];
  idx: number;
  onUpdate: (fieldId: string, req: UpdateSubTeamFormFieldRequest) => void;
  onDelete: (fieldId: string) => void;
  onReorder: (ids: string[]) => void;
}

function swapIds(rows: SubTeamFormFieldResponse[], a: number, b: number): string[] {
  const ids = rows.map((f) => f.id);
  [ids[a], ids[b]] = [ids[b], ids[a]];
  return ids;
}

function FieldRow({ field, isFirst, isLast, rowsSnapshot, idx, onUpdate, onDelete, onReorder }: FieldRowProps) {
  const tr = useSubTeamI18n();
  const fieldId = field.id;
  const locked = field.locked;
  const linkedTo = field.linked_to;
  const hasOptionsPanel = field.field_type === "SingleSelect" || field.field_type === "MultiSelect";

  const [menuOpen, setMenuOpen] = useState(false);
  // One menu per field row, so the dismissal anchor is this row's own element.
  const [menuDomId] = useState(() => `field-link-menu-${crypto.randomUUID()}`);
  const menuRef = useRef<HTMLSpanElement>(null);
  useDismissOnOutsideClick(menuRef, menuOpen, setMenuOpen);

  const typeRef = useRef<HTMLSelectElement>(null);
  useDomProp(typeRef, "value", fieldTypeKey(field.field_type));
  const labelRef = useRef<HTMLInputElement>(null);
  useDomProp(labelRef, "value", field.label);
  useNativeChange(labelRef, (el) => onUpdate(fieldId, { ...EMPTY_FIELD_UPDATE, label: el.value }));
  const requiredRef = useRef<HTMLInputElement>(null);
  useDomProp(requiredRef, "checked", field.required);

  const moveUp = () => {
    if (isFirst) return;
    onReorder(swapIds(rowsSnapshot, idx, idx - 1));
  };
  const moveDown = () => {
    if (isLast) return;
    onReorder(swapIds(rowsSnapshot, idx, idx + 1));
  };

  const pickLink = (link: TeamProfileLink) => {
    onUpdate(fieldId, { ...EMPTY_FIELD_UPDATE, linked_to: link });
    setMenuOpen(false);
  };

  return (
    <div className="field-row-wrap" data-testid="sub-team-form-field-row">
      <div className="field-row" data-linked={linkDataAttr(linkedTo)} data-locked={dataBool(locked)}>
        <span className="field-row__drag">
          <button
            style={{ background: "transparent", border: 0, color: "inherit", padding: 0, cursor: "pointer", display: "flex" }}
            disabled={isFirst}
            onClick={moveUp}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </button>
          <button
            style={{ background: "transparent", border: 0, color: "inherit", padding: 0, cursor: "pointer", display: "none" }}
            disabled={isLast}
            onClick={moveDown}
          >
            v
          </button>
        </span>
        <select
          ref={typeRef}
          className="field-row__type"
          defaultValue={fieldTypeKey(field.field_type)}
          disabled={locked}
          onChange={(e) => {
            const ty = parseFieldType(e.currentTarget.value);
            if (ty) onUpdate(fieldId, { ...EMPTY_FIELD_UPDATE, field_type: ty });
          }}
        >
          <option value="short_text">Short text</option>
          <option value="long_text">Long text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="single_select">Single select</option>
          <option value="multi_select">Multi select</option>
          <option value="url">URL</option>
        </select>
        <input
          ref={labelRef}
          className="field-row__label"
          data-testid="sub-team-form-field-label-input"
          defaultValue={field.label}
          readOnly={locked}
        />

        {locked && <span className="field-row__lock-badge">Default</span>}

        <span className="field-row__link-wrap" id={menuDomId} ref={menuRef}>
          <button
            className="field-row__link-btn"
            data-linked={linkedTo !== null ? "set" : "none"}
            data-testid="sub-team-form-field-link-btn"
            type="button"
            disabled={locked}
            onClick={(e) => {
              e.stopPropagation();
              if (!locked) setMenuOpen((o) => !o);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>{linkButtonLabel(linkedTo, tr)}</span>
          </button>
          {menuOpen && (
            <div className="field-row__link-menu" data-open="true">
              <LinkOption label={tr.formLinkTeamName} hint="team.name" selected={linkedTo === "TeamName"} onPick={() => pickLink("TeamName")} />
              <LinkOption
                label={tr.formLinkTeamUsername}
                hint="team.username"
                selected={linkedTo === "TeamUsername"}
                onPick={() => pickLink("TeamUsername")}
              />
              <LinkOption label={tr.formLinkTeamBio} hint="team.bio" selected={linkedTo === "TeamBio"} onPick={() => pickLink("TeamBio")} />
              <LinkOption
                label={tr.formLinkTeamProfileUrl}
                hint="team.profile_url"
                selected={linkedTo === "TeamProfileUrl"}
                onPick={() => pickLink("TeamProfileUrl")}
              />
            </div>
          )}
        </span>

        <label className="field-row__req">
          <input
            ref={requiredRef}
            type="checkbox"
            data-testid="sub-team-form-field-required-check"
            defaultChecked={field.required}
            disabled={locked}
            onChange={(e) => {
              if (locked) return;
              onUpdate(fieldId, { ...EMPTY_FIELD_UPDATE, required: e.currentTarget.checked });
            }}
          />
          {` ${tr.fieldRequired}`}
        </label>
        <button
          className="field-row__del"
          aria-label={tr.deleteField}
          disabled={locked}
          onClick={() => {
            if (locked) return;
            onDelete(fieldId);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>

      {hasOptionsPanel && (
        <FieldOptionsPanel
          options={field.options}
          onChange={(opts) => onUpdate(fieldId, { ...EMPTY_FIELD_UPDATE, options: opts })}
        />
      )}
    </div>
  );
}

function FieldOptionsPanel({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  const tr = useSubTeamI18n();
  // Seeded once, like `use_signal(|| options.clone())`.
  const [local, setLocalState] = useState<string[]>(() => [...options]);
  const localRef = useRef(local);
  const setLocal = (next: string[]) => {
    localRef.current = next;
    setLocalState(next);
  };

  return (
    <div className="field-options">
      <div className="field-options__list">
        {local.map((opt, idx) => (
          <OptionItem
            key={`opt-${idx}`}
            value={opt}
            placeholder={tr.formOptionsPlaceholder}
            onInput={(value) => {
              const next = [...localRef.current];
              if (idx < next.length) next[idx] = value;
              setLocal(next);
            }}
            onCommit={() => onChange(localRef.current)}
            onRemove={() => {
              const next = [...localRef.current];
              if (idx < next.length) next.splice(idx, 1);
              setLocal(next);
              onChange(next);
            }}
          />
        ))}
      </div>
      <button
        className="field-options__add"
        type="button"
        onClick={() => {
          const next = [...localRef.current, ""];
          setLocal(next);
          onChange(next);
        }}
      >
        {`+ ${tr.formOptionsAdd}`}
      </button>
    </div>
  );
}

function OptionItem({
  value,
  placeholder,
  onInput,
  onCommit,
  onRemove,
}: {
  value: string;
  placeholder: string;
  onInput: (value: string) => void;
  onCommit: () => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useNativeChange(ref, onCommit);
  return (
    <div className="field-options__item">
      <input
        ref={ref}
        className="field-options__input"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onInput(e.currentTarget.value)}
      />
      <button className="field-options__del" aria-label="Remove option" type="button" onClick={onRemove}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function LinkOption({ label, hint, selected, onPick }: { label: ReactNode; hint: string; selected: boolean; onPick: () => void }) {
  return (
    <button className="field-row__link-option" aria-selected={dataBool(selected)} type="button" onClick={onPick}>
      <span>{label}</span>
      <span className="field-row__link-option-key">{hint}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}

function fieldTypeKey(t: SubTeamFormFieldType): string {
  switch (t) {
    case "ShortText":
      return "short_text";
    case "LongText":
      return "long_text";
    case "Number":
      return "number";
    case "Date":
      return "date";
    case "SingleSelect":
      return "single_select";
    case "MultiSelect":
      return "multi_select";
    case "Url":
      return "url";
  }
}

function parseFieldType(s: string): SubTeamFormFieldType | null {
  switch (s) {
    case "short_text":
      return "ShortText";
    case "long_text":
      return "LongText";
    case "number":
      return "Number";
    case "date":
      return "Date";
    case "single_select":
      return "SingleSelect";
    case "multi_select":
      return "MultiSelect";
    case "url":
      return "Url";
    default:
      return null;
  }
}

function linkButtonLabel(link: TeamProfileLink | null, tr: SubTeamI18n): string {
  switch (link) {
    case "TeamName":
      return tr.formLinkTeamName;
    case "TeamUsername":
      return tr.formLinkTeamUsername;
    case "TeamBio":
      return tr.formLinkTeamBio;
    case "TeamProfileUrl":
      return tr.formLinkTeamProfileUrl;
    default:
      return tr.formLinkNone;
  }
}

/** Datatag for CSS targeting (`.field-row[data-linked="team.name"]`). */
function linkDataAttr(link: TeamProfileLink | null): string {
  switch (link) {
    case "TeamName":
      return "team.name";
    case "TeamUsername":
      return "team.username";
    case "TeamBio":
      return "team.bio";
    case "TeamProfileUrl":
      return "team.profile_url";
    default:
      return "none";
  }
}
