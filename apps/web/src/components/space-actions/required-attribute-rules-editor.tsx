import { useState } from "react";
import type { ConditionOperator, RequiredAttributeRule } from "@ratel/ts-bridges";
import { ContentAlign, PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { useActionRequiredAttributeSelectorI18n } from "./action-required-attribute-selector.i18n";

/**
 * A choice poll question a rule may target. Action gating offers single-choice
 * questions; poll display conditions also offer multiple-choice ones.
 */
export interface SingleChoiceCandidate {
  pollActionId: string;
  pollTitle: string;
  questionIndex: number;
  questionTitle: string;
  options: string[];
}

export interface RequiredAttributeRulesEditorProps {
  candidates: SingleChoiceCandidate[];
  value: RequiredAttributeRule[];
  onChange: (next: RequiredAttributeRule[]) => void;
  disabled?: boolean;
  /** Replaces the default action-gating hint above the chips. */
  hint?: string;
  /** Replaces the default text shown when there is nothing to pick from. */
  emptyText?: string;
  /** Replaces the default "add" button label. */
  addLabel?: string;
  /** How the rules combine. Only meaningful together with `onOperatorChange`. */
  operator?: ConditionOperator;
  /**
   * Enables the AND/OR toggle (shown once at least one rule exists). Without
   * it the rules always AND together, as action gating requires.
   */
  onOperatorChange?: (next: ConditionOperator) => void;
}

/** A choice poll question a rule may target. */
export type ChoiceCandidate = SingleChoiceCandidate;

/**
 * Stateless editor for a list of answer rules: chips for the current rules
 * (click to remove), a picker of unused candidate questions, and an
 * allowed-value picker. Values inside a rule OR together; rules AND together
 * unless `onOperatorChange` enables the AND/OR toggle. Persisting the list is
 * up to `onChange`, so the same editor serves action gating, the Sampling
 * population rules and poll question display conditions.
 */
export function RequiredAttributeRulesEditor({
  candidates,
  value,
  onChange,
  disabled = false,
  hint,
  emptyText,
  addLabel,
  operator = "And",
  onOperatorChange,
}: RequiredAttributeRulesEditorProps) {
  const tr = useActionRequiredAttributeSelectorI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState<SingleChoiceCandidate | null>(null);
  const [pendingValues, setPendingValues] = useState<string[]>([]);

  const usedKeys = new Set(value.map((r) => `${r.poll_action_id}:${r.question_index}`));
  const availableCandidates = candidates.filter((c) => !usedKeys.has(`${c.pollActionId}:${c.questionIndex}`));

  const removeRule = (idx: number) => {
    if (disabled) return;
    onChange(value.filter((_, i) => i !== idx));
  };

  const startAddRule = (candidate: SingleChoiceCandidate) => {
    setPendingCandidate(candidate);
    setPendingValues([]);
    setMenuOpen(false);
  };

  const confirmAddRule = () => {
    if (!pendingCandidate || pendingValues.length === 0) return;
    const rule: RequiredAttributeRule = {
      poll_action_id: pendingCandidate.pollActionId,
      question_index: pendingCandidate.questionIndex,
      allowed_values: pendingValues,
    };
    onChange([...value, rule]);
    setPendingCandidate(null);
    setPendingValues([]);
  };

  const toggleValue = (option: string) => {
    setPendingValues((prev) => (prev.includes(option) ? prev.filter((v) => v !== option) : [...prev, option]));
  };

  const ruleLabel = (rule: RequiredAttributeRule): string => {
    const candidate = candidates.find((c) => c.pollActionId === rule.poll_action_id && c.questionIndex === rule.question_index);
    const pollTitle = candidate?.pollTitle ?? rule.poll_action_id;
    const questionTitle = candidate?.questionTitle ?? `#${rule.question_index}`;
    return `${pollTitle} · ${questionTitle} = ${rule.allowed_values.join(" / ")}`;
  };

  const hasAvailable = availableCandidates.length > 0 && !disabled;
  const hasRules = value.length > 0;

  return (
    <div className="flex flex-col gap-2 w-full" data-testid="required-attribute-selector">
      <span className="font-medium text-[12px]/[16px] text-foreground-muted">{hint ?? tr.requiredAttributesHint}</span>

      {onOperatorChange && hasRules && (
        <div className="flex gap-1 items-center" role="radiogroup" data-testid="condition-operator">
          {(["And", "Or"] as const).map((op) => (
            <button
              key={op}
              type="button"
              role="radio"
              aria-checked={operator === op}
              data-testid={`condition-operator-${op.toLowerCase()}`}
              disabled={disabled}
              className={`py-1 px-2.5 rounded-full text-[12px]/[16px] border ${
                operator === op ? "bg-primary/10 border-primary text-primary" : "border-separator text-foreground-muted"
              }`}
              onClick={() => onOperatorChange(op)}
            >
              {op === "And" ? tr.operatorAnd : tr.operatorOr}
            </button>
          ))}
        </div>
      )}

      {!hasAvailable && !hasRules ? (
        <span className="font-medium italic text-[12px]/[16px] text-foreground-muted" data-testid="required-attribute-empty">
          {emptyText ?? tr.noQuestionsAvailable}
        </span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {value.map((rule, idx) => (
            <button
              key={`${rule.poll_action_id}:${rule.question_index}`}
              type="button"
              data-testid={`chip-required-attribute-${idx}`}
              disabled={disabled}
              className="inline-flex gap-1.5 items-center py-1 px-2.5 font-medium rounded-full bg-primary/10 text-[12px]/[16px] text-primary"
              onClick={() => removeRule(idx)}
            >
              <span>{ruleLabel(rule)}</span>
              {!disabled && <span>×</span>}
            </button>
          ))}

          {hasAvailable && (
            <PopoverRoot open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger
                data-testid="btn-add-required-attribute"
                className="inline-flex gap-1 items-center py-1 px-2.5 font-medium rounded-full border border-separator text-[12px]/[16px] text-foreground-muted hover:bg-hover"
              >
                {addLabel ?? tr.addRequiredAttribute}
              </PopoverTrigger>
              <PopoverContent align={ContentAlign.Start}>
                <div className="flex flex-col gap-1 p-2 min-w-[260px] border rounded-[10px] border-separator bg-popover shadow-lg">
                  {availableCandidates.map((candidate) => (
                    <button
                      key={`${candidate.pollActionId}:${candidate.questionIndex}`}
                      type="button"
                      data-testid={`required-attribute-candidate-${candidate.pollActionId}-${candidate.questionIndex}`}
                      className="py-2 px-3 text-left rounded-[8px] text-[13px]/[18px] text-text-primary hover:bg-hover"
                      onClick={() => startAddRule(candidate)}
                    >
                      {candidate.pollTitle} · {candidate.questionTitle}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </PopoverRoot>
          )}
        </div>
      )}

      {pendingCandidate && (
        <div
          className="flex flex-col gap-2 p-3 rounded-[10px] border border-separator bg-popover"
          data-testid="required-attribute-value-picker"
        >
          <span className="font-medium text-[12px]/[16px] text-foreground-muted">{tr.selectAllowedValuesHint}</span>
          <div className="flex flex-wrap gap-2">
            {pendingCandidate.options.map((opt) => (
              <button
                key={opt}
                type="button"
                data-testid={`required-attribute-value-${opt}`}
                className={`py-1 px-2.5 rounded-full text-[12px]/[16px] border ${
                  pendingValues.includes(opt) ? "bg-primary/10 border-primary text-primary" : "border-separator text-foreground-muted"
                }`}
                onClick={() => toggleValue(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              data-testid="btn-cancel-required-attribute"
              className="py-1 px-2.5 rounded-[8px] text-[12px]/[16px] text-foreground-muted hover:bg-hover"
              onClick={() => {
                setPendingCandidate(null);
                setPendingValues([]);
              }}
            >
              {tr.cancel}
            </button>
            <button
              type="button"
              data-testid="btn-confirm-required-attribute"
              disabled={pendingValues.length === 0}
              className="py-1 px-2.5 rounded-[8px] text-[12px]/[16px] text-primary disabled:opacity-40"
              onClick={confirmAddRule}
            >
              {tr.confirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
