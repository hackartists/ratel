import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { Question, RequiredAttributeRule, SpaceActionSummary, SpacePartition } from "@ratel/ts-bridges";
import { getPoll } from "@ratel/ts-bridges";
import { useUpdateSpaceAction } from "@ratel/ts-bridges/hooks";
import { ContentAlign, PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { useActionRequiredAttributeSelectorI18n } from "./action-required-attribute-selector.i18n";
import { useToast } from "@/lib/toast";
import { useSpaceActionList } from "./use-space-action-list";

// app/ratel/src/features/spaces/pages/actions/services/required_attributes —
// gates participation on a Poll action's single-choice question answer
// falling inside an allow-list of option values. Independent of (AND-combined
// with) ActionDependencySelector's "complete this other action first" gate.
// Candidate questions are restricted to `answer_type === "single_choice"`
// across every Poll action in the same space.

export interface ActionRequiredAttributeSelectorProps {
  spaceId: string;
  actionId: string;
  initialRequiredAttributes: RequiredAttributeRule[];
  onChanged?: (next: RequiredAttributeRule[]) => void;
}

interface SingleChoiceCandidate {
  pollActionId: string;
  pollTitle: string;
  questionIndex: number;
  questionTitle: string;
  options: string[];
}

export function ActionRequiredAttributeSelector({
  spaceId,
  actionId,
  initialRequiredAttributes,
  onChanged,
}: ActionRequiredAttributeSelectorProps) {
  const tr = useActionRequiredAttributeSelectorI18n();
  const toast = useToast();
  const [rules, setRules] = useState<RequiredAttributeRule[]>(initialRequiredAttributes);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState<SingleChoiceCandidate | null>(null);
  const [pendingValues, setPendingValues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const update = useUpdateSpaceAction();

  const actions = useSpaceActionList(spaceId);
  const pollActions: SpaceActionSummary[] = actions.filter((a) => a.action_type === "Poll" && a.action_id !== actionId);

  // Fetch every poll's questions in the space so single_choice candidates can
  // be listed. Suspense-free: polls not yet loaded just contribute no
  // candidates until their query resolves.
  const pollQueries = useQueries({
    queries: pollActions.map((p) => ({
      queryKey: ["getPoll", spaceId, p.action_id],
      queryFn: () => getPoll(spaceId as SpacePartition, p.action_id),
    })),
  });

  const candidates: SingleChoiceCandidate[] = [];
  pollActions.forEach((p, i) => {
    const poll = pollQueries[i]?.data;
    if (!poll) return;
    poll.questions.forEach((q: Question, qi: number) => {
      if (q.answer_type !== "single_choice") return;
      candidates.push({
        pollActionId: p.action_id,
        pollTitle: p.title,
        questionIndex: qi,
        questionTitle: q.title,
        options: q.options,
      });
    });
  });

  const usedKeys = new Set(rules.map((r) => `${r.poll_action_id}:${r.question_index}`));
  const availableCandidates = candidates.filter((c) => !usedKeys.has(`${c.pollActionId}:${c.questionIndex}`));

  const save = (next: RequiredAttributeRule[]) => {
    if (saving) return;
    setSaving(true);
    update
      .mutateAsync({ spaceId, actionId, req: { required_attributes: next } })
      .then(() => {
        setRules(next);
        onChanged?.(next);
      })
      .catch((e) => toast.error(e))
      .finally(() => setSaving(false));
  };

  const removeRule = (idx: number) => {
    save(rules.filter((_, i) => i !== idx));
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
    save([...rules, rule]);
    setPendingCandidate(null);
    setPendingValues([]);
  };

  const toggleValue = (value: string) => {
    setPendingValues((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const ruleLabel = (rule: RequiredAttributeRule): string => {
    const pollAction = pollActions.find((p) => p.action_id === rule.poll_action_id);
    const candidate = candidates.find(
      (c) => c.pollActionId === rule.poll_action_id && c.questionIndex === rule.question_index,
    );
    const pollTitle = pollAction?.title ?? rule.poll_action_id;
    const questionTitle = candidate?.questionTitle ?? `#${rule.question_index}`;
    return `${pollTitle} · ${questionTitle} = ${rule.allowed_values.join(" / ")}`;
  };

  const hasAvailable = availableCandidates.length > 0;
  const hasRules = rules.length > 0;

  return (
    <div className="flex flex-col gap-2 w-full" data-testid="required-attribute-selector">
      <span className="font-medium text-[12px]/[16px] text-foreground-muted">{tr.requiredAttributesHint}</span>

      {!hasAvailable && !hasRules ? (
        <span className="font-medium italic text-[12px]/[16px] text-foreground-muted" data-testid="required-attribute-empty">
          {tr.noQuestionsAvailable}
        </span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {rules.map((rule, idx) => (
            <button
              key={`${rule.poll_action_id}:${rule.question_index}`}
              type="button"
              data-testid={`chip-required-attribute-${idx}`}
              className="inline-flex gap-1.5 items-center py-1 px-2.5 font-medium rounded-full bg-primary/10 text-[12px]/[16px] text-primary"
              onClick={() => removeRule(idx)}
            >
              <span>{ruleLabel(rule)}</span>
              <span>×</span>
            </button>
          ))}

          {hasAvailable && (
            <PopoverRoot open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger
                data-testid="btn-add-required-attribute"
                className="inline-flex gap-1 items-center py-1 px-2.5 font-medium rounded-full border border-separator text-[12px]/[16px] text-foreground-muted hover:bg-hover"
              >
                {tr.addRequiredAttribute}
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
