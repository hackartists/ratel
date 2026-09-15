import { useTeamDaoI18n } from "./i18n";
import { useCopyAddress } from "../hooks/use-team-dao";
import { CheckIcon, ClipboardIcon, ExternalLinkIcon } from "./dao-icons";

// app/ratel/src/features/social/pages/dao/components/dao_info_card.rs (`DaoInfoCard`).
export function DaoInfoCard({ daoAddress, explorerUrl }: { daoAddress: string; explorerUrl: string | null }) {
  const tr = useTeamDaoI18n();
  const { copied, onCopy, onExplorerClick } = useCopyAddress(daoAddress);

  return (
    <div className="p-6 rounded-lg border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700 bg-card-bg">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="mb-1 text-xl font-semibold text-text-primary">{tr.daoAddress}</h3>
          <p className="text-sm text-text-secondary">{tr.daoDescription}</p>
        </div>
        <div className="py-1 px-3 text-sm font-medium text-green-800 bg-green-100 rounded-full dark:text-green-200 dark:bg-green-900">
          {tr.active}
        </div>
      </div>

      <div className="p-4 mb-4 rounded-md bg-card-bg-secondary dark:bg-modal-card-bg">
        <div className="flex gap-3 justify-between items-center">
          <code className="font-mono text-sm break-all text-text-primary">{daoAddress}</code>
          <button
            className="p-2 rounded transition-colors hover:bg-gray-200 shrink-0 dark:hover:bg-gray-700"
            title={tr.copyAddress}
            onClick={onCopy}
          >
            {copied ? (
              <CheckIcon width="20" height="20" className="w-5 h-5 text-green-600" />
            ) : (
              <ClipboardIcon width="20" height="20" className="w-5 h-5 text-text-secondary" />
            )}
          </button>
        </div>
      </div>

      {explorerUrl !== null && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex gap-2 items-center py-2 px-4 text-white rounded-md transition-colors bg-primary hover:bg-primary-dark"
          onClick={(event) => onExplorerClick(event, explorerUrl)}
        >
          {tr.viewOnExplorer}
          <ExternalLinkIcon width="16" height="16" className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
