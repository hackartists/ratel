// Ported from: app/ratel/src/features/sub_team/i18n.rs (`SubTeamTranslate`). Namespace "subTeam".
import { useTranslation } from "react-i18next";

const en = {
  tab_requirements: "Eligibility",
  tab_form: "Application Form",
  tab_documents: "Documents",
  tab_sub_teams: "Sub-teams",
  tab_queue: "Pending Applications",
  tab_broadcast: "Broadcast",
  settings_is_parent_eligible: "Accept sub-team applications",
  settings_min_members: "Minimum members",
  settings_autosaved: "Auto-saved",
  settings_save: "Save",
  activation_label_on: "Parent-eligible · ON",
  activation_label_off: "Parent-eligible · OFF",
  activation_title_on: "Accepting sub-team applications",
  activation_title_off: "Sub-team applications closed",
  activation_desc: "While ON, the “Sub-team” icon on this team's home routes visitors to the apply page. Toggling OFF stops new applications but keeps existing relationships, broadcasts, and the dashboard fully operational.",
  kpi_recognized: "Recognized sub-teams",
  kpi_pending: "Pending applications",
  kpi_last_broadcast: "Last broadcast",
  kpi_pending_review: "Needs review",
  kpi_no_broadcast: "—",
  req_card_title: "Eligibility · Team-level checks",
  req_card_meta: "Objective team metrics only",
  req_min_members_title: "Minimum members",
  req_min_members_desc: "Team must reach this headcount before submitting",
  req_min_days_title: "Minimum team age",
  req_min_days_desc: "Team must exist for at least this many days before applying",
  req_inline_note: "For per-team info, mark the field as required in the Application form. Bylaws and similar documents go in the Documents tab — set them as required reading and applicants must read & agree before submitting.",
  form_card_title: "Application form",
  form_meta_fields: "fields",
  form_meta_required: "required",
  form_notice_title: "Linked field",
  form_notice_text: "Click the 🔗 Link button next to a field to bind its default value to an attribute on the applicant team's profile.",
  form_new_field: "New field",
  form_link_none: "Link",
  form_link_team_name: "Team name",
  form_link_team_username: "Username",
  form_link_team_bio: "Bio / about",
  form_link_team_profile_url: "Profile image",
  form_options_title: "Options",
  form_options_placeholder: "Option label…",
  form_options_add: "Add option",
  add_field: "Add field",
  delete_field: "Delete field",
  reorder_field: "Reorder",
  field_label: "Label",
  field_type: "Type",
  field_required: "Required",
  field_options: "Options",
  type_short_text: "Short text",
  type_long_text: "Long text",
  type_number: "Number",
  type_date: "Date",
  type_single_select: "Single select",
  type_multi_select: "Multi select",
  type_url: "URL",
  add_document: "Add document",
  edit_document: "Edit document",
  docs_card_title: "Documents · DOCUMENTS",
  docs_banner_title: "Documents shown on apply",
  docs_banner_text: "Manage operating guides / regulations here. Docs marked as Required reading must be read & agreed to before sub-teams submit. Past agreements stay anchored to the version that was published at submit time.",
  docs_updated_suffix: "edited",
  docs_edit_btn: "Edit",
  docs_add_btn: "New document",
  required_reading: "Must read",
  document_body: "Body",
  delete_document: "Delete document",
  reorder_document: "Reorder",
  document_title: "Title",
  review_application: "Review application",
  approve: "Approve",
  reject: "Reject",
  reject_reason: "Reason",
  return: "Return for revision",
  return_comment: "Revision comment",
  broadcast_title: "Title",
  broadcast_body: "Body",
  broadcast_compose: "Write announcement",
  direct_compose: "Write to this sub-team",
  broadcast_publish: "Publish",
  sub_team_options: "Options",
  sub_team_options_drawer_title: "Document options",
  sub_team_options_close: "Close options",
  broadcast_draft: "Draft",
  broadcast_delete: "Delete",
  broadcast_published: "Published",
  broadcast_title_placeholder: "Enter a title…",
  broadcast_body_placeholder: "Tell your story… use the toolbar to add formatting, links and images.",
  broadcast_posting_as: "Posting as",
  broadcast_section_tags: "Tags",
  broadcast_section_attachments: "Attachments",
  broadcast_attachments_none: "No attachments",
  broadcast_attachments_upload_title: "Upload file",
  broadcast_attachments_upload_hint: "PDF · DOCX · PPTX · XLSX · PNG · JPG",
  broadcast_discard_draft: "Discard draft",
  broadcast_status_idle: "Auto-save enabled",
  broadcast_status_dirty: "Unsaved changes",
  broadcast_status_saving: "Saving…",
  broadcast_status_saved: "Auto-saved just now",
  broadcast_status_error: "Save failed",
  broadcast_save_draft_manual: "Save draft",
  broadcast_compose_sub: "Publish to every recognized sub-team — in-app notifications.",
  broadcast_draft_chars: "{{n}} chars",
  broadcast_draft_posting_as: "Posting as",
  broadcast_draft_target: "Broadcast",
  broadcast_drafts_card_title: "Drafts",
  broadcast_untitled: "(Untitled draft)",
  broadcast_published_card_title: "Published",
  broadcast_published_count: "{{n}} published",
  broadcast_drafts_count: "{{n}} drafts",
  broadcast_pinned: "Pinned",
  broadcast_unpinned: "Unpinned",
  broadcast_fanout_meta: "{{n}} sub-teams notified",
  broadcast_comments_meta: "{{n}} comments",
  broadcast_autosaved_idle: "Saved",
  broadcast_autosaved_just_now: "Just now",
  broadcast_autosaved_minutes: "{{n}} min ago auto-saved",
  broadcast_autosaved_hours: "{{n}} hours ago auto-saved",
  broadcast_autosaved_yesterday: "Yesterday auto-saved",
  broadcast_autosaved_days: "{{n}} days ago auto-saved",
  broadcast_time_today: "Today",
  broadcast_time_yesterday: "Yesterday",
  broadcast_time_days_ago: "{{n}} days ago",
  broadcast_enable_space: "Enable Space",
  broadcast_space_hint: "Turn this announcement into a Space — every recognized sub-team's members can vote, discuss, and earn rewards together.",
  broadcast_space_active_hint: "Publish will take you to the Space designer to configure quests, rewards, and members.",
  broadcast_tag_placeholder: "Add a tag…",
  broadcast_remove_tag: "Remove tag",
  select_parent_team: "Select a parent team",
  submit_requirement_unmet: "Submission requirements not met",
  missing_required_field: "A required field is missing",
  agree_required_docs: "Agree to the must-read documents",
  agreement_required: "Agreement required",
  submit: "Submit",
  cancel: "Cancel",
  parent_icon: "Parent team",
  parent_panel_title: "Parent · PARENT",
  application_status: "Application status",
  leave_parent: "Leave",
  parent_card_status_active: "Active",
  parent_card_status_pending: "Pending",
  parent_card_meta_recognized_since: "Recognized since",
  parent_card_meta_pending: "Submitted",
  parent_recognized_info_prefix: "This team is a recognized sub-team of ",
  parent_recognized_info_suffix: ". You'll receive parent broadcasts and your activity will show on the parent dashboard.",
  parent_pending_info: "The parent admin is reviewing your application. It usually takes 3–5 business days.",
  parent_action_open_home_title: "Open parent team home",
  parent_action_open_home_sub: "View parent team's feed",
  parent_action_view_bylaws_title: "View parent bylaws",
  parent_action_view_bylaws_sub: "Read the regulations and documents",
  parent_action_leave_title: "Leave parent team",
  parent_action_leave_sub: "Become a standalone team — your content is kept",
  parent_action_view_application_title: "Check application status",
  parent_action_view_application_sub: "Open timeline · feedback from the parent",
  parent_action_edit_application_title: "Edit application",
  parent_action_edit_application_sub: "Still under review · update the content",
  parent_action_cancel_application_title: "Cancel application",
  parent_action_cancel_application_sub: "Withdraw the application currently under review",
  parent_standalone_title: "Standalone team",
  parent_standalone_desc: "This team isn't part of any parent team yet.",
  bylaws_title: "Bylaws",
  bylaws_regulations: "Regulations",
  window_weekly: "Weekly",
  window_monthly: "Monthly",
  post_count: "Posts",
  space_count: "Spaces",
  active_member_count: "Active members",
  privacy_notice_short: "Private posts not included",
  growth_score: "Growth score",
  growth_score_placeholder: "—",
  growth_score_meta: "Not available yet",
  trend_title_weekly: "Activity trend · Weekly",
  trend_title_monthly: "Activity trend · Monthly",
  trend_legend_posts: "Posts",
  trend_legend_members: "Active members",
  member_search_placeholder: "Search by handle…",
  member_sort_active: "Sort: most active",
  per_member_activity: "Per-member activity",
  direct_announce_title: "Direct announcement",
  direct_announce_note: "Pinned to this sub-team's feed only · not counted as a broadcast",
  direct_announce_history_title: "Past direct announcements",
  direct_announce_history_empty: "No direct announcements sent yet.",
  danger_zone: "Danger zone",
  member_handle_header: "Handle",
  member_posts_header: "Posts",
  member_spaces_header: "Spaces",
  member_last_active_header: "Last active",
  save: "Save",
  edit: "Edit",
  delete: "Delete",
  loading: "Loading...",
  empty_list: "Nothing here yet",
  deregister_title: "Deregister sub-team",
  deregister_reason: "Reason",
  deregister_confirm: "Deregister",
  deregister_status_chip: "Danger action",
  deregister_eyebrow: "Deregister sub-team",
  deregister_header_title_prefix: "Deregister ",
  deregister_header_title_suffix: " from this parent team",
  deregister_header_sub: "This only removes the parent-child link. The team keeps running standalone — the parent cannot edit or delete its content.",
  deregister_consequences_title: "What happens after deregister?",
  deregister_consequence_unlink: "The sub-team's parent_team_id is cleared and it becomes a standalone team.",
  deregister_consequence_notify: "Sub-team admins receive a deregister notification with the reason you write below.",
  deregister_consequence_demote: "Past announcements you sent become normal posts and stay in the team's space.",
  deregister_consequence_content: "The team's members, posts, and spaces are NOT affected.",
  deregister_consequence_reapply: "Re-recognition requires a brand-new application.",
  deregister_reason_placeholder: "Explain why you're deregistering — this is delivered verbatim to the sub-team admin.",
  deregister_reason_hint: "Sent verbatim to the sub-team admins and permanently logged with the deregister record.",
  deregister_notif_preview_label: "Notification preview · what the sub-team admin will receive",
  deregister_notif_preview_title_prefix: "",
  deregister_notif_preview_title_suffix: " has deregistered your team",
  deregister_notif_preview_empty: "Your reason will appear here as you type.",
  deregister_confirm_check: "I understand the above and confirm deregistering this sub-team.",
  deregister_confirm_check_hint: "Check this box to enable the \"Deregister\" button.",
  leave_parent_title: "Leave parent team",
  leave_parent_reason: "Reason (optional)",
  leave_parent_confirm: "Leave",
  page_under_construction: "Page under construction",
  apply_page_title: "Apply as Sub-team",
  apply_page_eyebrow: "Apply as Sub-team",
  apply_target_label: "Target parent team",
  apply_select_parent: "Select a parent team",
  apply_required_docs: "Required reading",
  apply_docs_open_review: "Open to review",
  apply_docs_agreed: "Agreed",
  apply_form_fields: "Application form",
  apply_eligibility_title: "Eligibility check",
  apply_elig_min_members: "Minimum members met",
  apply_elig_form_filled: "Required fields filled",
  apply_elig_docs_agreed: "Required docs agreed",
  apply_submit: "Submit application",
  apply_submit_sub: "All requirements must be met before submitting",
  apply_parent_eligible_off: "This team is not accepting sub-team applications",
  apply_page_header_sub: "Pick the team you admin and its profile (name / bio / lead) auto-fills the form. You can edit any field inline.",
  apply_status_drafting: "Drafting",
  apply_save_draft: "Save draft",
  apply_progress_label: "Requirements met",
  apply_elig_admin_title: "Team admin permission",
  apply_elig_admin_desc: "Must be an admin of the selected team",
  apply_elig_min_members_desc: "Team must reach this headcount before submitting",
  apply_elig_min_days_title: "Team age requirement",
  apply_elig_min_days_desc: "Recently-created teams can't apply yet",
  apply_elig_docs_desc: "Read & agree to every required doc",
  apply_elig_form_desc: "Fill every required field",
  apply_pick_your_team: "Pick your team",
  apply_picker_placeholder: "Select a team",
  apply_picker_empty: "You're not an admin of any team yet",
  apply_doc_view_open: "Open to read",
  apply_doc_reference_badge: "Reference",
  apply_close: "Close",
  apply_submit_progress_prefix: "Requirements",
  apply_submit_progress_suffix: "met",
  doc_modal_eyebrow: "Required reading",
  doc_modal_agree: "Agree",
  doc_modal_agreed: "Agreed",
  doc_modal_cancel: "Cancel",
  doc_modal_notice: "Clicking Agree records this document version and your consent timestamp permanently. Cancelling does not save your agreement.",
  status_page_title: "Application Status",
  status_page_eyebrow: "Application Tracker",
  status_relationship_standalone: "Standalone team",
  status_relationship_pending: "Application pending",
  status_relationship_recognized: "Recognized sub-team",
  status_edit_and_resubmit: "Edit and resubmit",
  status_cancel_application: "Cancel application",
  status_history: "Application history",
  status_no_applications: "No applications yet",
  status_decision_reason: "Decision reason",
  status_latest_application: "Latest application",
  queue_row_members_suffix: "members",
  queue_row_form_snapshot: "Form snapshot",
  queue_row_review_btn: "Review application",
  queue_row_confirm: "Confirm",
  queue_row_approve_placeholder: "Optional note for the applicant (e.g. welcome message)",
  queue_row_return_placeholder: "Please describe what needs to be revised before resubmission",
  queue_row_reject_placeholder: "Please explain why the application was rejected",
  review_modal_eyebrow: "Application review",
  review_modal_submitted_at: "Submitted",
  review_modal_submitter: "Submitter",
  review_modal_form_section: "Submitted answers",
  review_modal_fields_suffix: "fields",
  review_modal_close: "Close",
  status_hero_pending_eyebrow: "Submitted",
  status_hero_pending_title: "Under review",
  status_hero_pending_sub: "The parent team is reviewing your application. It usually takes 3–5 business days. You'll be notified by Ratel + email.",
  status_hero_returned_eyebrow: "Returned",
  status_hero_returned_title: "Revision requested",
  status_hero_returned_sub: "The parent team requested edits. Review the comment below, then edit and resubmit. There is no cooldown.",
  status_hero_approved_eyebrow: "Approved",
  status_hero_approved_title: "🎉 Recognized as an official sub-team",
  status_hero_approved_sub: "Your team is now a recognized sub-team. You'll receive parent-team announcements and your activity will roll up to the parent dashboard.",
  status_hero_rejected_eyebrow: "Rejected",
  status_hero_rejected_title: "Your application was not approved",
  status_hero_rejected_sub: "Please review the reason below. You can keep operating as a standalone team and reapply to the same or a different parent team without a cooldown.",
  status_feedback_returned_heading: "Revision comment",
  status_feedback_approved_heading: "Welcome message",
  status_feedback_rejected_heading: "Rejection reason",
  status_feedback_author_suffix: "Parent team",
  status_snapshot_heading: "Submitted answers",
  status_form_version_meta: "Form snapshot",
  status_fields_count_suffix: "fields",
  status_form_pin_title: "Form version pinned",
  status_form_pin_text: "This application is pinned to the form version at submission time. Future updates to the form do not retroactively apply.",
  doc_compose_title_new: "New document",
  doc_compose_title_edit: "Edit document",
  doc_compose_eyebrow: "Sub-team · Document",
  doc_compose_title_placeholder: "Document title",
  doc_compose_body_placeholder: "Write document content…",
  doc_compose_required_on: "Marked as required",
  doc_compose_required_off: "Not required",
  doc_compose_required_desc_short: "Must agree on apply",
  doc_compose_reference_only: "Reference only",
  doc_compose_required_desc: "Sub-teams must read and agree to this document before submitting.",
  doc_compose_word_count: "characters",
  doc_compose_autosaved: "Auto-saved",
  doc_compose_draft_unsaved: "Draft",
  doc_compose_preview: "Preview",
  doc_compose_banner_label: "Document editor · Rich text + attachments",
  doc_compose_banner_text: "regulations / operating guides — composed with the Ratel rich editor. Mark a document as Required and sub-teams must read & agree before submitting their application.",
  doc_compose_attachments_title: "Attachments",
  doc_compose_upload_title: "Add file · Upload",
  doc_compose_upload_hint: "PDF · DOCX · Image (max 25 MB per file)",
  doc_compose_required_card_title: "Required reading",
  doc_compose_info_title: "Document info",
  doc_compose_info_version: "Version",
  doc_compose_info_updated: "Last updated",
  doc_compose_info_editor: "Editor",
  doc_compose_info_attachments: "Attachments",
  doc_compose_info_required: "Required",
  doc_compose_attach_none: "No attachments",
  doc_compose_attach_files_unit: "files",
  doc_compose_discard: "Discard changes",
  doc_compose_stats_words: "words",
  doc_compose_stats_read: "read",
  doc_compose_stats_chars: "chars",
  yes: "Yes",
  no: "No",
  leave_parent_page_eyebrow: "Leave Parent Team",
  leave_parent_current_tie: "Current relationship",
  leave_parent_keep_title: "What stays",
  leave_parent_keep_team: "Your team (members, posts, spaces) — continues as a standalone team.",
  leave_parent_keep_announcements: "Past announcements from the parent remain as normal posts (unpinned).",
  leave_parent_keep_admins: "Team admins and member composition.",
  leave_parent_lose_title: "What you lose",
  leave_parent_lose_broadcasts: "No more broadcasts from the parent team.",
  leave_parent_lose_dashboard: "Your activity will no longer count in the parent's dashboard.",
  leave_parent_lose_badge: "The parent affiliation badge is removed from your team profile.",
  leave_parent_lose_reapply: "Rejoining requires a brand-new application.",
  leave_parent_reason_placeholder: "Optional message to parent team admins.",
  leave_parent_reason_hint: "This message is included in the parent team's leave notification. Leaving still works if you skip it.",
  leave_parent_confirm_checkbox: "I confirm leaving the parent team and becoming a standalone team.",
  leave_parent_not_recognized: "This team is not currently a recognized sub-team.",
  leave_parent_status_chip: "Action · Caution",
  leave_parent_eyebrow_code: "Leave Parent Team",
  leave_parent_header_title_prefix: "Leave ",
  leave_parent_header_title_suffix: " and continue standalone",
  leave_parent_header_emphasis: "Leave",
  leave_parent_header_sub: "Drop the sub-team link without the parent's approval. You'll stop receiving parent broadcasts, your activity won't show on the parent dashboard, and the parent is notified.",
  leave_parent_tie_child_of: "Child of",
  leave_parent_tie_recognized_since: "Recognized since",
  leave_parent_panel_sub: "Only this team can run this action (team admin role required). The parent's approval isn't needed.",
  bylaws_page_eyebrow: "Bylaws",
  bylaws_team_regulations: "Team regulations",
  bylaws_parent_regulations: "Parent team regulations",
  bylaws_empty: "No bylaws published yet",
  bylaws_required_badge: "Required",
  bylaws_status_chip: "Public",
  bylaws_add_team: "Add bylaw",
  bylaws_add_club: "Add club rule",
  bylaws_page_title: "Bylaws — publish your rules so every member follows the same playbook.",
  bylaws_page_sub: "Bylaws behave like regular posts but are grouped in a dedicated section on the team page. Sub-teams can review the parent's bylaws side-by-side.",
  bylaws_parent_link_eyebrow: "Parent team bylaws",
  bylaws_parent_link_meta: "View the parent team's bylaws",
  bylaws_view_parent: "Parent view",
  bylaws_view_sub: "Sub-team view",
  bylaws_page_eyebrow_fr: "FR-2 · Bylaws",
  bylaws_page_title_strong: "Bylaws",
  bylaws_page_title_rest: " — publish your rules so every member follows the same playbook.",
  bylaws_section_team_regulations: "Team regulations · BYLAWS",
  bylaws_section_club_rules: "Club rules · CLUB BYLAWS",
  bylaws_section_count_items: "{{n}} items",
  bylaws_card_bylaw_num: "BYLAW {{n}}",
  bylaws_card_rule_num: "RULE {{n}}",
  bylaws_required_meta: "Required",
  docs_view_bylaws: "View bylaws",
};

