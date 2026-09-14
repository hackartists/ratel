import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getAiModeratorConfig, updateAiModeratorConfig } from "@ratel/ts-bridges";
import { Info } from "@/components/icons/help-support";
import { Card, CardDirection } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CrossAxisAlign, MainAxisAlign } from "@/components/ui/layout";
import { Switch } from "@/components/ui/switch";
import { TextArea } from "@/components/ui/textarea";
import { ContentAlign, ContentSide, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAiModeratorSettingI18n } from "@/i18n/generated/features/ai_moderator/components/ai-moderator-setting.i18n";
import { useToast } from "@/lib/toast";
import { MaterialList } from "./material-list";

// app/ratel/src/features/ai_moderator/components/ai_moderator_setting.
//
// Rust binds the toggle to `PremiumSwitch` (a membership-gated Switch); that
// component's React port is deferred pending the membership-query work (see
// docs/superpower/2026-09-14-react-frontend-migration.md §9.1, P1 "보류").
// This uses the plain `Switch` instead — same boolean toggle behavior, no
// membership gate — and should switch to `PremiumSwitch` once it lands.
export function AiModeratorSetting({ spaceId, discussionId }: { spaceId: string; discussionId: string }) {
  const tr = useAiModeratorSettingI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["getAiModeratorConfig", spaceId, discussionId];
  const config = useSuspenseQuery({
    queryKey,
    queryFn: () => getAiModeratorConfig(spaceId, discussionId),
  }).data;

  const [enabled, setEnabled] = useState(config.enabled);
  const [replyInterval, setReplyInterval] = useState(config.reply_interval);
  const [guidelines, setGuidelines] = useState(config.guidelines);
  const [saveVersion, setSaveVersion] = useState(0);

  // Resync local state when the server value changes underneath us
  // (another tab, a refetch after an unrelated mutation, ...).
  const lastSynced = useRef({ enabled: config.enabled, replyInterval: config.reply_interval, guidelines: config.guidelines });
  useEffect(() => {
    const latest = { enabled: config.enabled, replyInterval: config.reply_interval, guidelines: config.guidelines };
    const prev = lastSynced.current;
    if (prev.enabled !== latest.enabled || prev.replyInterval !== latest.replyInterval || prev.guidelines !== latest.guidelines) {
      lastSynced.current = latest;
      setEnabled(latest.enabled);
      setReplyInterval(latest.replyInterval);
      setGuidelines(latest.guidelines);
    }
  }, [config.enabled, config.reply_interval, config.guidelines]);

  const save = (next: { enabled: boolean; replyInterval: number; guidelines: string }) => {
    updateAiModeratorConfig(spaceId, discussionId, {
      enabled: next.enabled,
      reply_interval: next.replyInterval,
      guidelines: next.guidelines,
    })
      .then(() => {
        toast.info(tr.configSaved);
        void queryClient.invalidateQueries({ queryKey });
      })
      .catch((e) => toast.error(e));
  };

  // Debounced autosave — 3 seconds after the last reply-interval/guidelines edit.
  const latestDraft = useRef({ enabled, replyInterval, guidelines });
  latestDraft.current = { enabled, replyInterval, guidelines };
  useEffect(() => {
    if (saveVersion === 0) return;
    const timer = window.setTimeout(() => {
      save(latestDraft.current);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [saveVersion]);

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    save({ enabled: next, replyInterval, guidelines });
  };

  const labelClass = "font-semibold font-raleway text-[13px]/[16px] tracking-[-0.14px] text-web-font-neutral";

  return (
    <Collapsible open={enabled}>
      <CollapsibleTrigger
        as={(attrs) => (
          <Card
            {...attrs}
            direction={CardDirection.Row}
            mainAxisAlign={MainAxisAlign.Between}
            crossAxisAlign={CrossAxisAlign.Center}
            className={enabled ? "!rounded-b-none" : ""}
          >
            <div className="flex gap-1 items-center">
              <p className="font-semibold font-raleway text-[15px]/[18px] tracking-[-0.16px] text-web-font-primary">
                {tr.aiModerator}
              </p>
              <Tooltip>
                <TooltipTrigger>
                  <Info
                    width="14"
                    height="14"
                    className="cursor-help text-web-font-neutral [&>path]:stroke-current [&>circle]:fill-current [&>path]:fill-none"
                  />
                </TooltipTrigger>
                <TooltipContent side={ContentSide.Bottom} align={ContentAlign.Start}>
                  {tr.aiModeratorTooltip}
                </TooltipContent>
              </Tooltip>
            </div>
            <div data-testid="ai-moderator-toggle">
              <Switch active={enabled} label={tr.enableAiModerator} onToggle={() => toggleEnabled()} />
            </div>
          </Card>
        )}
      />
      <CollapsibleContent>
        <Card className="gap-4 w-full !rounded-t-none">
          <div className="flex flex-col gap-2.5 w-full">
            <p className={labelClass}>{tr.replyIntervalLabel}</p>
            <div className="flex gap-3 items-center">
              <input
                type="number"
                data-testid="ai-moderator-reply-interval"
                className="font-semibold text-right !w-[120px] font-raleway text-[15px]/[18px] tracking-[-0.16px]"
                value={replyInterval}
                onChange={(e) => {
                  const val = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                  setReplyInterval(val);
                  setSaveVersion((v) => v + 1);
                }}
              />
              <span className="text-[13px] text-foreground-muted">{tr.replyIntervalSuffix}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 w-full">
            <p className={labelClass}>{tr.guidelinesLabel}</p>
            <TextArea
              data-testid="ai-moderator-guidelines"
              className="w-full min-h-[100px]"
              placeholder={tr.guidelinesPlaceholder}
              value={guidelines}
              onChange={(e) => {
                setGuidelines(e.target.value);
                setSaveVersion((v) => v + 1);
              }}
            />
          </div>

          <MaterialList spaceId={spaceId} discussionId={discussionId} />

          <div className="flex gap-5 items-start p-5 w-full rounded-[12px] border border-web-card-stroke3 bg-web-card-bg2">
            <Info
              width="18"
              height="18"
              className="mt-0.5 shrink-0 text-web-font-neutral [&>path]:stroke-current [&>circle]:fill-current [&>path]:fill-none"
            />
            <div className="flex flex-col flex-1 gap-2 min-w-0">
              <p className="font-semibold font-raleway text-[15px]/[18px] tracking-[-0.16px] text-web-font-primary">
                {tr.howItWorks}
              </p>
              <ul className="pl-4 font-medium list-disc text-[13px]/[20px] font-raleway text-web-font-body">
                <li>{tr.infoLineOne}</li>
                <li>{tr.infoLineTwo}</li>
                <li>{tr.infoLineThree}</li>
              </ul>
            </div>
          </div>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
