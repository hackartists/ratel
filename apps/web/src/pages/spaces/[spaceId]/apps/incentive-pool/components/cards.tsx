import type * as React from "react";

// app/ratel/src/features/spaces/pages/apps/apps/incentive_pool/components/mod.rs.

export function SummaryStatCard({
  title,
  badge,
  value,
  unit,
}: {
  title: string;
  badge: string | null;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex flex-col gap-2 border rounded-[12px] border-separator bg-card p-[17px]">
      <div className="flex gap-2 justify-between items-center">
        <p className="font-bold font-raleway text-[15px] leading-[18px] tracking-[-0.16px] text-web-font-neutral">{title}</p>
        {badge !== null && (
          <p className="flex justify-center items-center px-2 font-medium leading-4 border h-[25px] rounded-[100px] border-btn-primary-outline font-raleway text-[12px] text-btn-primary-bg">
            {badge}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1 items-end ml-auto">
        <p className="font-bold font-raleway text-[36px] leading-[40px] tracking-[-0.72px] text-web-font-primary">{value}</p>
        <p className="font-semibold font-raleway text-[15px] leading-[18px] tracking-[-0.16px] text-web-font-neutral">{unit}</p>
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  titleClass,
  bodyClass,
  children,
}: {
  title: string;
  titleClass: string;
  bodyClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full rounded-[12px] bg-card">
      <div className="flex justify-between items-center self-stretch px-5 py-4 border-b rounded-t-[12px] border-separator bg-card">
        <p className={titleClass}>{title}</p>
      </div>
      <div className={bodyClass}>{children}</div>
    </div>
  );
}

export function IconActionButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="flex justify-center items-center w-11 h-11 border shrink-0 rounded-[8px] border-btn-outline-outline bg-btn-outline-bg text-btn-outline-text disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function DistributionModeCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  const cardClass = selected
    ? "flex w-full shrink-0 flex-col items-start gap-1 self-stretch rounded-[12px] border border-btn-primary-outline bg-btn-primary-bg/5 p-[17px] text-left"
    : "flex w-full shrink-0 flex-col items-start gap-1 self-stretch rounded-[12px] border border-separator bg-transparent p-[17px] text-left";

  return (
    <button className={cardClass} onClick={onClick}>
      <p className="font-bold font-raleway text-[15px] leading-[18px] tracking-[-0.16px] text-web-font-primary">{title}</p>
      <p className="w-full font-medium leading-5 font-raleway text-[13px] tracking-[0] text-card-meta">{description}</p>
    </button>
  );
}
