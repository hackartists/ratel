import * as React from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  getPoll,
  getSamplingDashboard,
  getSamplingSettings,
  previewSamplingCells,
  upsertSamplingConfig,
} from "@ratel/ts-bridges";
import type {
  Question,
  RequiredAttributeRule,
  SamplingCellDto,
  SamplingDashboardResponse,
  SamplingMethod,
  SamplingSettingsResponse,
  SpaceActionSummary,
} from "@ratel/ts-bridges";
import { spaceQueryKeys } from "@/components/space/space-context";
import { useSpaceActionList } from "@/components/space-actions/use-space-action-list";
import type { SingleChoiceCandidate } from "@/components/space-actions/required-attribute-rules-editor";

/** Editable Sampling settings as held by the settings form. */
export interface SamplingFormState {
  entryPollId: string;
  rules: RequiredAttributeRule[];
  dimensions: number[];
  total: string;
  method: SamplingMethod;
  recruit: boolean;
}

/** Everything the Sampling settings page and dashboard need. */
export interface UseSpaceSampling {
  settings: SamplingSettingsResponse;
  locked: boolean;
  entryPolls: SpaceActionSummary[];
  form: SamplingFormState;
  setForm: (patch: Partial<SamplingFormState>) => void;
  questions: Question[];
  candidates: SingleChoiceCandidate[];
  preview: SamplingCellDto[] | null;
  dashboard: SamplingDashboardResponse | null;
  saving: boolean;
  canSave: boolean;
  save: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function initialForm(settings: SamplingSettingsResponse, entryPolls: SpaceActionSummary[]): SamplingFormState {
  const config = settings.config;
  if (config) {
    return {
      entryPollId: config.entry_poll_id,
      rules: config.population_rules,
      dimensions: config.dimensions,
      total: String(config.total_samples),
      method: config.method,
      recruit: config.allow_recruit_during_sampling,
    };
  }
  return {
    entryPollId: entryPolls.length === 1 ? entryPolls[0].action_id : "",
    rules: [],
    dimensions: [],
    total: "",
    method: "FirstCome",
    recruit: false,
  };
}

/**
 * Loads the saved Sampling settings, keeps the editable form, previews the
 * cell targets for the current inputs (debounced, computed by the server)
 * and exposes save / dashboard refresh. `locked` turns the form read-only
 * once the space has left `Open`.
 */
export function useSpaceSampling(spaceId: string, spaceStatus: string | null): UseSpaceSampling {
  const queryClient = useQueryClient();
  const settingsKey = ["getSamplingSettings", spaceId] as const;
  const dashboardKey = ["getSamplingDashboard", spaceId] as const;
  const settings = useSuspenseQuery({ queryKey: settingsKey, queryFn: () => getSamplingSettings(spaceId) }).data;
  const actions = useSpaceActionList(spaceId);
  const entryPolls = actions.filter((a) => a.action_type === "Poll" && a.prerequisite);

  const [form, setFormState] = React.useState<SamplingFormState>(() => initialForm(settings, entryPolls));
  const setForm = (patch: Partial<SamplingFormState>) => setFormState((prev) => ({ ...prev, ...patch }));

  const locked = settings.locked || !(spaceStatus === null || spaceStatus === "Designing" || spaceStatus === "Open");

  const poll = useQuery({
    queryKey: ["getPoll", spaceId, form.entryPollId],
    queryFn: () => getPoll(spaceId, form.entryPollId),
    enabled: form.entryPollId !== "",
  }).data;
  const questions = poll?.questions ?? [];
  const entryTitle = entryPolls.find((p) => p.action_id === form.entryPollId)?.title ?? "";
  const candidates: SingleChoiceCandidate[] = questions.flatMap((q, qi) =>
    q.answer_type === "single_choice"
      ? [{ pollActionId: form.entryPollId, pollTitle: entryTitle, questionIndex: qi, questionTitle: q.title, options: q.options }]
      : [],
  );

  const total = Number.parseInt(form.total, 10);
  const previewInput = useDebounced({ entryPollId: form.entryPollId, dimensions: form.dimensions, total }, 300);
  const previewEnabled = previewInput.entryPollId !== "" && Number.isFinite(previewInput.total) && previewInput.total >= 1;
  const preview = useQuery({
    queryKey: ["previewSamplingCells", spaceId, previewInput.entryPollId, previewInput.dimensions, previewInput.total],
    queryFn: () =>
      previewSamplingCells(spaceId, {
        entry_poll_id: previewInput.entryPollId,
        dimensions: previewInput.dimensions,
        total_samples: previewInput.total,
      }),
    enabled: previewEnabled,
    retry: false,
  }).data;

  const dashboard = useQuery({
    queryKey: dashboardKey,
    queryFn: () => getSamplingDashboard(spaceId),
    enabled: settings.config !== null,
    retry: false,
  });

  const [saving, setSaving] = React.useState(false);
  const canSave = !locked && !saving && form.entryPollId !== "" && Number.isFinite(total) && total >= 1;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const saved = await upsertSamplingConfig(spaceId, {
        entry_poll_id: form.entryPollId,
        population_rules: form.rules,
        dimensions: form.dimensions,
        total_samples: total,
        allocation: "Equal",
        method: form.method,
        allow_recruit_during_sampling: form.recruit,
      });
      queryClient.setQueryData(settingsKey, saved);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: dashboardKey, exact: true }),
        queryClient.refetchQueries({ queryKey: spaceQueryKeys.space(spaceId), exact: true }),
      ]);
    } finally {
      setSaving(false);
    }
  };

  const refreshDashboard = async () => {
    await queryClient.refetchQueries({ queryKey: dashboardKey, exact: true });
  };

  return {
    settings,
    locked,
    entryPolls,
    form,
    setForm,
    questions,
    candidates,
    preview: previewEnabled ? (preview ?? null) : null,
    dashboard: dashboard.data ?? null,
    saving,
    canSave,
    save,
    refreshDashboard,
  };
}
