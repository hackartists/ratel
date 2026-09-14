import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ApplyContextDocument } from "@ratel/ts-bridges";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, ListChecks, Send, Users } from "@/components/icons/lucide";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useSubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";
import { dataBool } from "@/lib/dom";
import { useFindTeam } from "@ratel/ts-bridges/hooks";
import { DocAgreementModal } from "./components/doc-agreement-modal";
import { EligibilityItem } from "./components/eligibility-item";
import { FieldRow } from "./components/field-row";
import { useSubTeamApply } from "./hooks/use-sub-team-apply";

// app/ratel/src/features/sub_team/pages/apply/component.rs (`TeamSubTeamApplyPage`,
// `/:username/sub-teams/apply`). Full-screen page OUTSIDE SocialLayout — owns its
// own back/brand topbar. `:username` names the PARENT team being applied to.
export function Component() {
  const t = useSubTeamI18n();
  const { username = "" } = useParams<{ username: string }>();

  // team-context: no shared team context in React yet — each page that
  // needs the route's team data loads it locally via `useFindTeam`.
  const teamQuery = useFindTeam(username);
  if (teamQuery.data === undefined) return null;

  const teamData = teamQuery.data;
  const teamDisplay = teamData.nickname || teamData.username;
  const teamHandle = teamData.username;
  const teamId = teamData.pk.replace(/^TEAM#/, "");

  return (
    <>
      <SeoMeta title={t.applyPageTitle} />
      <ApplyForm username={username} teamDisplay={teamDisplay} teamHandle={teamHandle} parentTeamId={teamId} />
    </>
  );
}

function ApplyForm({
  username,
  teamDisplay,
  teamHandle,
  parentTeamId,
}: {
  username: string;
  teamDisplay: string;
  teamHandle: string;
  parentTeamId: string;
}) {
  const t = useSubTeamI18n();
  const navigate = useNavigate();
  const ctx = useSubTeamApply(parentTeamId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeDocIdx, setActiveDocIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!ctx.ready) return null;

  const context = ctx.applyContext;
  const formFields = context.form_fields;
  const requiredDocs = context.required_docs;
  const myTeamsList = ctx.myTeams;
  const currentApplicant = ctx.applicantTeamId;

  const selectedTeam = myTeamsList.find((team) => team.pk.replace(/^TEAM#/, "") === currentApplicant);
  const selectedTeamName = selectedTeam ? selectedTeam.nickname || selectedTeam.username : t.applyPickerPlaceholder;
  const selectedTeamHandle = selectedTeam ? `@${selectedTeam.username}` : "";

  const requiredFieldCount = formFields.filter((f) => f.required).length;
  const requiredFilledCount = formFields.filter((f) => {
    if (!f.required) return false;
    const v = ctx.formValues[f.id];
    if (typeof v === "string") return v.trim() !== "";
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "number") return true;
    if (typeof v === "boolean") return v;
    return v !== undefined && v !== null;
  }).length;

  const agreedSnapshot = ctx.agreedDocIds;
  const requiredDocTotal = requiredDocs.filter((d) => d.required).length;
  const agreedCount = requiredDocs.filter((d) => d.required && agreedSnapshot[d.id] !== undefined).length;
  const docsMet = requiredDocTotal === 0 || agreedCount === requiredDocTotal;
  const formMet = requiredFilledCount === requiredFieldCount;

  const applicantMemberCount = selectedTeam?.member_count ?? 0;
  const applicantCreatedAt = selectedTeam?.created_at ?? 0;
  const minMembersMet = context.min_sub_team_members <= 0 || applicantMemberCount >= context.min_sub_team_members;
  const minDaysMet =
    context.min_sub_team_age_days <= 0
      ? true
      : applicantCreatedAt <= 0
        ? false
        : Math.max(0, Math.floor((Date.now() - applicantCreatedAt) / 86_400_000)) >= context.min_sub_team_age_days;
  const adminMet = selectedTeam !== undefined;

  const metFlags = [adminMet, minMembersMet, minDaysMet, docsMet, formMet];
  const metCount = metFlags.filter(Boolean).length;
  const totalCount = 5;
  const progressPct = Math.round((metCount / totalCount) * 100);
  const eligibilityMet = context.is_parent_eligible && metCount === totalCount;

  const selectedDoc: ApplyContextDocument | undefined = activeDocIdx !== null ? requiredDocs[activeDocIdx] : undefined;
  const modalOpen = selectedDoc !== undefined;
  const modalDoc: ApplyContextDocument = selectedDoc ?? {
    id: "",
    title: "",
    body: "",
    body_hash: "",
    order: 0,
    required: false,
    attachments: [],
  };
  const modalAlreadyAgreed = selectedDoc !== undefined && agreedSnapshot[selectedDoc.id] !== undefined;
  const modalIndex = activeDocIdx !== null ? activeDocIdx + 1 : 0;
  const modalTotal = requiredDocs.length;

  return (
    <>
      <div className="sub-team-apply">
        <div className="arena-topbar">
          <div className="arena-topbar__brand">
            <button
              className="brand-home"
              aria-label="Back"
              onClick={() => navigate(`/${username}`, { replace: true })}
            >
              <ChevronLeft className="w-4 h-4 [&>path]:stroke-current" />
            </button>
            <span className="brand-home__divider" />
            <div className="arena-topbar__logo">{teamDisplay.slice(0, 3).toUpperCase()}</div>
            <div className="u-col">
              <span className="arena-topbar__title">{teamDisplay}</span>
              <span className="arena-topbar__handle">{t.applyPageEyebrow}</span>
            </div>
            <span className="arena-topbar__status arena-topbar__status--scheduled">{t.applyStatusDrafting}</span>
          </div>
        </div>

        <div className="page page--wide">
          <div className="page-header">
            <div className="page-header__main">
              <span className="page-header__eyebrow">
                <Users className="w-3 h-3 [&>path]:stroke-current" />
                {t.applyPageEyebrow}
              </span>
              <h1 className="page-header__title">
                <strong>{teamDisplay}</strong>
                {t.applyTargetLabel}
              </h1>
              <p className="page-header__sub">{t.applyPageHeaderSub}</p>
            </div>
          </div>

          <div className="target-summary">
            <div className="target-summary__avatar">{teamDisplay.slice(0, 3).toUpperCase()}</div>
            <div className="target-summary__body">
              <div className="target-summary__label">{t.applyTargetLabel}</div>
              <div className="target-summary__name">{teamDisplay}</div>
              <div className="target-summary__handle">@{teamHandle}</div>
            </div>
          </div>

          <div className="team-picker">
            <label className="team-picker__label">{t.applyPickYourTeam}</label>
            <div className="team-dropdown">
              <button
                className="team-dropdown__trigger"
                data-testid="sub-team-apply-picker-trigger"
                type="button"
                aria-expanded={dataBool(pickerOpen)}
                onClick={() => setPickerOpen((v) => !v)}
              >
                <div className="team-dropdown__body">
                  <span className="team-dropdown__name">{selectedTeamName}</span>
                  {selectedTeamHandle !== "" && <span className="team-dropdown__meta">{selectedTeamHandle}</span>}
                </div>
                <ChevronDown className="w-4 h-4 [&>path]:stroke-current team-dropdown__chev" />
              </button>
              {pickerOpen && myTeamsList.length > 0 && (
                <div className="team-dropdown__menu" data-open="true" role="listbox">
                  {myTeamsList.map((team) => {
                    const teamPk = team.pk.replace(/^TEAM#/, "");
                    const isSelected = teamPk === currentApplicant;
                    const teamName = team.nickname || team.username;
                    return (
                      <button
                        key={team.pk}
                        type="button"
                        className="team-dropdown__item"
                        data-testid={`sub-team-apply-picker-item-${team.username}`}
                        aria-selected={dataBool(isSelected)}
                        onClick={() => {
                          ctx.setApplicantTeamId(teamPk);
                          setPickerOpen(false);
                        }}
                      >
                        <div className="team-dropdown__body">
                          <span className="team-dropdown__name">{teamName}</span>
                          <span className="team-dropdown__meta">@{team.username}</span>
                        </div>
                        {isSelected && (
                          <span className="team-dropdown__check">
                            <Check className="w-3 h-3 [&>path]:stroke-current" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {!context.is_parent_eligible && <div className="notice notice--warn">{t.applyParentEligibleOff}</div>}

          <div className="apply-grid">
            <div className="composer-col">
              {requiredDocs.length > 0 && (
                <div className="req-docs" id="req-docs">
                  <div className="req-docs__head">
                    <span className="req-docs__title">
                      <FileText className="w-3 h-3 [&>path]:stroke-current" />
                      {t.applyRequiredDocs}
                    </span>
                    <span className="req-docs__progress" data-all-read={dataBool(docsMet)}>
                      {agreedCount} / {requiredDocTotal}
                    </span>
                  </div>
                  {requiredDocs.map((doc, idx) => {
                    const agreed = agreedSnapshot[doc.id] !== undefined;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        className="req-doc"
                        data-agreed={dataBool(agreed)}
                        data-required={dataBool(doc.required)}
                        data-id={doc.id}
                        data-testid="sub-team-apply-req-doc"
                        onClick={() => setActiveDocIdx(idx)}
                      >
                        <span className="req-doc__badge">{doc.required ? t.bylawsRequiredBadge : t.applyDocReferenceBadge}</span>
                        <span className="req-doc__title">{doc.title}</span>
                        <span className="req-doc__status">
                          {doc.required ? (
                            agreed ? (
                              <>
                                <Check className="w-3 h-3 [&>path]:stroke-current" />
                                {t.applyDocsAgreed}
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 [&>path]:stroke-current" />
                                {t.applyDocsOpenReview}
                              </>
                            )
                          ) : (
                            <>
                              <FileText className="w-3 h-3 [&>path]:stroke-current" />
                              {t.applyDocViewOpen}
                            </>
                          )}
                        </span>
                        <span className="req-doc__chev">
                          <ChevronRight className="w-3 h-3 [&>path]:stroke-current" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="composer-card">
                <div className="composer-meta">
                  <div className="composer-meta__selected">
                    <span>{selectedTeamName}</span>
                  </div>
                  <span className="composer-meta__arrow">
                    <ChevronRight className="w-3 h-3 [&>path]:stroke-current" />
                  </span>
                  <div className="composer-meta__selected">
                    <span className="composer-meta__target">{teamDisplay}</span>
                  </div>
                </div>
                <div className="composer-card__title">
                  <ListChecks className="w-3 h-3 [&>path]:stroke-current" />
                  {t.applyFormFields}
                </div>
                {formFields.map((field) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    value={ctx.formValues[field.id]}
                    onChange={ctx.setFieldValue}
                  />
                ))}
              </div>

              <div className="submit-bar">
                <div className="submit-bar__status">
                  <div className={eligibilityMet ? "submit-bar__title submit-bar__title--ready" : "submit-bar__title"}>
                    {t.applySubmitProgressPrefix} {metCount} / {totalCount} {t.applySubmitProgressSuffix}
                  </div>
                  <div className="submit-bar__sub">{eligibilityMet ? t.applySubmit : t.applySubmitSub}</div>
                </div>
                <button className="btn btn--ghost" type="button" onClick={() => navigate(`/${username}`, { replace: true })}>
                  {t.cancel}
                </button>
                <button
                  className="btn btn--primary"
                  id="submit-btn"
                  data-testid="sub-team-apply-submit-btn"
                  disabled={!eligibilityMet || submitting}
                  onClick={() => {
                    if (!eligibilityMet || submitting) return;
                    setSubmitting(true);
                    void ctx
                      .submit()
                      .then(() => {
                        navigate(`/${username}/sub-teams/application`, { replace: true });
                      })
                      .catch(() => {
                        setSubmitting(false);
                      });
                  }}
                >
                  <Send className="w-3 h-3 [&>path]:stroke-current" />
                  {t.applySubmit}
                </button>
              </div>
            </div>

            <aside className="eligibility-col">
              <div className="eligibility-panel">
                <div className="eligibility-panel__title">
                  <Check className="w-3 h-3 [&>path]:stroke-current" />
                  {t.applyEligibilityTitle}
                </div>

                <div className="elig-progress">
                  <div className="elig-progress__top">
                    <span>{t.applyProgressLabel}</span>
                    <span className={eligibilityMet ? "elig-progress__fraction elig-progress__fraction--ready" : "elig-progress__fraction"}>
                      {metCount} / {totalCount}
                    </span>
                  </div>
                  <div className="elig-progress__track">
                    <div className="elig-progress__fill" style={{ width: `${progressPct}%` }} data-ready={dataBool(eligibilityMet)} />
                  </div>
                </div>

                <div className="elig-list">
                  <EligibilityItem met={adminMet} title={t.applyEligAdminTitle} desc={t.applyEligAdminDesc} />
                  <EligibilityItem met={minMembersMet} title={t.applyEligMinMembers} desc={t.applyEligMinMembersDesc} />
                  <EligibilityItem met={minDaysMet} title={t.applyEligMinDaysTitle} desc={t.applyEligMinDaysDesc} />
                  <EligibilityItem met={docsMet} title={t.applyEligDocsAgreed} desc={t.applyEligDocsDesc} />
                  <EligibilityItem met={formMet} title={t.applyEligFormFilled} desc={t.applyEligFormDesc} />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <DocAgreementModal
        open={modalOpen}
        doc={modalDoc}
        alreadyAgreed={modalAlreadyAgreed}
        index={modalIndex}
        total={modalTotal}
        onCancel={() => setActiveDocIdx(null)}
        onAgree={() => {
          if (selectedDoc !== undefined) {
            ctx.agreeDoc(selectedDoc.id, selectedDoc.body_hash);
          }
          setActiveDocIdx(null);
        }}
      />
    </>
  );
}
