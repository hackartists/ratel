# Ratel Dioxus route & page inventory (for React+TS migration)

Companion to [`2026-09-14-react-frontend-migration.md`](2026-09-14-react-frontend-migration.md).

Source: `app/ratel/src/route.rs` (the only compiled, mounted `Route` enum; `app.rs` renders `Router::<Route>`). Generated 2026-09-14, read-only.

## How metrics were counted

- Counted once on 2026-09-14 with a throwaway script that walks each route's page dir(s) recursively, skipping `controllers/`, `models/`, `server/`, `tests/` subdirs. Numbers are a sizing guide, not a contract.
- **rs** = total `.rs` lines in those dirs. **rsx** = lines inside `rsx! { ... }` blocks (brace-matched). Shared dirs are counted once per route, so routes that share a dir (e.g. 3 broadcast composer routes) show identical numbers; do not sum the per-route column — use group totals.
- **ldr / infq / act** = `use_loader(` / `use_infinite_query(` / `use_action(` occurrences. **hdl** = calls matching `*_handler(` (many server fns lack that suffix, so also see **ctrl** = `controllers::` references). **seo** = `SeoMeta {`. **eval** = `document::eval(` / `dx_eval(` / `eval(`. **js** = `.js` files in dir (per-component `script.js` or `interop/web/*.js`); **scr** = `document::Script {` tags. **ed** = `Editor {` (shared Tiptap-style editor in `common/components/editor`, which loads its own script.js). **pop** = `use_popup(` / `popup.open(`.
- Page-dir choice is a judgement call: wrapper pages (`SocialX`, `UserPosts`, `PostDetail`, `MembershipHome`) include the dirs they delegate to.

## Route table

Total routes (enum variants incl. catch-all): **73**

