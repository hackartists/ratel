--
-- PostgreSQL database dump
--

\restrict Z9FE0mWepCy1M16cuK1JQlpnIcenTyragxVG2B0EVhdpk6AkrXNKcRlHd7jqmps

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: ai_moderator_configs; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.ai_moderator_configs DISABLE TRIGGER ALL;



ALTER TABLE public.ai_moderator_configs ENABLE TRIGGER ALL;

--
-- Data for Name: ai_moderator_materials; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.ai_moderator_materials DISABLE TRIGGER ALL;



ALTER TABLE public.ai_moderator_materials ENABLE TRIGGER ALL;

--
-- Data for Name: analyze_quota_configs; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.analyze_quota_configs DISABLE TRIGGER ALL;



ALTER TABLE public.analyze_quota_configs ENABLE TRIGGER ALL;

--
-- Data for Name: arcade_settings; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.arcade_settings DISABLE TRIGGER ALL;



ALTER TABLE public.arcade_settings ENABLE TRIGGER ALL;

--
-- Data for Name: arcade_wallet_balances; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.arcade_wallet_balances DISABLE TRIGGER ALL;



ALTER TABLE public.arcade_wallet_balances ENABLE TRIGGER ALL;

--
-- Data for Name: arcade_wallet_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.arcade_wallet_transactions DISABLE TRIGGER ALL;



ALTER TABLE public.arcade_wallet_transactions ENABLE TRIGGER ALL;

--
-- Data for Name: attribute_codes; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.attribute_codes DISABLE TRIGGER ALL;

INSERT INTO public.attribute_codes (id, code, created_at, birth_date, gender, university) VALUES ('52b58af1-37b2-5644-8100-38e2e2557398', 'wKFegq', 1764227900000, NULL, 'female', 'Konkuk');
INSERT INTO public.attribute_codes (id, code, created_at, birth_date, gender, university) VALUES ('18b8d853-c7c8-5142-b86f-59f6dd41b68f', 'bVn0Vq', 1764227901000, NULL, 'male', 'Konkuk');
INSERT INTO public.attribute_codes (id, code, created_at, birth_date, gender, university) VALUES ('f7634b5c-61de-5b91-91a1-c9a1f3abd024', 'bIFviB', 1764227902000, NULL, 'female', 'Sogang');
INSERT INTO public.attribute_codes (id, code, created_at, birth_date, gender, university) VALUES ('b3899ea2-41cf-5bfa-a1b5-7c8b30c66d84', 'j94EA1', 1764227903000, NULL, 'male', 'Sogang');


ALTER TABLE public.attribute_codes ENABLE TRIGGER ALL;

--
-- Data for Name: character_skills; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.character_skills DISABLE TRIGGER ALL;



ALTER TABLE public.character_skills ENABLE TRIGGER ALL;

--
-- Data for Name: character_xp_sources; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.character_xp_sources DISABLE TRIGGER ALL;



ALTER TABLE public.character_xp_sources ENABLE TRIGGER ALL;

--
-- Data for Name: character_xps; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.character_xps DISABLE TRIGGER ALL;



ALTER TABLE public.character_xps ENABLE TRIGGER ALL;

--
-- Data for Name: email_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.email_verifications DISABLE TRIGGER ALL;



ALTER TABLE public.email_verifications ENABLE TRIGGER ALL;

--
-- Data for Name: engagement_snapshots; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.engagement_snapshots DISABLE TRIGGER ALL;



ALTER TABLE public.engagement_snapshots ENABLE TRIGGER ALL;

--
-- Data for Name: essences; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.essences DISABLE TRIGGER ALL;



