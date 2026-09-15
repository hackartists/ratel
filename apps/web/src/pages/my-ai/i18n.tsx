// Ported from: app/ratel/src/features/me/pages/my_ai/i18n.rs (`MyAiTranslate`). Namespace "myAi".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "My AI",
  back: "Back",
  status_online: "MCP Online",
  status_offline: "Not Configured",
  mcp_docs: "MCP Docs",
  hero_eyebrow_label: "Personal MCP Endpoint",
  hero_eyebrow_transport: "Streamable HTTP",
  hero_title: "Plug Ratel into your AI agent",
  hero_sub: "This is your private endpoint. Add it to Claude Code, Claude Desktop, Cursor, or any MCP-compatible client to let your agent post on Ratel, vote in polls, browse spaces and discussions, and act on your behalf — securely scoped to your account.",
  endpoint_label: "Endpoint",
  placeholder_existing: "Token already generated — regenerate to view a fresh URL.",
  placeholder_none: "No token yet — click \"Generate\" to create your endpoint.",
  note_heads_up: "Heads up.",
  note_body: "The full URL is shown only once — right after you generate or regenerate it. Copy it now and paste into your agent's config. If you lose it, you'll need to regenerate (the old token will stop working immediately).",
  btn_copy: "Copy URL",
  btn_copied: "Copied",
  btn_generate: "Generate",
  btn_regenerate: "Regenerate",
  btn_generating: "Generating…",
  btn_copy_url: "Copy",
  actions_hint: "Keep this URL secret. Treat it like an API key.",
  caps_section_title: "What your agent can do",
  caps_section_sub: "All actions are scoped to your account · auditable",
  cap_posts_label: "Posts & Drafts",
  cap_posts_value: "Create, edit, like, and delete posts",
  cap_polls_label: "Polls & Quizzes",
  cap_polls_value: "Run, respond, and analyze results",
  cap_spaces_label: "Spaces & Teams",
  cap_spaces_value: "Create spaces, manage teams, follow users",
  cap_discussions_label: "Discussions",
  cap_discussions_value: "Read, comment, and start discussions",
  cap_inbox_label: "Notifications",
  cap_inbox_value: "Read inbox, mark items as read",
  guide_section_title: "Setup guide",
  guide_section_sub: "Pick your client · 2-minute setup",
  tab_claude_code: "Claude Code",
  tab_claude_desktop: "Claude Desktop",
  tab_cursor: "Cursor",
  tab_generic: "Generic JSON",
  cc_lede_prefix: "Claude Code",
  cc_lede_body: "is Anthropic's CLI agent. Add Ratel as a streamable HTTP MCP server in one command, then call /mcp inside Claude Code to confirm.",
  cc_step1_title: "Add the server with claude mcp add",
  cc_step1_hint: "Run this in your terminal. Replace the URL with the one you copied above.",
  cc_step2_title: "Verify the connection",
  cc_step2_hint: "Inside an active Claude Code session, run /mcp. You should see a 'ratel' server with status connected and the available tools listed.",
  cc_step3_title: "Try it out",
  cc_step3_hint: "Ask Claude Code something like: \"List my latest 5 Ratel posts and mark all unread notifications as read.\"",
  cc_verify_title: "Local-only token",
  cc_verify_hint: "Claude Code stores the URL in ~/.claude.json on your machine. Don't commit this file to git.",
  cd_lede: "Claude Desktop reads its MCP server list from claude_desktop_config.json. Add the snippet below, save, and fully quit + relaunch Claude.",
  cd_step1_title: "Open the config file",
  cd_step1_macos: "macOS",
  cd_step1_windows: "Windows",
  cd_step2_title: "Add the ratel server",
  cd_step2_hint: "Merge into \"mcpServers\" (create the key if missing).",
  cd_step3_title: "Restart Claude Desktop",
  cd_step3_hint: "Fully quit (not just close) then reopen. Look for the plug icon at the bottom of the chat input — 'ratel' should appear in the connected servers list.",
  cur_lede: "Cursor supports MCP servers via Settings → Cursor Settings → MCP. You can either add the server through the UI or paste the JSON directly.",
  cur_step1_title: "Open Cursor Settings · MCP",
  cur_step1_hint: "Press Cmd+, (macOS) or Ctrl+, (Windows/Linux), then search \"MCP\".",
  cur_step2_title: "Add a new server → HTTP / Streamable",
  cur_step2_hint: "Name: ratel · URL: paste the endpoint you copied above.",
  cur_step3_title: "Toggle the server on",
  cur_step3_hint: "Cursor will show \"Loading tools…\" then list the Ratel tools (create_post, list_inbox, vote_poll, …). Open the chat sidebar and the agent can now use them.",
  gen_lede: "Any client that speaks the Model Context Protocol over Streamable HTTP can connect. The endpoint accepts JSON-RPC 2.0 requests and streams responses via Server-Sent Events.",
  gen_step1_title: "Smoke-test with curl",
  gen_step1_hint: "Confirm your endpoint is reachable and lists tools.",
  gen_step2_title: "Use any MCP SDK",
  gen_step2_hint: "Python, TypeScript, Rust SDKs all work. Point the client's StreamableHTTPServerTransport at your endpoint URL.",
  error_clipboard: "Failed to copy to clipboard. Please copy it manually.",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "마이 AI",
  back: "뒤로",
  status_online: "MCP 연결됨",
  status_offline: "미설정",
  mcp_docs: "MCP 문서",
  hero_eyebrow_label: "개인 MCP 엔드포인트",
  hero_eyebrow_transport: "스트리머블 HTTP",
  hero_title: "Ratel을 AI 에이전트에 연결하세요",
  hero_sub: "이것은 당신의 개인 엔드포인트입니다. Claude Code, Claude Desktop, Cursor 또는 MCP 호환 클라이언트에 추가하여 에이전트가 Ratel에 글을 게시하고, 투표하고, 스페이스와 토론을 탐색하며, 당신의 계정에 안전하게 범위가 지정된 작업을 수행하도록 할 수 있습니다.",
  endpoint_label: "엔드포인트",
  placeholder_existing: "토큰이 이미 생성되었습니다. 새 URL을 보려면 다시 생성하세요.",
  placeholder_none: "아직 토큰이 없습니다. \"생성\"을 클릭하여 엔드포인트를 만드세요.",
  note_heads_up: "주의.",
  note_body: "전체 URL은 생성 또는 재생성 직후 한 번만 표시됩니다. 지금 복사하여 에이전트 설정에 붙여넣으세요. 분실 시 다시 생성해야 하며 기존 토큰은 즉시 작동하지 않습니다.",
  btn_copy: "URL 복사",
  btn_copied: "복사됨",
  btn_generate: "생성",
  btn_regenerate: "재생성",
  btn_generating: "생성 중…",
  btn_copy_url: "복사",
  actions_hint: "이 URL을 비밀로 유지하세요. API 키처럼 다루세요.",
  caps_section_title: "에이전트가 할 수 있는 일",
  caps_section_sub: "모든 작업은 당신의 계정으로 제한 · 감사 가능",
  cap_posts_label: "게시물 및 초안",
  cap_posts_value: "게시물 작성, 수정, 좋아요, 삭제",
  cap_polls_label: "투표 및 퀴즈",
  cap_polls_value: "실행, 응답, 결과 분석",
  cap_spaces_label: "스페이스 및 팀",
  cap_spaces_value: "스페이스 생성, 팀 관리, 사용자 팔로우",
  cap_discussions_label: "토론",
  cap_discussions_value: "읽기, 댓글 작성, 토론 시작",
  cap_inbox_label: "알림",
  cap_inbox_value: "받은편지함 읽기, 항목 읽음 처리",
  guide_section_title: "설정 가이드",
  guide_section_sub: "클라이언트 선택 · 2분 설정",
  tab_claude_code: "Claude Code",
  tab_claude_desktop: "Claude Desktop",
  tab_cursor: "Cursor",
  tab_generic: "일반 JSON",
  cc_lede_prefix: "Claude Code",
  cc_lede_body: "는 Anthropic의 CLI 에이전트입니다. Ratel을 streamable HTTP MCP 서버로 한 번의 명령으로 추가한 후, Claude Code 안에서 /mcp를 호출하여 확인하세요.",
  cc_step1_title: "claude mcp add로 서버 추가",
  cc_step1_hint: "터미널에서 실행하세요. URL을 위에서 복사한 URL로 교체하세요.",
  cc_step2_title: "연결 확인",
  cc_step2_hint: "활성 Claude Code 세션에서 /mcp를 실행하세요. 'ratel' 서버가 연결됨 상태로 표시되고 사용 가능한 도구가 나열되어야 합니다.",
  cc_step3_title: "사용해보기",
  cc_step3_hint: "Claude Code에 다음과 같이 요청하세요: \"내 최근 Ratel 게시물 5개를 나열하고 모든 읽지 않은 알림을 읽음으로 표시하세요.\"",
  cc_verify_title: "로컬 전용 토큰",
  cc_verify_hint: "Claude Code는 URL을 ~/.claude.json에 저장합니다. 이 파일을 git에 커밋하지 마세요.",
  cd_lede: "Claude Desktop은 claude_desktop_config.json에서 MCP 서버 목록을 읽습니다. 아래 스니펫을 추가하고 저장한 후, Claude를 완전히 종료한 다음 다시 실행하세요.",
  cd_step1_title: "설정 파일 열기",
  cd_step1_macos: "macOS",
  cd_step1_windows: "Windows",
  cd_step2_title: "ratel 서버 추가",
  cd_step2_hint: "\"mcpServers\"에 병합하세요 (없으면 키를 생성하세요).",
  cd_step3_title: "Claude Desktop 재시작",
  cd_step3_hint: "완전히 종료한 후 (단순히 닫는 것이 아님) 다시 여세요. 채팅 입력 하단의 플러그 아이콘을 확인하세요 — 'ratel'이 연결된 서버 목록에 표시되어야 합니다.",
  cur_lede: "Cursor는 Settings → Cursor Settings → MCP를 통해 MCP 서버를 지원합니다. UI를 통해 서버를 추가하거나 JSON을 직접 붙여넣을 수 있습니다.",
  cur_step1_title: "Cursor Settings · MCP 열기",
  cur_step1_hint: "Cmd+, (macOS) 또는 Ctrl+, (Windows/Linux)를 누른 후 \"MCP\"를 검색하세요.",
  cur_step2_title: "새 서버 추가 → HTTP / Streamable",
  cur_step2_hint: "이름: ratel · URL: 위에서 복사한 엔드포인트를 붙여넣으세요.",
  cur_step3_title: "서버 활성화",
  cur_step3_hint: "Cursor에 \"Loading tools…\"가 표시된 후 Ratel 도구(create_post, list_inbox, vote_poll, …)가 나열됩니다. 채팅 사이드바를 열면 에이전트가 이제 도구를 사용할 수 있습니다.",
  gen_lede: "Streamable HTTP를 통해 Model Context Protocol을 사용하는 모든 클라이언트가 연결할 수 있습니다. 엔드포인트는 JSON-RPC 2.0 요청을 수락하고 Server-Sent Events를 통해 응답을 스트리밍합니다.",
  gen_step1_title: "curl로 스모크 테스트",
  gen_step1_hint: "엔드포인트가 도달 가능하고 도구를 나열하는지 확인하세요.",
  gen_step2_title: "MCP SDK 사용",
  gen_step2_hint: "Python, TypeScript, Rust SDK 모두 작동합니다. 클라이언트의 StreamableHTTPServerTransport를 엔드포인트 URL로 지정하세요.",
  error_clipboard: "클립보드 복사에 실패했습니다. 수동으로 복사하세요.",
};

