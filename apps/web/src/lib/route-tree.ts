// The app's route table as plain data, ported from the retired Dioxus `Route`
// enum (app/ratel/src/route.rs): same URLs, same layout nesting, one leaf per
// former enum variant (`name`). `App.tsx` turns it into React Router records;
// keep it free of JSX and `@/` imports so plain Node scripts can read it.
//
// Matching: React Router ranks static segments above dynamic ones, so
// `/posts`, `/admin`, `/arcade`, `/spaces/:spaceId` and
// `/:username/sub-teams/manage` win over the `/:username` and
// `/sub-teams/:subTeamId` wildcards regardless of order here — the same
// URLs Dioxus resolves by declaration order (docs/superpower/2026-09-14-react-frontend-migration.md §3.5).
// Query-only params (e.g. `/launchpad/return?:project_id…`) are not part of
// the path; pages read them with `useSearchParams`.

/** File name under `src/layouts/`. */
export type LayoutName =
  | "root-layout"
  | "arcade-layout"
  | "admin-layout"
  | "fact-fold-admin-layout"
  | "social-layout"
  | "space-layout"
  | "space-apps-layout";

export interface RouteNode {
  /** Relative path; omitted for index routes and pathless layouts. */
  path?: string;
  index?: true;
  layout?: LayoutName;
  /** Dioxus `Route` variant rendered by this leaf. */
  name?: string;
  children?: RouteNode[];
}

const page = (path: string, name: string): RouteNode => ({ path, name });
const index = (name: string): RouteNode => ({ index: true, name });

export const NOT_FOUND = "PageNotFound";