ALTER TABLE public.essences ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_bets; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_bets DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_bets ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_chat_messages DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_chat_messages ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_leaderboard_entries; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_leaderboard_entries DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_leaderboard_entries ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_lobbies; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_lobbies DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_lobbies ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_participants; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_participants DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_participants ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_rationales; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_rationales DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_rationales ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_rounds; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_rounds DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_rounds ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_settings; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_settings DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_settings ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_settlements; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_settlements DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_settlements ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_subject_plays; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_subject_plays DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_subject_plays ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_subjects; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_subjects DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_subjects ENABLE TRIGGER ALL;

--
-- Data for Name: fact_fold_user_stats; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.fact_fold_user_stats DISABLE TRIGGER ALL;



ALTER TABLE public.fact_fold_user_stats ENABLE TRIGGER ALL;

--
-- Data for Name: file_links; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.file_links DISABLE TRIGGER ALL;



ALTER TABLE public.file_links ENABLE TRIGGER ALL;

--
-- Data for Name: hot_spaces; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.hot_spaces DISABLE TRIGGER ALL;



ALTER TABLE public.hot_spaces ENABLE TRIGGER ALL;

--
-- Data for Name: inbox_dedup_markers; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.inbox_dedup_markers DISABLE TRIGGER ALL;



ALTER TABLE public.inbox_dedup_markers ENABLE TRIGGER ALL;

--
-- Data for Name: last_backfill_versions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.last_backfill_versions DISABLE TRIGGER ALL;



ALTER TABLE public.last_backfill_versions ENABLE TRIGGER ALL;

--
-- Data for Name: launchpad_deductions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.launchpad_deductions DISABLE TRIGGER ALL;



ALTER TABLE public.launchpad_deductions ENABLE TRIGGER ALL;

--
-- Data for Name: mcp_client_secrets; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.mcp_client_secrets DISABLE TRIGGER ALL;



ALTER TABLE public.mcp_client_secrets ENABLE TRIGGER ALL;

--
-- Data for Name: memberships; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.memberships DISABLE TRIGGER ALL;

INSERT INTO public.memberships (id, tier, created_at, updated_at, credits, price_dollars, price_won, display_order, duration_days, max_credits_per_space, is_active) VALUES ('f41584ab-5a6c-523b-9fd3-0995f18dfe3a', 'vip', 1764227900883722, 1764227900883722, 1360, 100, 150000, 3, 30, 100, true);
INSERT INTO public.memberships (id, tier, created_at, updated_at, credits, price_dollars, price_won, display_order, duration_days, max_credits_per_space, is_active) VALUES ('5ba4d3a2-0d89-512d-b392-a40aa6a7bee8', 'pro', 1764227900857256, 1764227900857256, 40, 20, 30000, 1, 30, 2, true);
INSERT INTO public.memberships (id, tier, created_at, updated_at, credits, price_dollars, price_won, display_order, duration_days, max_credits_per_space, is_active) VALUES ('1d5f72b6-0851-5b55-ac94-d4276914edff', 'max', 1764227900869019, 1764227900869019, 190, 50, 75000, 2, 30, 10, true);
INSERT INTO public.memberships (id, tier, created_at, updated_at, credits, price_dollars, price_won, display_order, duration_days, max_credits_per_space, is_active) VALUES ('c1e037c4-5e24-5a63-bdb3-f638a0d12dab', 'free', 1764227900847989, 1764227900847989, 0, 0, 0, 0, -1, -1, true);


ALTER TABLE public.memberships ENABLE TRIGGER ALL;

--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.notifications DISABLE TRIGGER ALL;



ALTER TABLE public.notifications ENABLE TRIGGER ALL;

--
-- Data for Name: phone_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.phone_verifications DISABLE TRIGGER ALL;



ALTER TABLE public.phone_verifications ENABLE TRIGGER ALL;

--
-- Data for Name: post_artworks; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.post_artworks DISABLE TRIGGER ALL;



ALTER TABLE public.post_artworks ENABLE TRIGGER ALL;

--
-- Data for Name: post_categories; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.post_categories DISABLE TRIGGER ALL;



ALTER TABLE public.post_categories ENABLE TRIGGER ALL;

