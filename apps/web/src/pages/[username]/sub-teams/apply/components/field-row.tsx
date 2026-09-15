import type { ChangeEvent } from "react";
import type { SubTeamFormFieldResponse } from "@ratel/ts-bridges";
import { dataBool } from "@/lib/dom";
import { useSubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";

// app/ratel/src/features/sub_team/pages/apply/component.rs (`FieldRow`) — one
// application-form field, rendered per `field_type`. Linked fields (server
// prefills from the applicant team's profile at submit time) show a 🔗 hint.

export interface FieldRowProps {
  field: SubTeamFormFieldResponse;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
}

export function FieldRow({ field, value, onChange }: FieldRowProps) {
  const t = useSubTeamI18n();
  const isLinked = field.linked_to !== null;
  const linkedHint = (() => {
    switch (field.linked_to) {
      case "TeamName":
        return t.formLinkTeamName;
      case "TeamUsername":
        return t.formLinkTeamUsername;
      case "TeamBio":
        return t.formLinkTeamBio;
      case "TeamProfileUrl":
        return t.formLinkTeamProfileUrl;
      default:
        return null;
    }
  })();

  const textValue = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  const selectedValues: string[] = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

  const emitText = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange(field.id, e.target.value);

  return (
    <div className="field" data-testid="sub-team-apply-field" data-linked={dataBool(isLinked)}>
      <label className="field__label">
        {field.label}
        {field.required && <span className="req"> *</span>}
        {linkedHint !== null && <span className="field__linked-hint"> · 🔗 {linkedHint}</span>}
      </label>
      {field.field_type === "LongText" ? (
        <textarea className="field__textarea" value={textValue} onChange={emitText} />
      ) : field.field_type === "Number" ? (
        <input className="field__input" type="number" value={textValue} onChange={emitText} />
      ) : field.field_type === "Date" ? (
        <input className="field__input" type="date" value={textValue} onChange={emitText} />
      ) : field.field_type === "Url" ? (
        <input className="field__input" type="url" value={textValue} onChange={emitText} />
      ) : field.field_type === "SingleSelect" ? (
        <select className="field__select" value={textValue} onChange={emitText}>
          <option value="">—</option>
          {field.options.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.field_type === "MultiSelect" ? (
        <div className="field__multi">
          {field.options.map((opt, i) => {
            const selected = selectedValues.includes(opt);
            return (
              <label className="field__checkbox" key={i}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? selectedValues.includes(opt)
                        ? selectedValues
                        : [...selectedValues, opt]
                      : selectedValues.filter((v) => v !== opt);
                    onChange(field.id, next);
                  }}
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <input className="field__input" type="text" value={textValue} onChange={emitText} />
      )}
    </div>
  );
}