const ko: Record<keyof typeof en, string> = {
  tab_requirements: "가입 요건",
  tab_form: "신청폼",
  tab_documents: "문서",
  tab_sub_teams: "하위팀 목록",
  tab_queue: "신청 대기",
  tab_broadcast: "전체 공지 관리",
  settings_is_parent_eligible: "하위팀 신청 받기",
  settings_min_members: "최소 인원 수",
  settings_autosaved: "자동 저장됨",
  settings_save: "저장",
  activation_label_on: "하위팀 신청 받기 · ON",
  activation_label_off: "하위팀 신청 받기 · OFF",
  activation_title_on: "하위팀 가입 신청을 받고 있습니다",
  activation_title_off: "하위팀 가입 신청을 받지 않습니다",
  activation_desc: "ON 상태일 때, 이 팀 홈의 \"하위팀\" 아이콘이 방문자를 가입 신청 페이지로 보냅니다. OFF 로 바꿔도 기존 하위팀 관계, 공지, 대시보드는 정상 작동합니다.",
  kpi_recognized: "인증 하위팀",
  kpi_pending: "심사 대기",
  kpi_last_broadcast: "마지막 공지",
  kpi_pending_review: "검토 필요",
  kpi_no_broadcast: "—",
  req_card_title: "가입 요건 · TEAM-LEVEL CHECKS",
  req_card_meta: "객관적 팀 지표만",
  req_min_members_title: "최소 멤버 수",
  req_min_members_desc: "팀이 이 인원을 달성해야 제출 가능",
  req_min_days_title: "팀 생성 최소 기간",
  req_min_days_desc: "팀이 만들어진 후 최소 일수 후에 신청 가능",
  req_inline_note: "팀별 정보는 신청폼에서 \"필수\" 체크로 받으세요. 규정 같은 문서는 문서 탭에서 만들고 \"필독\"으로 지정하면 가입 신청 때 반드시 읽고 동의해야 제출됩니다.",
  form_card_title: "신청폼 · APPLICATION FORM",
  form_meta_fields: "필드",
  form_meta_required: "필수",
  form_notice_title: "LINKED FIELD",
  form_notice_text: "각 필드 옆의 🔗 Link 버튼을 클릭하면 신청자 팀 프로필의 어떤 속성에서 자동으로 값을 가져올지 지정할 수 있습니다.",
  form_new_field: "새 필드",
  form_link_none: "Link",
  form_link_team_name: "팀 이름",
  form_link_team_username: "Username",
  form_link_team_bio: "팀 소개 / BIO",
  form_link_team_profile_url: "프로필 이미지",
  form_options_title: "선택지",
  form_options_placeholder: "선택지 라벨…",
  form_options_add: "선택지 추가",
  add_field: "필드 추가",
  delete_field: "필드 삭제",
  reorder_field: "순서 변경",
  field_label: "라벨",
  field_type: "타입",
  field_required: "필수",
  field_options: "선택지",
  type_short_text: "짧은 텍스트",
  type_long_text: "긴 텍스트",
  type_number: "숫자",
  type_date: "날짜",
  type_single_select: "단일 선택",
  type_multi_select: "다중 선택",
  type_url: "URL",
  add_document: "문서 추가",
  edit_document: "문서 수정",
  docs_card_title: "문서 · DOCUMENTS",
  docs_banner_title: "가입 신청에서 보이는 문서",
  docs_banner_text: "운영 가이드·기타 규정을 여기서 관리하세요. 가입 신청 필독으로 지정한 문서는 하위팀이 신청할 때 반드시 읽고 동의해야 제출됩니다. 문서 내용을 나중에 수정해도 기존 신청의 동의 기록은 당시 문구로 고정됩니다.",
  docs_updated_suffix: "수정",
  docs_edit_btn: "편집",
  docs_add_btn: "새 문서 작성",
  required_reading: "필독",
  document_body: "본문",
  delete_document: "문서 삭제",
  reorder_document: "순서 변경",
  document_title: "제목",
  review_application: "신청 심사",
  approve: "승인",
  reject: "반려",
  reject_reason: "사유",
  return: "반송",
  return_comment: "수정 요청 코멘트",
  broadcast_title: "제목",
  broadcast_body: "본문",
  broadcast_compose: "공지 작성",
  direct_compose: "이 하위팀에만 공지",
  broadcast_publish: "발행",
  sub_team_options: "옵션",
  sub_team_options_drawer_title: "문서 옵션",
  sub_team_options_close: "옵션 닫기",
  broadcast_draft: "드래프트",
  broadcast_delete: "삭제",
  broadcast_published: "발행됨",
  broadcast_title_placeholder: "제목을 입력하세요…",
  broadcast_body_placeholder: "이야기를 들려주세요… 도구 모음을 사용해 서식, 링크, 이미지를 추가할 수 있어요.",
  broadcast_posting_as: "게시자",
  broadcast_section_tags: "태그",
  broadcast_section_attachments: "첨부 파일",
  broadcast_attachments_none: "첨부 없음",
  broadcast_attachments_upload_title: "파일 업로드",
  broadcast_attachments_upload_hint: "PDF · DOCX · PPTX · XLSX · PNG · JPG",
  broadcast_discard_draft: "초안 버리기",
  broadcast_status_idle: "자동 저장 활성화",
  broadcast_status_dirty: "저장되지 않은 변경",
  broadcast_status_saving: "저장 중…",
  broadcast_status_saved: "자동 저장됨 방금",
  broadcast_status_error: "저장 실패",
  broadcast_save_draft_manual: "초안 저장",
  broadcast_compose_sub: "인식된 모든 하위팀에 발행 · 인앱 알림.",
  broadcast_draft_chars: "{{n}}자",
  broadcast_draft_posting_as: "게시자",
  broadcast_draft_target: "Broadcast",
  broadcast_drafts_card_title: "작성 중 · Drafts",
  broadcast_untitled: "(제목 없음)",
  broadcast_published_card_title: "발행된 공지 · Published",
  broadcast_published_count: "{{n}}건",
  broadcast_drafts_count: "{{n}}건",
  broadcast_pinned: "Pinned",
  broadcast_unpinned: "Unpinned",
  broadcast_fanout_meta: "{{n}} 하위팀 알림",
  broadcast_comments_meta: "{{n}} 댓글",
  broadcast_autosaved_idle: "저장됨",
  broadcast_autosaved_just_now: "방금 자동 저장",
  broadcast_autosaved_minutes: "{{n}}분 전 자동 저장",
  broadcast_autosaved_hours: "{{n}}시간 전 자동 저장",
  broadcast_autosaved_yesterday: "어제 자동 저장",
  broadcast_autosaved_days: "{{n}}일 전 자동 저장",
  broadcast_time_today: "오늘",
  broadcast_time_yesterday: "어제",
  broadcast_time_days_ago: "{{n}}일 전",
  broadcast_enable_space: "스페이스 활성화",
  broadcast_space_hint: "이 게시물을 스페이스로 전환하세요. 투표하고, 토론하고, 보상을 함께 받을 수 있는 전용 공간을 제공합니다.",
  broadcast_space_active_hint: "게시하면 퀘스트, 보상, 멤버를 설정하는 스페이스 디자이너로 이동합니다.",
  broadcast_tag_placeholder: "태그 추가…",
  broadcast_remove_tag: "태그 제거",
  select_parent_team: "팀 선택",
  submit_requirement_unmet: "제출 조건 미충족",
  missing_required_field: "필수 필드 누락",
  agree_required_docs: "필독 문서 동의하기",
  agreement_required: "동의 필요",
  submit: "제출하기",
  cancel: "취소",
  parent_icon: "상위팀 아이콘",
  parent_panel_title: "상위팀 · PARENT",
  application_status: "신청 상태",
  leave_parent: "이탈",
  parent_card_status_active: "Active",
  parent_card_status_pending: "Pending",
  parent_card_meta_recognized_since: "인증",
  parent_card_meta_pending: "제출",
  parent_recognized_info_prefix: "이 팀은 ",
  parent_recognized_info_suffix: "의 인증 하위팀입니다. 상위팀의 공지를 받고, 상위팀 활동 대시보드에 공개 활동이 집계됩니다.",
  parent_pending_info: "상위팀 담당자가 신청서를 검토 중입니다. 보통 영업일 3–5일 소요됩니다.",
  parent_action_open_home_title: "상위팀 홈으로 이동",
  parent_action_open_home_sub: "상위팀 팀 피드 열기",
  parent_action_view_bylaws_title: "상위팀 운영 수칙 보기",
  parent_action_view_bylaws_sub: "규정 및 문서 확인",
  parent_action_leave_title: "상위팀에서 이탈",
  parent_action_leave_sub: "독립 팀으로 전환 · 콘텐츠는 유지",
  parent_action_view_application_title: "신청 상태 확인",
  parent_action_view_application_sub: "타임라인 · 상위팀 피드백 열기",
  parent_action_edit_application_title: "신청서 수정",
  parent_action_edit_application_sub: "아직 심사 대기 중 · 내용 업데이트",
  parent_action_cancel_application_title: "신청 취소",
  parent_action_cancel_application_sub: "현재 심사 중인 신청을 철회",
  parent_standalone_title: "독립 팀입니다",
  parent_standalone_desc: "아직 어떤 상위팀에도 속해있지 않습니다.",
  bylaws_title: "운영 수칙",
  bylaws_regulations: "규정",
  window_weekly: "주간",
  window_monthly: "월간",
  post_count: "포스트 수",
  space_count: "스페이스 수",
  active_member_count: "활성 멤버 수",
  privacy_notice_short: "Private 미포함 공지",
  growth_score: "성장 점수",
  growth_score_placeholder: "—",
  growth_score_meta: "아직 집계 전",
  trend_title_weekly: "활동 추이 · 주간",
  trend_title_monthly: "활동 추이 · 월간",
  trend_legend_posts: "포스트",
  trend_legend_members: "활성 멤버",
  member_search_placeholder: "핸들 검색…",
  member_sort_active: "정렬: 활동 많은 순",
  per_member_activity: "멤버별 활동",
  direct_announce_title: "이 하위팀에만 공지",
  direct_announce_note: "이 하위팀에만 핀 고정됩니다 · 전체 공지와 별개로 집계",
  direct_announce_history_title: "이전 공지 이력",
  direct_announce_history_empty: "아직 보낸 공지가 없습니다.",
  danger_zone: "위험 영역",
  member_handle_header: "멤버",
  member_posts_header: "포스트",
  member_spaces_header: "스페이스",
  member_last_active_header: "최근 활동",
  save: "저장",
  edit: "수정",
  delete: "삭제",
  loading: "불러오는 중...",
  empty_list: "아직 없습니다",
  deregister_title: "하위팀 등록 해제",
  deregister_reason: "사유",
  deregister_confirm: "해제 확정",
  deregister_status_chip: "위험한 조작",
  deregister_eyebrow: "하위팀 등록 해제",
  deregister_header_title_prefix: "",
  deregister_header_title_suffix: "의 등록을 해제합니다",
  deregister_header_sub: "이 동작은 부모-자식 관계만 해제합니다. 동아리 자체는 독립 팀으로 계속 운영됩니다. 상위 팀은 이 동아리의 콘텐츠를 수정하거나 삭제할 수 없습니다.",
  deregister_consequences_title: "해제 후 어떻게 됩니까?",
  deregister_consequence_unlink: "하위팀의 parent_team_id가 제거되어 독립 팀으로 전환됩니다.",
  deregister_consequence_notify: "하위팀 admin은 해제 알림과 사유를 전달받습니다.",
  deregister_consequence_demote: "이전에 발송한 공지들은 일반 게시물로 강등되어 팀 스페이스에 남아 있습니다.",
  deregister_consequence_content: "동아리의 멤버, 게시물, 스페이스는 전혀 영향을 받지 않습니다.",
  deregister_consequence_reapply: "향후 이 동아리가 다시 인증을 받으려면 정식 신청 절차를 거쳐야 합니다.",
  deregister_reason_placeholder: "예: 최근 3개월 간 정기 활동이 확인되지 않았고, 지도교수 변경 사항 공지도 누락되었습니다. 동아리 활성화 후 재신청해주시면 환영합니다.",
  deregister_reason_hint: "이 메시지는 동아리 admin에게 그대로 전달되며, 해제 기록에 영구 보관됩니다.",
  deregister_notif_preview_label: "알림 미리보기 · 하위팀 admin이 받을 알림",
  deregister_notif_preview_title_prefix: "",
  deregister_notif_preview_title_suffix: "에서 팀 등록을 해제했습니다",
  deregister_notif_preview_empty: "해제 사유가 여기에 표시됩니다 — 왼쪽 텍스트 영역에 입력한 내용이 실시간으로 반영됩니다.",
  deregister_confirm_check: "위 내용을 이해했고 등록 해제를 확인합니다.",
  deregister_confirm_check_hint: "체크해야 \"해제 확정\" 버튼이 활성화됩니다.",
  leave_parent_title: "상위팀 이탈",
  leave_parent_reason: "사유 (선택)",
  leave_parent_confirm: "이탈",
  page_under_construction: "페이지 준비중",
  apply_page_title: "하위팀 가입 신청",
  apply_page_eyebrow: "하위팀 가입 신청",
  apply_target_label: "신청 대상",
  apply_select_parent: "상위팀 선택",
  apply_required_docs: "필독 문서",
  apply_docs_open_review: "열어서 검토",
  apply_docs_agreed: "동의 완료",
  apply_form_fields: "신청폼",
  apply_eligibility_title: "가입 요건",
  apply_elig_min_members: "최소 멤버 수 충족",
  apply_elig_form_filled: "필수 필드 작성 완료",
  apply_elig_docs_agreed: "필독 문서 동의 완료",
  apply_submit: "신청 제출",
  apply_submit_sub: "모든 요건이 충족되면 제출할 수 있습니다",
  apply_parent_eligible_off: "이 팀은 현재 하위팀 신청을 받지 않습니다",
  apply_page_header_sub: "내가 관리자인 팀을 선택하면 팀 프로필(이름·소개·지도자 등)이 신청폼에 자동 채워집니다. 필요하면 이 자리에서 바로 수정할 수 있어요.",
  apply_status_drafting: "초안",
  apply_save_draft: "초안 저장",
  apply_progress_label: "요건 충족도",
  apply_elig_admin_title: "팀의 관리자 권한",
  apply_elig_admin_desc: "선택한 팀의 admin이어야 신청 가능",
  apply_elig_min_members_desc: "팀이 이 인원을 달성해야 제출 가능",
  apply_elig_min_days_title: "팀 생성 최소 기간",
  apply_elig_min_days_desc: "최근 만들어진 팀은 신청 불가",
  apply_elig_docs_desc: "지정한 필독 문서를 모두 읽고 동의",
  apply_elig_form_desc: "필수 필드 모두 작성",
  apply_pick_your_team: "내가 관리자인 팀 선택",
  apply_picker_placeholder: "팀을 선택하세요",
  apply_picker_empty: "관리자 권한이 있는 팀이 없습니다",
  apply_doc_view_open: "열어 보기",
  apply_doc_reference_badge: "참고",
  apply_close: "닫기",
  apply_submit_progress_prefix: "요건",
  apply_submit_progress_suffix: "충족",
  doc_modal_eyebrow: "필독 문서",
  doc_modal_agree: "동의하기",
  doc_modal_agreed: "동의 완료",
  doc_modal_cancel: "취소",
  doc_modal_notice: "동의하기를 누르면 제출 기록에 이 문서의 현재 버전과 동의 시점이 영구 보관됩니다. 취소하면 동의 상태가 저장되지 않습니다.",
  status_page_title: "신청 상태",
  status_page_eyebrow: "신청 상태",
  status_relationship_standalone: "독립 팀",
  status_relationship_pending: "심사 대기 중",
  status_relationship_recognized: "인증된 하위팀",
  status_edit_and_resubmit: "수정 후 재제출",
  status_cancel_application: "신청 취소",
  status_history: "신청 기록",
  status_no_applications: "신청 내역이 없습니다",
  status_decision_reason: "심사 결과 사유",
  status_latest_application: "최근 신청",
  queue_row_members_suffix: "명",
  queue_row_form_snapshot: "폼 스냅샷",
  queue_row_review_btn: "신청서 확인하기",
  queue_row_confirm: "확인",
  queue_row_approve_placeholder: "신청자에게 전할 메모 (선택 사항) — 환영 메시지나 안내 사항",
  queue_row_return_placeholder: "재제출 전 수정해야 할 내용을 설명해주세요",
  queue_row_reject_placeholder: "거절 사유를 설명해주세요",
  review_modal_eyebrow: "신청서 검토",
  review_modal_submitted_at: "제출 시각",
  review_modal_submitter: "제출자",
  review_modal_form_section: "제출 내역",
  review_modal_fields_suffix: "필드",
  review_modal_close: "닫기",
  status_hero_pending_eyebrow: "제출됨",
  status_hero_pending_title: "심사 대기 중입니다",
  status_hero_pending_sub: "담당자가 신청서를 검토하고 있습니다. 보통 영업일 기준 3–5일이 소요됩니다. 결과는 Ratel 알림 + 이메일로 안내됩니다.",
  status_hero_returned_eyebrow: "수정 반송됨",
  status_hero_returned_title: "수정 요청이 도착했습니다",
  status_hero_returned_sub: "담당자가 신청서 수정을 요청했습니다. 아래 코멘트를 확인하고 수정 후 재제출해주세요. 쿨다운은 없습니다.",
  status_hero_approved_eyebrow: "승인됨",
  status_hero_approved_title: "🎉 정식 하위팀으로 등록되었습니다",
  status_hero_approved_sub: "이제 인증된 하위팀이 되었습니다. 상위팀의 공지를 받고, 활동이 상위팀 대시보드에 집계됩니다.",
  status_hero_rejected_eyebrow: "거절됨",
  status_hero_rejected_title: "안타깝게도 이번 신청은 거절되었습니다",
  status_hero_rejected_sub: "아래 사유를 확인해주세요. 독립 팀으로 계속 운영할 수 있고, 쿨다운 없이 같은 또는 다른 상위팀에 재신청할 수 있습니다.",
  status_feedback_returned_heading: "수정 요청 코멘트",
  status_feedback_approved_heading: "환영 메시지",
  status_feedback_rejected_heading: "거절 사유",
  status_feedback_author_suffix: "상위팀 담당자",
  status_snapshot_heading: "제출 내역",
  status_form_version_meta: "폼 스냅샷",
  status_fields_count_suffix: "필드",
  status_form_pin_title: "폼 버전 고정",
  status_form_pin_text: "제출 시점의 폼 버전에 이 신청은 고정되어 있습니다. 상위팀이 폼을 업데이트하더라도 이 신청에는 적용되지 않습니다.",
  doc_compose_title_new: "새 문서",
  doc_compose_title_edit: "문서 편집",
  doc_compose_eyebrow: "하위팀 · 문서",
  doc_compose_title_placeholder: "문서 제목",
  doc_compose_body_placeholder: "문서 내용을 작성하세요…",
  doc_compose_required_on: "필독으로 지정됨",
  doc_compose_required_off: "필독 아님",
  doc_compose_required_desc_short: "신청 시 동의 필수",
  doc_compose_reference_only: "참고 자료로만 노출",
  doc_compose_required_desc: "하위팀이 가입 신청할 때 이 문서를 읽고 동의해야 합니다.",
  doc_compose_word_count: "글자",
  doc_compose_autosaved: "자동 저장됨",
  doc_compose_draft_unsaved: "초안",
  doc_compose_preview: "미리보기",
  doc_compose_banner_label: "DOCUMENT EDITOR · RICH TEXT + 첨부",
  doc_compose_banner_text: "규정·운영 가이드를 Ratel rich editor 로 작성합니다. 필독으로 지정하면 하위팀이 가입 신청 때 반드시 읽고 동의해야 제출됩니다.",
  doc_compose_attachments_title: "첨부 파일 · ATTACHMENTS",
  doc_compose_upload_title: "파일 추가 · UPLOAD",
  doc_compose_upload_hint: "PDF · DOCX · 이미지 (최대 25 MB/파일)",
  doc_compose_required_card_title: "가입 신청 필독",
  doc_compose_info_title: "문서 정보",
  doc_compose_info_version: "VERSION",
  doc_compose_info_updated: "LAST UPDATED",
  doc_compose_info_editor: "EDITOR",
  doc_compose_info_attachments: "ATTACHMENTS",
  doc_compose_info_required: "REQUIRED",
  doc_compose_attach_none: "첨부 없음",
  doc_compose_attach_files_unit: "파일",
  doc_compose_discard: "변경 폐기 · DISCARD",
  doc_compose_stats_words: "단어",
  doc_compose_stats_read: "read",
  doc_compose_stats_chars: "자",
  yes: "예",
  no: "아니오",
  leave_parent_page_eyebrow: "상위팀 이탈",
  leave_parent_current_tie: "현재 소속",
  leave_parent_keep_title: "유지되는 것",
  leave_parent_keep_team: "팀 자체 (멤버, 게시물, 스페이스) — 독립 팀으로 계속 운영.",
  leave_parent_keep_announcements: "부모팀이 과거에 보낸 공지들은 일반 게시물로 남습니다 (핀 해제됨).",
  leave_parent_keep_admins: "동아리 admin 권한과 멤버 구성.",
  leave_parent_lose_title: "상실하는 것",
  leave_parent_lose_broadcasts: "앞으로 부모팀 공지를 받지 않습니다.",
  leave_parent_lose_dashboard: "부모팀 활동 대시보드에 집계되지 않습니다.",
  leave_parent_lose_badge: "팀 프로필의 소속 표시가 제거됩니다.",
  leave_parent_lose_reapply: "재가입하려면 정식 신청 절차를 다시 거쳐야 합니다.",
  leave_parent_reason_placeholder: "부모팀 admin에게 남길 메시지 (선택)",
  leave_parent_reason_hint: "이 메시지는 부모팀 admin에게 전달되는 이탈 알림에 포함됩니다. 생략해도 이탈은 실행됩니다.",
  leave_parent_confirm_checkbox: "상위팀과의 sub-team 관계를 해제하고 독립 팀이 되는 것에 동의합니다.",
  leave_parent_not_recognized: "이 팀은 현재 인증된 하위팀이 아닙니다.",
  leave_parent_status_chip: "주의 · 실행 액션",
  leave_parent_eyebrow_code: "상위팀 이탈",
  leave_parent_header_title_prefix: "",
  leave_parent_header_title_suffix: "에서 독립합니다",
  leave_parent_header_emphasis: "독립",
  leave_parent_header_sub: "부모팀의 승인 없이 sub-team 관계만 해제하고 독립 팀으로 전환합니다. 부모팀의 공지 방송, 활동 집계, 거버넌스에서 벗어납니다. 부모팀은 알림을 받습니다.",
  leave_parent_tie_child_of: "Child of",
  leave_parent_tie_recognized_since: "인증",
  leave_parent_panel_sub: "이 동작은 이 팀에서만 실행 가능합니다 (팀 admin 권한 필요). 부모팀의 승인은 필요하지 않습니다.",
  bylaws_page_eyebrow: "운영 수칙",
  bylaws_team_regulations: "팀 규정",
  bylaws_parent_regulations: "상위팀 규정",
  bylaws_empty: "공개된 운영 수칙이 없습니다",
  bylaws_required_badge: "필독",
  bylaws_status_chip: "공개",
  bylaws_add_team: "운영 수칙 항목 추가",
  bylaws_add_club: "회칙 항목 추가",
  bylaws_page_title: "운영 수칙을 공개 게시하여 모두가 같은 규칙을 따르게 합니다.",
  bylaws_page_sub: "Bylaws는 일반 게시물과 동일하게 동작하지만, 팀 페이지에서 전용 섹션으로 묶여 보입니다. 자식 팀은 부모 팀의 Bylaws를 바로 확인할 수 있습니다.",
  bylaws_parent_link_eyebrow: "상위팀 운영 수칙",
  bylaws_parent_link_meta: "상위팀이 관리하는 운영 수칙 보기",
  bylaws_view_parent: "PARENT VIEW",
  bylaws_view_sub: "SUB-TEAM VIEW",
  bylaws_page_eyebrow_fr: "FR-2 · BYLAWS",
  bylaws_page_title_strong: "운영 수칙",
  bylaws_page_title_rest: "을 공개 게시하여 모두가 같은 규칙을 따르게 합니다.",
  bylaws_section_team_regulations: "팀 운영 수칙 · BYLAWS",
  bylaws_section_club_rules: "동아리 회칙 · CLUB BYLAWS",
  bylaws_section_count_items: "{{n}}개 항목",
  bylaws_card_bylaw_num: "BYLAW {{n}}",
  bylaws_card_rule_num: "RULE {{n}}",
  bylaws_required_meta: "필독",
  docs_view_bylaws: "운영 수칙 자세히 보기",
};

