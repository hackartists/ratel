import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  createSubTeamFormFieldHandler,
  deleteSubTeamFormFieldHandler,
  listSubTeamFormFieldsHandler,
  reorderSubTeamFormFieldsHandler,
  updateSubTeamFormFieldHandler,
} from "@ratel/ts-bridges";
import type {
  CreateSubTeamFormFieldRequest,
  ListResponse,
  SubTeamFormFieldResponse,
  UpdateSubTeamFormFieldRequest,
} from "@ratel/ts-bridges";

// app/ratel/src/features/sub_team/hooks/use_sub_team_form.rs — installed by
// `FormTab`. Every action restarts the form-fields loader.

export interface UseSubTeamForm {
  fields: ListResponse<SubTeamFormFieldResponse>;
  handleCreateField: (req: CreateSubTeamFormFieldRequest) => void;
  handleUpdateField: (fieldId: string, req: UpdateSubTeamFormFieldRequest) => void;
  handleDeleteField: (fieldId: string) => void;
  handleReorder: (fieldIds: string[]) => void;
}

/** `UpdateSubTeamFormFieldRequest { ..Default::default() }`. */
export const EMPTY_FIELD_UPDATE: UpdateSubTeamFormFieldRequest = {
  label: null,
  field_type: null,
  required: null,
  order: null,
  options: null,
  linked_to: null,
};

export function useSubTeamForm(teamId: string): UseSubTeamForm {
  const fields = useSuspenseQuery({
    queryKey: ["subTeamManage", "listSubTeamFormFields", teamId],
    queryFn: () => listSubTeamFormFieldsHandler(teamId),
  });
  const restart = fields.refetch;

  const run = useCallback(
    (label: string, fn: () => Promise<unknown>) => {
      void (async () => {
        try {
          await fn();
          await restart();
        } catch (e) {
          console.error(`${label} failed:`, e);
        }
      })();
    },
    [restart],
  );

  return {
    fields: fields.data,
    handleCreateField: (req) =>
      run("create_sub_team_form_field", () => createSubTeamFormFieldHandler(teamId, req)),
    handleUpdateField: (fieldId, req) =>
      run("update_sub_team_form_field", () => updateSubTeamFormFieldHandler(teamId, fieldId, req)),
    handleDeleteField: (fieldId) =>
      run("delete_sub_team_form_field", () => deleteSubTeamFormFieldHandler(teamId, fieldId)),
    handleReorder: (fieldIds) =>
      run("reorder_sub_team_form_fields", () => reorderSubTeamFormFieldsHandler(teamId, { field_ids: fieldIds })),
  };
}
