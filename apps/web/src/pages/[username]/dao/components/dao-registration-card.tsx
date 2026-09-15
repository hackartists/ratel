import { useTeamDaoI18n } from "./i18n";
import { fillCount } from "../hooks/use-team-dao";
import { InformationCircleIcon } from "./dao-icons";

// app/ratel/src/features/social/pages/dao/components/dao_registration_card.rs (`DaoRegistrationCard`).
export function DaoRegistrationCard({
  eligibleCount,
  minRequired,
  canRegister,
  onRegister,
}: {
  eligibleCount: number;
  minRequired: number;
  canRegister: boolean;
  onRegister: () => void;
}) {
  const tr = useTeamDaoI18n();
  const needMore = eligibleCount >= minRequired ? 0 : minRequired - eligibleCount;

  return (
    <div className="bg-card-bg dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-xl font-semibold text-text-primary mb-4">{tr.registerDao}</h3>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-6">
        <div className="flex gap-3">
          <InformationCircleIcon width="24" height="24" className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">{tr.adminRequirements}</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">
              {tr.adminRequirementsDescription}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-text-secondary mb-1">{fillCount(tr.eligibleAdminsCount({ count: eligibleCount }), eligibleCount)}</p>
          <p className="text-xs text-text-secondary">{tr.minAdminsRequired}</p>
        </div>

        {eligibleCount >= minRequired ? (
          <div className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
            ✓ Ready
          </div>
        ) : (
          <div className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-sm font-medium">
            {`Need ${needMore} more`}
          </div>
        )}
      </div>

      {!canRegister && eligibleCount < minRequired && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">{tr.insufficientAdmins}</p>
        </div>
      )}

      <button
        className="w-full px-6 py-3 bg-primary text-white rounded-md font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
        disabled={!canRegister}
        onClick={onRegister}
      >
        {tr.registerDao}
      </button>
    </div>
  );
}
