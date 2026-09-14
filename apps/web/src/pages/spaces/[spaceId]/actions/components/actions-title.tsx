import { Info } from "@/components/icons/help-support";
import { ContentAlign, ContentSide, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// The `h3` + info tooltip heading shared by the creator / participant / viewer
// action pages (identical RSX in each Rust view).
export function ActionsTitle({ title, tooltip }: { title: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-2">
      <h3>{title}</h3>
      <Tooltip>
        <TooltipTrigger>
          <Info
            width="16"
            height="16"
            className="h-4 w-4 [&>path]:stroke-text-secondary [&>path]:fill-none [&>circle]:stroke-text-secondary [&>circle]:fill-current cursor-pointer"
          />
        </TooltipTrigger>
        <TooltipContent side={ContentSide.Bottom} align={ContentAlign.Start}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
