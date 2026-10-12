import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { Question, RequiredAttributeRule, SpaceActionSummary, SpacePartition } from "@ratel/ts-bridges";
import { getPoll } from "@ratel/ts-bridges";
import { useUpdateSpaceAction } from "@ratel/ts-bridges/hooks";
import { useToast } from "@/lib/toast";
import { RequiredAttributeRulesEditor, type SingleChoiceCandidate } from "./required-attribute-rules-editor";
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

/** Lists every single-choice question of the given poll actions. */
export function useSingleChoiceCandidates(spaceId: string, pollActions: SpaceActionSummary[]): SingleChoiceCandidate[] {
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
  return candidates;
}

export function ActionRequiredAttributeSelector({
  spaceId,
  actionId,
  initialRequiredAttributes,
  onChanged,
}: ActionRequiredAttributeSelectorProps) {
  const toast = useToast();
  const [rules, setRules] = useState<RequiredAttributeRule[]>(initialRequiredAttributes);
  const [saving, setSaving] = useState(false);
  const update = useUpdateSpaceAction();

  const actions = useSpaceActionList(spaceId);
  const pollActions: SpaceActionSummary[] = actions.filter((a) => a.action_type === "Poll" && a.action_id !== actionId);
  const candidates = useSingleChoiceCandidates(spaceId, pollActions);

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

  return <RequiredAttributeRulesEditor candidates={candidates} value={rules} onChange={save} />;
}