--
-- Data for Name: post_comment_likes; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.post_comment_likes DISABLE TRIGGER ALL;



ALTER TABLE public.post_comment_likes ENABLE TRIGGER ALL;

--
-- Data for Name: post_comments; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.post_comments DISABLE TRIGGER ALL;



ALTER TABLE public.post_comments ENABLE TRIGGER ALL;

--
-- Data for Name: post_likes; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.post_likes DISABLE TRIGGER ALL;



ALTER TABLE public.post_likes ENABLE TRIGGER ALL;

--
-- Data for Name: post_reposts; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.post_reposts DISABLE TRIGGER ALL;



ALTER TABLE public.post_reposts ENABLE TRIGGER ALL;

--
-- Data for Name: post_syndication_directives; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.post_syndication_directives DISABLE TRIGGER ALL;



ALTER TABLE public.post_syndication_directives ENABLE TRIGGER ALL;

--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.posts DISABLE TRIGGER ALL;



ALTER TABLE public.posts ENABLE TRIGGER ALL;

--
-- Data for Name: rewards; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.rewards DISABLE TRIGGER ALL;



ALTER TABLE public.rewards ENABLE TRIGGER ALL;

--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.sessions DISABLE TRIGGER ALL;



ALTER TABLE public.sessions ENABLE TRIGGER ALL;

--
-- Data for Name: social_connections; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.social_connections DISABLE TRIGGER ALL;



ALTER TABLE public.social_connections ENABLE TRIGGER ALL;

--
-- Data for Name: space_actions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_actions DISABLE TRIGGER ALL;



ALTER TABLE public.space_actions ENABLE TRIGGER ALL;

--
-- Data for Name: space_activities; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_activities DISABLE TRIGGER ALL;



ALTER TABLE public.space_activities ENABLE TRIGGER ALL;

--
-- Data for Name: space_admins; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_admins DISABLE TRIGGER ALL;



ALTER TABLE public.space_admins ENABLE TRIGGER ALL;

--
-- Data for Name: space_analyze_discussion_results; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_analyze_discussion_results DISABLE TRIGGER ALL;



ALTER TABLE public.space_analyze_discussion_results ENABLE TRIGGER ALL;

--
-- Data for Name: space_analyze_report_results; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_analyze_report_results DISABLE TRIGGER ALL;



ALTER TABLE public.space_analyze_report_results ENABLE TRIGGER ALL;

--
-- Data for Name: space_analyze_reports; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_analyze_reports DISABLE TRIGGER ALL;



ALTER TABLE public.space_analyze_reports ENABLE TRIGGER ALL;

--
-- Data for Name: space_analyzes; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_analyzes DISABLE TRIGGER ALL;



ALTER TABLE public.space_analyzes ENABLE TRIGGER ALL;

--
-- Data for Name: space_apps; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_apps DISABLE TRIGGER ALL;



ALTER TABLE public.space_apps ENABLE TRIGGER ALL;

--
-- Data for Name: space_categories; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_categories DISABLE TRIGGER ALL;



ALTER TABLE public.space_categories ENABLE TRIGGER ALL;

--
-- Data for Name: space_commons; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_commons DISABLE TRIGGER ALL;



ALTER TABLE public.space_commons ENABLE TRIGGER ALL;

--
-- Data for Name: space_dashboard_aggregates; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_dashboard_aggregates DISABLE TRIGGER ALL;



ALTER TABLE public.space_dashboard_aggregates ENABLE TRIGGER ALL;

--
-- Data for Name: space_email_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_email_verifications DISABLE TRIGGER ALL;



ALTER TABLE public.space_email_verifications ENABLE TRIGGER ALL;

--
-- Data for Name: space_files; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_files DISABLE TRIGGER ALL;



ALTER TABLE public.space_files ENABLE TRIGGER ALL;

--
-- Data for Name: space_follow_actions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_follow_actions DISABLE TRIGGER ALL;



