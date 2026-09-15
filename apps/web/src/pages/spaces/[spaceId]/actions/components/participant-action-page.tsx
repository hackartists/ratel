import { ActionCard } from "@/components/space-actions/action-card";
import { useSpaceActionList } from "@/components/space-actions/use-space-action-list";
import { useParticipantActionPageI18n } from "./participant-action-page.i18n";
import { ActionsTitle } from "./actions-title";

// app/ratel/src/features/spaces/pages/actions/views/main/participant_page.
export function ParticipantActionPage({ spaceId }: { spaceId: string }) {
  const tr = useParticipantActionPageI18n();
  const actions = useSpaceActionList(spaceId);

  return (
    <div id="participant-action-page" className="flex flex-col gap-5 items-start w-full text-web-font-primary">
      <div className="flex flex-col gap-2.5 mx-auto w-full max-w-[1024px]">
        <ActionsTitle title={tr.title} tooltip={tr.titleTooltip} />

        {actions.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5 w-full tablet:grid-cols-2">
            {actions.map((action) => (
              <ActionCard key={action.action_id} action={action} spaceId={spaceId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
