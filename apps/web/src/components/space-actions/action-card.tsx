import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { SpaceActionSummary, SpaceActionType } from "@ratel/ts-bridges";
import { useDeleteSpaceAction } from "@ratel/ts-bridges/hooks";
import { Delete2 } from "@/components/icons/edit";
import { Lock1 } from "@/components/icons/security";
import { Badge, BadgeColor, BadgeVariant } from "@/components/ui/badge";
import { SpaceCard } from "@/components/ui/space-card";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useActionCardI18n } from "./action-card.i18n";
import { usePopup } from "@/lib/popup";
import { useToast } from "@/lib/toast";
import { isActionLocked } from "./access";
import { summaryUrl } from "./action-urls";
import { DeleteActionPopup } from "./delete-action";
import { useSpace, useSpaceRole } from "@/components/space/space-context";

// app/ratel/src/features/spaces/pages/actions/components/action_card.

type ActionStatus = "Draft" | "Ongoing" | "Closed";

function resolveActionStatus(action: SpaceActionSummary): ActionStatus {
  if (action.status === "Ongoing") return "Ongoing";
  if (action.status === "Finish") return "Closed";
  return "Draft";
}

const STATUS_BADGE_COLOR: Record<ActionStatus, BadgeColor> = {
  Draft: BadgeColor.Grey,
  Ongoing: BadgeColor.Green,
  Closed: BadgeColor.Red,
};

const TYPE_BADGE_COLOR: Record<SpaceActionType, BadgeColor> = {
  Poll: BadgeColor.Orange,
  TopicDiscussion: BadgeColor.Blue,
  Follow: BadgeColor.Pink,
  Quiz: BadgeColor.Purple,
  Meet: BadgeColor.Green,
  Announcement: BadgeColor.Grey,
};

export function formatWithCommas(value: number): string {
  const negative = value < 0;
  const digits = String(Math.abs(Math.trunc(value)));
  let formatted = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) formatted += ",";
    formatted += digits[i];
  }
  return negative ? `-${formatted}` : formatted;
}

export interface ActionCardProps {
  action: SpaceActionSummary;
  spaceId: string;
  deletable?: boolean;
  onDeleted?: () => void;
}

