import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getSubTeamApplicationDraftHandler,
  listAdminTeamsHandler,
  listChildApplicationsHandler,
} from "@ratel/ts-bridges";
import type { ApplyContextResponse, SubTeamApplicationStatus, TeamItem, TeamPartition } from "@ratel/ts-bridges";
import {
  useDeleteSubTeamApplicationDraft,
  useGetSubTeamApplyContext,
  useSaveSubTeamApplicationDraft,
  useSubmitApplication,
} from "@ratel/ts-bridges/hooks";

// app/ratel/src/features/sub_team/hooks/use_sub_team_apply.rs (`UseSubTeamApply`) —
// controller for `/:username/sub-teams/apply` (child-side "apply as sub-team" form).
// `parentTeamId` is the `:username` team; `applicantTeamId` is the team-picker
// selection, auto-seeded to the viewer's first admin team once `myTeams` resolves.

type FormValues = Record<string, unknown>;
type AgreedDocIds = Record<string, string>;

const IN_FLIGHT_STATUSES: SubTeamApplicationStatus[] = ["Pending", "Returned"];

export interface UseSubTeamApply {
  /** Both `applyContext` and `myTeams` have resolved — Rust `use_loader(...)?` suspends until then. */
  ready: boolean;
  parentTeamId: TeamPartition;
  applicantTeamId: TeamPartition;
  setApplicantTeamId: (id: TeamPartition) => void;
  applyContext: ApplyContextResponse;
  myTeams: TeamItem[];
  formValues: FormValues;
  agreedDocIds: AgreedDocIds;
  setFieldValue: (fieldId: string, value: unknown) => void;
  agreeDoc: (docId: string, bodyHash: string) => void;
  /** Submits as `applicantTeamId`, clears the draft, returns the new application id. */
  submit: () => Promise<string>;
}

const EMPTY_CONTEXT: ApplyContextResponse = {
  is_parent_eligible: false,
  min_sub_team_members: 0,
  min_sub_team_age_days: 0,
  recognized_count: 0,
  pending_count: 0,
  form_fields: [],
  required_docs: [],
};

function linkedValue(link: string, team: TeamItem): string {
  switch (link) {
    case "TeamName":
      return team.nickname || team.username;
    case "TeamUsername":
      return team.username;
    case "TeamBio":
      return team.description;
    case "TeamProfileUrl":
      return team.profile_url;
    default:
      return "";
  }
}