| # | Path | Variant | Component | Source file | Layout chain | Group | rs | rsx | ldr | infq | act | hdl | ctrl | seo | eval | scr | js | ed | pop |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/` | Index | views::Index | `views/index/component.rs` | RootLayout | shell/public | 1747 | 975 | 2 | 1 | 0 | 4 | 4 | 1 | 0 | 1 | 1 | 0 | 3 |
| 2 | `/privacy` | PrivacyPolicyPage | PrivacyPolicyPage | `views/privacy/mod.rs` | RootLayout | shell/public | 364 | 67 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | `/terms` | TermsOfServicePage | TermsOfServicePage | `views/terms/mod.rs` | RootLayout | shell/public | 265 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | `/child-safety` | ChildSafetyPage | ChildSafetyPage | `views/child_safety/mod.rs` | RootLayout | shell/public | 259 | 67 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5 | `/membership` | MembershipHome | membership::Home | `features/membership/views/home/mod.rs` | RootLayout | membership | 1184 | 488 | 0 | 0 | 0 | 2 | 1 | 0 | 0 | 1 | 0 | 0 | 4 |
| 6 | `/credentials` | CredentialsHome | CredentialsHome (route.rs wrapper) > social::pages::credentials::Home | `features/social/pages/credentials/views/mod.rs` | RootLayout | social | 1854 | 989 | 2 | 0 | 0 | 5 | 6 | 0 | 2 | 2 | 3 | 0 | 9 |
| 7 | `/essence` | EssenceSourcesPage | EssenceSourcesPage | `features/essence/pages/sources/component.rs` | RootLayout | essence | 1069 | 619 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 1 | 0 | 0 |
| 8 | `/onboarding/connections` | OnboardingConnectionsPage | cross_posting::views::OnboardingPage | `features/cross_posting/views/onboarding_page/component.rs` | RootLayout | cross_posting | 407 | 327 | 0 | 0 | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 9 | `/launchpad/return?:project_id&:conversion_id&:brand_tx_id&:deducted_points&:remaining_points&:round_id&:community_url&:ts&:sig` | LaunchpadReturnPage | LaunchpadReturnPage | `features/launchpad_partner/views/return_page.rs` | RootLayout | launchpad | 384 | 200 | 4 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| 10 | `/posts` | PostIndex | posts::Index | `features/posts/views/index/mod.rs` | RootLayout | posts | 6 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 11 | `/posts/:post_id/edit` | PostEdit | posts::PostEdit | `features/posts/views/post_edit/` | RootLayout | posts | 1577 | 822 | 1 | 0 | 0 | 8 | 3 | 0 | 0 | 1 | 1 | 1 | 2 |
| 12 | `/posts/:post_id` | PostDetail | posts::PostDetail | `features/posts/views/post_detail/` | RootLayout | posts | 2192 | 1358 | 0 | 1 | 0 | 10 | 10 | 1 | 0 | 1 | 1 | 2 | 0 |
| 13 | `/my-follower` | MyFollowerPage | MyFollowerPage | `features/my_follower/views/home/mod.rs` | RootLayout | me/character/follower | 121 | 27 | 0 | 2 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| 14 | `/my-ai` | MyAiPage | MyAiPage | `features/me/pages/my_ai/component.rs` | RootLayout | me/character/follower | 1011 | 788 | 1 | 0 | 0 | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 15 | `/me/character` | CharacterPage | CharacterPage | `features/character/pages/character_page/component.rs` | RootLayout | me/character/follower | 470 | 242 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 16 | `/arcade/home` | ArcadeHomePage | ArcadeHomePage | `features/arcade/pages/home/component.rs` | RootLayout > ArcadeLayout | arcade | 577 | 208 | 2 | 1 | 0 | 4 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| 17 | `/arcade/leaderboard` | ArcadeLeaderboardPage | ArcadeLeaderboardPage (same file as home) | `features/arcade/pages/home/component.rs` | RootLayout > ArcadeLayout | arcade | 577 | 208 | 2 | 1 | 0 | 4 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| 18 | `/arcade/games/fact-or-fold/matching/:round_id` | FactFoldMatchingPage | FactFoldMatchingPage | `features/arcade/games/fact_or_fold/pages/matching/component.rs` | RootLayout > ArcadeLayout | arcade | 454 | 169 | 1 | 0 | 0 | 2 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 19 | `/arcade/games/fact-or-fold/rounds/:round_id` | FactFoldGameRoomPage | FactFoldGameRoomPage | `features/arcade/games/fact_or_fold/pages/game_room/component.rs` | RootLayout > ArcadeLayout | arcade | 2418 | 935 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 1 | 1 | 0 | 0 |
| 20 | `/admin` | AdminMainPage | AdminMainPage | `features/admin/views/main/mod.rs` | RootLayout > AdminLayout(admin::AppLayout) | admin | 944 | 561 | 3 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| 21 | `/admin/fact-or-fold/subjects` | FactFoldAdminSubjectsPage | FactFoldAdminSubjectsPage | `features/arcade/games/fact_or_fold/pages/admin/subjects/component.rs` | RootLayout > AdminLayout > FactFoldAdminLayout | arcade | 383 | 169 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 22 | `/admin/fact-or-fold/subjects/new` | FactFoldAdminNewSubjectPage | FactFoldAdminNewSubjectPage | `features/arcade/games/fact_or_fold/pages/admin/new_subject/component.rs` | RootLayout > AdminLayout > FactFoldAdminLayout | arcade | 651 | 310 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 23 | `/admin/fact-or-fold/schedule` | FactFoldAdminSchedulePage | FactFoldAdminSchedulePage | `features/arcade/games/fact_or_fold/pages/admin/schedule/component.rs` | RootLayout > AdminLayout > FactFoldAdminLayout | arcade | 161 | 87 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 24 | `/admin/fact-or-fold/stats` | FactFoldAdminStatsPage | FactFoldAdminStatsPage | `features/arcade/games/fact_or_fold/pages/admin/stats/component.rs` | RootLayout > AdminLayout > FactFoldAdminLayout | arcade | 107 | 60 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 25 | `/admin/fact-or-fold/reports` | FactFoldAdminReportsPage | FactFoldAdminReportsPage | `features/arcade/games/fact_or_fold/pages/admin/reports/component.rs` | RootLayout > AdminLayout > FactFoldAdminLayout | arcade | 67 | 30 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 26 | `/admin/fact-or-fold/settings` | FactFoldAdminSettingsPage | FactFoldAdminSettingsPage | `features/arcade/games/fact_or_fold/pages/admin/settings/component.rs` | RootLayout > AdminLayout > FactFoldAdminLayout | arcade | 446 | 230 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 27 | `/:username/settings/connections` | UserSettingsConnectionsPage | cross_posting::views::ConnectionsPage | `features/cross_posting/views/connections_page/component.rs` | RootLayout | cross_posting | 414 | 407 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 28 | `/:username/sub-teams/docs/:doc_id/edit` | TeamSubTeamDocEditPage | TeamSubTeamDocEditPage | `features/sub_team/pages/doc_compose/component.rs` | RootLayout | sub_team | 905 | 614 | 1 | 0 | 0 | 3 | 2 | 1 | 0 | 0 | 0 | 1 | 0 |
| 29 | `/:username/sub-teams/announcements/compose` | TeamSubTeamBroadcastComposePage | TeamSubTeamBroadcastComposePage | `features/sub_team/pages/broadcast_compose/component.rs` | RootLayout | sub_team | 829 | 550 | 1 | 0 | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 1 | 0 |
| 30 | `/:username/sub-teams/announcements/:announcement_id/edit` | TeamSubTeamBroadcastEditPage | TeamSubTeamBroadcastEditPage | `features/sub_team/pages/broadcast_compose/component.rs` | RootLayout | sub_team | 829 | 550 | 1 | 0 | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 1 | 0 |
| 31 | `/:username/sub-teams/apply` | TeamSubTeamApplyPage | TeamSubTeamApplyPage | `features/sub_team/pages/apply/component.rs` | RootLayout | sub_team | 1017 | 899 | 1 | 0 | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 32 | `/:username/sub-teams/application` | TeamSubTeamApplicationStatusPage | TeamSubTeamApplicationStatusPage | `features/sub_team/pages/application_status/component.rs` | RootLayout | sub_team | 424 | 299 | 1 | 0 | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 33 | `/:username/parent/leave` | TeamLeaveParentPage | TeamLeaveParentPage | `features/sub_team/pages/leave_parent/component.rs` | RootLayout | sub_team | 345 | 234 | 1 | 0 | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 34 | `/:username/sub-teams/:sub_team_id/deregister` | TeamSubTeamDeregisterPage | TeamSubTeamDeregisterPage | `features/sub_team/pages/deregister/component.rs` | RootLayout | sub_team | 312 | 190 | 2 | 0 | 0 | 2 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| 35 | `/:username/bylaws` | TeamBylawsPage | TeamBylawsPage | `features/sub_team/pages/bylaws/component.rs` | RootLayout | sub_team | 266 | 136 | 2 | 0 | 0 | 2 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| 36 | `/:username/bylaws/compose/:category` | TeamSubTeamBylawsComposePage | TeamSubTeamBylawsComposePage | `features/sub_team/pages/doc_compose/component.rs` | RootLayout | sub_team | 905 | 614 | 1 | 0 | 0 | 3 | 2 | 1 | 0 | 0 | 0 | 1 | 0 |
| 37 | `/:username` | SocialIndex | SocialIndex -> user_views::Home or pages::home::Home | `features/social/pages/index/mod.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 1085 | 726 | 1 | 2 | 0 | 6 | 9 | 0 | 0 | 1 | 1 | 0 | 0 |
| 38 | `/:username/drafts` | SocialDraft | SocialDraft -> draft::{user,team}::Home | `features/social/pages/draft/mod.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 1487 | 815 | 1 | 2 | 0 | 7 | 9 | 0 | 0 | 1 | 1 | 0 | 0 |
| 39 | `/:username/rewards` | SocialReward | SocialReward -> reward::{user,team}::Home | `features/social/pages/reward/mod.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 866 | 183 | 3 | 0 | 0 | 5 | 5 | 0 | 0 | 0 | 2 | 0 | 0 |
| 40 | `/:username/posts` | UserPosts | social::pages::post::Home | `features/social/pages/post/views/mod.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 475 | 226 | 0 | 2 | 0 | 3 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| 41 | `/:username/memberships` | SocialMembership | SocialMembership -> membership::{user,team}::Home | `features/social/pages/membership/mod.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 784 | 305 | 4 | 0 | 0 | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| 42 | `/:username/credentials` | CredentialPage | social::pages::credentials::Home | `features/social/pages/credentials/views/mod.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 1854 | 989 | 2 | 0 | 0 | 5 | 6 | 0 | 2 | 2 | 3 | 0 | 9 |
| 43 | `/:username/spaces` | UserSpaces | social::pages::space::Home | `features/social/pages/space/views/mod.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 150 | 59 | 0 | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| 44 | `/:username/dao` | TeamDao | social::pages::dao::Home | `features/social/pages/dao/views/mod.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 914 | 296 | 1 | 0 | 0 | 2 | 2 | 0 | 0 | 1 | 0 | 0 | 0 |
| 45 | `/:username/members` | TeamMember | social::pages::member::Home | `features/social/pages/member/views/mod.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 1707 | 640 | 2 | 1 | 0 | 10 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| 46 | `/:username/settings` | SocialSetting | SocialSetting -> setting::{user,team}::Home | `features/social/pages/setting/mod.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 4659 | 2272 | 11 | 0 | 0 | 24 | 12 | 0 | 0 | 1 | 0 | 0 | 5 |
| 47 | `/:username/settings/members` | TeamSettingMember | setting::team::ManagementPage | `features/social/pages/setting/team/views/management_page.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 354 | 304 | 1 | 0 | 0 | 4 | 3 | 0 | 0 | 0 | 0 | 0 | 2 |
| 48 | `/:username/settings/subscription` | TeamSettingSubscription | setting::team::SubscriptionPage | `features/social/pages/setting/team/views/subscription_page/mod.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | social | 889 | 358 | 1 | 0 | 0 | 3 | 1 | 0 | 0 | 1 | 0 | 0 | 1 |
| 49 | `/:username/sub-teams/manage` | TeamSubTeamManagementPage | TeamSubTeamManagementPage | `features/sub_team/pages/management/component.rs` | RootLayout > SocialLayout > (UserLayout or TeamArenaLayout) | sub_team | 2504 | 1768 | 1 | 0 | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 50 | `/:username/sub-teams/:sub_team_id/compose` | TeamSubTeamDirectComposePage | TeamSubTeamDirectComposePage | `features/sub_team/pages/broadcast_compose/component.rs` | RootLayout | sub_team | 829 | 550 | 1 | 0 | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 1 | 0 |
| 51 | `/:username/sub-teams/:sub_team_id` | TeamSubTeamDetailPage | TeamSubTeamDetailPage | `features/sub_team/pages/detail/component.rs` | RootLayout | sub_team | 474 | 299 | 1 | 0 | 0 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 52 | `/spaces/:space_id` | SpaceIndexPage | SpaceIndexPage (arena viewer/participant) | `features/spaces/pages/index/component.rs` | RootLayout > SpaceLayout | spaces | 7262 | 5522 | 8 | 0 | 0 | 1 | 23 | 0 | 0 | 1 | 2 | 0 | 13 |
| 53 | `/spaces/:space_id/report` | SpaceReportPage | report::views::SpaceReportPage | `features/spaces/pages/report/views/mod.rs` | RootLayout > SpaceLayout | spaces | 3838 | 629 | 3 | 0 | 4 | 0 | 15 | 0 | 5 | 1 | 1 | 2 | 0 |
| 54 | `/spaces/:space_id/report/:report_id` | ReportDetailPage | ReportDetailPage | `features/spaces/pages/report/views/detail/component.rs` | RootLayout > SpaceLayout | spaces | 2063 | 840 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 1 | 1 | 1 | 0 |
| 55 | `/spaces/:space_id/discussions/:discussion_id` | SpaceDiscussionPage | SpaceDiscussionPage | `features/spaces/pages/index/action_pages/discussion/component.rs` | RootLayout > SpaceLayout | spaces | 2607 | 664 | 3 | 1 | 8 | 0 | 3 | 0 | 0 | 1 | 1 | 0 | 3 |
| 56 | `/spaces/:space_id/discussions/:discussion_id/comments/:comment_id` | SpaceDiscussionCommentPage | SpaceDiscussionCommentPage (same file) | `features/spaces/pages/index/action_pages/discussion/component.rs` | RootLayout > SpaceLayout | spaces | 2607 | 664 | 3 | 1 | 8 | 0 | 3 | 0 | 0 | 1 | 1 | 0 | 3 |
| 57 | `/spaces/:space_id/actions` | SpaceActionsPage | actions::views::main::SpaceActionsPage | `features/spaces/pages/actions/views/main/mod.rs` | RootLayout > SpaceLayout | spaces | 4049 | 1620 | 6 | 0 | 0 | 2 | 11 | 0 | 0 | 0 | 0 | 1 | 4 |
| 58 | `/spaces/:space_id/actions/discussions/:discussion_id/edit` | DiscussionActionEditorPage | DiscussionActionEditorPage | `features/spaces/pages/actions/actions/discussion/views/editor/mod.rs` | RootLayout > SpaceLayout | spaces | 1080 | 469 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| 59 | `/spaces/:space_id/actions/polls/:poll_id` | PollActionPage | PollActionPage | `features/spaces/pages/actions/actions/poll/views/main/mod.rs` | RootLayout > SpaceLayout | spaces | 5207 | 2734 | 4 | 0 | 0 | 0 | 3 | 0 | 2 | 0 | 0 | 0 | 2 |
| 60 | `/spaces/:space_id/actions/quizzes/:quiz_id` | QuizActionPage | QuizActionPage | `features/spaces/pages/actions/actions/quiz/views/main/mod.rs` | RootLayout > SpaceLayout | spaces | 2818 | 1441 | 3 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| 61 | `/spaces/:space_id/actions/follows/:follow_id` | FollowActionPage | FollowActionPage | `features/spaces/pages/actions/actions/follow/views/main/mod.rs` | RootLayout > SpaceLayout | spaces | 1627 | 912 | 2 | 2 | 0 | 0 | 13 | 0 | 0 | 0 | 0 | 0 | 0 |
| 62 | `/spaces/:space_id/actions/meets/:meet_id` | MeetActionPage | MeetActionPage | `features/spaces/pages/actions/actions/meet/components/meet_page/component.rs` | RootLayout > SpaceLayout | spaces | 865 | 332 | 1 | 0 | 4 | 0 | 3 | 2 | 0 | 0 | 0 | 0 | 0 |
| 63 | `/spaces/:space_id/apps/general` | SpaceGeneralAppPage | SpaceGeneralAppPage | `features/spaces/pages/apps/apps/general/views/home/mod.rs` | RootLayout > SpaceLayout > SpaceAppsLayout(apps::Layout) | spaces | 1569 | 725 | 1 | 1 | 10 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 1 |
| 64 | `/spaces/:space_id/apps/files` | SpaceFileAppPage | SpaceFileAppPage | `features/spaces/pages/apps/apps/file/views/home/mod.rs` | RootLayout > SpaceLayout > SpaceAppsLayout(apps::Layout) | spaces | 759 | 379 | 2 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| 65 | `/spaces/:space_id/apps/analyzes` | SpaceAnalyzesAppPage | SpaceAnalyzesAppPage | `features/spaces/pages/apps/apps/analyzes/views/home/mod.rs` | RootLayout > SpaceLayout > SpaceAppsLayout(apps::Layout) | spaces | 386 | 344 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 0 |
| 66 | `/spaces/:space_id/apps/analyzes/create` | SpaceAnalyzeCreatePage | SpaceAnalyzeCreatePage | `features/spaces/pages/apps/apps/analyzes/views/create/mod.rs` | RootLayout > SpaceLayout > SpaceAppsLayout(apps::Layout) | spaces | 1239 | 913 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 67 | `/spaces/:space_id/apps/analyzes/report/:report_id` | SpaceAnalyzeReportPage | SpaceAnalyzeReportPage | `features/spaces/pages/apps/apps/analyzes/views/report/mod.rs` | RootLayout > SpaceLayout > SpaceAppsLayout(apps::Layout) | spaces | 1989 | 1126 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 0 |
| 68 | `/spaces/:space_id/apps/analyzes/report/:report_id/records` | SpaceAnalyzeRecordsPage | SpaceAnalyzeRecordsPage | `features/spaces/pages/apps/apps/analyzes/views/records/component.rs` | RootLayout > SpaceLayout > SpaceAppsLayout(apps::Layout) | spaces | 287 | 260 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 69 | `/spaces/:space_id/apps/analyzes/poll/:poll_id` | SpaceAnalyzeDetailPage | SpaceAnalyzeDetailPage | `features/spaces/pages/apps/apps/analyzes/views/analyze/poll/page.rs` | RootLayout > SpaceLayout > SpaceAppsLayout(apps::Layout) | spaces | 867 | 272 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| 70 | `/spaces/:space_id/apps/analyzes/discussion/:discussion_id` | SpaceAnalyzeDiscussionPage | SpaceAnalyzeDiscussionPage | `features/spaces/pages/apps/apps/analyzes/views/analyze/discussion/page.rs` | RootLayout > SpaceLayout > SpaceAppsLayout(apps::Layout) | spaces | 37 | 13 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 71 | `/spaces/:space_id/apps/panels` | SpacePanelsAppPage | SpacePanelsAppPage | `features/spaces/pages/apps/apps/panels/views/home/mod.rs` | RootLayout > SpaceLayout > SpaceAppsLayout(apps::Layout) | spaces | 1659 | 676 | 1 | 0 | 5 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| 72 | `/spaces/:space_id/apps/incentive-pool` | SpaceIncentivePoolAppPage | SpaceIncentivePoolAppPage | `features/spaces/pages/apps/apps/incentive_pool/views/home/mod.rs` | RootLayout > SpaceLayout > SpaceAppsLayout(apps::Layout) | spaces | 1238 | 583 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| 73 | `/:..rest` | PageNotFound | PageNotFound (inline in route.rs) | `route.rs` | RootLayout | shell/public | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Page dirs measured per route:

- Index: `views/index`
- PrivacyPolicyPage: `views/privacy`
- TermsOfServicePage: `views/terms`
- ChildSafetyPage: `views/child_safety`
- MembershipHome: `features/membership/views`, `features/membership/components`
- CredentialsHome: `features/social/pages/credentials`
- EssenceSourcesPage: `features/essence/pages/sources`
- OnboardingConnectionsPage: `features/cross_posting/views/onboarding_page`
- LaunchpadReturnPage: `features/launchpad_partner/views`
- PostIndex: `features/posts/views/index`
- PostEdit: `features/posts/views/post_edit`
- PostDetail: `features/posts/views/post_detail`, `features/posts/components/post_detail`
- MyFollowerPage: `features/my_follower/views`
- MyAiPage: `features/me/pages/my_ai`
- CharacterPage: `features/character/pages/character_page`
- ArcadeHomePage: `features/arcade/pages/home`
- ArcadeLeaderboardPage: `features/arcade/pages/home`
- FactFoldMatchingPage: `features/arcade/games/fact_or_fold/pages/matching`
- FactFoldGameRoomPage: `features/arcade/games/fact_or_fold/pages/game_room`
- AdminMainPage: `features/admin/views/main`
- FactFoldAdminSubjectsPage: `features/arcade/games/fact_or_fold/pages/admin/subjects`
- FactFoldAdminNewSubjectPage: `features/arcade/games/fact_or_fold/pages/admin/new_subject`
- FactFoldAdminSchedulePage: `features/arcade/games/fact_or_fold/pages/admin/schedule`
- FactFoldAdminStatsPage: `features/arcade/games/fact_or_fold/pages/admin/stats`
- FactFoldAdminReportsPage: `features/arcade/games/fact_or_fold/pages/admin/reports`
- FactFoldAdminSettingsPage: `features/arcade/games/fact_or_fold/pages/admin/settings`
- UserSettingsConnectionsPage: `features/cross_posting/views/connections_page`
- TeamSubTeamDocEditPage: `features/sub_team/pages/doc_compose`
- TeamSubTeamBroadcastComposePage: `features/sub_team/pages/broadcast_compose`
- TeamSubTeamBroadcastEditPage: `features/sub_team/pages/broadcast_compose`
- TeamSubTeamApplyPage: `features/sub_team/pages/apply`
- TeamSubTeamApplicationStatusPage: `features/sub_team/pages/application_status`
- TeamLeaveParentPage: `features/sub_team/pages/leave_parent`
- TeamSubTeamDeregisterPage: `features/sub_team/pages/deregister`
- TeamBylawsPage: `features/sub_team/pages/bylaws`
- TeamSubTeamBylawsComposePage: `features/sub_team/pages/doc_compose`
- SocialIndex: `features/social/pages/index`, `features/social/pages/home`, `features/social/user_views`
- SocialDraft: `features/social/pages/draft`
- SocialReward: `features/social/pages/reward`
- UserPosts: `features/social/pages/post`, `features/posts/components/my_posts.rs`, `features/posts/components/feed_card`
- SocialMembership: `features/social/pages/membership`
- CredentialPage: `features/social/pages/credentials`
- UserSpaces: `features/social/pages/space`
- TeamDao: `features/social/pages/dao`
- TeamMember: `features/social/pages/member`
- SocialSetting: `features/social/pages/setting`
- TeamSettingMember: `features/social/pages/setting/team/views/management_page.rs`
- TeamSettingSubscription: `features/social/pages/setting/team/views/subscription_page`
- TeamSubTeamManagementPage: `features/sub_team/pages/management`
- TeamSubTeamDirectComposePage: `features/sub_team/pages/broadcast_compose`
- TeamSubTeamDetailPage: `features/sub_team/pages/detail`
- SpaceIndexPage: `features/spaces/pages/index` (excluding features/spaces/pages/index/action_pages/discussion)
- SpaceReportPage: `features/spaces/pages/report` (excluding features/spaces/pages/report/views/detail)
- ReportDetailPage: `features/spaces/pages/report/views/detail`
- SpaceDiscussionPage: `features/spaces/pages/index/action_pages/discussion`
- SpaceDiscussionCommentPage: `features/spaces/pages/index/action_pages/discussion`
- SpaceActionsPage: `features/spaces/pages/actions` (excluding features/spaces/pages/actions/actions)
- DiscussionActionEditorPage: `features/spaces/pages/actions/actions/discussion`
- PollActionPage: `features/spaces/pages/actions/actions/poll`
- QuizActionPage: `features/spaces/pages/actions/actions/quiz`
- FollowActionPage: `features/spaces/pages/actions/actions/follow`
- MeetActionPage: `features/spaces/pages/actions/actions/meet`
- SpaceGeneralAppPage: `features/spaces/pages/apps/apps/general`
- SpaceFileAppPage: `features/spaces/pages/apps/apps/file`
- SpaceAnalyzesAppPage: `features/spaces/pages/apps/apps/analyzes/views/home`
- SpaceAnalyzeCreatePage: `features/spaces/pages/apps/apps/analyzes/views/create`
- SpaceAnalyzeReportPage: `features/spaces/pages/apps/apps/analyzes/views/report`
- SpaceAnalyzeRecordsPage: `features/spaces/pages/apps/apps/analyzes/views/records`
- SpaceAnalyzeDetailPage: `features/spaces/pages/apps/apps/analyzes/views/analyze/poll`
- SpaceAnalyzeDiscussionPage: `features/spaces/pages/apps/apps/analyzes/views/analyze/discussion`
- SpacePanelsAppPage: `features/spaces/pages/apps/apps/panels`
- SpaceIncentivePoolAppPage: `features/spaces/pages/apps/apps/incentive_pool`
- PageNotFound: -