export const i18n = { en, ko };

export interface MyAiI18n {
  pageTitle: string;
  back: string;
  statusOnline: string;
  statusOffline: string;
  mcpDocs: string;
  heroEyebrowLabel: string;
  heroEyebrowTransport: string;
  heroTitle: string;
  heroSub: string;
  endpointLabel: string;
  placeholderExisting: string;
  placeholderNone: string;
  noteHeadsUp: string;
  noteBody: string;
  btnCopy: string;
  btnCopied: string;
  btnGenerate: string;
  btnRegenerate: string;
  btnGenerating: string;
  btnCopyUrl: string;
  actionsHint: string;
  capsSectionTitle: string;
  capsSectionSub: string;
  capPostsLabel: string;
  capPostsValue: string;
  capPollsLabel: string;
  capPollsValue: string;
  capSpacesLabel: string;
  capSpacesValue: string;
  capDiscussionsLabel: string;
  capDiscussionsValue: string;
  capInboxLabel: string;
  capInboxValue: string;
  guideSectionTitle: string;
  guideSectionSub: string;
  tabClaudeCode: string;
  tabClaudeDesktop: string;
  tabCursor: string;
  tabGeneric: string;
  ccLedePrefix: string;
  ccLedeBody: string;
  ccStep1Title: string;
  ccStep1Hint: string;
  ccStep2Title: string;
  ccStep2Hint: string;
  ccStep3Title: string;
  ccStep3Hint: string;
  ccVerifyTitle: string;
  ccVerifyHint: string;
  cdLede: string;
  cdStep1Title: string;
  cdStep1Macos: string;
  cdStep1Windows: string;
  cdStep2Title: string;
  cdStep2Hint: string;
  cdStep3Title: string;
  cdStep3Hint: string;
  curLede: string;
  curStep1Title: string;
  curStep1Hint: string;
  curStep2Title: string;
  curStep2Hint: string;
  curStep3Title: string;
  curStep3Hint: string;
  genLede: string;
  genStep1Title: string;
  genStep1Hint: string;
  genStep2Title: string;
  genStep2Hint: string;
  errorClipboard: string;
}

