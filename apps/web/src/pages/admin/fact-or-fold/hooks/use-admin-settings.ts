import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getSettingsHandler, updateSettingsHandler } from "@ratel/ts-bridges";
import type { FactOrFoldSettingsResponse, UpdateFactOrFoldSettingsRequest } from "@ratel/ts-bridges";
import { FF_SETTINGS_KEY } from "./use-admin-subjects";

// app/ratel/src/features/arcade/games/fact_or_fold/hooks/use_admin_settings.rs
// (`UseFactFoldAdminSettings`): the tunable-parameters singleton and `save`,
// which persists a patch and reloads the singleton.
export function useAdminSettings() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: FF_SETTINGS_KEY, queryFn: () => getSettingsHandler() });
  return {
    settings: data,
    save: async (patch: UpdateFactOrFoldSettingsRequest): Promise<FactOrFoldSettingsResponse> => {
      const next = await updateSettingsHandler(patch);
      void queryClient.invalidateQueries({ queryKey: FF_SETTINGS_KEY });
      return next;
    },
  };
}
