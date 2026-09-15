// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/index/i18n.rs (`SpaceViewerTranslate`). Namespace "spaceViewer".
import { useTranslation } from "react-i18next";

const en = {
  join_heading: "Join the Arena",
  join_desc: "Enter this space to vote on proposals, discuss topics, and earn rewards alongside other participants.",
  welcome_heading: "Welcome, Explorer",
  welcome_desc: "Sign in to participate in this space, vote on proposals, and earn rewards.",
  participants: "Participants",
  remaining: "Remaining",
  rewards: "Rewards",
  participate: "Participate",
  sign_in: "Sign In",
  space_creator: "Space Creator",
  overview: "Overview",
  settings: "Settings",
  about: "About",
  key_metrics: "Key Metrics",
  spots_left: "Spots Left",
  reward_pool: "Reward Pool",
  likes: "Likes",
  created_by: "Created by",
  theme: "Theme",
  dark: "Dark",
  light: "Light",
  system: "System",
  language: "Language",
  english: "English",
  korean: "Korean",
  status_open: "Open for Participation",
  status_ongoing: "In Progress",
  status_finished: "Finished",
  login_title: "Join the Movement",
  verification_heading: "Verification Required",
  verification_alert: "Some required attributes are missing",
  required_attributes: "Required Attributes",
  verify_credentials: "Verify Credentials",
  verification_failed: "Some required attributes are still missing after verification.",
  logout: "Log Out",
  delete_account: "Delete Account",
  consent_heading: "Confirm Participation",
  consent_desc: "Please review and confirm your consent before joining this space.",
  consent_label: "I understand and agree to participate in this Space, including sharing the required attributes for verification.",
  consent_cancel: "Back",
  consent_confirm: "Join Space",
  your_quests: "Your Quests",
  your_quests_tooltip: "Complete quests to earn points and unlock rewards. Admins can add, edit, or remove quests here.",
  quest_progress: "Progress",
  completed: "Completed",
  no_completed_yet: "No completed quests yet",
  all_quests_done: "All quests completed! Great work.",
  prev_quest: "Previous quest",
  next_quest: "Next quest",
  required_label: "Required",
  locked_label: "Locked",
  dependency_locked_prefix: "Complete first:",
  dependency_locked_generic: "required actions",
  locked_see_required: "See Required",
  start_quest: "Start",
  vote_to_participate: "Cast your vote",
  join_discussion: "Join the conversation",
  questions: "Questions",
  follow_users: "Follow to complete",
  followed_label: "followed",
  vote_label: "Vote",
  skipped_label: "Skipped",
  switch_to_creator: "Creator Mode",
  leaderboard: "Leaderboard",
  your_rank: "Your Rank",
  total_xp: "Total XP",
  poll_label: "Poll",
  quiz_label: "Quiz",
  discussion_label: "Discussion",
  follow_label: "Follow",
  top_participants: "Top Participants",
  you: "You",
  no_ranking_yet: "No ranking data yet. Complete actions to earn XP!",
  xp_label: "XP",
  prereq_heading: "Complete Required Actions",
  prereq_desc: "Complete the following actions to secure your spot in this space.",
  prereq_progress: "Progress",
  prereq_completed: "Completed",
  prereq_pending: "Start",
  waiting_heading: "You're All Set!",
  waiting_desc: "You've completed all required actions. Waiting for the space to start.",
  waiting_status: "Waiting for Space to Start",
  waiting_participants: "Participants",
  waiting_starts_in: "Starts In",
  waiting_days: "D",
  waiting_hours: "H",
  waiting_minutes: "M",
  waiting_seconds: "S",
  edit: "Edit",
  editing: "Editing",
  about_edit_hint: "Markdown supported",
  files: "Files",
  files_hint: "Up to 20 MB each",
  drop_files_title: "Drop files to upload",
  drop_files_desc: "PDF, images, documents — up to 20 MB per file",
  browse_files: "or click to browse",
  save: "Save",
  cancel: "Cancel",
  installed_apps: "Installed Apps",
  available_apps: "Available Apps",
  app_general_name: "General",
  app_general_desc: "Settings (Admin)",
  app_file_name: "File",
  app_file_desc: "Manage and organize files shared in your space.",
  app_analyzes_name: "Analyzes",
  app_analyzes_desc: "Check out the poll results.",
  app_panels_name: "Panels",
  app_panels_desc: "Configure panel participation rules.",
  settings_btn: "Settings",
  install: "Install",
  reports_section_label: "Reports",
  report_download_btn: "View Report",
  new_action: "New Action",
  new_action_desc: "Create a new quest for participants. Pick a type to get started.",
  create_action: "Create Action",
  admin_only: "Admin only",
  editing_quest: "Editing quest",
  quest_title_placeholder: "Quest title",
  quest_desc_placeholder: "Describe this quest...",
  attachments: "Attachments",
  choose_action_type: "Choose Action Type",
  poll_name: "Poll",
  poll_desc: "Ask a question with multiple-choice options. Collect votes.",
  discussion_name: "Discussion",
  discussion_desc: "Open a thread where members share perspectives and comment.",
  quiz_name: "Quiz",
  quiz_desc: "Test knowledge with timed questions. Reward pass-rate.",
  follow_name: "Follow",
  follow_desc: "Require participants to follow curated users or teams.",
  meet_name: "Meet",
  meet_desc: "Live meeting with recording & transcript",
  admin_badge: "Admin",
  home: "Home",
  publish: "Publish",
  start: "Start",
  finish: "Finish",
  comments_count: "comments",
};