ALTER TABLE public.space_follow_actions ENABLE TRIGGER ALL;

--
-- Data for Name: space_follow_users; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_follow_users DISABLE TRIGGER ALL;



ALTER TABLE public.space_follow_users ENABLE TRIGGER ALL;

--
-- Data for Name: space_incentive_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_incentive_tokens DISABLE TRIGGER ALL;



ALTER TABLE public.space_incentive_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: space_incentives; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_incentives DISABLE TRIGGER ALL;



ALTER TABLE public.space_incentives ENABLE TRIGGER ALL;

--
-- Data for Name: space_invitation_members; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_invitation_members DISABLE TRIGGER ALL;



ALTER TABLE public.space_invitation_members ENABLE TRIGGER ALL;

--
-- Data for Name: space_meets; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_meets DISABLE TRIGGER ALL;



ALTER TABLE public.space_meets ENABLE TRIGGER ALL;

--
-- Data for Name: space_panel_participants; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_panel_participants DISABLE TRIGGER ALL;



ALTER TABLE public.space_panel_participants ENABLE TRIGGER ALL;

--
-- Data for Name: space_panel_quotas; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_panel_quotas DISABLE TRIGGER ALL;



ALTER TABLE public.space_panel_quotas ENABLE TRIGGER ALL;

--
-- Data for Name: space_participants; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_participants DISABLE TRIGGER ALL;



ALTER TABLE public.space_participants ENABLE TRIGGER ALL;

--
-- Data for Name: space_poll_results; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_poll_results DISABLE TRIGGER ALL;



ALTER TABLE public.space_poll_results ENABLE TRIGGER ALL;

--
-- Data for Name: space_poll_user_answers; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_poll_user_answers DISABLE TRIGGER ALL;



ALTER TABLE public.space_poll_user_answers ENABLE TRIGGER ALL;

--
-- Data for Name: space_polls; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_polls DISABLE TRIGGER ALL;



ALTER TABLE public.space_polls ENABLE TRIGGER ALL;

--
-- Data for Name: space_post_comment_likes; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_post_comment_likes DISABLE TRIGGER ALL;



ALTER TABLE public.space_post_comment_likes ENABLE TRIGGER ALL;

--
-- Data for Name: space_post_comments; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_post_comments DISABLE TRIGGER ALL;



ALTER TABLE public.space_post_comments ENABLE TRIGGER ALL;

--
-- Data for Name: space_post_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_post_subscriptions DISABLE TRIGGER ALL;



ALTER TABLE public.space_post_subscriptions ENABLE TRIGGER ALL;

--
-- Data for Name: space_posts; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_posts DISABLE TRIGGER ALL;



ALTER TABLE public.space_posts ENABLE TRIGGER ALL;

--
-- Data for Name: space_quiz_answers; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_quiz_answers DISABLE TRIGGER ALL;



ALTER TABLE public.space_quiz_answers ENABLE TRIGGER ALL;

--
-- Data for Name: space_quiz_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_quiz_attempts DISABLE TRIGGER ALL;



ALTER TABLE public.space_quiz_attempts ENABLE TRIGGER ALL;

--
-- Data for Name: space_quizzes; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_quizzes DISABLE TRIGGER ALL;



ALTER TABLE public.space_quizzes ENABLE TRIGGER ALL;

--
-- Data for Name: space_reports; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_reports DISABLE TRIGGER ALL;



ALTER TABLE public.space_reports ENABLE TRIGGER ALL;

--
-- Data for Name: space_rewards; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_rewards DISABLE TRIGGER ALL;



ALTER TABLE public.space_rewards ENABLE TRIGGER ALL;

--
-- Data for Name: space_scores; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_scores DISABLE TRIGGER ALL;



ALTER TABLE public.space_scores ENABLE TRIGGER ALL;

--
-- Data for Name: space_status_change_events; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.space_status_change_events DISABLE TRIGGER ALL;