export function useMyAiI18n(): MyAiI18n {
  const { t } = useTranslation("myAi");
  return {
    pageTitle: t("page_title"),
    back: t("back"),
    statusOnline: t("status_online"),
    statusOffline: t("status_offline"),
    mcpDocs: t("mcp_docs"),
    heroEyebrowLabel: t("hero_eyebrow_label"),
    heroEyebrowTransport: t("hero_eyebrow_transport"),
    heroTitle: t("hero_title"),
    heroSub: t("hero_sub"),
    endpointLabel: t("endpoint_label"),
    placeholderExisting: t("placeholder_existing"),
    placeholderNone: t("placeholder_none"),
    noteHeadsUp: t("note_heads_up"),
    noteBody: t("note_body"),
    btnCopy: t("btn_copy"),
    btnCopied: t("btn_copied"),
    btnGenerate: t("btn_generate"),
    btnRegenerate: t("btn_regenerate"),
    btnGenerating: t("btn_generating"),
    btnCopyUrl: t("btn_copy_url"),
    actionsHint: t("actions_hint"),
    capsSectionTitle: t("caps_section_title"),
    capsSectionSub: t("caps_section_sub"),
    capPostsLabel: t("cap_posts_label"),
    capPostsValue: t("cap_posts_value"),
    capPollsLabel: t("cap_polls_label"),
    capPollsValue: t("cap_polls_value"),
    capSpacesLabel: t("cap_spaces_label"),
    capSpacesValue: t("cap_spaces_value"),
    capDiscussionsLabel: t("cap_discussions_label"),
    capDiscussionsValue: t("cap_discussions_value"),
    capInboxLabel: t("cap_inbox_label"),
    capInboxValue: t("cap_inbox_value"),
    guideSectionTitle: t("guide_section_title"),
    guideSectionSub: t("guide_section_sub"),
    tabClaudeCode: t("tab_claude_code"),
    tabClaudeDesktop: t("tab_claude_desktop"),
    tabCursor: t("tab_cursor"),
    tabGeneric: t("tab_generic"),
    ccLedePrefix: t("cc_lede_prefix"),
    ccLedeBody: t("cc_lede_body"),
    ccStep1Title: t("cc_step1_title"),
    ccStep1Hint: t("cc_step1_hint"),
    ccStep2Title: t("cc_step2_title"),
    ccStep2Hint: t("cc_step2_hint"),
    ccStep3Title: t("cc_step3_title"),
    ccStep3Hint: t("cc_step3_hint"),
    ccVerifyTitle: t("cc_verify_title"),
    ccVerifyHint: t("cc_verify_hint"),
    cdLede: t("cd_lede"),
    cdStep1Title: t("cd_step1_title"),
    cdStep1Macos: t("cd_step1_macos"),
    cdStep1Windows: t("cd_step1_windows"),
    cdStep2Title: t("cd_step2_title"),
    cdStep2Hint: t("cd_step2_hint"),
    cdStep3Title: t("cd_step3_title"),
    cdStep3Hint: t("cd_step3_hint"),
    curLede: t("cur_lede"),
    curStep1Title: t("cur_step1_title"),
    curStep1Hint: t("cur_step1_hint"),
    curStep2Title: t("cur_step2_title"),
    curStep2Hint: t("cur_step2_hint"),
    curStep3Title: t("cur_step3_title"),
    curStep3Hint: t("cur_step3_hint"),
    genLede: t("gen_lede"),
    genStep1Title: t("gen_step1_title"),
    genStep1Hint: t("gen_step1_hint"),
    genStep2Title: t("gen_step2_title"),
    genStep2Hint: t("gen_step2_hint"),
    errorClipboard: t("error_clipboard"),
  };
}