const ko: Record<keyof typeof en, string> = {
  join_heading: "아레나 참여",
  join_desc: "이 스페이스에 참여하여 제안에 투표하고, 주제를 토론하고, 다른 참가자들과 함께 보상을 받으세요.",
  welcome_heading: "탐험가님, 환영합니다",
  welcome_desc: "로그인하여 이 스페이스에 참여하고, 제안에 투표하고, 보상을 받으세요.",
  participants: "참가자",
  remaining: "잔여",
  rewards: "보상",
  participate: "참여하기",
  sign_in: "로그인",
  space_creator: "스페이스 생성자",
  overview: "개요",
  settings: "설정",
  about: "소개",
  key_metrics: "주요 지표",
  spots_left: "남은 자리",
  reward_pool: "보상 풀",
  likes: "좋아요",
  created_by: "생성자",
  theme: "테마",
  dark: "다크",
  light: "라이트",
  system: "시스템",
  language: "언어",
  english: "영어",
  korean: "한국어",
  status_open: "참여 가능",
  status_ongoing: "진행 중",
  status_finished: "종료",
  login_title: "로그인 및 회원가입",
  verification_heading: "인증 필요",
  verification_alert: "필수 속성이 부족합니다",
  required_attributes: "필수 속성",
  verify_credentials: "자격 증명 인증",
  verification_failed: "인증 후에도 일부 필수 속성이 부족합니다.",
  logout: "로그아웃",
  delete_account: "회원 탈퇴",
  consent_heading: "참여 확인",
  consent_desc: "이 스페이스에 참여하기 전에 동의 사항을 확인해 주세요.",
  consent_label: "이 스페이스에 참여하며, 검증에 필요한 속성 공유에 동의합니다.",
  consent_cancel: "뒤로",
  consent_confirm: "스페이스 참여",
  your_quests: "나의 퀘스트",
  your_quests_tooltip: "퀘스트를 완료하면 포인트를 얻고 보상을 잠금 해제할 수 있습니다. 관리자는 여기서 퀘스트를 추가, 편집, 삭제할 수 있습니다.",
  quest_progress: "진행도",
  completed: "완료됨",
  no_completed_yet: "아직 완료된 퀘스트가 없습니다",
  all_quests_done: "모든 퀘스트를 완료했습니다!",
  prev_quest: "이전 퀘스트",
  next_quest: "다음 퀘스트",
  required_label: "필수",
  locked_label: "잠김",
  dependency_locked_prefix: "먼저 완료:",
  dependency_locked_generic: "선행 액션",
  locked_see_required: "선행 액션 보기",
  start_quest: "시작",
  vote_to_participate: "투표하기",
  join_discussion: "토론 참여",
  questions: "문항",
  follow_users: "팔로우하여 완료",
  followed_label: "팔로우됨",
  vote_label: "투표",
  skipped_label: "건너뜀",
  switch_to_creator: "관리자 모드",
  leaderboard: "리더보드",
  your_rank: "내 순위",
  total_xp: "총 경험치",
  poll_label: "투표",
  quiz_label: "퀴즈",
  discussion_label: "토론",
  follow_label: "팔로우",
  top_participants: "상위 참가자",
  you: "나",
  no_ranking_yet: "아직 랭킹 데이터가 없습니다. 활동을 완료하여 경험치를 얻으세요!",
  xp_label: "경험치",
  prereq_heading: "필수 액션 완료",
  prereq_desc: "이 스페이스에 참여하려면 다음 액션을 완료해주세요.",
  prereq_progress: "진행도",
  prereq_completed: "완료",
  prereq_pending: "시작",
  waiting_heading: "준비 완료!",
  waiting_desc: "모든 필수 액션을 완료했습니다. 스페이스 시작을 기다리고 있습니다.",
  waiting_status: "스페이스 시작 대기 중",
  waiting_participants: "참여자",
  waiting_starts_in: "시작까지",
  waiting_days: "일",
  waiting_hours: "시",
  waiting_minutes: "분",
  waiting_seconds: "초",
  edit: "편집",
  editing: "편집 중",
  about_edit_hint: "마크다운 지원",
  files: "파일",
  files_hint: "파일당 최대 20 MB",
  drop_files_title: "파일을 놓아 업로드",
  drop_files_desc: "PDF, 이미지, 문서 — 파일당 최대 20 MB",
  browse_files: "또는 클릭하여 찾아보기",
  save: "저장",
  cancel: "취소",
  installed_apps: "설치된 앱",
  available_apps: "사용 가능한 앱",
  app_general_name: "일반",
  app_general_desc: "설정 (관리자)",
  app_file_name: "파일",
  app_file_desc: "스페이스에서 공유되는 파일을 관리하고 정리하세요.",
  app_analyzes_name: "분석",
  app_analyzes_desc: "투표 결과를 확인하세요.",
  app_panels_name: "패널",
  app_panels_desc: "패널 참여 규칙을 설정하세요.",
  settings_btn: "설정",
  install: "설치",
  reports_section_label: "보고서",
  report_download_btn: "보고서 확인하기",
  new_action: "새 액션",
  new_action_desc: "참가자를 위한 새로운 퀘스트를 만드세요. 유형을 선택하여 시작하세요.",
  create_action: "액션 만들기",
  admin_only: "관리자 전용",
  editing_quest: "퀘스트 편집 중",
  quest_title_placeholder: "퀘스트 제목",
  quest_desc_placeholder: "이 퀘스트를 설명해 주세요...",
  attachments: "첨부 파일",
  choose_action_type: "액션 유형 선택",
  poll_name: "투표",
  poll_desc: "객관식 질문을 하고 투표를 모으세요.",
  discussion_name: "토론",
  discussion_desc: "구성원이 의견을 나누고 댓글을 다는 스레드를 여세요.",
  quiz_name: "퀴즈",
  quiz_desc: "시간 제한 질문으로 지식을 확인하고 통과율에 보상하세요.",
  follow_name: "팔로우",
  follow_desc: "참가자에게 지정된 사용자 또는 팀을 팔로우하도록 요구하세요.",
  meet_name: "미팅",
  meet_desc: "녹화·transcript 자동 저장 실시간 회의",
  admin_badge: "관리자",
  home: "홈",
  publish: "게시",
  start: "시작",
  finish: "종료",
  comments_count: "개의 댓글",
};

