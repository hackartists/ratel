import { useTeamDaoI18n } from "./i18n";
import { MIN_DAO_ADMINS, useDaoAdmin, type TeamDao } from "../hooks/use-team-dao";
import { DaoInfoCard } from "./dao-info-card";
import { DaoRegistrationCard } from "./dao-registration-card";
import { RegisterDaoPopup } from "./register-dao-popup";

// app/ratel/src/features/social/pages/dao/views/admin_page.rs (`AdminPage`).
export function AdminPage({ username, context }: { username: string; context: TeamDao }) {
  const tr = useTeamDaoI18n();
  const {
    team,
    eligibleAdmins,
    canRegister,
    explorerUrl,
    isPopupOpen,
    isRegistering,
    openRegistrationPopup,
    closePopup,
    register,
  } = useDaoAdmin(username, context);

  const daoAddress = team.dao_address ? team.dao_address : null;

  return (
    <div className="flex flex-col gap-5 p-6 w-full max-w-[1152px]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{tr.daoTitle}</h1>
        <p className="text-text-secondary">{tr.daoDescription}</p>
      </div>

      {daoAddress !== null ? (
        <DaoInfoCard daoAddress={daoAddress} explorerUrl={explorerUrl} />
      ) : (
        <DaoRegistrationCard
          onRegister={openRegistrationPopup}
          eligibleCount={eligibleAdmins.length}
          minRequired={MIN_DAO_ADMINS}
          canRegister={canRegister}
        />
      )}

      {isPopupOpen && (
        <RegisterDaoPopup
          eligibleAdmins={eligibleAdmins}
          onRegister={register}
          onCancel={closePopup}
          isRegistering={isRegistering}
        />
      )}
    </div>
  );
}