ALTER TABLE public.space_status_change_events ENABLE TRIGGER ALL;

--
-- Data for Name: sub_team_announcement_fanouts; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.sub_team_announcement_fanouts DISABLE TRIGGER ALL;



ALTER TABLE public.sub_team_announcement_fanouts ENABLE TRIGGER ALL;

--
-- Data for Name: sub_team_announcements; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.sub_team_announcements DISABLE TRIGGER ALL;



ALTER TABLE public.sub_team_announcements ENABLE TRIGGER ALL;

--
-- Data for Name: sub_team_application_drafts; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.sub_team_application_drafts DISABLE TRIGGER ALL;



ALTER TABLE public.sub_team_application_drafts ENABLE TRIGGER ALL;

--
-- Data for Name: sub_team_applications; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.sub_team_applications DISABLE TRIGGER ALL;



ALTER TABLE public.sub_team_applications ENABLE TRIGGER ALL;

--
-- Data for Name: sub_team_doc_agreements; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.sub_team_doc_agreements DISABLE TRIGGER ALL;



ALTER TABLE public.sub_team_doc_agreements ENABLE TRIGGER ALL;

--
-- Data for Name: sub_team_document_versions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.sub_team_document_versions DISABLE TRIGGER ALL;



ALTER TABLE public.sub_team_document_versions ENABLE TRIGGER ALL;

--
-- Data for Name: sub_team_documents; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.sub_team_documents DISABLE TRIGGER ALL;



ALTER TABLE public.sub_team_documents ENABLE TRIGGER ALL;

--
-- Data for Name: sub_team_form_fields; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.sub_team_form_fields DISABLE TRIGGER ALL;



ALTER TABLE public.sub_team_form_fields ENABLE TRIGGER ALL;

--
-- Data for Name: sub_team_links; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.sub_team_links DISABLE TRIGGER ALL;



ALTER TABLE public.sub_team_links ENABLE TRIGGER ALL;

--
-- Data for Name: syndication_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.syndication_jobs DISABLE TRIGGER ALL;



ALTER TABLE public.syndication_jobs ENABLE TRIGGER ALL;

--
-- Data for Name: team_groups; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.team_groups DISABLE TRIGGER ALL;

INSERT INTO public.team_groups (id, team_id, created_at, name, description, members, permissions) VALUES ('0e55a3b3-fb35-45b2-8a57-1440dda643ef', 'b8f58214-40fd-58cb-8c74-74135c509246', 1764227900000, 'Admin', 'Administrators group with all permissions', 3, 1099511627775);


ALTER TABLE public.team_groups ENABLE TRIGGER ALL;

--
-- Data for Name: team_memberships; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.team_memberships DISABLE TRIGGER ALL;



ALTER TABLE public.team_memberships ENABLE TRIGGER ALL;

--
-- Data for Name: team_owners; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.team_owners DISABLE TRIGGER ALL;

INSERT INTO public.team_owners (id, team_id, display_name, profile_url, username, user_pk) VALUES ('b7702883-4488-5a4a-ae64-062cab3235b3', 'b8f58214-40fd-58cb-8c74-74135c509246', 'User 2', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'user2', 'USER#00000000-0000-0000-0000-000000000002');


ALTER TABLE public.team_owners ENABLE TRIGGER ALL;

--
-- Data for Name: team_payments; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.team_payments DISABLE TRIGGER ALL;



ALTER TABLE public.team_payments ENABLE TRIGGER ALL;

--
-- Data for Name: team_purchases; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.team_purchases DISABLE TRIGGER ALL;



ALTER TABLE public.team_purchases ENABLE TRIGGER ALL;

--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.teams DISABLE TRIGGER ALL;