export const i18n = { en, ko };

export interface SpaceViewerI18n {
  joinHeading: string;
  joinDesc: string;
  welcomeHeading: string;
  welcomeDesc: string;
  participants: string;
  remaining: string;
  rewards: string;
  participate: string;
  signIn: string;
  spaceCreator: string;
  overview: string;
  settings: string;
  about: string;
  keyMetrics: string;
  spotsLeft: string;
  rewardPool: string;
  likes: string;
  createdBy: string;
  theme: string;
  dark: string;
  light: string;
  system: string;
  language: string;
  english: string;
  korean: string;
  statusOpen: string;
  statusOngoing: string;
  statusFinished: string;
  loginTitle: string;
  verificationHeading: string;
  verificationAlert: string;
  requiredAttributes: string;
  verifyCredentials: string;
  verificationFailed: string;
  logout: string;
  deleteAccount: string;
  consentHeading: string;
  consentDesc: string;
  consentLabel: string;
  consentCancel: string;
  consentConfirm: string;
  yourQuests: string;
  yourQuestsTooltip: string;
  questProgress: string;
  completed: string;
  noCompletedYet: string;
  allQuestsDone: string;
  prevQuest: string;
  nextQuest: string;
  requiredLabel: string;
  lockedLabel: string;
  dependencyLockedPrefix: string;
  dependencyLockedGeneric: string;
  lockedSeeRequired: string;
  startQuest: string;
  voteToParticipate: string;
  joinDiscussion: string;
  questions: string;
  followUsers: string;
  followedLabel: string;
  voteLabel: string;
  skippedLabel: string;
  switchToCreator: string;
  leaderboard: string;
  yourRank: string;
  totalXp: string;
  pollLabel: string;
  quizLabel: string;
  discussionLabel: string;
  followLabel: string;
  topParticipants: string;
  you: string;
  noRankingYet: string;
  xpLabel: string;
  prereqHeading: string;
  prereqDesc: string;
  prereqProgress: string;
  prereqCompleted: string;
  prereqPending: string;
  waitingHeading: string;
  waitingDesc: string;
  waitingStatus: string;
  waitingParticipants: string;
  waitingStartsIn: string;
  waitingDays: string;
  waitingHours: string;
  waitingMinutes: string;
  waitingSeconds: string;
  edit: string;
  editing: string;
  aboutEditHint: string;
  files: string;
  filesHint: string;
  dropFilesTitle: string;
  dropFilesDesc: string;
  browseFiles: string;
  save: string;
  cancel: string;
  installedApps: string;
  availableApps: string;
  appGeneralName: string;
  appGeneralDesc: string;
  appFileName: string;
  appFileDesc: string;
  appAnalyzesName: string;
  appAnalyzesDesc: string;
  appPanelsName: string;
  appPanelsDesc: string;
  settingsBtn: string;
  install: string;
  reportsSectionLabel: string;
  reportDownloadBtn: string;
  newAction: string;
  newActionDesc: string;
  createAction: string;
  adminOnly: string;
  editingQuest: string;
  questTitlePlaceholder: string;
  questDescPlaceholder: string;
  attachments: string;
  chooseActionType: string;
  pollName: string;
  pollDesc: string;
  discussionName: string;
  discussionDesc: string;
  quizName: string;
  quizDesc: string;
  followName: string;
  followDesc: string;
  meetName: string;
  meetDesc: string;
  adminBadge: string;
  home: string;
  publish: string;
  start: string;
  finish: string;
  commentsCount: string;
}

