import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { SpaceActionType } from "@ratel/ts-bridges";
import { Discuss } from "@/components/icons/chat";
import { File } from "@/components/icons/file";
import { UserGroup } from "@/components/icons/user";
import { Check } from "@/components/icons/validations";
import { Button, ButtonShape, ButtonStyle } from "@/components/ui/button";
import { SpaceCard } from "@/components/ui/space-card";
import {
  useCreateActionModalI18n,
  type CreateActionModalI18n,
} from "./create-action-modal.i18n";
import { dataBool } from "@/lib/dom";
import { useLayover } from "@/lib/layover";
import { createSpaceAction } from "./use-create-space-action";

// app/ratel/src/features/spaces/pages/actions/components/create_action_modal —
// action type picker with a mock preview. The preview samples are literal
// strings in the Rust source too (not translated), kept verbatim.

export function CreateActionModal({ spaceId }: { spaceId: string }) {
  const tr = useCreateActionModalI18n();
  const navigate = useNavigate();
  const layover = useLayover();
  const [selectedType, setSelectedType] = useState<SpaceActionType | null>("Quiz");
  const [isCreating, setIsCreating] = useState(false);

  const createAction = async () => {
    if (selectedType === null) return;
    if (isCreating) return;
    setIsCreating(true);
    try {
      const url = await createSpaceAction(spaceId, selectedType);
      setIsCreating(false);
      navigate(url);
      layover.close();
    } catch (err) {
      console.error("Failed to create action:", err);
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-action-modal-bg">
      {/* `min-h-0` lets this flex child shrink so `overflow-y-auto` engages. */}
      <div className="flex overflow-y-auto flex-col gap-5 p-[1.875rem] grow min-h-0">
        <div className="grid grid-cols-2 gap-2.5">
          <ActionTypeOption
            testId="action-type-quiz"
            selected={selectedType === "Quiz"}
            disabled={false}
            onClick={() => setSelectedType("Quiz")}
            title={tr.quizTitle}
            caption={tr.quizCaption}
            icon={<File width="22" height="22" className="[&>path]:fill-none [&>path]:stroke-action-type-icon-stroke" />}
          />
          <ActionTypeOption
            testId="action-type-poll"
            selected={selectedType === "Poll"}
            disabled={false}
            onClick={() => setSelectedType("Poll")}
            title={tr.pollTitle}
            caption={tr.pollCaption}
            icon={<Check width="22" height="22" className="[&>path]:fill-none [&>path]:stroke-action-type-icon-stroke" />}
          />
          <ActionTypeOption
            testId="action-type-discussion"
            selected={selectedType === "TopicDiscussion"}
            disabled={false}
            onClick={() => setSelectedType("TopicDiscussion")}
            title={tr.discussionTitle}
            caption={tr.discussionCaption}
            icon={<Discuss width="22" height="22" className="[&>path]:fill-none [&>path]:stroke-action-type-icon-stroke" />}
          />
          <ActionTypeOption
            testId="action-type-follow"
            selected={selectedType === "Follow"}
            disabled={false}
            onClick={() => setSelectedType("Follow")}
            title={tr.followTitle}
            caption={tr.followCaption}
            icon={<UserGroup width="22" height="22" className="[&>path]:fill-none [&>path]:stroke-action-type-icon-stroke" />}
          />
        </div>

        <ActionPreview selected={selectedType} tr={tr} />
      </div>

      {/* Bottom bar */}
      <div className="flex gap-5 justify-end items-center px-5 border-t h-[5.25rem] border-card-border shrink-0">
        <Button
          className="hover:opacity-80 !px-5 !py-3 !text-[0.875rem]/[1rem] !font-bold !text-text-primary"
          buttonStyle={ButtonStyle.Text}
          onClick={() => {
            setIsCreating(false);
            layover.close();
          }}
        >
          {tr.back}
        </Button>
        <Button
          data-testid="create-action-confirm"
          className="hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed !px-5 !py-3 !rounded-[0.625rem] !text-[0.875rem]/[1rem] !font-bold !bg-btn-primary-bg !text-btn-primary-text"
          buttonStyle={ButtonStyle.Text}
          shape={ButtonShape.Square}
          disabled={isCreating || selectedType === null}
          onClick={() => void createAction()}
        >
          {isCreating ? tr.creating : tr.create}
        </Button>
      </div>
    </div>
  );
}

function ActionPreview({ selected, tr }: { selected: SpaceActionType | null; tr: CreateActionModalI18n }) {
  let content: ReactNode;
  switch (selected) {
    case "Poll":
      content = <PollPreview />;
      break;
    case "Quiz":
      content = <QuizPreview />;
      break;
    case "TopicDiscussion":
      content = <DiscussionPreview />;
      break;
    case "Follow":
      content = <FollowPreview />;
      break;
    case "Meet":
      return (
        <SpaceCard className="flex flex-col gap-5 border border-action-type-card-border !bg-action-type-card-bg !rounded-[0.75rem] !p-4">
          <p className="font-medium text-text-primary text-[1.0625rem]/[1.25rem]">{tr.previewTitle}</p>
          <div className="flex justify-center items-center w-full border h-[14.875rem] rounded-[0.75rem] border-action-type-card-border bg-action-preview-inner-bg">
            <p className="text-[0.875rem]/[1.25rem] text-foreground-muted">Meet</p>
          </div>
        </SpaceCard>
      );
    case null:
      return (
        <SpaceCard className="flex flex-col gap-5 border border-action-type-card-border !bg-action-type-card-bg !rounded-[0.75rem] !p-4">
          <p className="font-medium text-text-primary text-[1.0625rem]/[1.25rem]">{tr.previewTitle}</p>
          <div className="flex justify-center items-center w-full border h-[14.875rem] rounded-[0.75rem] border-action-type-card-border bg-action-preview-inner-bg">
            <p className="text-[0.875rem]/[1.25rem] text-foreground-muted">{tr.previewEmpty}</p>
          </div>
        </SpaceCard>
      );
  }

  return (
    <SpaceCard className="flex flex-col gap-3 border border-yellow-400/30 !bg-action-type-card-bg !rounded-[0.75rem] !p-4">
      <p className="font-medium text-text-primary text-[1.0625rem]/[1.25rem]">{tr.previewTitle}</p>
      <div className="flex flex-col gap-3 p-4 w-full border opacity-90 pointer-events-none rounded-[0.75rem] border-action-type-card-border bg-action-preview-inner-bg">
        {content}
      </div>
    </SpaceCard>
  );
}

// Mock poll viewer: time range + a sample question with radio options.
function PollPreview() {
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex gap-2 items-center text-xs text-foreground-muted">
        <span>Mar 12, 2026 00:00</span>
        <span>~</span>
        <span>Mar 19, 2026 00:00</span>
      </div>
      <div className="p-3 rounded-lg border border-action-type-card-border">
        <div className="mb-2 text-xs text-foreground-muted">1 / 2</div>
        <p className="mb-2 text-sm font-medium text-text-primary">Which proposal do you support?</p>
        <div className="flex flex-col gap-1.5">
          {["Proposal A", "Proposal B", "Proposal C"].map((option) => (
            <label key={option} className="flex gap-2 items-center text-sm text-action-preview-option-text">
              <div className="rounded-full border-2 size-4 border-action-preview-radio-border" />
              {option}
            </label>
          ))}
        </div>
      </div>
      <div className="py-2 text-sm font-medium text-center text-action-preview-submit-text rounded-lg bg-action-preview-submit-bg">
        Submit
      </div>
    </div>
  );
}

