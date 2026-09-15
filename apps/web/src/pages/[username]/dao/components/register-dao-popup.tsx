import { useState } from "react";
import { useTeamDaoI18n } from "@/i18n/generated/features/social/pages/dao/views/team-dao.i18n";
import { fillCount, MIN_DAO_ADMINS, type EligibleAdminResponse } from "../hooks/use-team-dao";
import { CheckIcon, XMarkIcon } from "./dao-icons";

// app/ratel/src/features/social/pages/dao/components/register_dao_popup.rs (`RegisterDaoPopup`).

const ROW_SELECTED =
  "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all border-primary bg-primary/10";
const ROW_UNSELECTED =
  "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all border-neutral-200/70 dark:border-neutral-700/60 hover:border-neutral-400/50 dark:hover:border-neutral-500/50";
const CHECKBOX_SELECTED =
  "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 bg-primary border-primary";
const CHECKBOX_UNSELECTED =
  "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 border-neutral-300/70 dark:border-neutral-600/70";

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(address.length - 4)}`;
}

export function RegisterDaoPopup({
  eligibleAdmins,
  onRegister,
  onCancel,
  isRegistering,
}: {
  eligibleAdmins: EligibleAdminResponse[];
  onRegister: (selectedAddresses: string[]) => void;
  onCancel: () => void;
  isRegistering: boolean;
}) {
  const tr = useTeamDaoI18n();
  const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(() => new Set());

  const selectedCount = selectedAddresses.size;
  const canConfirm = selectedCount >= MIN_DAO_ADMINS && !isRegistering;

  const toggle = (evmAddress: string) => {
    if (isRegistering) return;
    setSelectedAddresses((current) => {
      const next = new Set(current);
      if (next.has(evmAddress)) next.delete(evmAddress);
      else next.add(evmAddress);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background text-neutral-900 dark:text-neutral-100 rounded-lg shadow-xl w-full max-w-[600px] max-h-[80vh] flex flex-col border border-neutral-200/70 dark:border-neutral-700/60">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200/70 dark:border-neutral-700/60">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">{tr.selectAdmins}</h2>
            <p className="text-sm text-text-secondary mt-1">{tr.selectAdminsDescription}</p>
          </div>
          <button
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors disabled:opacity-50"
            onClick={onCancel}
            disabled={isRegistering}
          >
            <XMarkIcon width="24" height="24" className="w-6 h-6 text-neutral-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {eligibleAdmins.map((admin) => {
              const selected = selectedAddresses.has(admin.evm_address);
              const baseClass = selected ? ROW_SELECTED : ROW_UNSELECTED;
              const rowClass = isRegistering ? `${baseClass} opacity-50 cursor-not-allowed` : baseClass;
              const profileUrl = admin.profile_url ? admin.profile_url : "/default-avatar.png";
              return (
                <div key={admin.user_id} className={rowClass} onClick={() => toggle(admin.evm_address)}>
                  <div className={selected ? CHECKBOX_SELECTED : CHECKBOX_UNSELECTED}>
                    {selected && <CheckIcon width="16" height="16" className="w-4 h-4 text-white" />}
                  </div>
                  <img src={profileUrl} alt={admin.display_name} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-text-primary dark:text-neutral-100 truncate">
                        {admin.display_name}
                      </p>
                      {admin.is_owner && (
                        <span className="px-2 py-0.5 bg-yellow-100/80 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-200 text-xs font-medium rounded">
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">{`@${admin.username}`}</p>
                    <p className="text-xs font-mono text-neutral-400 dark:text-neutral-500 mt-1">
                      {truncateAddress(admin.evm_address)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-neutral-200/70 dark:border-neutral-700/60">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{fillCount(tr.selectedCount({ count: selectedCount }), selectedCount)}</p>
            {selectedCount < MIN_DAO_ADMINS && <p className="text-sm text-red-500">{tr.minAdminsRequired}</p>}
          </div>

          <div className="flex gap-3">
            <button
              className="flex-1 px-6 py-3 bg-neutral-300 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 rounded-md font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onCancel}
              disabled={isRegistering}
            >
              {tr.cancel}
            </button>
            <button
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-md font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onRegister(Array.from(selectedAddresses))}
              disabled={!canConfirm}
            >
              {isRegistering ? tr.registeringDao : tr.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
