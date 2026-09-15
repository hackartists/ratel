import type {
  SpaceAdminListItem,
  SpaceInvitationListItem,
  SpaceResponse,
  SpaceVisibility,
  UserPartition,
} from "@ratel/ts-bridges";
import { listSpaceInvitations } from "@ratel/ts-bridges";
import {
  useAddSpaceAdmin,
  useDeleteSpace,
  useDeleteSpaceInvitation,
  useInfiniteList,
  useInviteSpaceParticipants,
  useListSpaceAdmins,
  useRemoveSpaceAdmin,
  useUpdateSpace,
} from "@ratel/ts-bridges/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useGeneralI18n } from "@/pages/spaces/[spaceId]/apps/general/i18n";
import { useAction, type Action } from "@/lib/use-action";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/spaces/pages/apps/apps/general/hooks/use_space_general_settings.rs
// — controller for the General settings page: the admins list, the paginated
// invitations and every mutation a settings card fires. Each action toasts on
// both branches; space fields are patched in the cached `getSpace` response
// (Rust `space.with_mut`) instead of refetching.

const INVITATION_PAGE_SIZE = 20;

export interface InvitationsQuery {
  items: SpaceInvitationListItem[];
  hasMore: boolean;
  /** A next page is loading (Rust `is_loading()`). */
  isLoading: boolean;
  next: () => void;
}

export interface UseSpaceGeneralSettings {
  spaceId: string;
  admins: SpaceAdminListItem[];
  invitations: InvitationsQuery;
  updateLogo: Action<[string]>;
  updateStartTime: Action<[number]>;
  updateVisibility: Action<[SpaceVisibility]>;
  updateAnonymous: Action<[boolean]>;
  updateJoinAnytime: Action<[boolean]>;
  sendInvitations: Action<[string[]]>;
  deleteInvitation: Action<[UserPartition]>;
  addAdmins: Action<[string[]]>;
  removeAdmin: Action<[UserPartition]>;
  deleteSpaceAction: Action<[]>;
}

const Context = createContext<UseSpaceGeneralSettings | null>(null);
export const SpaceGeneralSettingsProvider = Context.Provider;

export function useSpaceGeneralSettings(): UseSpaceGeneralSettings {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSpaceGeneralSettings must be used under SpaceGeneralSettingsProvider");
  return ctx;
}

/** Builds the controller; `null` until the admins and first invitations page load. */
export function useSpaceGeneralSettingsController(spaceId: string): UseSpaceGeneralSettings | null {
  const tr = useGeneralI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const admins = useListSpaceAdmins(spaceId, { throwOnError: true });
  const invitations = useInfiniteList<SpaceInvitationListItem>(
    ["listSpaceInvitations", spaceId, "infinite", INVITATION_PAGE_SIZE],
    (bookmark) => listSpaceInvitations(spaceId, bookmark, INVITATION_PAGE_SIZE),
    { throwOnError: true },
  );

  const updateSpace = useUpdateSpace();
  const inviteParticipants = useInviteSpaceParticipants();
  const deleteSpaceInvitation = useDeleteSpaceInvitation();
  const addSpaceAdmin = useAddSpaceAdmin();
  const removeSpaceAdmin = useRemoveSpaceAdmin();
  const deleteSpace = useDeleteSpace();

  /** Rust `space.with_mut(|s| ...)`. */
  const patchSpace = (patch: Partial<SpaceResponse>) =>
    queryClient.setQueryData<SpaceResponse>(["getSpace", spaceId], (s) => (s ? { ...s, ...patch } : s));

  const updateLogo = useAction(async (logo: string) => {
    try {
      await updateSpace.mutateAsync({ spaceId, req: { logo } });
      patchSpace({ logo });
      toast.info(tr.logoUpdatedSuccessfully);
    } catch (err) {
      toast.error(err);
    }
  });

  const updateStartTime = useAction(async (startedAt: number) => {
    try {
      await updateSpace.mutateAsync({ spaceId, req: { started_at: startedAt } });
      patchSpace({ started_at: startedAt });
      toast.info(tr.startTimeUpdatedSuccessfully);
    } catch (err) {
      toast.error(err);
    }
  });

  const updateVisibility = useAction(async (visibility: SpaceVisibility) => {
    try {
      await updateSpace.mutateAsync({ spaceId, req: { visibility } });
      patchSpace({ visibility });
      toast.info(tr.visibilityUpdatedSuccessfully);
    } catch (err) {
      toast.error(err);
    }
  });

  const updateAnonymous = useAction(async (anonymousParticipation: boolean) => {
    try {
      await updateSpace.mutateAsync({ spaceId, req: { anonymous_participation: anonymousParticipation } });
      patchSpace({ anonymous_participation: anonymousParticipation });
      toast.info(tr.anonymousUpdatedSuccessfully);
    } catch (err) {
      toast.error(err);
    }
  });

  const updateJoinAnytime = useAction(async (joinAnytime: boolean) => {
    try {
      await updateSpace.mutateAsync({ spaceId, req: { join_anytime: joinAnytime } });
      patchSpace({ join_anytime: joinAnytime });
      toast.info(tr.joinAnytimeUpdatedSuccessfully);
    } catch (err) {
      toast.error(err);
    }
  });

  const sendInvitations = useAction(async (emails: string[]) => {
    if (emails.length === 0) return;
    try {
      await inviteParticipants.mutateAsync({ spaceId, req: { emails } });
      void invitations.refetch();
      toast.info(tr.participantsInvitedSuccessfully);
    } catch (err) {
      toast.error(err);
    }
  });

  const deleteInvitation = useAction(async (userId: UserPartition) => {
    try {
      await deleteSpaceInvitation.mutateAsync({ spaceId, userId });
      void invitations.refetch();
      toast.info(tr.invitationDeletedSuccessfully);
    } catch (err) {
      toast.error(err);
    }
  });

  const addAdmins = useAction(async (targets: string[]) => {
    if (targets.length === 0) return;
    for (const target of targets) {
      try {
        await addSpaceAdmin.mutateAsync({ spaceId, body: { target } });
      } catch (err) {
        toast.error(err);
        return;
      }
    }
    void admins.refetch();
  });

  const removeAdmin = useAction(async (userId: UserPartition) => {
    try {
      await removeSpaceAdmin.mutateAsync({ spaceId, userId });
      void admins.refetch();
    } catch (err) {
      toast.error(err);
    }
  });

  const deleteSpaceAction = useAction(async () => {
    try {
      await deleteSpace.mutateAsync(spaceId);
      toast.info(tr.spaceDeletedSuccessfully);
      navigate("/");
    } catch (err) {
      toast.error(err);
    }
  });

  if (admins.data === undefined || invitations.data === undefined) return null;

  return {
    spaceId,
    admins: admins.data,
    invitations: {
      items: invitations.items,
      hasMore: invitations.hasMore,
      isLoading: invitations.isFetchingNextPage,
      next: () => {
        if (invitations.isFetchingNextPage || !invitations.hasMore) return;
        void invitations.fetchNextPage();
      },
    },
    updateLogo,
    updateStartTime,
    updateVisibility,
    updateAnonymous,
    updateJoinAnytime,
    sendInvitations,
    deleteInvitation,
    addAdmins,
    removeAdmin,
    deleteSpaceAction,
  };
}
