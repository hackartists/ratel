// Every i18next namespace, keyed by name. Each bundle lives next to the code
// that uses it (biyard/asset console convention: a co-located `i18n.tsx`, or
// `<name>.i18n.tsx` when a directory holds several) and exports
// `i18n = { en, ko }` plus a typed `use<Name>I18n()` hook.
import { i18n as actionCard } from "@/components/space-actions/action-card.i18n";
import { i18n as actionDependencySelector } from "@/components/space-actions/action-dependency-selector.i18n";
import { i18n as actionEditFooter } from "@/components/space-actions/action-edit-footer.i18n";
import { i18n as actionEditTopbar } from "@/components/space-actions/action-edit-topbar.i18n";
import { i18n as actionPoll } from "@/pages/spaces/[spaceId]/components/poll-viewer/i18n";
import { i18n as actionRequiredAttributeSelector } from "@/components/space-actions/action-required-attribute-selector.i18n";
import { i18n as actionSettingsModal } from "@/components/space-actions/action-settings-modal.i18n";
import { i18n as actionStatusControl } from "@/components/space-actions/action-status-control.i18n";
import { i18n as adminLayout } from "@/layouts/admin-layout.i18n";
import { i18n as adminRewards } from "@/pages/admin/components/i18n";
import { i18n as aiModeratorSetting } from "@/components/space-actions/ai-moderator-setting.i18n";
import { i18n as appsSection } from "@/components/space/settings-panel/apps-section.i18n";
import { i18n as arcadeExchangeModal } from "@/components/arcade/i18n";
import { i18n as arcadeHome } from "@/pages/arcade/i18n";
import { i18n as arcadeLayout } from "@/components/arcade/arcade-layout.i18n";
import { i18n as arenaReward } from "@/components/space-actions/arena-reward.i18n";
import { i18n as blueskyConnectModal } from "@/components/cross-posting/bluesky-connect-modal.i18n";
import { i18n as characterPage } from "@/pages/me/character/i18n";
import { i18n as composeSidebar } from "@/components/cross-posting/compose-sidebar.i18n";
import { i18n as connectionsPage } from "@/pages/[username]/settings/connections/i18n";
import { i18n as createActionModal } from "@/components/space-actions/create-action-modal.i18n";
import { i18n as creatorActionPage } from "@/pages/spaces/[spaceId]/actions/components/creator-action-page.i18n";
import { i18n as credentials } from "@/pages/credentials/credentials.i18n";
import { i18n as deleteActionButton } from "@/components/space-actions/delete-action-button.i18n";
import { i18n as deleteActionPopup } from "@/components/space-actions/delete-action-popup.i18n";
import { i18n as deleteSpacePopup } from "@/pages/spaces/[spaceId]/apps/general/components/i18n";
import { i18n as discussionArena } from "@/components/space/discussion-arena/i18n";
import { i18n as discussionEditor } from "@/pages/spaces/[spaceId]/actions/discussions/[discussionId]/edit/i18n";
import { i18n as editor } from "@/components/editor/i18n";
import { i18n as enumI18n } from "@/i18n/enums.i18n";
import { i18n as errorPage } from "@/components/i18n";
import { i18n as essenceSources } from "@/pages/essence/i18n";
import { i18n as factFoldAdminLayout } from "@/layouts/fact-fold-admin-layout.i18n";
import { i18n as factFoldAdminNewSubject } from "@/pages/admin/fact-or-fold/subjects/new/i18n";
import { i18n as factFoldAdminReports } from "@/pages/admin/fact-or-fold/reports/i18n";
import { i18n as factFoldAdminSchedule } from "@/pages/admin/fact-or-fold/schedule/i18n";
import { i18n as factFoldAdminSettings } from "@/pages/admin/fact-or-fold/settings/components/i18n";
import { i18n as factFoldAdminStats } from "@/pages/admin/fact-or-fold/stats/i18n";
import { i18n as factFoldAdminSubjects } from "@/pages/admin/fact-or-fold/subjects/i18n";
import { i18n as factFoldMatching } from "@/pages/arcade/games/fact-or-fold/matching/[roundId]/components/i18n";
import { i18n as factFoldRoom } from "@/pages/arcade/games/fact-or-fold/rounds/[roundId]/i18n";
import { i18n as followCreator } from "@/pages/spaces/[spaceId]/actions/follows/[followId]/components/follow-creator.i18n";
import { i18n as followFullCard } from "@/pages/spaces/[spaceId]/actions/follows/[followId]/components/follow-full-card.i18n";
import { i18n as followList } from "@/pages/my-follower/components/follow-list.i18n";
import { i18n as followTabs } from "@/pages/my-follower/components/follow-tabs.i18n";
import { i18n as followUserInvite } from "@/pages/spaces/[spaceId]/actions/follows/[followId]/components/follow-user-invite.i18n";
import { i18n as followUserList } from "@/pages/spaces/[spaceId]/actions/follows/[followId]/components/follow-user-list.i18n";
import { i18n as followViewer } from "@/pages/spaces/[spaceId]/actions/follows/[followId]/components/follow-viewer.i18n";
import { i18n as general } from "@/pages/spaces/[spaceId]/apps/general/i18n";
import { i18n as greetingEntry } from "@/components/space/settings-panel/greeting-entry.i18n";
import { i18n as home } from "@/pages/[username]/components/team-home/i18n";
import { i18n as homeArena } from "@/pages/components/i18n";
import { i18n as incentivePool } from "@/pages/spaces/[spaceId]/apps/incentive-pool/i18n";
import { i18n as inviteMember } from "@/components/team-member/i18n";
import { i18n as launchpadPartner } from "@/components/launchpad-partner/i18n";
import { i18n as legalClose } from "@/components/legal/i18n";
import { i18n as levelChip } from "@/components/character/i18n";
import { i18n as lockedDependenciesPopup } from "@/pages/spaces/[spaceId]/components/action-dashboard/i18n";
import { i18n as loginModal } from "@/components/auth/login-modal.i18n";
import { i18n as materialList } from "@/components/space-actions/material-list.i18n";
import { i18n as meetAction } from "@/pages/spaces/[spaceId]/i18n";
import { i18n as membershipPage } from "@/pages/[username]/memberships/components/membership-page.i18n";
import { i18n as membershipPlan } from "@/pages/membership/components/i18n";
import { i18n as membershipPurchase } from "@/components/membership/membership-purchase.i18n";
import { i18n as membershipReceipt } from "@/components/membership/membership-receipt.i18n";
import { i18n as myAi } from "@/pages/my-ai/i18n";
import { i18n as myFollower } from "@/pages/my-follower/i18n";
import { i18n as myFollowerHeader } from "@/pages/my-follower/components/my-follower-header.i18n";
import { i18n as notifications } from "@/components/notifications/i18n";
import { i18n as onboardingPage } from "@/pages/onboarding/connections/i18n";
import { i18n as panels } from "@/pages/spaces/[spaceId]/apps/panels/i18n";
import { i18n as participantActionPage } from "@/pages/spaces/[spaceId]/actions/components/participant-action-page.i18n";
import { i18n as pollCreator } from "@/pages/spaces/[spaceId]/actions/polls/[pollId]/components/poll-creator.i18n";
import { i18n as pollParticipant } from "@/pages/spaces/[spaceId]/actions/polls/[pollId]/components/poll-participant.i18n";
import { i18n as pollRead } from "@/pages/spaces/[spaceId]/actions/polls/[pollId]/components/poll-read.i18n";
import { i18n as pollTermination } from "@/pages/spaces/[spaceId]/actions/polls/[pollId]/components/poll-termination.i18n";
import { i18n as postDetailSyndicated } from "@/pages/posts/[postId]/i18n";
import { i18n as postEdit } from "@/pages/posts/[postId]/edit/i18n";
import { i18n as premiumUnlock } from "@/components/ui/i18n";
import { i18n as prerequisiteTile } from "@/components/space-actions/prerequisite-tile.i18n";
import { i18n as profileDropdown } from "@/components/profile-dropdown/i18n";
import { i18n as questionViewer } from "@/components/space-actions/question-viewer.i18n";
import { i18n as quizArena } from "@/pages/spaces/[spaceId]/components/quiz-arena/i18n";
import { i18n as quizCreator } from "@/pages/spaces/[spaceId]/actions/quizzes/[quizId]/components/quiz-creator.i18n";
import { i18n as quizRead } from "@/pages/spaces/[spaceId]/actions/quizzes/[quizId]/components/quiz-read.i18n";
import { i18n as ratelArenaTopbar } from "@/components/arena-topbar/i18n";
import { i18n as reportDetail } from "@/pages/spaces/[spaceId]/report/[reportId]/i18n";
import { i18n as reportList } from "@/pages/spaces/[spaceId]/report/i18n";
import { i18n as rewardHistorySection } from "@/pages/[username]/rewards/components/reward-history-section.i18n";
import { i18n as settingsSwitchButton } from "@/components/space-actions/settings-switch-button.i18n";
import { i18n as signupModal } from "@/components/auth/signup-modal.i18n";
import { i18n as spaceAnalyzesApp } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { i18n as spaceAppType } from "@/components/space/settings-panel/i18n";
import { i18n as spaceCommonSpaceVisibilityModalVisibilityModal } from "@/components/space/space-common-space-visibility-modal-visibility-modal.i18n";
import { i18n as spaceEndModal } from "@/components/space/space-end-modal.i18n";
import { i18n as spaceFile } from "@/pages/spaces/[spaceId]/apps/files/space-file.i18n";
import { i18n as spaceSamplingModal } from "@/components/space/space-sampling-modal.i18n";
import { i18n as spaceStartModal } from "@/components/space/space-start-modal.i18n";
import { i18n as spaceSampling } from "@/pages/spaces/[spaceId]/apps/sampling/i18n";
import { i18n as spaceGreetingSettings } from "@/pages/spaces/[spaceId]/settings/greeting/i18n";
import { i18n as samplingEntryCard } from "@/pages/spaces/[spaceId]/components/sampling-entry-card.i18n";
import { i18n as spaceViewer } from "@/pages/spaces/[spaceId]/components/space-viewer.i18n";
import { i18n as subTeam } from "@/pages/[username]/sub-teams/sub-team.i18n";
import { i18n as syndicationPanel } from "@/components/cross-posting/syndication-panel.i18n";
import { i18n as teamArena } from "@/components/social/team-arena/i18n";
import { i18n as teamCreationForm } from "@/components/team-creation/team-creation-form.i18n";
import { i18n as teamDao } from "@/pages/[username]/dao/components/i18n";
import { i18n as teamDraft } from "@/pages/[username]/drafts/i18n";
import { i18n as teamMember } from "@/pages/[username]/members/i18n";
import { i18n as teamMembership } from "@/pages/[username]/memberships/components/team-membership.i18n";
import { i18n as teamMenu } from "@/components/social/user-layout/i18n";
import { i18n as teamRewards } from "@/pages/[username]/rewards/components/team-rewards.i18n";
import { i18n as teamSettings } from "@/pages/[username]/settings/i18n";
import { i18n as teamSubscription } from "@/pages/[username]/settings/subscription/i18n";
import { i18n as userDrafts } from "@/pages/[username]/drafts/components/i18n";
import { i18n as userHome } from "@/pages/[username]/components/user-home/i18n";
import { i18n as userRewards } from "@/pages/[username]/rewards/components/user-rewards.i18n";
import { i18n as userSettings } from "@/pages/[username]/settings/components/i18n";
import { i18n as viewerActionPage } from "@/pages/spaces/[spaceId]/actions/components/viewer-action-page.i18n";
import { i18n as viewerPage } from "@/pages/[username]/members/components/i18n";

