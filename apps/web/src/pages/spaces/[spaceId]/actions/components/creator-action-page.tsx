import { ActionCard } from "@/components/space-actions/action-card";
import { ActionSettingsModal } from "@/components/space-actions/action-settings-modal";
import { CreateActionModal } from "@/components/space-actions/create-action-modal";
import { useSpaceActionList } from "@/components/space-actions/use-space-action-list";
import { useSpaceContext } from "@/components/space/space-context";
import { Thunder } from "@/components/icons/game";
import { Settings2 } from "@/components/icons/settings";
import { AddCircle } from "@/components/icons/validations";
import { Button, ButtonShape, ButtonSize, ButtonStyle } from "@/components/ui/button";
import { SpaceCard } from "@/components/ui/space-card";
import { useCreatorActionPageI18n } from "./creator-action-page.i18n";
import { LayoverSize, useLayover } from "@/lib/layover";
import { ActionsTitle } from "./actions-title";

// app/ratel/src/features/spaces/pages/actions/views/main/creator_page.
export function CreatorActionPage({ spaceId }: { spaceId: string }) {
  const tr = useCreatorActionPageI18n();
  const layover = useLayover();
  const actions = useSpaceActionList(spaceId);
  const refreshActions = useSpaceContext().restartActions;

  return (
    <div id="creator-action-page" className="flex flex-col gap-5 items-start w-full text-web-font-primary">
      <div className="flex flex-col gap-2.5 mx-auto w-full max-w-[1024px]">
        <div className="flex justify-between items-center w-full max-mobile:flex-col max-mobile:items-stretch max-mobile:gap-3">
          <ActionsTitle title={tr.title} tooltip={tr.titleTooltip} />

          <Button
            size={ButtonSize.Medium}
            buttonStyle={ButtonStyle.Secondary}
            shape={ButtonShape.Square}
            className="inline-flex border-action-type-card-border hover:border-action-type-card-border font-raleway max-mobile:w-full bg-action-type-card-bg hover:bg-action-type-card-bg text-btn-action-settings-text hover:text-btn-action-settings-text hover:opacity-90"
            onClick={() => {
              layover.open(
                "space-action-settings-layover",
                "",
                <ActionSettingsModal spaceId={spaceId} actions={actions} onApplied={refreshActions} />,
              );
              layover.setSize(LayoverSize.Small);
            }}
          >
            <div className="flex flex-row gap-2.5 justify-center items-center">
              <Settings2
                width="16"
                height="16"
                className="[&>path]:fill-current [&>circle]:stroke-current [&>circle]:fill-none"
              />
              <span>{tr.buttonSettingsLabel}</span>
            </div>
          </Button>
        </div>

        {/* Empty state card */}
        <SpaceCard className="flex flex-col gap-5 justify-center items-center w-full border border-dashed border-neutral-800 light:border-neutral-300 !bg-neutral-900 light:!bg-neutral-100 !rounded-[0.75rem] !px-4 !pt-[0.625rem] !pb-5">
          <Thunder className="size-6 [&>path]:fill-none [&>path]:stroke-neutral-400 light:[&>path]:stroke-neutral-500" />
          <p className="font-medium text-[1.0625rem]/[1.25rem] text-font-primary">{tr.noActionsTitle}</p>

          <Button
            buttonStyle={ButtonStyle.Secondary}
            onClick={() => {
              layover.open("space-actions-layover", tr.layoverTitle, <CreateActionModal spaceId={spaceId} />);
              layover.setSize(LayoverSize.Half);
            }}
          >
            <div className="flex flex-row gap-2 justify-center items-center w-full">
              <AddCircle
                width="24"
                height="24"
                className="[&>circle]:fill-none [&>circle]:stroke-neutral-900 [&>path]:stroke-neutral-900"
              />
              <span>{tr.buttonAddActionLabel}</span>
            </div>
          </Button>

          <p className="font-semibold text-center text-[0.75rem]/[1rem] text-neutral-400 light:text-neutral-600">
            {tr.noActionsDescription}
          </p>
        </SpaceCard>

        {/* Action cards grid */}
        {actions.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5 w-full tablet:grid-cols-2">
            {actions.map((action) => (
              <ActionCard
                key={action.action_id}
                action={action}
                spaceId={spaceId}
                deletable
                onDeleted={refreshActions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