export function useSubTeamApply(parentTeamId: TeamPartition): UseSubTeamApply {
  const [applicantTeamId, setApplicantTeamIdState] = useState<TeamPartition>(parentTeamId);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [agreedDocIds, setAgreedDocIds] = useState<AgreedDocIds>({});

  const applyContextQuery = useGetSubTeamApplyContext(parentTeamId);
  const myTeamsQuery = useQuery({
    queryKey: ["listAdminTeams", "subTeamApply"],
    queryFn: () => listAdminTeamsHandler(undefined),
  });

  const saveDraftMutation = useSaveSubTeamApplicationDraft();
  const submitMutation = useSubmitApplication();
  const deleteDraftMutation = useDeleteSubTeamApplicationDraft();

  // Refs mirror the latest state so the debounced autosave and submit()
  // always read the current value, like Dioxus's `signal.read()` inside a
  // spawned task (which sees the latest value regardless of closure age).
  const formValuesRef = useRef(formValues);
  formValuesRef.current = formValues;
  const agreedDocIdsRef = useRef(agreedDocIds);
  agreedDocIdsRef.current = agreedDocIds;
  const applicantTeamIdRef = useRef(applicantTeamId);
  applicantTeamIdRef.current = applicantTeamId;

  const myTeamsList = myTeamsQuery.data?.items ?? [];
  const applyContext = applyContextQuery.data ?? EMPTY_CONTEXT;

  // Auto-pick the viewer's first admin team once `myTeams` resolves — only
  // while the applicant is still unset (mirrors the parent placeholder).
  useEffect(() => {
    if (myTeamsList.length === 0) return;
    if (applicantTeamId !== "" && applicantTeamId !== parentTeamId) return;
    const first = myTeamsList[0];
    const firstId = first.pk.replace(/^TEAM#/, "");
    setApplicantTeamIdState(firstId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeamsList, parentTeamId]);

  // Linked-field prefill — subscribes only to applicantTeamId / myTeams /
  // form_fields; reads formValues from the ref so its own set() doesn't loop.
  useEffect(() => {
    const team = myTeamsList.find((t) => t.pk.replace(/^TEAM#/, "") === applicantTeamId);
    if (!team) return;
    const fields = applyContext.form_fields;
    let changed = false;
    const next = { ...formValuesRef.current };
    for (const f of fields) {
      if (!f.linked_to) continue;
      const value = linkedValue(f.linked_to, team);
      const prev = typeof next[f.id] === "string" ? (next[f.id] as string) : undefined;
      if (prev !== value) {
        next[f.id] = value;
        changed = true;
      }
    }
    if (changed) setFormValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicantTeamId, myTeamsList, applyContext.form_fields]);

  // Two-step hydration, one-shot per mount: in-flight application first,
  // draft second. Guarded by a ref so it never re-fires.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (applicantTeamId === "" || applicantTeamId === parentTeamId) return;
    hydratedRef.current = true;
    const requiredDocs = applyContext.required_docs
      .filter((d) => d.required)
      .map((d) => [d.id, d.body_hash] as const);
    void (async () => {
      try {
        const page = await listChildApplicationsHandler(applicantTeamId, undefined);
        const inFlight = page.items.find(
          (a) => a.parent_team_id === parentTeamId && IN_FLIGHT_STATUSES.includes(a.status),
        );
        if (inFlight) {
          setFormValues(inFlight.form_values as FormValues);
          setAgreedDocIds(Object.fromEntries(requiredDocs));
          return;
        }
      } catch {
        // ignore — fall through to draft hydration
      }
      try {
        const draft = await getSubTeamApplicationDraftHandler(applicantTeamId, parentTeamId);
        if (draft) {
          setFormValues(draft.form_values as FormValues);
          setAgreedDocIds(Object.fromEntries(draft.doc_agreements.map((a) => [a.doc_id, a.body_hash])));
        }
      } catch {
        // ignore — no draft yet
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicantTeamId, parentTeamId]);

  const saveDraft = useCallback(() => {
    const applicant = applicantTeamIdRef.current;
    if (applicant === "" || applicant === parentTeamId) return;
    const agreements = Object.entries(agreedDocIdsRef.current).map(([doc_id, body_hash]) => ({
      doc_id,
      body_hash,
    }));
    saveDraftMutation.mutate({
      teamPk: applicant,
      body: {
        parent_team_id: parentTeamId,
        form_values: formValuesRef.current as never,
        doc_agreements: agreements,
      },
    });
  }, [parentTeamId, saveDraftMutation]);

  const saveVersionRef = useRef(0);
  const bumpSave = useCallback(() => {
    saveVersionRef.current += 1;
    const ver = saveVersionRef.current;
    setTimeout(() => {
      if (saveVersionRef.current !== ver) return;
      saveDraft();
    }, 2000);
  }, [saveDraft]);

  const setFieldValue = useCallback(
    (fieldId: string, value: unknown) => {
      setFormValues((prev) => ({ ...prev, [fieldId]: value }));
      bumpSave();
    },
    [bumpSave],
  );

  const agreeDoc = useCallback(
    (docId: string, bodyHash: string) => {
      setAgreedDocIds((prev) => ({ ...prev, [docId]: bodyHash }));
      bumpSave();
    },
    [bumpSave],
  );

  const submit = useCallback(async (): Promise<string> => {
    const applicant = applicantTeamIdRef.current;
    const agreements = Object.entries(agreedDocIdsRef.current).map(([doc_id, body_hash]) => ({
      doc_id,
      body_hash,
    }));
    const resp = await submitMutation.mutateAsync({
      teamPk: applicant,
      body: {
        parent_team_id: parentTeamId,
        form_values: formValuesRef.current as never,
        doc_agreements: agreements,
      },
    });
    try {
      await deleteDraftMutation.mutateAsync({ teamPk: applicant, parentTeamId });
    } catch {
      // non-fatal — the draft is stale noise at this point
    }
    return resp.id;
  }, [parentTeamId, submitMutation, deleteDraftMutation]);

  return {
    ready: applyContextQuery.data !== undefined && myTeamsQuery.data !== undefined,
    parentTeamId,
    applicantTeamId,
    setApplicantTeamId: setApplicantTeamIdState,
    applyContext,
    myTeams: myTeamsList,
    formValues,
    agreedDocIds,
    setFieldValue,
    agreeDoc,
    submit,
  };
}
