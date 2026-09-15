import type { CreatePanelQuotaGroupRequest, DeletePanelKey, SpacePanelQuotaResponse } from "@ratel/ts-bridges";
import {
  useCreatePanelQuotas,
  useDeletePanelQuotas,
  useListPanels,
  useUpdatePanelQuota,
  useUpdateSpace,
} from "@ratel/ts-bridges/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { useAction, type Action } from "@/lib/use-action";
import { useToast } from "@/lib/toast";
import {
  buildCollectiveGroups,
  buildConditionalGroups,
  dedupKeys,
  isConditionalOption,
  isSelectedOption,
  optionKeys,
  type PanelOption,
} from "./panel-logic";

// app/ratel/src/features/spaces/pages/apps/apps/panels/hooks/use_space_panels.rs —
// the panel list plus every auto-saving mutation of the panel settings arena.
// Successful mutations reload the panel list (and the space for the total
// quota); failures toast.

export interface UseSpacePanels {
  panels: SpacePanelQuotaResponse[];
  /** The panel list is reloading (Rust `panels.loading()`). */
  isSaving: boolean;
  updateTotalQuota: Action<[number]>;
  toggleAttribute: Action<[PanelOption]>;
  moveToConditional: Action<[PanelOption]>;
  updateRowQuota: Action<[string, number]>;
  deleteRow: Action<[string]>;
}

const Context = createContext<UseSpacePanels | null>(null);
export const SpacePanelsProvider = Context.Provider;

export function useSpacePanels(): UseSpacePanels {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSpacePanels must be used under SpacePanelsProvider");
  return ctx;
}

/** Builds the controller; `null` until the panel list loads. */
export function useSpacePanelsController(spaceId: string): UseSpacePanels | null {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { space } = useSpaceAppsContext();

  const panelsQuery = useListPanels(spaceId, { throwOnError: true });
  const updateSpace = useUpdateSpace();
  const createPanelQuotas = useCreatePanelQuotas();
  const deletePanelQuotas = useDeletePanelQuotas();
  const updatePanelQuota = useUpdatePanelQuota();

  const current = panelsQuery.data ?? [];
  const currentQuota = space.quota;
  const restartPanels = () => queryClient.invalidateQueries({ queryKey: ["listPanels", spaceId] });

  /** `rebuild_panels`: delete the old rows, then create the new groups. */
  const rebuildPanels = async (keys: DeletePanelKey[], groups: CreatePanelQuotaGroupRequest[]) => {
    if (keys.length > 0) await deletePanelQuotas.mutateAsync({ spaceId, req: { keys } });
    if (groups.length > 0) {
      await createPanelQuotas.mutateAsync({ spaceId, req: { attributes: [], attributes_vec: groups } });
    }
  };

  const updateTotalQuota = useAction(async (nextQuota: number) => {
    try {
      await updateSpace.mutateAsync({ spaceId, req: { quotas: nextQuota } });
      void queryClient.invalidateQueries({ queryKey: ["getSpace", spaceId] });
      void restartPanels();
    } catch (err) {
      console.error("Failed to update panel total quota:", err);
      toast.error(err);
    }
  });

  const toggleAttribute = useAction(async (option: PanelOption) => {
    const hasUniversity = isSelectedOption("University", current);
    const hasAge = isSelectedOption("Age", current);
    const hasGender = isSelectedOption("Gender", current);
    const isAgeConditional = isConditionalOption("Age", current);
    const isGenderConditional = isConditionalOption("Gender", current);

    const nextUni = option === "University" ? !hasUniversity : hasUniversity;
    const nextAge = option === "Age" ? !hasAge : hasAge;
    const nextGender = option === "Gender" ? !hasGender : hasGender;
    const nextAgeConditional = option === "Age" ? false : isAgeConditional;
    const nextGenderConditional = option === "Gender" ? false : isGenderConditional;

    const keys = dedupKeys([
      ...optionKeys("University", current),
      ...optionKeys("Age", current),
      ...optionKeys("Gender", current),
    ]);

    const groups = buildCollectiveGroups(nextUni, nextAge && !nextAgeConditional, nextGender && !nextGenderConditional);
    if (nextAge && nextAgeConditional) {
      groups.push(...buildConditionalGroups("Age", currentQuota, nextGenderConditional));
    }
    if (nextGender && nextGenderConditional && !nextAgeConditional) {
      groups.push(...buildConditionalGroups("Gender", currentQuota, false));
    }

    try {
      await rebuildPanels(keys, groups);
      void restartPanels();
    } catch (err) {
      console.error("Failed to toggle panel:", err);
      toast.error(err);
    }
  });

  const moveToConditional = useAction(async (option: PanelOption) => {
    const willAge = option === "Age" || isConditionalOption("Age", current);
    const willGender = option === "Gender" || isConditionalOption("Gender", current);

    let keys = optionKeys(option, current);
    if (willAge && willGender) {
      const other: PanelOption = option === "Age" ? "Gender" : "Age";
      keys = dedupKeys([...keys, ...optionKeys(other, current)]);
    }

    const groups =
      willAge && willGender
        ? buildConditionalGroups("Age", currentQuota, true)
        : buildConditionalGroups(option, currentQuota, false);

    try {
      await rebuildPanels(keys, groups);
      void restartPanels();
    } catch (err) {
      console.error("Failed to move to conditional:", err);
      toast.error(err);
    }
  });

  const updateRowQuota = useAction(async (panelId: string, quota: number) => {
    try {
      await updatePanelQuota.mutateAsync({ spaceId, req: { panel_id: panelId, quota } });
      void restartPanels();
    } catch (err) {
      console.error("Failed to update panel row quota:", err);
      toast.error(err);
    }
  });

  const deleteRow = useAction(async (panelId: string) => {
    try {
      await deletePanelQuotas.mutateAsync({ spaceId, req: { keys: [{ panel_id: panelId }] } });
      void restartPanels();
    } catch (err) {
      console.error("Failed to delete panel row:", err);
      toast.error(err);
    }
  });

  if (panelsQuery.data === undefined) return null;

  return {
    panels: panelsQuery.data,
    isSaving: panelsQuery.isFetching,
    updateTotalQuota,
    toggleAttribute,
    moveToConditional,
    updateRowQuota,
    deleteRow,
  };
}