export function useSpaceViewerI18n(): SpaceViewerI18n {
  const { t } = useTranslation("spaceViewer");
  return {
    joinHeading: t("join_heading"),
    joinDesc: t("join_desc"),
    welcomeHeading: t("welcome_heading"),
    welcomeDesc: t("welcome_desc"),
    participants: t("participants"),
    remaining: t("remaining"),
    rewards: t("rewards"),
    participate: t("participate"),
    signIn: t("sign_in"),
    spaceCreator: t("space_creator"),
    overview: t("overview"),
    settings: t("settings"),
    about: t("about"),
    keyMetrics: t("key_metrics"),
    spotsLeft: t("spots_left"),
    rewardPool: t("reward_pool"),
    likes: t("likes"),
    createdBy: t("created_by"),
    theme: t("theme"),
    dark: t("dark"),
    light: t("light"),
    system: t("system"),
    language: t("language"),
    english: t("english"),
    korean: t("korean"),
    statusOpen: t("status_open"),
    statusOngoing: t("status_ongoing"),
    statusFinished: t("status_finished"),
    loginTitle: t("login_title"),
    verificationHeading: t("verification_heading"),
    verificationAlert: t("verification_alert"),
    requiredAttributes: t("required_attributes"),
    verifyCredentials: t("verify_credentials"),
    verificationFailed: t("verification_failed"),
    logout: t("logout"),
    deleteAccount: t("delete_account"),
    consentHeading: t("consent_heading"),
    consentDesc: t("consent_desc"),
    consentLabel: t("consent_label"),
    consentCancel: t("consent_cancel"),
    consentConfirm: t("consent_confirm"),
    yourQuests: t("your_quests"),
    yourQuestsTooltip: t("your_quests_tooltip"),
    questProgress: t("quest_progress"),
    completed: t("completed"),
    noCompletedYet: t("no_completed_yet"),
    allQuestsDone: t("all_quests_done"),
    prevQuest: t("prev_quest"),
    nextQuest: t("next_quest"),
    requiredLabel: t("required_label"),
    lockedLabel: t("locked_label"),
    dependencyLockedPrefix: t("dependency_locked_prefix"),
    dependencyLockedGeneric: t("dependency_locked_generic"),
    lockedSeeRequired: t("locked_see_required"),
    startQuest: t("start_quest"),
    voteToParticipate: t("vote_to_participate"),
    joinDiscussion: t("join_discussion"),
    questions: t("questions"),
    followUsers: t("follow_users"),
    followedLabel: t("followed_label"),
    voteLabel: t("vote_label"),
    skippedLabel: t("skipped_label"),
    switchToCreator: t("switch_to_creator"),
    leaderboard: t("leaderboard"),
    yourRank: t("your_rank"),
    totalXp: t("total_xp"),
    pollLabel: t("poll_label"),
    quizLabel: t("quiz_label"),
    discussionLabel: t("discussion_label"),
    followLabel: t("follow_label"),
    topParticipants: t("top_participants"),
    you: t("you"),
    noRankingYet: t("no_ranking_yet"),
    xpLabel: t("xp_label"),
    prereqHeading: t("prereq_heading"),
    prereqDesc: t("prereq_desc"),
    prereqProgress: t("prereq_progress"),
    prereqCompleted: t("prereq_completed"),
    prereqPending: t("prereq_pending"),
    waitingHeading: t("waiting_heading"),
    waitingDesc: t("waiting_desc"),
    waitingStatus: t("waiting_status"),
    waitingParticipants: t("waiting_participants"),
    waitingStartsIn: t("waiting_starts_in"),
    waitingDays: t("waiting_days"),
    waitingHours: t("waiting_hours"),
    waitingMinutes: t("waiting_minutes"),
    waitingSeconds: t("waiting_seconds"),
    edit: t("edit"),
    editing: t("editing"),
    aboutEditHint: t("about_edit_hint"),
    files: t("files"),
    filesHint: t("files_hint"),
    dropFilesTitle: t("drop_files_title"),
    dropFilesDesc: t("drop_files_desc"),
    browseFiles: t("browse_files"),
    save: t("save"),
    cancel: t("cancel"),
    installedApps: t("installed_apps"),
    availableApps: t("available_apps"),
    appGeneralName: t("app_general_name"),
    appGeneralDesc: t("app_general_desc"),
    appFileName: t("app_file_name"),
    appFileDesc: t("app_file_desc"),
    appAnalyzesName: t("app_analyzes_name"),
    appAnalyzesDesc: t("app_analyzes_desc"),
    appPanelsName: t("app_panels_name"),
    appPanelsDesc: t("app_panels_desc"),
    settingsBtn: t("settings_btn"),
    install: t("install"),
    reportsSectionLabel: t("reports_section_label"),
    reportDownloadBtn: t("report_download_btn"),
    newAction: t("new_action"),
    newActionDesc: t("new_action_desc"),
    createAction: t("create_action"),
    adminOnly: t("admin_only"),
    editingQuest: t("editing_quest"),
    questTitlePlaceholder: t("quest_title_placeholder"),
    questDescPlaceholder: t("quest_desc_placeholder"),
    attachments: t("attachments"),
    chooseActionType: t("choose_action_type"),
    pollName: t("poll_name"),
    pollDesc: t("poll_desc"),
    discussionName: t("discussion_name"),
    discussionDesc: t("discussion_desc"),
    quizName: t("quiz_name"),
    quizDesc: t("quiz_desc"),
    followName: t("follow_name"),
    followDesc: t("follow_desc"),
    meetName: t("meet_name"),
    meetDesc: t("meet_desc"),
    adminBadge: t("admin_badge"),
    home: t("home"),
    publish: t("publish"),
    start: t("start"),
    finish: t("finish"),
    commentsCount: t("comments_count"),
  };
}
