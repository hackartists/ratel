import { useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { getTeamDaoHandler } from "@ratel/ts-bridges";
import type { EligibleAdminResponse, TeamDao, TeamDaoTeamResponse, TeamRole } from "@ratel/ts-bridges";
import { useUpdateTeam } from "@ratel/ts-bridges/hooks";
import { useEnumI18n } from "@/i18n/generated/enums.i18n";
import { useToast } from "@/lib/toast";
import {
  afterCopyDelay,
  copyToClipboard,
  createDao,
  DAO_CONFIG,
  DAO_NETWORK,
  DaoWalletError,
  openExternalUrl,
  opensExternalUrlNatively,
} from "./dao-interop";

// app/ratel/src/features/social/pages/dao/views/{mod.rs, admin_page.rs} and
// components/dao_info_card.rs — the Team DAO page controller.

export type { EligibleAdminResponse, TeamDao, TeamDaoTeamResponse } from "@ratel/ts-bridges";

/** admin_page.rs `min_required: 3` / `eligible_admins_count >= 3`. */
export const MIN_DAO_ADMINS = 3;

/**
 * Rust `tr.x.replace("{{count}}", &n.to_string())`. The generated i18n module
 * currently holds `{{{count}}}` (the extractor wrapped the already-doubled
 * braces), which i18next leaves untouched, so any leftover placeholder is
 * filled here too.
 */
export function fillCount(text: string, count: number): string {
  return text.replace(/\{+count\}+/g, String(count));
}

/** `TeamRole::is_owner`. */
export function isTeamOwner(role: TeamRole): boolean {
  return role === "owner";
}

/**
 * views/mod.rs `Home` loader: `get_team_dao_handler(username)` with the error
 * mapped to `Err(String)` (the page then shows `ViewerPage`), so a failure
 * never reaches the error boundary. Suspends while loading (`use_loader(..)?`).
 */
export function useTeamDao(username: string): TeamDao | null {
  const query = useSuspenseQuery({
    queryKey: ["teamDaoPage", username],
    queryFn: () =>
      getTeamDaoHandler(username).then(
        (context): { context: TeamDao | null } => ({ context }),
        (): { context: TeamDao | null } => ({ context: null }),
      ),
  });
  return query.data.context;
}

export interface UseDaoAdmin {
  team: TeamDaoTeamResponse;
  eligibleAdmins: EligibleAdminResponse[];
  canRegister: boolean;
  /** `Some(url)` only when both the explorer base and the DAO address are non-empty. */
  explorerUrl: string | null;
  isPopupOpen: boolean;
  isRegistering: boolean;
  openRegistrationPopup: () => void;
  closePopup: () => void;
  register: (selectedAddresses: string[]) => void;
}

/** admin_page.rs `AdminPage` state and handlers. */
export function useDaoAdmin(username: string, context: TeamDao): UseDaoAdmin {
  const toast = useToast();
  const enumT = useEnumI18n();
  const updateTeam = useUpdateTeam();

  const [team, setTeam] = useState<TeamDaoTeamResponse>(() => context.team);
  const eligibleAdmins = context.eligible_admins;
  const canRegister = eligibleAdmins.length >= MIN_DAO_ADMINS && isTeamOwner(context.role);

  const [isPopupOpen, setPopupOpen] = useState(false);
  const [isRegistering, setRegisteringState] = useState(false);
  // The Rust handlers read the `is_registering` signal at call time.
  const registering = useRef(false);
  const setRegistering = (value: boolean) => {
    registering.current = value;
    setRegisteringState(value);
  };

  const explorerBase = DAO_CONFIG.blockExplorerUrl.trim();
  const explorerUrl =
    team.dao_address == null || explorerBase === "" || team.dao_address === ""
      ? null
      : `${explorerBase.replace(/\/+$/, "")}/account/${team.dao_address}`;

  const openRegistrationPopup = () => {
    if (!canRegister) {
      toast.error(enumT("Error", "InsufficientAdmins"));
      return;
    }
    setPopupOpen(true);
  };

  const closePopup = () => {
    if (!registering.current) setPopupOpen(false);
  };

  /** admin_page.rs `handle_wallet_error`. `Error::WalletError(_)` translates without its payload. */
  const handleWalletError = (err: unknown) => {
    const code = err instanceof DaoWalletError ? err.code : null;
    if (code === "USER_REJECTED") toast.error(enumT("Error", "TransactionRejected"));
    else if (code === "METAMASK_NOT_INSTALLED") toast.error(enumT("Error", "MetamaskNotInstalled"));
    else toast.error(enumT("Error", "WalletError"));
  };

  const register = (selectedAddresses: string[]) => {
    if (selectedAddresses.length < MIN_DAO_ADMINS) {
      toast.error(enumT("Error", "InsufficientAdmins"));
      return;
    }
    if (registering.current) return;

    void (async () => {
      setRegistering(true);
      // Hardcoded (untranslated) in admin_page.rs.
      toast.info("Connecting to Kaia network...");
      toast.info("Creating DAO on blockchain...");

      let daoAddress: string;
      let transactionHash: string;
      try {
        ({ daoAddress, transactionHash } = await createDao(
          selectedAddresses,
          DAO_NETWORK,
          DAO_CONFIG.rpcUrl,
          DAO_CONFIG.blockExplorerUrl,
        ));
      } catch (err) {
        handleWalletError(err);
        setRegistering(false);
        return;
      }

      toast.info("Saving DAO address...");
      try {
        await updateTeam.mutateAsync({
          username,
          body: { nickname: null, description: null, profile_url: null, dao_address: daoAddress, thumbnail_url: null },
        });
        setTeam((current) => ({ ...current, dao_address: daoAddress }));
        const txShort = Array.from(transactionHash).slice(0, 10).join("");
        toast.info(`DAO registered successfully! Transaction: ${txShort}...`);
        setPopupOpen(false);
      } catch {
        toast.error(enumT("Error", "Internal"));
      }

      setRegistering(false);
    })();
  };

  return {
    team,
    eligibleAdmins,
    canRegister,
    explorerUrl,
    isPopupOpen,
    isRegistering,
    openRegistrationPopup,
    closePopup,
    register,
  };
}

export interface UseCopyAddress {
  copied: boolean;
  onCopy: () => void;
  /** Explorer anchor click: under Tauri, opens the URL natively instead of in the WebView. */
  onExplorerClick: (event: { preventDefault(): void }, url: string) => void;
}

/** dao_info_card.rs `DaoInfoCard` handlers. */
export function useCopyAddress(daoAddress: string): UseCopyAddress {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    void (async () => {
      try {
        await copyToClipboard(daoAddress);
      } catch {
        return;
      }
      setCopied(true);
      await afterCopyDelay();
      setCopied(false);
    })();
  };

  const onExplorerClick = (event: { preventDefault(): void }, url: string) => {
    if (!opensExternalUrlNatively()) return; // Plain web: the anchor's default behaviour.
    event.preventDefault();
    void openExternalUrl(url);
  };

  return { copied, onCopy, onExplorerClick };
}
