import { dataBool } from "@/lib/dom";

// `RoleTab` (app/ratel/src/features/social/pages/member/views/mod.rs).
export function RoleTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button className="tm-role-tab" type="button" aria-selected={dataBool(active)} onClick={onClick}>
      {`${label} `}
      <span className="tm-role-tab__count">{count}</span>
    </button>
  );
}