export const modules = {
  actionCard,
  actionDependencySelector,
  actionEditFooter,
  actionEditTopbar,
  actionPoll,
  actionRequiredAttributeSelector,
  actionSettingsModal,
  actionStatusControl,
  adminLayout,
  adminRewards,
  aiModeratorSetting,
  appsSection,
  arcadeExchangeModal,
  arcadeHome,
  arcadeLayout,
  arenaReward,
  blueskyConnectModal,
  characterPage,
  composeSidebar,
  connectionsPage,
  createActionModal,
  creatorActionPage,
  credentials,
  deleteActionButton,
  deleteActionPopup,
  deleteSpacePopup,
  discussionArena,
  discussionEditor,
  editor,
  enum: enumI18n,
  errorPage,
  essenceSources,
  factFoldAdminLayout,
  factFoldAdminNewSubject,
  factFoldAdminReports,
  factFoldAdminSchedule,
  factFoldAdminSettings,
  factFoldAdminStats,
  factFoldAdminSubjects,
  factFoldMatching,
  factFoldRoom,
  followCreator,
  followFullCard,
  followList,
  followTabs,
  followUserInvite,
  followUserList,
  followViewer,
  general,
  greetingEntry,
  home,
  homeArena,
  incentivePool,
  inviteMember,
  launchpadPartner,
  legalClose,
  levelChip,
  lockedDependenciesPopup,
  loginModal,
  materialList,
  meetAction,
  membershipPage,
  membershipPlan,
  membershipPurchase,
  membershipReceipt,
  myAi,
  myFollower,
  myFollowerHeader,
  notifications,
  onboardingPage,
  panels,
  participantActionPage,
  pollCreator,
  pollParticipant,
  pollRead,
  pollTermination,
  postDetailSyndicated,
  postEdit,
  premiumUnlock,
  prerequisiteTile,
  profileDropdown,
  questionViewer,
  quizArena,
  quizCreator,
  quizRead,
  ratelArenaTopbar,
  samplingEntryCard,
  reportDetail,
  reportList,
  rewardHistorySection,
  settingsSwitchButton,
  signupModal,
  spaceAnalyzesApp,
  spaceAppType,
  spaceCommonSpaceVisibilityModalVisibilityModal,
  spaceEndModal,
  spaceFile,
  spaceSampling,
  spaceGreetingSettings,
  spaceSamplingModal,
  spaceStartModal,
  spaceViewer,
  subTeam,
  syndicationPanel,
  teamArena,
  teamCreationForm,
  teamDao,
  teamDraft,
  teamMember,
  teamMembership,
  teamMenu,
  teamRewards,
  teamSettings,
  teamSubscription,
  userDrafts,
  userHome,
  userRewards,
  userSettings,
  viewerActionPage,
  viewerPage,
};
