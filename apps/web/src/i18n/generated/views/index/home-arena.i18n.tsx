// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/views/index/i18n.rs (`HomeArenaTranslate`). Namespace "homeArena".
import { useTranslation } from "react-i18next";

const en = {
  brand_title: "Ratel",
  live_status: "Live",
  create: "Create",
  compose_post: "Compose post",
  engage: "Engage",
  account: "Account",
  profile: "Profile",
  ai_assist: "AI assist",
  drafts: "Drafts",
  rewards: "Rewards",
  credentials: "Credentials",
  essence: "Essence",
  arcade: "Arcade",
  my_ai: "My AI",
  settings: "Settings",
  sign_in: "Sign In",
  section_hot: "Hot",
  section_spaces: "Spaces",
  tab_hot: "Hot Spaces",
  tab_mine: "My Spaces",
  tab_posts: "My Posts",
  tab_invited: "Invited",
  empty_hot: "No hot spaces yet. Check back soon.",
  empty_mine: "You haven't joined any spaces yet.",
  empty_posts: "You haven't written any posts yet.",
  empty_invited: "No pending invitations.",
  post_badge: "Post",
  stat_likes: "Likes",
  stat_comments: "Comments",
  stat_shares: "Shares",
  view_post: "View Post",
  heat_blazing: "Blazing",
  heat_trending: "Trending",
  heat_rising: "Rising",
  rank_label: "RANK",
  stat_members: "Members",
  stat_quests: "Quests",
  stat_heat_7d: "7d Heat",
  reward_pool: "pool",
  enter_arena: "Enter Arena",
  hud_your_balance: "Your Balance",
  hud_hot_right_now: "Hot Right Now",
  hud_active_spaces: "active spaces",
  browse_all: "Browse All",
  teams: "Teams",
  teams_header: "Your Teams",
  teams_empty: "You haven't joined any team yet.",
  create_team: "Create Team",
  menu: "Menu",
  open_menu: "Open menu",
  close_menu: "Close menu",
};

const ko: Record<keyof typeof en, string> = {
  brand_title: "Ratel",
  live_status: "실시간",
  create: "생성",
  compose_post: "글 작성",
  engage: "참여",
  account: "계정",
  profile: "프로필",
  ai_assist: "AI 어시스트",
  drafts: "임시저장",
  rewards: "보상",
  credentials: "자격증명",
  essence: "Essence",
  arcade: "오락실",
  my_ai: "마이 AI",
  settings: "설정",
  sign_in: "로그인",
  section_hot: "인기",
  section_spaces: "스페이스",
  tab_hot: "인기 스페이스",
  tab_mine: "내 스페이스",
  tab_posts: "내 게시물",
  tab_invited: "받은 초대",
  empty_hot: "아직 인기 스페이스가 없습니다.",
  empty_mine: "아직 참여한 스페이스가 없습니다.",
  empty_posts: "아직 작성한 게시물이 없습니다.",
  empty_invited: "받은 초대가 없습니다.",
  post_badge: "게시물",
  stat_likes: "좋아요",
  stat_comments: "댓글",
  stat_shares: "공유",
  view_post: "게시물 보기",
  heat_blazing: "불타는",
  heat_trending: "트렌드",
  heat_rising: "상승",
  rank_label: "순위",
  stat_members: "멤버",
  stat_quests: "퀘스트",
  stat_heat_7d: "7일 열기",
  reward_pool: "풀",
  enter_arena: "입장하기",
  hud_your_balance: "내 잔액",
  hud_hot_right_now: "지금 인기",
  hud_active_spaces: "활성 스페이스",
  browse_all: "전체 보기",
  teams: "팀",
  teams_header: "내 팀",
  teams_empty: "아직 참여한 팀이 없습니다.",
  create_team: "팀 생성",
  menu: "메뉴",
  open_menu: "메뉴 열기",
  close_menu: "메뉴 닫기",
};

export const i18n = { en, ko };

export interface HomeArenaI18n {
  brandTitle: string;
  liveStatus: string;
  create: string;
  composePost: string;
  engage: string;
  account: string;
  profile: string;
  aiAssist: string;
  drafts: string;
  rewards: string;
  credentials: string;
  essence: string;
  arcade: string;
  myAi: string;
  settings: string;
  signIn: string;
  sectionHot: string;
  sectionSpaces: string;
  tabHot: string;
  tabMine: string;
  tabPosts: string;
  tabInvited: string;
  emptyHot: string;
  emptyMine: string;
  emptyPosts: string;
  emptyInvited: string;
  postBadge: string;
  statLikes: string;
  statComments: string;
  statShares: string;
  viewPost: string;
  heatBlazing: string;
  heatTrending: string;
  heatRising: string;
  rankLabel: string;
  statMembers: string;
  statQuests: string;
  statHeat7d: string;
  rewardPool: string;
  enterArena: string;
  hudYourBalance: string;
  hudHotRightNow: string;
  hudActiveSpaces: string;
  browseAll: string;
  teams: string;
  teamsHeader: string;
  teamsEmpty: string;
  createTeam: string;
  menu: string;
  openMenu: string;
  closeMenu: string;
}

export function useHomeArenaI18n(): HomeArenaI18n {
  const { t } = useTranslation("homeArena");
  return {
    brandTitle: t("brand_title"),
    liveStatus: t("live_status"),
    create: t("create"),
    composePost: t("compose_post"),
    engage: t("engage"),
    account: t("account"),
    profile: t("profile"),
    aiAssist: t("ai_assist"),
    drafts: t("drafts"),
    rewards: t("rewards"),
    credentials: t("credentials"),
    essence: t("essence"),
    arcade: t("arcade"),
    myAi: t("my_ai"),
    settings: t("settings"),
    signIn: t("sign_in"),
    sectionHot: t("section_hot"),
    sectionSpaces: t("section_spaces"),
    tabHot: t("tab_hot"),
    tabMine: t("tab_mine"),
    tabPosts: t("tab_posts"),
    tabInvited: t("tab_invited"),
    emptyHot: t("empty_hot"),
    emptyMine: t("empty_mine"),
    emptyPosts: t("empty_posts"),
    emptyInvited: t("empty_invited"),
    postBadge: t("post_badge"),
    statLikes: t("stat_likes"),
    statComments: t("stat_comments"),
    statShares: t("stat_shares"),
    viewPost: t("view_post"),
    heatBlazing: t("heat_blazing"),
    heatTrending: t("heat_trending"),
    heatRising: t("heat_rising"),
    rankLabel: t("rank_label"),
    statMembers: t("stat_members"),
    statQuests: t("stat_quests"),
    statHeat7d: t("stat_heat_7d"),
    rewardPool: t("reward_pool"),
    enterArena: t("enter_arena"),
    hudYourBalance: t("hud_your_balance"),
    hudHotRightNow: t("hud_hot_right_now"),
    hudActiveSpaces: t("hud_active_spaces"),
    browseAll: t("browse_all"),
    teams: t("teams"),
    teamsHeader: t("teams_header"),
    teamsEmpty: t("teams_empty"),
    createTeam: t("create_team"),
    menu: t("menu"),
    openMenu: t("open_menu"),
    closeMenu: t("close_menu"),
  };
}