INSERT INTO public.teams (id, created_at, updated_at, points, display_name, profile_url, username, followers, followings, description, dao_address, thumbnail_url, allow_invite, allow_create_space, is_parent_eligible, min_sub_team_members, min_sub_team_age_days, parent_team_id, pending_parent_team_id) VALUES ('b8f58214-40fd-58cb-8c74-74135c509246', 1764227900000, 1764227900000, 0, 'hiteam', '', 'hiteam', 0, 0, '', NULL, NULL, false, false, false, 0, 0, NULL, NULL);


ALTER TABLE public.teams ENABLE TRIGGER ALL;

--
-- Data for Name: test_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.test_accounts DISABLE TRIGGER ALL;



ALTER TABLE public.test_accounts ENABLE TRIGGER ALL;

--
-- Data for Name: timeline_entries; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.timeline_entries DISABLE TRIGGER ALL;



ALTER TABLE public.timeline_entries ENABLE TRIGGER ALL;

--
-- Data for Name: user_device_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_device_tokens DISABLE TRIGGER ALL;



ALTER TABLE public.user_device_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: user_essence_stats; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_essence_stats DISABLE TRIGGER ALL;



ALTER TABLE public.user_essence_stats ENABLE TRIGGER ALL;

--
-- Data for Name: user_evm_addresses; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_evm_addresses DISABLE TRIGGER ALL;

INSERT INTO public.user_evm_addresses (id, user_pk, evm_address) VALUES ('eaafdcfb-c6bf-5a86-ab0e-984ab89f6989', 'USER#00000000-0000-0000-0000-000000000002', '0x1234567890123456789012345678901234567890');
INSERT INTO public.user_evm_addresses (id, user_pk, evm_address) VALUES ('bf42bfcd-8ab0-5af8-9941-05d8c35e7c43', 'USER#00000000-0000-0000-0000-000000000003', '0x2345678901234567890123456789012345678901');
INSERT INTO public.user_evm_addresses (id, user_pk, evm_address) VALUES ('9e2d2085-42e3-520b-b5a3-385d33c1be2d', 'USER#00000000-0000-0000-0000-000000000004', '0x3456789012345678901234567890123456789012');


ALTER TABLE public.user_evm_addresses ENABLE TRIGGER ALL;

--
-- Data for Name: user_follows; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_follows DISABLE TRIGGER ALL;



ALTER TABLE public.user_follows ENABLE TRIGGER ALL;

--
-- Data for Name: user_inbox_notifications; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_inbox_notifications DISABLE TRIGGER ALL;



ALTER TABLE public.user_inbox_notifications ENABLE TRIGGER ALL;

--
-- Data for Name: user_membership_locals; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_membership_locals DISABLE TRIGGER ALL;



ALTER TABLE public.user_membership_locals ENABLE TRIGGER ALL;

--
-- Data for Name: user_memberships; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_memberships DISABLE TRIGGER ALL;



ALTER TABLE public.user_memberships ENABLE TRIGGER ALL;

--
-- Data for Name: user_notifications; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_notifications DISABLE TRIGGER ALL;



ALTER TABLE public.user_notifications ENABLE TRIGGER ALL;

--
-- Data for Name: user_oauths; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_oauths DISABLE TRIGGER ALL;



ALTER TABLE public.user_oauths ENABLE TRIGGER ALL;

--
-- Data for Name: user_onboarding_flags; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_onboarding_flags DISABLE TRIGGER ALL;



ALTER TABLE public.user_onboarding_flags ENABLE TRIGGER ALL;

--
-- Data for Name: user_payments; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_payments DISABLE TRIGGER ALL;



ALTER TABLE public.user_payments ENABLE TRIGGER ALL;

--
-- Data for Name: user_phone_numbers; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_phone_numbers DISABLE TRIGGER ALL;



ALTER TABLE public.user_phone_numbers ENABLE TRIGGER ALL;

--
-- Data for Name: user_principals; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_principals DISABLE TRIGGER ALL;



ALTER TABLE public.user_principals ENABLE TRIGGER ALL;

--
-- Data for Name: user_purchases; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_purchases DISABLE TRIGGER ALL;