export function ActionCard({ action, spaceId, deletable = false, onDeleted }: ActionCardProps) {
  const tr = useActionCardI18n();
  const enumT = useEnumI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const popup = usePopup();
  const space = useSpace();
  const role = useSpaceRole();
  const remove = useDeleteSpaceAction();

  const status = resolveActionStatus(action);
  const statusLabel = status === "Draft" ? tr.statusDraft : status === "Ongoing" ? tr.statusOngoing : tr.statusClosed;
  const typeLabel = {
    Poll: tr.actionTypePoll,
    TopicDiscussion: tr.actionTypeDiscussion,
    Follow: tr.actionTypeFollow,
    Quiz: tr.actionTypeQuiz,
    Meet: tr.actionTypeMeet,
    Announcement: enumT("SpaceActionType", "Announcement"),
  }[action.action_type];
  const pointValue = action.total_point ?? 0;
  const points = `${formatWithCommas(pointValue)} P`;
  const scoreValue = action.total_score ?? 0;
  const score = scoreValue >= 0 ? `+${scoreValue}` : String(scoreValue);
  const hasStats = pointValue !== 0 || scoreValue !== 0;
  const quizScoreText =
    action.quiz_score !== null && action.quiz_total_score !== null
      ? `${action.quiz_score}/${action.quiz_total_score}`
      : null;
  const quizResultLabel = action.quiz_passed === null ? null : action.quiz_passed ? tr.quizPass : tr.quizFailed;

  const title = action.title === "" ? tr.untitled : action.title;
  const description = action.description === "" ? tr.noDescription : action.description;
  const isClosed = status === "Closed";
  const isLocked =
    role !== "Creator" &&
    ((action.depends_on.length > 0 && !action.dependencies_met) ||
      (action.required_attributes.length > 0 && !action.required_attributes_met));
  const lockReason =
    action.depends_on.length > 0 && !action.dependencies_met ? tr.dependenciesNotMet : tr.requiredAttributesNotMet;
  const cardClass = isLocked
    ? "flex flex-col w-full text-left border transition-colors gap-[0.625rem] !rounded-[1rem] !bg-neutral-900 light:!bg-white !p-[0.9375rem] border-neutral-800 light:border-neutral-300 opacity-60 cursor-not-allowed"
    : isClosed
      ? "flex flex-col w-full text-left border transition-colors cursor-pointer gap-[0.625rem] !rounded-[1rem] !bg-neutral-900 light:!bg-white !p-[0.9375rem] border-neutral-800 light:border-neutral-300 opacity-60"
      : "flex flex-col w-full text-left border transition-colors cursor-pointer gap-[0.625rem] !rounded-[1rem] !bg-neutral-900 light:!bg-white !p-[0.9375rem] border-neutral-800 light:border-neutral-300 light:hover:!bg-neutral-50 hover:!bg-neutral-800";

  const onDeleteClick = (evt: MouseEvent) => {
    evt.stopPropagation();
    evt.preventDefault();
    const onConfirm = () => {
      remove
        .mutateAsync({ spaceId, actionId: action.action_id })
        .then(() => {
          popup.close();
          toast.info(tr.deletedSuccessfully);
          if (onDeleted) onDeleted();
          else navigate(`/spaces/${spaceId}/actions`);
        })
        .catch((err) => toast.error(err));
    };
    popup.open(<DeleteActionPopup onConfirm={onConfirm} onCancel={() => popup.close()} />);
  };

  return (
    <SpaceCard
      className={cardClass}
      onClick={() => {
        if (isLocked) {
          toast.info(lockReason);
          return;
        }
        if (role !== "Creator") {
          const spaceStatus = space.status;
          const enableAction = action.prerequisite && (spaceStatus === "Open" || spaceStatus === "Ongoing");
          if (!enableAction) {
            if (spaceStatus !== "Ongoing") {
              toast.error(new Error(enumT("Error", "SpaceNotStarted")));
              return;
            }
            if (status === "Closed") {
              toast.error(new Error(enumT("Error", "ActionEnded")));
              return;
            }
          }
        }
        navigate(summaryUrl(spaceId, action));
      }}
    >
      {/* Top: badges + delete */}
      <div className="flex gap-3 justify-between items-start w-full max-mobile:flex-col">
        <div className="flex gap-2 items-center">
          <Badge color={TYPE_BADGE_COLOR[action.action_type]} variant={BadgeVariant.Rounded}>
            {typeLabel}
          </Badge>

          {action.action_type !== "Follow" && (
            <Badge color={STATUS_BADGE_COLOR[status]} variant={BadgeVariant.Rounded}>
              {statusLabel}
            </Badge>
          )}

          {action.prerequisite && (
            <Badge color={BadgeColor.Red} variant={BadgeVariant.Rounded}>
              {tr.prerequisite}
            </Badge>
          )}

          {isLocked && (
            <Badge color={BadgeColor.Grey} variant={BadgeVariant.Rounded}>
              {tr.locked}
            </Badge>
          )}
        </div>

        <div className="flex gap-2 items-center max-mobile:self-end">
          {deletable && !isActionLocked(space.status, action.status) && (
            <button
              type="button"
              aria-label={tr.deleteAction}
              className="inline-flex justify-center items-center w-8 h-8 transition-colors duration-150 text-neutral-500 light:hover:text-neutral-700 hover:text-neutral-200"
              onClick={onDeleteClick}
            >
              <Delete2 className="w-4 h-4 [&>path]:stroke-current [&>path]:fill-none" />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <p
        className={`w-full font-semibold text-[1.125rem]/[1.75rem] truncate ${action.title === "" ? "text-foreground-muted italic" : "text-text-primary"}`}
      >
        {title}
      </p>

      {/* Description */}
      <div
        className={`flex-1 w-full min-h-0 font-medium break-words line-clamp-1 text-[0.75rem]/[1rem] text-foreground-muted${action.description === "" ? "  text-text-primary" : ""}`}
        dangerouslySetInnerHTML={{ __html: description }}
      />

      {isLocked && (
        <div className="flex gap-1.5 items-center font-medium text-[0.75rem]/[1rem] text-foreground-muted">
          <Lock1 width="14" height="14" className="[&>path]:stroke-current" />
          <span>{lockReason}</span>
        </div>
      )}

      {hasStats && (
        // Bottom: points + score (border-top as separator)
        <div className="flex gap-2 items-center w-full border-t border-neutral-800 light:border-neutral-300 pt-[0.6875rem]">
          {pointValue !== 0 && (
            <span className="inline-flex items-center font-semibold text-white gap-[6px] h-[32px] px-[10px] rounded-[10px] bg-neutral-800/50 light:bg-neutral-100 light:text-neutral-900 text-[15px]/[22px]">
              {points}
            </span>
          )}
          {scoreValue !== 0 && (
            <span className="inline-flex items-center font-semibold text-white gap-[6px] h-[32px] px-[10px] rounded-[10px] bg-neutral-800/50 light:bg-neutral-100 light:text-neutral-900 text-[15px]/[22px]">
              {score}
            </span>
          )}
        </div>
      )}

      {action.action_type === "Quiz" && quizScoreText !== null && (
        <div className="flex gap-2 justify-end mt-auto w-full">
          {quizResultLabel !== null && (
            <span
              className={`inline-flex items-center px-2.5 font-semibold h-[26px] rounded-[8px] text-[12px]/[18px] ${action.quiz_passed === true ? "bg-sp-act-quiz-pass-bg text-sp-act-quiz-pass-text" : "bg-sp-act-quiz-fail-bg text-sp-act-quiz-fail-text"}`}
            >
              {quizResultLabel}
            </span>
          )}
          <span className="inline-flex items-center px-2.5 font-semibold h-[26px] rounded-[8px] bg-primary/20 text-[12px]/[18px] text-primary">
            {quizScoreText}
          </span>
        </div>
      )}
    </SpaceCard>
  );
}
