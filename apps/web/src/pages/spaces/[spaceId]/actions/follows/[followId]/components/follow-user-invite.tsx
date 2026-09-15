import { useState } from "react";
import { useAddFollowUsers, useCheckFollowUsers } from "@ratel/ts-bridges/hooks";
import { Button, ButtonSize, ButtonStyle } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpaceCard } from "@/components/ui/space-card";
import { useFollowUserInviteI18n } from "./follow-user-invite.i18n";

// follow/components/follow_user_invite — Enter checks the typed usernames /
// emails and stages the existing ones as chips; Add submits staged + typed
// identifiers.

function normalizeIdentifierInput(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim().replace(/^@+/, "").toLowerCase())
    .filter((value) => value !== "");
}

export function FollowUserInvite({ spaceId, onRefresh }: { spaceId: string; onRefresh: () => void }) {
  const tr = useFollowUserInviteI18n();
  const [identifierInput, setIdentifierInput] = useState("");
  const [pendingIdentifiers, setPendingIdentifiers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const add = useAddFollowUsers();
  const check = useCheckFollowUsers();

  const onAdd = () => {
    if (loading) return;
    let identifiers = [...pendingIdentifiers, ...normalizeIdentifierInput(identifierInput)];
    identifiers = identifiers.filter((value, i) => identifiers.indexOf(value) === i);
    if (identifiers.length === 0) return;

    setLoading(true);
    add
      .mutateAsync({ spaceId, req: { identifiers } })
      .then(() => {
        setLoading(false);
        setPendingIdentifiers([]);
        setIdentifierInput("");
        onRefresh();
      })
      .catch(() => setLoading(false));
  };

  return (
    <SpaceCard className="overflow-visible w-full shrink-0 rounded-[12px] !p-0">
      <div className="flex justify-between items-center self-stretch px-5 py-4 border-b border-separator">
        <p className="font-semibold text-center sp-dash-font-raleway text-[17px]/[20px] tracking-[-0.18px] text-font-primary">
          {tr.title}
        </p>
      </div>
      <div className="flex flex-col gap-5 items-start self-stretch p-5 bg-card max-mobile:p-4">
        <div className="flex items-start w-full gap-[10px] max-tablet:flex-col">
          <div className="flex flex-col flex-1 gap-2 justify-center items-start w-full">
            <p className="font-semibold sp-dash-font-raleway text-[15px] leading-[18px] tracking-[-0.16px] text-font-primary">
              {tr.identifierLabel}
            </p>
            <Input
              className="flex flex-col justify-center items-start px-3 py-2.5 w-full font-medium leading-6 rounded-[8px] border-[0.5px] border-input-box-border bg-input-box-bg sp-dash-font-raleway text-[15px] tracking-[0.5px] text-text-primary placeholder:text-muted-foreground"
              placeholder={tr.identifierPlaceholder}
              value={identifierInput}
              onChange={(e) => setIdentifierInput(e.target.value)}
              onConfirm={() => {
                const identifiers = normalizeIdentifierInput(identifierInput);
                if (identifiers.length === 0) return;
                check
                  .mutateAsync({ spaceId, req: { identifiers } })
                  .then((res) => {
                    const existing = res.existing_identifiers;
                    if (existing.length > 0) {
                      setPendingIdentifiers((list) => {
                        const next = [...list];
                        for (const value of existing) if (!next.includes(value)) next.push(value);
                        return next;
                      });
                    }
                  })
                  .catch(() => undefined)
                  .finally(() => setIdentifierInput(""));
              }}
            />

            <div className="flex flex-wrap gap-2 items-center w-full">
              {pendingIdentifiers.map((value, idx) => (
                <InviteEmailChip
                  key={value}
                  value={value}
                  onRemove={() => setPendingIdentifiers((list) => list.filter((_, i) => i !== idx))}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end w-full max-tablet:justify-stretch">
          <Button className="w-fit max-tablet:w-full" buttonStyle={ButtonStyle.Primary} disabled={loading} onClick={onAdd}>
            {loading ? tr.adding : tr.add}
          </Button>
        </div>
      </div>
    </SpaceCard>
  );
}

function InviteEmailChip({ value, onRemove }: { value: string; onRemove: () => void }) {
  return (
    <div className="flex gap-1 items-center pr-1 pl-3 h-7 rounded-[100px] bg-btn-primary-bg">
      <span className="font-medium leading-6 sp-dash-font-raleway text-[15px] tracking-[0.5px] text-btn-primary-text">
        {value}
      </span>
      <Button
        className="size-5 rounded-full !p-0 hover:!bg-transparent disabled:opacity-50"
        size={ButtonSize.Icon}
        buttonStyle={ButtonStyle.Text}
        onClick={() => onRemove()}
      >
        {/* packages/icons ratel::XMarkIcon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          className="w-3 h-3 [&>path]:stroke-btn-primary-text/90"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 18L18 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>
    </div>
  );
}