export const i18n = { en, ko };

export interface SubTeamI18n {
  tabRequirements: string;
  tabForm: string;
  tabDocuments: string;
  tabSubTeams: string;
  tabQueue: string;
  tabBroadcast: string;
  settingsIsParentEligible: string;
  settingsMinMembers: string;
  settingsAutosaved: string;
  settingsSave: string;
  activationLabelOn: string;
  activationLabelOff: string;
  activationTitleOn: string;
  activationTitleOff: string;
  activationDesc: string;
  kpiRecognized: string;
  kpiPending: string;
  kpiLastBroadcast: string;
  kpiPendingReview: string;
  kpiNoBroadcast: string;
  reqCardTitle: string;
  reqCardMeta: string;
  reqMinMembersTitle: string;
  reqMinMembersDesc: string;
  reqMinDaysTitle: string;
  reqMinDaysDesc: string;
  reqInlineNote: string;
  formCardTitle: string;
  formMetaFields: string;
  formMetaRequired: string;
  formNoticeTitle: string;
  formNoticeText: string;
  formNewField: string;
  formLinkNone: string;
  formLinkTeamName: string;
  formLinkTeamUsername: string;
  formLinkTeamBio: string;
  formLinkTeamProfileUrl: string;
  formOptionsTitle: string;
  formOptionsPlaceholder: string;
  formOptionsAdd: string;
  addField: string;
  deleteField: string;
  reorderField: string;
  fieldLabel: string;
  fieldType: string;
  fieldRequired: string;
  fieldOptions: string;
  typeShortText: string;
  typeLongText: string;
  typeNumber: string;
  typeDate: string;
  typeSingleSelect: string;
  typeMultiSelect: string;
  typeUrl: string;
  addDocument: string;
  editDocument: string;
  docsCardTitle: string;
  docsBannerTitle: string;
  docsBannerText: string;
  docsUpdatedSuffix: string;
  docsEditBtn: string;
  docsAddBtn: string;
  requiredReading: string;
  documentBody: string;
  deleteDocument: string;
  reorderDocument: string;
  documentTitle: string;
  reviewApplication: string;
  approve: string;
  reject: string;
  rejectReason: string;
  return: string;
  returnComment: string;
  broadcastTitle: string;
  broadcastBody: string;
  broadcastCompose: string;
  directCompose: string;
  broadcastPublish: string;
  subTeamOptions: string;
  subTeamOptionsDrawerTitle: string;
  subTeamOptionsClose: string;
  broadcastDraft: string;
  broadcastDelete: string;
  broadcastPublished: string;
  broadcastTitlePlaceholder: string;
  broadcastBodyPlaceholder: string;
  broadcastPostingAs: string;
  broadcastSectionTags: string;
  broadcastSectionAttachments: string;
  broadcastAttachmentsNone: string;
  broadcastAttachmentsUploadTitle: string;
  broadcastAttachmentsUploadHint: string;
  broadcastDiscardDraft: string;
  broadcastStatusIdle: string;
  broadcastStatusDirty: string;
  broadcastStatusSaving: string;
  broadcastStatusSaved: string;
  broadcastStatusError: string;
  broadcastSaveDraftManual: string;
  broadcastComposeSub: string;
  broadcastDraftChars: (values: { n: string | number }) => string;
  broadcastDraftPostingAs: string;
  broadcastDraftTarget: string;
  broadcastDraftsCardTitle: string;
  broadcastUntitled: string;
  broadcastPublishedCardTitle: string;
  broadcastPublishedCount: (values: { n: string | number }) => string;
  broadcastDraftsCount: (values: { n: string | number }) => string;
  broadcastPinned: string;
  broadcastUnpinned: string;
  broadcastFanoutMeta: (values: { n: string | number }) => string;
  broadcastCommentsMeta: (values: { n: string | number }) => string;
  broadcastAutosavedIdle: string;
  broadcastAutosavedJustNow: string;
  broadcastAutosavedMinutes: (values: { n: string | number }) => string;
  broadcastAutosavedHours: (values: { n: string | number }) => string;
  broadcastAutosavedYesterday: string;
  broadcastAutosavedDays: (values: { n: string | number }) => string;
  broadcastTimeToday: string;
  broadcastTimeYesterday: string;
  broadcastTimeDaysAgo: (values: { n: string | number }) => string;
  broadcastEnableSpace: string;
  broadcastSpaceHint: string;
  broadcastSpaceActiveHint: string;
  broadcastTagPlaceholder: string;
  broadcastRemoveTag: string;
  selectParentTeam: string;
  submitRequirementUnmet: string;
  missingRequiredField: string;
  agreeRequiredDocs: string;
  agreementRequired: string;
  submit: string;
  cancel: string;
  parentIcon: string;
  parentPanelTitle: string;
  applicationStatus: string;
  leaveParent: string;
  parentCardStatusActive: string;
  parentCardStatusPending: string;
  parentCardMetaRecognizedSince: string;
  parentCardMetaPending: string;
  parentRecognizedInfoPrefix: string;
  parentRecognizedInfoSuffix: string;
  parentPendingInfo: string;
  parentActionOpenHomeTitle: string;
  parentActionOpenHomeSub: string;
  parentActionViewBylawsTitle: string;
  parentActionViewBylawsSub: string;
  parentActionLeaveTitle: string;
  parentActionLeaveSub: string;
  parentActionViewApplicationTitle: string;
  parentActionViewApplicationSub: string;
  parentActionEditApplicationTitle: string;
  parentActionEditApplicationSub: string;
  parentActionCancelApplicationTitle: string;
  parentActionCancelApplicationSub: string;
  parentStandaloneTitle: string;
  parentStandaloneDesc: string;
  bylawsTitle: string;
  bylawsRegulations: string;
  windowWeekly: string;
  windowMonthly: string;
  postCount: string;
  spaceCount: string;
  activeMemberCount: string;
  privacyNoticeShort: string;
  growthScore: string;
  growthScorePlaceholder: string;
  growthScoreMeta: string;
  trendTitleWeekly: string;
  trendTitleMonthly: string;
  trendLegendPosts: string;
  trendLegendMembers: string;
  memberSearchPlaceholder: string;
  memberSortActive: string;
  perMemberActivity: string;
  directAnnounceTitle: string;
  directAnnounceNote: string;
  directAnnounceHistoryTitle: string;
  directAnnounceHistoryEmpty: string;
  dangerZone: string;
  memberHandleHeader: string;
  memberPostsHeader: string;
  memberSpacesHeader: string;
  memberLastActiveHeader: string;
  save: string;
  edit: string;
  delete: string;
  loading: string;
  emptyList: string;
  deregisterTitle: string;
  deregisterReason: string;
  deregisterConfirm: string;
  deregisterStatusChip: string;
  deregisterEyebrow: string;
  deregisterHeaderTitlePrefix: string;
  deregisterHeaderTitleSuffix: string;
  deregisterHeaderSub: string;
  deregisterConsequencesTitle: string;
  deregisterConsequenceUnlink: string;
  deregisterConsequenceNotify: string;
  deregisterConsequenceDemote: string;
  deregisterConsequenceContent: string;
  deregisterConsequenceReapply: string;
  deregisterReasonPlaceholder: string;
  deregisterReasonHint: string;
  deregisterNotifPreviewLabel: string;
  deregisterNotifPreviewTitlePrefix: string;
  deregisterNotifPreviewTitleSuffix: string;
  deregisterNotifPreviewEmpty: string;
  deregisterConfirmCheck: string;
  deregisterConfirmCheckHint: string;
  leaveParentTitle: string;
  leaveParentReason: string;
  leaveParentConfirm: string;
  pageUnderConstruction: string;
  applyPageTitle: string;
  applyPageEyebrow: string;
  applyTargetLabel: string;
  applySelectParent: string;
  applyRequiredDocs: string;
  applyDocsOpenReview: string;
  applyDocsAgreed: string;
  applyFormFields: string;
  applyEligibilityTitle: string;
  applyEligMinMembers: string;
  applyEligFormFilled: string;
  applyEligDocsAgreed: string;
  applySubmit: string;
  applySubmitSub: string;
  applyParentEligibleOff: string;
  applyPageHeaderSub: string;
  applyStatusDrafting: string;
  applySaveDraft: string;
  applyProgressLabel: string;
  applyEligAdminTitle: string;
  applyEligAdminDesc: string;
  applyEligMinMembersDesc: string;
  applyEligMinDaysTitle: string;
  applyEligMinDaysDesc: string;
  applyEligDocsDesc: string;
  applyEligFormDesc: string;
  applyPickYourTeam: string;
  applyPickerPlaceholder: string;
  applyPickerEmpty: string;
  applyDocViewOpen: string;
  applyDocReferenceBadge: string;
  applyClose: string;
  applySubmitProgressPrefix: string;
  applySubmitProgressSuffix: string;
  docModalEyebrow: string;
  docModalAgree: string;
  docModalAgreed: string;
  docModalCancel: string;
  docModalNotice: string;
  statusPageTitle: string;
  statusPageEyebrow: string;
  statusRelationshipStandalone: string;
  statusRelationshipPending: string;
  statusRelationshipRecognized: string;
  statusEditAndResubmit: string;
  statusCancelApplication: string;
  statusHistory: string;
  statusNoApplications: string;
  statusDecisionReason: string;
  statusLatestApplication: string;
  queueRowMembersSuffix: string;
  queueRowFormSnapshot: string;
  queueRowReviewBtn: string;
  queueRowConfirm: string;
  queueRowApprovePlaceholder: string;
  queueRowReturnPlaceholder: string;
  queueRowRejectPlaceholder: string;
  reviewModalEyebrow: string;
  reviewModalSubmittedAt: string;
  reviewModalSubmitter: string;
  reviewModalFormSection: string;
  reviewModalFieldsSuffix: string;
  reviewModalClose: string;
  statusHeroPendingEyebrow: string;
  statusHeroPendingTitle: string;
  statusHeroPendingSub: string;
  statusHeroReturnedEyebrow: string;
  statusHeroReturnedTitle: string;
  statusHeroReturnedSub: string;
  statusHeroApprovedEyebrow: string;
  statusHeroApprovedTitle: string;
  statusHeroApprovedSub: string;
  statusHeroRejectedEyebrow: string;
  statusHeroRejectedTitle: string;
  statusHeroRejectedSub: string;
  statusFeedbackReturnedHeading: string;
  statusFeedbackApprovedHeading: string;
  statusFeedbackRejectedHeading: string;
  statusFeedbackAuthorSuffix: string;
  statusSnapshotHeading: string;
  statusFormVersionMeta: string;
  statusFieldsCountSuffix: string;
  statusFormPinTitle: string;
  statusFormPinText: string;
  docComposeTitleNew: string;
  docComposeTitleEdit: string;
  docComposeEyebrow: string;
  docComposeTitlePlaceholder: string;
  docComposeBodyPlaceholder: string;
  docComposeRequiredOn: string;
  docComposeRequiredOff: string;
  docComposeRequiredDescShort: string;
  docComposeReferenceOnly: string;
  docComposeRequiredDesc: string;
  docComposeWordCount: string;
  docComposeAutosaved: string;
  docComposeDraftUnsaved: string;
  docComposePreview: string;
  docComposeBannerLabel: string;
  docComposeBannerText: string;
  docComposeAttachmentsTitle: string;
  docComposeUploadTitle: string;
  docComposeUploadHint: string;
  docComposeRequiredCardTitle: string;
  docComposeInfoTitle: string;
  docComposeInfoVersion: string;
  docComposeInfoUpdated: string;
  docComposeInfoEditor: string;
  docComposeInfoAttachments: string;
  docComposeInfoRequired: string;
  docComposeAttachNone: string;
  docComposeAttachFilesUnit: string;
  docComposeDiscard: string;
  docComposeStatsWords: string;
  docComposeStatsRead: string;
  docComposeStatsChars: string;
  yes: string;
  no: string;
  leaveParentPageEyebrow: string;
  leaveParentCurrentTie: string;
  leaveParentKeepTitle: string;
  leaveParentKeepTeam: string;
  leaveParentKeepAnnouncements: string;
  leaveParentKeepAdmins: string;
  leaveParentLoseTitle: string;
  leaveParentLoseBroadcasts: string;
  leaveParentLoseDashboard: string;
  leaveParentLoseBadge: string;
  leaveParentLoseReapply: string;
  leaveParentReasonPlaceholder: string;
  leaveParentReasonHint: string;
  leaveParentConfirmCheckbox: string;
  leaveParentNotRecognized: string;
  leaveParentStatusChip: string;
  leaveParentEyebrowCode: string;
  leaveParentHeaderTitlePrefix: string;
  leaveParentHeaderTitleSuffix: string;
  leaveParentHeaderEmphasis: string;
  leaveParentHeaderSub: string;
  leaveParentTieChildOf: string;
  leaveParentTieRecognizedSince: string;
  leaveParentPanelSub: string;
  bylawsPageEyebrow: string;
  bylawsTeamRegulations: string;
  bylawsParentRegulations: string;
  bylawsEmpty: string;
  bylawsRequiredBadge: string;
  bylawsStatusChip: string;
  bylawsAddTeam: string;
  bylawsAddClub: string;
  bylawsPageTitle: string;
  bylawsPageSub: string;
  bylawsParentLinkEyebrow: string;
  bylawsParentLinkMeta: string;
  bylawsViewParent: string;
  bylawsViewSub: string;
  bylawsPageEyebrowFr: string;
  bylawsPageTitleStrong: string;
  bylawsPageTitleRest: string;
  bylawsSectionTeamRegulations: string;
  bylawsSectionClubRules: string;
  bylawsSectionCountItems: (values: { n: string | number }) => string;
  bylawsCardBylawNum: (values: { n: string | number }) => string;
  bylawsCardRuleNum: (values: { n: string | number }) => string;
  bylawsRequiredMeta: string;
  docsViewBylaws: string;
}