export const routeTree: RouteNode = {
  path: "/",
  layout: "root-layout",
  children: [
    index("Index"),
    page("privacy", "PrivacyPolicyPage"),
    page("terms", "TermsOfServicePage"),
    page("child-safety", "ChildSafetyPage"),
    page("membership", "MembershipHome"),
    page("credentials", "CredentialsHome"),
    page("essence", "EssenceSourcesPage"),
    page("onboarding/connections", "OnboardingConnectionsPage"),
    page("launchpad/return", "LaunchpadReturnPage"),
    {
      path: "posts",
      children: [
        index("PostIndex"),
        page(":postId/edit", "PostEdit"),
        page(":postId", "PostDetail"),
      ],
    },
    page("my-follower", "MyFollowerPage"),
    page("my-ai", "MyAiPage"),
    page("me/character", "CharacterPage"),
    {
      path: "arcade",
      children: [
        {
          layout: "arcade-layout",
          children: [
            page("home", "ArcadeHomePage"),
            page("leaderboard", "ArcadeLeaderboardPage"),
            page("games/fact-or-fold/matching/:roundId", "FactFoldMatchingPage"),
            page("games/fact-or-fold/rounds/:roundId", "FactFoldGameRoomPage"),
          ],
        },
      ],
    },
    {
      path: "admin",
      children: [
        {
          layout: "admin-layout",
          children: [
            index("AdminMainPage"),
            {
              path: "fact-or-fold",
              children: [
                {
                  layout: "fact-fold-admin-layout",
                  children: [
                    page("subjects", "FactFoldAdminSubjectsPage"),
                    page("subjects/new", "FactFoldAdminNewSubjectPage"),
                    page("schedule", "FactFoldAdminSchedulePage"),
                    page("stats", "FactFoldAdminStatsPage"),
                    page("reports", "FactFoldAdminReportsPage"),
                    page("settings", "FactFoldAdminSettingsPage"),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      path: ":username",
      children: [
        // Full-screen pages that skip the social/team layout.
        page("settings/connections", "UserSettingsConnectionsPage"),
        page("sub-teams/docs/:docId/edit", "TeamSubTeamDocEditPage"),
        page("sub-teams/announcements/compose", "TeamSubTeamBroadcastComposePage"),
        page("sub-teams/announcements/:announcementId/edit", "TeamSubTeamBroadcastEditPage"),
        page("sub-teams/apply", "TeamSubTeamApplyPage"),
        page("sub-teams/application", "TeamSubTeamApplicationStatusPage"),
        page("parent/leave", "TeamLeaveParentPage"),
        page("sub-teams/:subTeamId/deregister", "TeamSubTeamDeregisterPage"),
        page("bylaws", "TeamBylawsPage"),
        page("bylaws/compose/:category", "TeamSubTeamBylawsComposePage"),
        {
          layout: "social-layout",
          children: [
            index("SocialIndex"),
            page("drafts", "SocialDraft"),
            page("rewards", "SocialReward"),
            page("posts", "UserPosts"),
            page("memberships", "SocialMembership"),
            page("credentials", "CredentialPage"),
            page("spaces", "UserSpaces"),
            page("dao", "TeamDao"),
            page("members", "TeamMember"),
            page("settings", "SocialSetting"),
            page("settings/members", "TeamSettingMember"),
            page("settings/subscription", "TeamSettingSubscription"),
            page("sub-teams/manage", "TeamSubTeamManagementPage"),
          ],
        },
        page("sub-teams/:subTeamId/compose", "TeamSubTeamDirectComposePage"),
        page("sub-teams/:subTeamId", "TeamSubTeamDetailPage"),
      ],
    },
    {
      path: "spaces/:spaceId",
      children: [
        {
          layout: "space-layout",
          children: [
            index("SpaceIndexPage"),
            page("report", "SpaceReportPage"),
            page("report/:reportId", "ReportDetailPage"),
            page("discussions/:discussionId", "SpaceDiscussionPage"),
            page("discussions/:discussionId/comments/:commentId", "SpaceDiscussionCommentPage"),
            {
              path: "actions",
              children: [
                index("SpaceActionsPage"),
                page("discussions/:discussionId/edit", "DiscussionActionEditorPage"),
                page("polls/:pollId", "PollActionPage"),
                page("quizzes/:quizId", "QuizActionPage"),
                page("follows/:followId", "FollowActionPage"),
                page("meets/:meetId", "MeetActionPage"),
              ],
            },
            {
              path: "apps",
              children: [
                {
                  layout: "space-apps-layout",
                  children: [
                    page("general", "SpaceGeneralAppPage"),
                    page("files", "SpaceFileAppPage"),
                    page("analyzes", "SpaceAnalyzesAppPage"),
                    page("analyzes/create", "SpaceAnalyzeCreatePage"),
                    page("analyzes/report/:reportId", "SpaceAnalyzeReportPage"),
                    page("analyzes/report/:reportId/records", "SpaceAnalyzeRecordsPage"),
                    page("analyzes/poll/:pollId", "SpaceAnalyzeDetailPage"),
                    page("analyzes/discussion/:discussionId", "SpaceAnalyzeDiscussionPage"),
                    page("panels", "SpacePanelsAppPage"),
                    page("sampling", "SpaceSamplingAppPage"),
                    page("incentive-pool", "SpaceIncentivePoolAppPage"),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    page("*", NOT_FOUND),
  ],
};

export interface FlatRoute {
  name: string;
  /** Absolute path, e.g. `/spaces/:spaceId/actions/polls/:pollId`. */
  path: string;
  layouts: LayoutName[];
  /** Page module directory under `src/pages/` ("" for `/`). */
  pageDir: string;
}

/** `/posts/:postId/edit` → `posts/[postId]/edit`; the catch-all → `not-found`. */
export function pageDirOf(path: string): string {
  if (path === "/*") return "not-found";
  return path
    .split("/")
    .filter(Boolean)
    .map((s) => (s.startsWith(":") ? `[${s.slice(1)}]` : s))
    .join("/");
}

export function flattenRoutes(
  node: RouteNode = routeTree,
  parent = "",
  layouts: LayoutName[] = [],
): FlatRoute[] {
  const path = node.path ? joinPath(parent, node.path) : parent;
  const chain = node.layout ? [...layouts, node.layout] : layouts;
  if (node.name) return [{ name: node.name, path: path || "/", layouts: chain, pageDir: pageDirOf(path || "/") }];
  return (node.children ?? []).flatMap((child) => flattenRoutes(child, path, chain));
}

function joinPath(parent: string, child: string): string {
  const segments = [...parent.split("/"), ...child.split("/")].filter(Boolean);
  return `/${segments.join("/")}`;
}