## Layouts

| Layout | File | rs | rsx | Provides |
|---|---|---|---|---|
| RootLayout | `root_layout.rs` | 61 | 30 | `AuthContext::init()` (use_loader `get_me_handler` -> `Store<UserContext>` + `logged_in` memo; tauri-web restores session first), `use_team_context_provider` (loader of user's teams), ErrorBoundary -> ErrorPage, SuspenseBoundary, `NotificationsBootstrap` (unread count polling, inbox provider, Android push), `PopupZone`, `ToastProvider`. No auth gating. |
| SocialLayout + UserLayout + TeamSidemenu | `features/social/layout.rs` | 499 | 359 | `use_wall_context_provider(username)` (loader `get_wall_by_username`) then branches: user wall -> `UserLayout` (sidemenu w/ categories via `use_resource(list_categories_handler)`, team-find loader, login/signup popups, sign-out, category `Signal<Option<String>>` context); team wall -> `TeamArenaLayout`. No gating. |
| TeamArenaLayout | `features/social/pages/team_arena` | 1248 | 921 | `TeamArenaContext` (from wall ctx), raw `TeamPartition` context, category signal, `ArenaTopbar` (tabs, follow/unfollow via `follow_user`/`unfollow_user`), `ArenaSettingsPanel`, decorative arena BG, SuspenseBoundary, per-layout `script.js`. Edit/member flags from wall payload (role-based). |
| ArcadeLayout | `features/arcade/layout.rs` | 263 | 175 | `use_arcade_wallet_provider` (chip wallet), top-bar nav (home/leaderboard), chip balance + `ArcadeExchangeModal`, mobile drawer, admin CTA if `UserType::SystemAdmin`. Hides menu in game room. No hard gating. |
| AdminLayout (admin::AppLayout) | `features/admin/layout.rs` | 58 | 36 | **Auth gate**: renders only for `UserType::SystemAdmin`, else `nav.push("/")`. Sticky back topbar. |
| FactFoldAdminLayout | `features/arcade/games/fact_or_fold/pages/admin/layout.rs` | 67 | 44 | Tab nav across 5 Fact-or-Fold admin pages (subjects/schedule/stats/reports/settings). No context. |
| SpaceLayout | `features/spaces/layout.rs` | 45 | 9 | `SpaceContextProvider::init` (6 loaders: user role, space, panel requirements, actions list, ranking, my score; `current_role` memo), `LayoverService`, `SpaceLayoutUiContext{sidebar_visible}`, `SeoMeta` from space, `Layover` host. |
| SpaceAppsLayout (apps::Layout + apps::ContextProvider) | `features/spaces/pages/apps/layout.rs` | 8 | 3 | apps `Context` (loader `get_space_apps` + space ctx). Creator-only gating is done inside pages via `space_ctx.role()`. |

Not mounted by the main Router but referenced as layouts: `TeamSettingLayout` (only in dead `features/social/route.rs`), `my_follower::layout`, `admin::route` `AppLayout` duplicate enum.

## Group totals (whole feature dir, UI-side .rs; excludes controllers/models/server/tests)

| Group | rs | rsx | .rs files | js | ldr | infq | act | hdl | ctrl | seo | eval | ed | pop |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shell/public | 4281 | 1794 | 20 | 1 | 2 | 1 | 0 | 6 | 6 | 1 | 1 | 0 | 9 |
| auth | 2405 | 647 | 36 | 7 | 1 | 0 | 0 | 15 | 10 | 0 | 7 | 0 | 5 |
| posts | 5685 | 2765 | 45 | 2 | 2 | 6 | 6 | 32 | 31 | 1 | 1 | 3 | 2 |
| social (user+team walls, team arena) | 15734 | 7606 | 194 | 8 | 27 | 6 | 0 | 67 | 60 | 0 | 2 | 0 | 24 |
| sub_team | 12436 | 5449 | 56 | 0 | 23 | 3 | 26 | 61 | 26 | 9 | 1 | 2 | 0 |
| spaces (index/actions/apps/report) | 53174 | 23280 | 461 | 11 | 64 | 7 | 37 | 8 | 157 | 3 | 14 | 5 | 31 |
| arcade (+fact-or-fold admin) | 9578 | 2496 | 83 | 1 | 15 | 1 | 0 | 33 | 7 | 10 | 0 | 0 | 0 |
| admin | 1441 | 602 | 16 | 0 | 3 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 |
| membership | 1798 | 488 | 17 | 2 | 0 | 0 | 0 | 2 | 1 | 0 | 2 | 0 | 4 |
| cross_posting | 6333 | 1399 | 35 | 1 | 3 | 0 | 0 | 9 | 3 | 2 | 1 | 0 | 0 |
| essence | 2023 | 619 | 26 | 1 | 1 | 0 | 5 | 8 | 2 | 1 | 0 | 0 | 0 |
| me/character/my_follower | 2660 | 1269 | 50 | 0 | 4 | 2 | 1 | 6 | 7 | 2 | 0 | 0 | 0 |
| launchpad_partner | 1369 | 200 | 18 | 0 | 4 | 0 | 0 | 4 | 3 | 0 | 0 | 0 | 2 |
| no-route features (notifications/timeline/activity/ai_moderator/rag/did) | 4052 | 1067 | 72 | 2 | 6 | 3 | 4 | 16 | 24 | 0 | 12 | 0 | 1 |
| common (components/hooks/contexts/services/utils/types/...) | 25775 | 5329 | 249 | 5 | 2 | 1 | 0 | 48 | 98 | 0 | 16 | 0 | 2 |
| common/components only | 9711 | 5126 | 124 | 1 | 0 | 0 | 0 | 0 | 4 | 0 | 8 | 0 | 2 |

Note: feature dirs also contain `hooks/`, `types/` (DTOs shared with server), `services/`, `interop/`; rsx is the better proxy for UI port effort.

## Top 10 largest route pages (by rs lines of page dirs)

1. SpaceIndexPage `/spaces/:space_id` — rs 7262, rsx 5522
2. PollActionPage `/spaces/:space_id/actions/polls/:poll_id` — rs 5207, rsx 2734
3. SocialSetting `/:username/settings` — rs 4659, rsx 2272
4. SpaceActionsPage `/spaces/:space_id/actions` — rs 4049, rsx 1620
5. SpaceReportPage `/spaces/:space_id/report` — rs 3838, rsx 629
6. QuizActionPage `/spaces/:space_id/actions/quizzes/:quiz_id` — rs 2818, rsx 1441
7. SpaceDiscussionPage `/spaces/:space_id/discussions/:discussion_id` — rs 2607, rsx 664
8. TeamSubTeamManagementPage `/:username/sub-teams/manage` — rs 2504, rsx 1768
9. FactFoldGameRoomPage `/arcade/games/fact-or-fold/rounds/:round_id` — rs 2418, rsx 935
10. PostDetail `/posts/:post_id` — rs 2192, rsx 1358

## Cross-cutting shared pieces

- `common/components/` (~9.7k rs): primitives Button, Input, Select, Card, Row/Col, Dialog, Popover, Tabs, Sheet, BottomSheet, Tooltip, DatePicker/TimePicker, FileUploader, ImageUploadPreview, PasteImageUploader, MentionAutocomplete, CommentImageGrid, SearchInput, SpaceCard, TeamSelector, TeamCreationForm, PremiumSwitch, ThemeSwitcher, Layover, Popup, SeoMeta, SuspenseBoundary, Editor (rich text + script.js), Navbar/Sidebar/Sidemenu, Skeleton, etc.
- Services/providers: `PopupService` + `PopupZone` (common/components/popup), `ToastService` + `ToastProvider` (common/providers/toast_provider), `ThemeService` (theme_switcher), `LayoverService` (common/components/layover, installed per SpaceLayout), `use_persist_ui_state` (localStorage lang/user cache).
- Contexts: `AuthContext`/`UserContext` (features/auth/context), `TeamContext` (common/contexts/team_context.rs), `UseWallContext` (social/hooks), `TeamArenaContext`, `SpaceContextProvider` (spaces/space_common/providers), apps `Context`, notification inbox/unread-count hooks, arcade wallet.
- Hooks (common/hooks): `use_infinite_query` (30 call sites app-wide), `use_loader` wrapper (157 call sites), `use_interval`, `use_platform`, `use_origin`, `use_scroll_lock`, `use_dismiss_on_outside_click` (+ dismiss_outside.js), `use_app_context_provider`.
- JS: 41 `.js` files under src (per-component `script.js` for HTML-first pages + `interop/web/*.js` eval drivers: auth/wallet 7, analyzes 4, common utils 3, credentials 2, notifications 2, membership 2, cross_posting 1). `app.rs` injects a large inline eval (Kakao in-app redirect, soft-keyboard `--kb-inset` tracking). `assets/main.css` is ~55.8k lines of global CSS (HTML-first class names), plus tailwind.
- i18n: `translate!` macro everywhere (EN/KO); SeoMeta in 28 files.

## Surprises / special routing behaviour

- **Catch-all** `/:..rest` -> `PageNotFound` (inline, hardcoded English, dumps attempted path in red `pre`).
- **Query-param route**: `/launchpad/return?:project_id&...&:sig` (9 optional query params, HMAC `sig` hand-back from Launchpad).
- **`/:username` root nest** is a dynamic top-level segment shared by users AND teams; `SocialLayout` resolves the wall type at runtime (`get_wall_by_username`) and swaps `UserLayout` vs `TeamArenaLayout`. Several `Social*` pages branch user/team the same way. React router must order static top-level paths (`/posts`, `/admin`, `/arcade`, `/spaces`, `/membership`, `/essence`, `/credentials`, `/privacy`...) ahead of `/:username`, and a username equal to one of those is unreachable.
- **Route ordering dependence**: `/:username/sub-teams/manage` (inside SocialLayout) must beat `/:username/sub-teams/:sub_team_id`; `/sub-teams/:sub_team_id/compose` declared before the detail wildcard.
- **Layout escapes**: 9 sub-team/bylaws/composer routes and `/:username/settings/connections` sit under `/:username` but deliberately OUTSIDE SocialLayout/TeamArenaLayout (own topbar).
- **Comment deep-link in path** (`/discussions/:id/comments/:comment_id`) because Dioxus router strips query/fragment on hydration — React could use `#comment` instead.
- **Guards are in components, not router**: AdminLayout redirects non-SystemAdmin to `/`; ArcadeLayout only shows admin CTA; space creator-only pages gate on `space_ctx.role()`. `define_owner_only_page!` (redirect non-owner to `/{username}/posts`) exists only in the dead `features/social/route.rs` and is NOT applied to live routes.
- `CredentialsHome` (`/credentials`) is a wrapper in route.rs passing an empty username to the same credentials page as `/:username/credentials`. `PostIndex` (`/posts`) renders only the text "app shell" (stub). `ArcadeHomePage` and `ArcadeLeaderboardPage` share one file.
- **No cargo-feature gating on any Route variant** or page module. Only runtime/platform cfgs: `tauri-web` session restore in AuthContext; `layout_test` feature swaps the (dead) spaces sub-router; `app.rs` Router is the same for web/mobile/tauri-web.
- **Dead / unmounted routing code** (safe to skip in migration): `features/spaces/route.rs` (ChildRouter sub-app design with `#[redirect]`, not `mod`-declared), `features/social/route.rs` (old UserLayout/TeamSettingLayout routes, `/home`, `/team-drafts`, `/team-settings`), `features/admin/route.rs`, `features/my_follower/route.rs` (all undeclared); `spaces/pages/{overview,report}/route.rs` and `apps/apps/incentive_pool/route.rs` (also undeclared); `apps/apps/rewards/route.rs` is the only sub-enum that is `mod`-declared (compiled) but unused. `spaces/pages/dashboard` and `spaces/pages/overview` are compiled and imported in route.rs but have no route; `spaces/pages/apps/views/` is not `mod`-declared (references a non-existent `Route::SpaceOverviewPage`); `spaces/pages/rewards` is commented out. `features/notifications/route.rs` is a placeholder.
- `use_resource` still used in SocialLayout's TeamSidemenu (banned pattern); SocialLayout sidemenu uses string-formatted routes.