// Mock quiz viewer: time range + score + a sample question.
function QuizPreview() {
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center text-xs text-foreground-muted">
          <span>Mar 12, 2026 00:00</span>
          <span>~</span>
          <span>Mar 19, 2026 00:00</span>
        </div>
      </div>
      <div className="flex gap-2 items-center text-xs text-foreground-muted">
        <span className="font-medium">Remaining submissions:</span>
        <span>3</span>
      </div>
      <div className="p-3 rounded-lg border border-action-type-card-border">
        <div className="mb-2 text-xs text-foreground-muted">1 / 3</div>
        <p className="mb-2 text-sm font-medium text-text-primary">What is the governance threshold?</p>
        <div className="flex flex-col gap-1.5">
          {["51%", "67%", "75%", "90%"].map((option, i) => (
            <label key={option} className="flex gap-2 items-center text-sm text-action-preview-option-text">
              <div
                className={`size-4 rounded-full border-2 ${i === 1 ? "border-yellow-400 bg-yellow-400/30" : "border-action-preview-radio-border"}`}
              />
              {option}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mock discussion viewer: title + content + comment area.
function DiscussionPreview() {
  return (
    <div className="flex flex-col gap-3 w-full">
      <h3 className="text-base font-bold text-text-primary">Should we increase the staking reward?</h3>
      <div className="flex gap-2 items-center text-xs text-foreground-muted">
        <div className="rounded-full size-5 bg-action-preview-avatar-bg" />
        <span className="font-medium">alice.eth</span>
      </div>
      <p className="text-sm text-foreground-muted line-clamp-2">
        I propose we increase the staking reward from 5% to 8% to incentivize long-term holders and strengthen network
        security...
      </p>
      <hr className="border-action-type-card-border" />
      <p className="text-sm font-bold text-text-primary">Comments (2)</p>
      <div className="flex flex-col gap-2">
        <div className="p-2 rounded-lg border border-action-type-card-border bg-action-preview-item-bg">
          <div className="flex gap-2 items-center mb-1 text-xs">
            <div className="rounded-full size-4 bg-action-preview-avatar-bg" />
            <span className="font-medium text-text-primary">bob.eth</span>
          </div>
          <p className="text-xs text-foreground-muted">I agree, higher rewards will attract more stakers.</p>
          <div className="flex gap-3 items-center mt-1 text-xs text-foreground-muted">
            <span>♡ 3</span>
            <span>Reply (1)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mock follow viewer: user list.
function FollowPreview() {
  return (
    <div className="flex flex-col gap-3 w-full">
      <p className="text-sm font-bold text-text-primary">Followers</p>
      <div className="flex flex-col gap-2">
        {[
          ["Alice", "@alice.eth"],
          ["Bob", "@bob.eth"],
          ["Charlie", "@charlie.eth"],
        ].map(([name, handle]) => (
          <div
            key={name}
            className="flex gap-3 items-center p-2 rounded-lg border border-action-type-card-border bg-action-preview-item-bg"
          >
            <div className="rounded-full size-8 bg-action-preview-avatar-bg" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text-primary">{name}</span>
              <span className="text-xs text-foreground-muted">{handle}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ActionTypeOptionProps {
  testId: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  title: string;
  caption: string;
  icon: ReactNode;
}

function ActionTypeOption({ testId, selected, disabled, onClick, title, caption, icon }: ActionTypeOptionProps) {
  return (
    <SpaceCard
      data-testid={testId}
      className={`flex items-center gap-2.5 text-left !p-2.5 !rounded-[0.75rem] border transition-opacity ${selected ? "border-yellow-400 !bg-yellow-400/5" : "border-action-type-card-border !bg-action-type-card-bg"} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-90"}`}
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
      aria-disabled={dataBool(disabled)}
    >
      <div className="flex justify-center items-center bg-white rounded-[0.625rem] size-11 shrink-0">{icon}</div>

      <div className="flex flex-col gap-1 items-start">
        <p className="font-bold text-text-primary text-[1.0625rem]/[1.25rem]">{title}</p>
        <p className="font-semibold text-[0.8125rem]/[1rem] text-action-type-card-caption">{caption}</p>
      </div>
    </SpaceCard>
  );
}
