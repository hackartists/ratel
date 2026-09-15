import { useNavigate } from "react-router-dom";
import { useDeleteSpaceAction } from "@ratel/ts-bridges/hooks";
import { Button, ButtonStyle } from "@/components/ui/button";
import { useDeleteActionButtonI18n } from "./delete-action-button.i18n";
import { useDeleteActionPopupI18n } from "./delete-action-popup.i18n";
import { usePopup } from "@/lib/popup";
import { useToast } from "@/lib/toast";
import { useSpaceContext } from "@/components/space/space-context";

// app/ratel/src/features/spaces/pages/actions/components/{delete_action_popup,delete_action_button}.

export interface DeleteActionPopupProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteActionPopup({ onConfirm, onCancel }: DeleteActionPopupProps) {
  const tr = useDeleteActionPopupI18n();
  return (
    <div className="flex flex-col w-[480px] max-w-full gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="text-lg font-bold text-text-primary text-center">{tr.title}</div>
        <div className="text-sm text-text-secondary leading-6 text-center">{tr.description}</div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="h-10 px-4 rounded-lg border border-neutral-300 text-text-primary transition-colors duration-150 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onCancel()}
        >
          {tr.cancel}
        </button>
        <button
          type="button"
          className="h-10 px-4 rounded-lg bg-red-600 text-white font-semibold transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onConfirm()}
        >
          {tr.confirm}
        </button>
      </div>
    </div>
  );
}

export interface ActionDeleteButtonProps {
  spaceId: string;
  actionId: string;
}

/** Danger-zone delete: confirm popup → delete → refresh the space actions → back to the space home. */
export function ActionDeleteButton({ spaceId, actionId }: ActionDeleteButtonProps) {
  const tr = useDeleteActionButtonI18n();
  const toast = useToast();
  const popup = usePopup();
  const navigate = useNavigate();
  const refreshActions = useSpaceContext().restartActions; // space_ctx.actions.restart()
  const remove = useDeleteSpaceAction();

  const onConfirm = () => {
    remove
      .mutateAsync({ spaceId, actionId })
      .then(() => {
        popup.close();
        toast.info(tr.deleteSuccess);
        refreshActions();
        // `replace` so the deleted editor URL isn't left in history.
        navigate(`/spaces/${spaceId}`, { replace: true });
      })
      .catch((err) => toast.error(err));
  };

  return (
    <div className="flex justify-end pt-5 w-full max-tablet:justify-stretch">
      <Button
        className="border w-fit self-end max-tablet:w-full border-web-error/70 !bg-transparent !text-web-error transition-colors duration-150 hover:!bg-web-error/10 hover:!border-web-error hover:!text-web-error disabled:!bg-transparent disabled:border-web-error/40 disabled:!text-web-error/40"
        buttonStyle={ButtonStyle.Text}
        onClick={() => popup.open(<DeleteActionPopup onConfirm={onConfirm} onCancel={() => popup.close()} />)}
      >
        {tr.deleteAction}
      </Button>
    </div>
  );
}