ALTER TABLE public.user_purchases ENABLE TRIGGER ALL;

--
-- Data for Name: user_referral_codes; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_referral_codes DISABLE TRIGGER ALL;



ALTER TABLE public.user_referral_codes ENABLE TRIGGER ALL;

--
-- Data for Name: user_refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_refresh_tokens DISABLE TRIGGER ALL;



ALTER TABLE public.user_refresh_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: user_relationships; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_relationships DISABLE TRIGGER ALL;



ALTER TABLE public.user_relationships ENABLE TRIGGER ALL;

--
-- Data for Name: user_reward_histories; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_reward_histories DISABLE TRIGGER ALL;



ALTER TABLE public.user_reward_histories ENABLE TRIGGER ALL;

--
-- Data for Name: user_rewards; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_rewards DISABLE TRIGGER ALL;



ALTER TABLE public.user_rewards ENABLE TRIGGER ALL;

--
-- Data for Name: user_team_groups; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_team_groups DISABLE TRIGGER ALL;

INSERT INTO public.user_team_groups (id, user_pk, team_group_sk, team_group_permissions, team_pk) VALUES ('37840402-e24f-5fe0-8632-c15de398ad88', 'USER#00000000-0000-0000-0000-000000000002', 'TEAM_GROUP#0e55a3b3-fb35-45b2-8a57-1440dda643ef', 1099511627775, 'TEAM#d4004e2b-093a-41cc-9f21-b8fb3e5e9f61');
INSERT INTO public.user_team_groups (id, user_pk, team_group_sk, team_group_permissions, team_pk) VALUES ('66e0f1d6-4c6d-520b-976e-ff41297427de', 'USER#00000000-0000-0000-0000-000000000003', 'TEAM_GROUP#0e55a3b3-fb35-45b2-8a57-1440dda643ef', 1099511627775, 'TEAM#d4004e2b-093a-41cc-9f21-b8fb3e5e9f61');
INSERT INTO public.user_team_groups (id, user_pk, team_group_sk, team_group_permissions, team_pk) VALUES ('ac97d598-147f-5228-9618-bcc709302afa', 'USER#00000000-0000-0000-0000-000000000004', 'TEAM_GROUP#0e55a3b3-fb35-45b2-8a57-1440dda643ef', 1099511627775, 'TEAM#d4004e2b-093a-41cc-9f21-b8fb3e5e9f61');


ALTER TABLE public.user_team_groups ENABLE TRIGGER ALL;

--
-- Data for Name: user_teams; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_teams DISABLE TRIGGER ALL;