export function useSubTeamI18n(): SubTeamI18n {
  const { t } = useTranslation("subTeam");
  return {
    tabRequirements: t("tab_requirements"),
    tabForm: t("tab_form"),
    tabDocuments: t("tab_documents"),
    tabSubTeams: t("tab_sub_teams"),
    tabQueue: t("tab_queue"),
    tabBroadcast: t("tab_broadcast"),
    settingsIsParentEligible: t("settings_is_parent_eligible"),
    settingsMinMembers: t("settings_min_members"),
    settingsAutosaved: t("settings_autosaved"),
    settingsSave: t("settings_save"),
    activationLabelOn: t("activation_label_on"),
    activationLabelOff: t("activation_label_off"),
    activationTitleOn: t("activation_title_on"),
    activationTitleOff: t("activation_title_off"),
    activationDesc: t("activation_desc"),
    kpiRecognized: t("kpi_recognized"),
    kpiPending: t("kpi_pending"),
    kpiLastBroadcast: t("kpi_last_broadcast"),
    kpiPendingReview: t("kpi_pending_review"),
    kpiNoBroadcast: t("kpi_no_broadcast"),
    reqCardTitle: t("req_card_title"),
    reqCardMeta: t("req_card_meta"),
    reqMinMembersTitle: t("req_min_members_title"),
    reqMinMembersDesc: t("req_min_members_desc"),
    reqMinDaysTitle: t("req_min_days_title"),
    reqMinDaysDesc: t("req_min_days_desc"),
    reqInlineNote: t("req_inline_note"),
    formCardTitle: t("form_card_title"),
    formMetaFields: t("form_meta_fields"),
    formMetaRequired: t("form_meta_required"),
    formNoticeTitle: t("form_notice_title"),
    formNoticeText: t("form_notice_text"),
    formNewField: t("form_new_field"),
    formLinkNone: t("form_link_none"),
    formLinkTeamName: t("form_link_team_name"),
    formLinkTeamUsername: t("form_link_team_username"),
    formLinkTeamBio: t("form_link_team_bio"),
    formLinkTeamProfileUrl: t("form_link_team_profile_url"),
    formOptionsTitle: t("form_options_title"),
    formOptionsPlaceholder: t("form_options_placeholder"),
    formOptionsAdd: t("form_options_add"),
    addField: t("add_field"),
    deleteField: t("delete_field"),
    reorderField: t("reorder_field"),
    fieldLabel: t("field_label"),
    fieldType: t("field_type"),
    fieldRequired: t("field_required"),
    fieldOptions: t("field_options"),
    typeShortText: t("type_short_text"),
    typeLongText: t("type_long_text"),
    typeNumber: t("type_number"),
    typeDate: t("type_date"),
    typeSingleSelect: t("type_single_select"),
    typeMultiSelect: t("type_multi_select"),
    typeUrl: t("type_url"),
    addDocument: t("add_document"),
    editDocument: t("edit_document"),
    docsCardTitle: t("docs_card_title"),
    docsBannerTitle: t("docs_banner_title"),
    docsBannerText: t("docs_banner_text"),
    docsUpdatedSuffix: t("docs_updated_suffix"),
    docsEditBtn: t("docs_edit_btn"),
    docsAddBtn: t("docs_add_btn"),
    requiredReading: t("required_reading"),
    documentBody: t("document_body"),
    deleteDocument: t("delete_document"),
    reorderDocument: t("reorder_document"),
    documentTitle: t("document_title"),
    reviewApplication: t("review_application"),
    approve: t("approve"),
    reject: t("reject"),
    rejectReason: t("reject_reason"),
    return: t("return"),
    returnComment: t("return_comment"),
    broadcastTitle: t("broadcast_title"),
    broadcastBody: t("broadcast_body"),
    broadcastCompose: t("broadcast_compose"),
    directCompose: t("direct_compose"),
    broadcastPublish: t("broadcast_publish"),
    subTeamOptions: t("sub_team_options"),
    subTeamOptionsDrawerTitle: t("sub_team_options_drawer_title"),
    subTeamOptionsClose: t("sub_team_options_close"),
    broadcastDraft: t("broadcast_draft"),
    broadcastDelete: t("broadcast_delete"),
    broadcastPublished: t("broadcast_published"),
    broadcastTitlePlaceholder: t("broadcast_title_placeholder"),
    broadcastBodyPlaceholder: t("broadcast_body_placeholder"),
    broadcastPostingAs: t("broadcast_posting_as"),
    broadcastSectionTags: t("broadcast_section_tags"),
    broadcastSectionAttachments: t("broadcast_section_attachments"),
    broadcastAttachmentsNone: t("broadcast_attachments_none"),
    broadcastAttachmentsUploadTitle: t("broadcast_attachments_upload_title"),
    broadcastAttachmentsUploadHint: t("broadcast_attachments_upload_hint"),
    broadcastDiscardDraft: t("broadcast_discard_draft"),
    broadcastStatusIdle: t("broadcast_status_idle"),
    broadcastStatusDirty: t("broadcast_status_dirty"),
    broadcastStatusSaving: t("broadcast_status_saving"),
    broadcastStatusSaved: t("broadcast_status_saved"),
    broadcastStatusError: t("broadcast_status_error"),
    broadcastSaveDraftManual: t("broadcast_save_draft_manual"),
    broadcastComposeSub: t("broadcast_compose_sub"),
    broadcastDraftChars: (values) => t("broadcast_draft_chars", { replace: values }),
    broadcastDraftPostingAs: t("broadcast_draft_posting_as"),
    broadcastDraftTarget: t("broadcast_draft_target"),
    broadcastDraftsCardTitle: t("broadcast_drafts_card_title"),
    broadcastUntitled: t("broadcast_untitled"),
    broadcastPublishedCardTitle: t("broadcast_published_card_title"),
    broadcastPublishedCount: (values) => t("broadcast_published_count", { replace: values }),
    broadcastDraftsCount: (values) => t("broadcast_drafts_count", { replace: values }),
    broadcastPinned: t("broadcast_pinned"),
    broadcastUnpinned: t("broadcast_unpinned"),
    broadcastFanoutMeta: (values) => t("broadcast_fanout_meta", { replace: values }),
    broadcastCommentsMeta: (values) => t("broadcast_comments_meta", { replace: values }),
    broadcastAutosavedIdle: t("broadcast_autosaved_idle"),
    broadcastAutosavedJustNow: t("broadcast_autosaved_just_now"),
    broadcastAutosavedMinutes: (values) => t("broadcast_autosaved_minutes", { replace: values }),
    broadcastAutosavedHours: (values) => t("broadcast_autosaved_hours", { replace: values }),
    broadcastAutosavedYesterday: t("broadcast_autosaved_yesterday"),
    broadcastAutosavedDays: (values) => t("broadcast_autosaved_days", { replace: values }),
    broadcastTimeToday: t("broadcast_time_today"),
    broadcastTimeYesterday: t("broadcast_time_yesterday"),
    broadcastTimeDaysAgo: (values) => t("broadcast_time_days_ago", { replace: values }),
    broadcastEnableSpace: t("broadcast_enable_space"),
    broadcastSpaceHint: t("broadcast_space_hint"),
    broadcastSpaceActiveHint: t("broadcast_space_active_hint"),
    broadcastTagPlaceholder: t("broadcast_tag_placeholder"),
    broadcastRemoveTag: t("broadcast_remove_tag"),
    selectParentTeam: t("select_parent_team"),
    submitRequirementUnmet: t("submit_requirement_unmet"),
    missingRequiredField: t("missing_required_field"),
    agreeRequiredDocs: t("agree_required_docs"),
    agreementRequired: t("agreement_required"),
    submit: t("submit"),
    cancel: t("cancel"),
    parentIcon: t("parent_icon"),
    parentPanelTitle: t("parent_panel_title"),
    applicationStatus: t("application_status"),
    leaveParent: t("leave_parent"),
    parentCardStatusActive: t("parent_card_status_active"),
    parentCardStatusPending: t("parent_card_status_pending"),
    parentCardMetaRecognizedSince: t("parent_card_meta_recognized_since"),
    parentCardMetaPending: t("parent_card_meta_pending"),
    parentRecognizedInfoPrefix: t("parent_recognized_info_prefix"),
    parentRecognizedInfoSuffix: t("parent_recognized_info_suffix"),
    parentPendingInfo: t("parent_pending_info"),
    parentActionOpenHomeTitle: t("parent_action_open_home_title"),
    parentActionOpenHomeSub: t("parent_action_open_home_sub"),
    parentActionViewBylawsTitle: t("parent_action_view_bylaws_title"),
    parentActionViewBylawsSub: t("parent_action_view_bylaws_sub"),
    parentActionLeaveTitle: t("parent_action_leave_title"),
    parentActionLeaveSub: t("parent_action_leave_sub"),
    parentActionViewApplicationTitle: t("parent_action_view_application_title"),
    parentActionViewApplicationSub: t("parent_action_view_application_sub"),
    parentActionEditApplicationTitle: t("parent_action_edit_application_title"),
    parentActionEditApplicationSub: t("parent_action_edit_application_sub"),
    parentActionCancelApplicationTitle: t("parent_action_cancel_application_title"),
    parentActionCancelApplicationSub: t("parent_action_cancel_application_sub"),
    parentStandaloneTitle: t("parent_standalone_title"),
    parentStandaloneDesc: t("parent_standalone_desc"),
    bylawsTitle: t("bylaws_title"),
    bylawsRegulations: t("bylaws_regulations"),
    windowWeekly: t("window_weekly"),
    windowMonthly: t("window_monthly"),
    postCount: t("post_count"),
    spaceCount: t("space_count"),
    activeMemberCount: t("active_member_count"),
    privacyNoticeShort: t("privacy_notice_short"),
    growthScore: t("growth_score"),
    growthScorePlaceholder: t("growth_score_placeholder"),
    growthScoreMeta: t("growth_score_meta"),
    trendTitleWeekly: t("trend_title_weekly"),
    trendTitleMonthly: t("trend_title_monthly"),
    trendLegendPosts: t("trend_legend_posts"),
    trendLegendMembers: t("trend_legend_members"),
    memberSearchPlaceholder: t("member_search_placeholder"),
    memberSortActive: t("member_sort_active"),
    perMemberActivity: t("per_member_activity"),
    directAnnounceTitle: t("direct_announce_title"),
    directAnnounceNote: t("direct_announce_note"),
    directAnnounceHistoryTitle: t("direct_announce_history_title"),
    directAnnounceHistoryEmpty: t("direct_announce_history_empty"),
    dangerZone: t("danger_zone"),
    memberHandleHeader: t("member_handle_header"),
    memberPostsHeader: t("member_posts_header"),
    memberSpacesHeader: t("member_spaces_header"),
    memberLastActiveHeader: t("member_last_active_header"),
    save: t("save"),
    edit: t("edit"),
    delete: t("delete"),
    loading: t("loading"),
    emptyList: t("empty_list"),
    deregisterTitle: t("deregister_title"),
    deregisterReason: t("deregister_reason"),
    deregisterConfirm: t("deregister_confirm"),
    deregisterStatusChip: t("deregister_status_chip"),
    deregisterEyebrow: t("deregister_eyebrow"),
    deregisterHeaderTitlePrefix: t("deregister_header_title_prefix"),
    deregisterHeaderTitleSuffix: t("deregister_header_title_suffix"),
    deregisterHeaderSub: t("deregister_header_sub"),
    deregisterConsequencesTitle: t("deregister_consequences_title"),
    deregisterConsequenceUnlink: t("deregister_consequence_unlink"),
    deregisterConsequenceNotify: t("deregister_consequence_notify"),
    deregisterConsequenceDemote: t("deregister_consequence_demote"),
    deregisterConsequenceContent: t("deregister_consequence_content"),
    deregisterConsequenceReapply: t("deregister_consequence_reapply"),
    deregisterReasonPlaceholder: t("deregister_reason_placeholder"),
    deregisterReasonHint: t("deregister_reason_hint"),
    deregisterNotifPreviewLabel: t("deregister_notif_preview_label"),
    deregisterNotifPreviewTitlePrefix: t("deregister_notif_preview_title_prefix"),
    deregisterNotifPreviewTitleSuffix: t("deregister_notif_preview_title_suffix"),
    deregisterNotifPreviewEmpty: t("deregister_notif_preview_empty"),
    deregisterConfirmCheck: t("deregister_confirm_check"),
    deregisterConfirmCheckHint: t("deregister_confirm_check_hint"),
    leaveParentTitle: t("leave_parent_title"),
    leaveParentReason: t("leave_parent_reason"),
    leaveParentConfirm: t("leave_parent_confirm"),
    pageUnderConstruction: t("page_under_construction"),
    applyPageTitle: t("apply_page_title"),
    applyPageEyebrow: t("apply_page_eyebrow"),
    applyTargetLabel: t("apply_target_label"),
    applySelectParent: t("apply_select_parent"),
    applyRequiredDocs: t("apply_required_docs"),
    applyDocsOpenReview: t("apply_docs_open_review"),
    applyDocsAgreed: t("apply_docs_agreed"),
    applyFormFields: t("apply_form_fields"),
    applyEligibilityTitle: t("apply_eligibility_title"),
    applyEligMinMembers: t("apply_elig_min_members"),
    applyEligFormFilled: t("apply_elig_form_filled"),
    applyEligDocsAgreed: t("apply_elig_docs_agreed"),
    applySubmit: t("apply_submit"),
    applySubmitSub: t("apply_submit_sub"),
    applyParentEligibleOff: t("apply_parent_eligible_off"),
    applyPageHeaderSub: t("apply_page_header_sub"),
    applyStatusDrafting: t("apply_status_drafting"),
    applySaveDraft: t("apply_save_draft"),
    applyProgressLabel: t("apply_progress_label"),
    applyEligAdminTitle: t("apply_elig_admin_title"),
    applyEligAdminDesc: t("apply_elig_admin_desc"),
    applyEligMinMembersDesc: t("apply_elig_min_members_desc"),
    applyEligMinDaysTitle: t("apply_elig_min_days_title"),
    applyEligMinDaysDesc: t("apply_elig_min_days_desc"),
    applyEligDocsDesc: t("apply_elig_docs_desc"),
    applyEligFormDesc: t("apply_elig_form_desc"),
    applyPickYourTeam: t("apply_pick_your_team"),
    applyPickerPlaceholder: t("apply_picker_placeholder"),
    applyPickerEmpty: t("apply_picker_empty"),
    applyDocViewOpen: t("apply_doc_view_open"),
    applyDocReferenceBadge: t("apply_doc_reference_badge"),
    applyClose: t("apply_close"),
    applySubmitProgressPrefix: t("apply_submit_progress_prefix"),
    applySubmitProgressSuffix: t("apply_submit_progress_suffix"),
    docModalEyebrow: t("doc_modal_eyebrow"),
    docModalAgree: t("doc_modal_agree"),
    docModalAgreed: t("doc_modal_agreed"),
    docModalCancel: t("doc_modal_cancel"),
    docModalNotice: t("doc_modal_notice"),
    statusPageTitle: t("status_page_title"),
    statusPageEyebrow: t("status_page_eyebrow"),
    statusRelationshipStandalone: t("status_relationship_standalone"),
    statusRelationshipPending: t("status_relationship_pending"),
    statusRelationshipRecognized: t("status_relationship_recognized"),
    statusEditAndResubmit: t("status_edit_and_resubmit"),
    statusCancelApplication: t("status_cancel_application"),
    statusHistory: t("status_history"),
    statusNoApplications: t("status_no_applications"),
    statusDecisionReason: t("status_decision_reason"),
    statusLatestApplication: t("status_latest_application"),
    queueRowMembersSuffix: t("queue_row_members_suffix"),
    queueRowFormSnapshot: t("queue_row_form_snapshot"),
    queueRowReviewBtn: t("queue_row_review_btn"),
    queueRowConfirm: t("queue_row_confirm"),
    queueRowApprovePlaceholder: t("queue_row_approve_placeholder"),
    queueRowReturnPlaceholder: t("queue_row_return_placeholder"),
    queueRowRejectPlaceholder: t("queue_row_reject_placeholder"),
    reviewModalEyebrow: t("review_modal_eyebrow"),
    reviewModalSubmittedAt: t("review_modal_submitted_at"),
    reviewModalSubmitter: t("review_modal_submitter"),
    reviewModalFormSection: t("review_modal_form_section"),
    reviewModalFieldsSuffix: t("review_modal_fields_suffix"),
    reviewModalClose: t("review_modal_close"),
    statusHeroPendingEyebrow: t("status_hero_pending_eyebrow"),
    statusHeroPendingTitle: t("status_hero_pending_title"),
    statusHeroPendingSub: t("status_hero_pending_sub"),
    statusHeroReturnedEyebrow: t("status_hero_returned_eyebrow"),
    statusHeroReturnedTitle: t("status_hero_returned_title"),
    statusHeroReturnedSub: t("status_hero_returned_sub"),
    statusHeroApprovedEyebrow: t("status_hero_approved_eyebrow"),
    statusHeroApprovedTitle: t("status_hero_approved_title"),
    statusHeroApprovedSub: t("status_hero_approved_sub"),
    statusHeroRejectedEyebrow: t("status_hero_rejected_eyebrow"),
    statusHeroRejectedTitle: t("status_hero_rejected_title"),
    statusHeroRejectedSub: t("status_hero_rejected_sub"),
    statusFeedbackReturnedHeading: t("status_feedback_returned_heading"),
    statusFeedbackApprovedHeading: t("status_feedback_approved_heading"),
    statusFeedbackRejectedHeading: t("status_feedback_rejected_heading"),
    statusFeedbackAuthorSuffix: t("status_feedback_author_suffix"),
    statusSnapshotHeading: t("status_snapshot_heading"),
    statusFormVersionMeta: t("status_form_version_meta"),
    statusFieldsCountSuffix: t("status_fields_count_suffix"),
    statusFormPinTitle: t("status_form_pin_title"),
    statusFormPinText: t("status_form_pin_text"),
    docComposeTitleNew: t("doc_compose_title_new"),
    docComposeTitleEdit: t("doc_compose_title_edit"),
    docComposeEyebrow: t("doc_compose_eyebrow"),
    docComposeTitlePlaceholder: t("doc_compose_title_placeholder"),
    docComposeBodyPlaceholder: t("doc_compose_body_placeholder"),
    docComposeRequiredOn: t("doc_compose_required_on"),
    docComposeRequiredOff: t("doc_compose_required_off"),
    docComposeRequiredDescShort: t("doc_compose_required_desc_short"),
    docComposeReferenceOnly: t("doc_compose_reference_only"),
    docComposeRequiredDesc: t("doc_compose_required_desc"),
    docComposeWordCount: t("doc_compose_word_count"),
    docComposeAutosaved: t("doc_compose_autosaved"),
    docComposeDraftUnsaved: t("doc_compose_draft_unsaved"),
    docComposePreview: t("doc_compose_preview"),
    docComposeBannerLabel: t("doc_compose_banner_label"),
    docComposeBannerText: t("doc_compose_banner_text"),
    docComposeAttachmentsTitle: t("doc_compose_attachments_title"),
    docComposeUploadTitle: t("doc_compose_upload_title"),
    docComposeUploadHint: t("doc_compose_upload_hint"),
    docComposeRequiredCardTitle: t("doc_compose_required_card_title"),
    docComposeInfoTitle: t("doc_compose_info_title"),
    docComposeInfoVersion: t("doc_compose_info_version"),
    docComposeInfoUpdated: t("doc_compose_info_updated"),
    docComposeInfoEditor: t("doc_compose_info_editor"),
    docComposeInfoAttachments: t("doc_compose_info_attachments"),
    docComposeInfoRequired: t("doc_compose_info_required"),
    docComposeAttachNone: t("doc_compose_attach_none"),
    docComposeAttachFilesUnit: t("doc_compose_attach_files_unit"),
    docComposeDiscard: t("doc_compose_discard"),
    docComposeStatsWords: t("doc_compose_stats_words"),
    docComposeStatsRead: t("doc_compose_stats_read"),
    docComposeStatsChars: t("doc_compose_stats_chars"),
    yes: t("yes"),
    no: t("no"),
    leaveParentPageEyebrow: t("leave_parent_page_eyebrow"),
    leaveParentCurrentTie: t("leave_parent_current_tie"),
    leaveParentKeepTitle: t("leave_parent_keep_title"),
    leaveParentKeepTeam: t("leave_parent_keep_team"),
    leaveParentKeepAnnouncements: t("leave_parent_keep_announcements"),
    leaveParentKeepAdmins: t("leave_parent_keep_admins"),
    leaveParentLoseTitle: t("leave_parent_lose_title"),
    leaveParentLoseBroadcasts: t("leave_parent_lose_broadcasts"),
    leaveParentLoseDashboard: t("leave_parent_lose_dashboard"),
    leaveParentLoseBadge: t("leave_parent_lose_badge"),
    leaveParentLoseReapply: t("leave_parent_lose_reapply"),
    leaveParentReasonPlaceholder: t("leave_parent_reason_placeholder"),
    leaveParentReasonHint: t("leave_parent_reason_hint"),
    leaveParentConfirmCheckbox: t("leave_parent_confirm_checkbox"),
    leaveParentNotRecognized: t("leave_parent_not_recognized"),
    leaveParentStatusChip: t("leave_parent_status_chip"),
    leaveParentEyebrowCode: t("leave_parent_eyebrow_code"),
    leaveParentHeaderTitlePrefix: t("leave_parent_header_title_prefix"),
    leaveParentHeaderTitleSuffix: t("leave_parent_header_title_suffix"),
    leaveParentHeaderEmphasis: t("leave_parent_header_emphasis"),
    leaveParentHeaderSub: t("leave_parent_header_sub"),
    leaveParentTieChildOf: t("leave_parent_tie_child_of"),
    leaveParentTieRecognizedSince: t("leave_parent_tie_recognized_since"),
    leaveParentPanelSub: t("leave_parent_panel_sub"),
    bylawsPageEyebrow: t("bylaws_page_eyebrow"),
    bylawsTeamRegulations: t("bylaws_team_regulations"),
    bylawsParentRegulations: t("bylaws_parent_regulations"),
    bylawsEmpty: t("bylaws_empty"),
    bylawsRequiredBadge: t("bylaws_required_badge"),
    bylawsStatusChip: t("bylaws_status_chip"),
    bylawsAddTeam: t("bylaws_add_team"),
    bylawsAddClub: t("bylaws_add_club"),
    bylawsPageTitle: t("bylaws_page_title"),
    bylawsPageSub: t("bylaws_page_sub"),
    bylawsParentLinkEyebrow: t("bylaws_parent_link_eyebrow"),
    bylawsParentLinkMeta: t("bylaws_parent_link_meta"),
    bylawsViewParent: t("bylaws_view_parent"),
    bylawsViewSub: t("bylaws_view_sub"),
    bylawsPageEyebrowFr: t("bylaws_page_eyebrow_fr"),
    bylawsPageTitleStrong: t("bylaws_page_title_strong"),
    bylawsPageTitleRest: t("bylaws_page_title_rest"),
    bylawsSectionTeamRegulations: t("bylaws_section_team_regulations"),
    bylawsSectionClubRules: t("bylaws_section_club_rules"),
    bylawsSectionCountItems: (values) => t("bylaws_section_count_items", { replace: values }),
    bylawsCardBylawNum: (values) => t("bylaws_card_bylaw_num", { replace: values }),
    bylawsCardRuleNum: (values) => t("bylaws_card_rule_num", { replace: values }),
    bylawsRequiredMeta: t("bylaws_required_meta"),
    docsViewBylaws: t("docs_view_bylaws"),
  };
}