INSERT INTO public.user_teams (id, user_pk, team_pk, last_used_at, display_name, profile_url, username, dao_address, role) VALUES ('7baa8a3e-b8e1-5458-8126-b493cbb4706b', 'USER#00000000-0000-0000-0000-000000000002', 'TEAM#d4004e2b-093a-41cc-9f21-b8fb3e5e9f61', 1764227900000, 'hiteam', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hiteam', NULL, '"member"');
INSERT INTO public.user_teams (id, user_pk, team_pk, last_used_at, display_name, profile_url, username, dao_address, role) VALUES ('4c153c53-97ea-5c34-b3ed-d1d3bff2bcdb', 'USER#00000000-0000-0000-0000-000000000003', 'TEAM#d4004e2b-093a-41cc-9f21-b8fb3e5e9f61', 1764227900000, 'hiteam', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hiteam', NULL, '"member"');
INSERT INTO public.user_teams (id, user_pk, team_pk, last_used_at, display_name, profile_url, username, dao_address, role) VALUES ('3de4b734-4469-55eb-8868-90e8998672e7', 'USER#00000000-0000-0000-0000-000000000004', 'TEAM#d4004e2b-093a-41cc-9f21-b8fb3e5e9f61', 1764227900000, 'hiteam', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hiteam', NULL, '"member"');


ALTER TABLE public.user_teams ENABLE TRIGGER ALL;

--
-- Data for Name: user_telegrams; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_telegrams DISABLE TRIGGER ALL;



ALTER TABLE public.user_telegrams ENABLE TRIGGER ALL;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.users DISABLE TRIGGER ALL;

INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('711f38d8-a264-5445-8e64-4ddaccbbd3f3', 1764227900000, 1764227900000, 'Admin User', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'admin@ratel.foundation', 'admin', NULL, true, true, 98, 0, 0, '', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);
INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('8bc31706-d73c-5928-b6df-60e8d2eca4a0', 1764227900000, 1764227900000, 'User1', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hi+user1@biyard.co', 'user1', NULL, true, true, 1, 0, 0, '', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);
INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('eaafdcfb-c6bf-5a86-ab0e-984ab89f6989', 1764227900000, 1764227900000, 'User2', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hi+user2@biyard.co', 'user2', NULL, true, true, 1, 0, 0, '', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);
INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('bf42bfcd-8ab0-5af8-9941-05d8c35e7c43', 1764227900000, 1764227900000, 'User3', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hi+user3@biyard.co', 'user3', NULL, true, true, 1, 0, 0, '', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);
INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('9e2d2085-42e3-520b-b5a3-385d33c1be2d', 1764227900000, 1764227900000, 'User4', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hi+user4@biyard.co', 'user4', NULL, true, true, 1, 0, 0, '', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);
INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('d35d2a75-8352-546f-89e1-41d751df2e40', 1764227900000, 1764227900000, 'User5', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hi+user5@biyard.co', 'user5', NULL, true, true, 1, 0, 0, '', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);
INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('82194bba-83e9-55d7-bc38-0e30f2a278a5', 1764227900000, 1764227900000, 'User6', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hi+user6@biyard.co', 'user6', NULL, true, true, 1, 0, 0, '', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);
INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('0b9986b2-39bc-5a5d-8a5a-b003a0666afa', 1764227900000, 1764227900000, 'User7', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hi+user7@biyard.co', 'user7', NULL, true, true, 1, 0, 0, '', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);
INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('2a5933f8-55da-5f27-8057-74c8a182d75d', 1764227900000, 1764227900000, 'User8', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hi+user8@biyard.co', 'user8', NULL, true, true, 1, 0, 0, '', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);
INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('ffd329f2-7ea5-5c54-9b94-882f66b83ce5', 1764227900000, 1764227900000, 'Guest1', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hi+anon1@biyard.co', 'anon1', NULL, true, true, 1, 0, 0, '건국대 여자', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);
INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('d60d5857-e068-5b51-b01b-2281ae656615', 1764227900000, 1764227900000, 'Creator1', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hi+admin1@biyard.co', 'admin1', NULL, true, true, 1, 0, 0, '공론조사 관리자', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);
INSERT INTO public.users (id, created_at, updated_at, display_name, profile_url, email, username, phone, term_agreed, informed_agreed, user_type, followers_count, followings_count, description, password, points, interstitial_seen, deleted_at) VALUES ('60bec3bd-8609-5472-85da-f29238f502e4', 1764227900000, 1764227900000, 'Creator2', 'https://metadata.ratel.foundation/ratel/default-profile.png', 'hi+admin2@biyard.co', 'admin2', NULL, true, true, 1, 0, 0, '공론조사 관리자', 'd590005c41712ddad6630ca03348fad16ce2fbfb611725116c14631ff02268d8', 0, false, NULL);


ALTER TABLE public.users ENABLE TRIGGER ALL;

--
-- Data for Name: verified_attributes; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.verified_attributes DISABLE TRIGGER ALL;



ALTER TABLE public.verified_attributes ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict Z9FE0mWepCy1M16cuK1JQlpnIcenTyragxVG2B0EVhdpk6AkrXNKcRlHd7jqmps

