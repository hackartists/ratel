import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileUploader } from "@/components/ui/file-uploader";
import { TeamArenaTab, useTeamArena, useTeamArenaTab } from "@/components/social/team-arena-context";
import { useTeamContext } from "@/components/social/use-team-context";
import { useTeamSettingsI18n } from "@/i18n/generated/features/social/pages/setting/team/views/team-settings.i18n";
import { useToast } from "@/lib/toast";
import { useTeamBilling, useTeamSettings } from "../hooks/use-team-settings";
import { digitsOnly, formatLocalDate, formatLocalDateTime, formatMembershipTierLabel } from "./format";

// app/ratel/src/features/social/pages/setting/team/views/mod.rs — `Home`
// (team variant of `SocialSetting`) and `TsSubscriptionCard`.

type Snapshot = [nickname: string, description: string, profileUrl: string];

export function TeamSettingsHome({ username }: { username: string }) {
  const tr = useTeamSettingsI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const teamCtx = useTeamContext();

  // Sync the arena topbar's active tab.
  useTeamArenaTab(TeamArenaTab.Settings);
  const arena = useTeamArena();

  const { team, updateTeam } = useTeamSettings(username);

  // Permission gate — viewers see a placeholder.
  const canEdit = team.role === "owner" || team.role === "admin";
  if (!canEdit) {
    return (
      <div className="ts-page">
        <div className="ts-card">
          <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "40px 20px" }}>
            {tr.noPermission}
          </p>
        </div>
      </div>
    );
  }

  return (
    <TeamSettingsForm
      username={username}
      team={team}
      updateTeam={updateTeam}
      onSaved={() => {
        toast.info(tr.saveSuccess);
        teamCtx.restartTeams();
        // Force the arena layout to refetch the team profile.
        arena.refresh();
      }}
      onDelete={async () => {
        // Goes through the context so the cached "YOUR TEAMS" list drops the row too.
        await teamCtx.deleteTeam(username);
        toast.info(tr.deleteSuccess);
        navigate("/");
      }}
    />
  );
}

interface TeamSettingsFormProps {
  username: string;
  team: ReturnType<typeof useTeamSettings>["team"];
  updateTeam: ReturnType<typeof useTeamSettings>["updateTeam"];
  onSaved: () => void;
  onDelete: () => Promise<void>;
}

function TeamSettingsForm({ username, team, updateTeam, onSaved, onDelete }: TeamSettingsFormProps) {
  const tr = useTeamSettingsI18n();
  const toast = useToast();

  const snap: Snapshot = [team.nickname, team.html_contents, team.profile_url ?? ""];
  const displayNameForDelete = team.nickname === "" ? team.username : team.nickname;

  const [nickname, setNickname] = useState(snap[0]);
  const [description, setDescription] = useState(snap[1]);
  const [profileUrl, setProfileUrl] = useState(snap[2]);
  const [baseline, setBaseline] = useState<Snapshot>(snap);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Re-sync the form when the server snapshot changes (after Save Changes).
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  useEffect(() => {
    const next: Snapshot = [team.nickname, team.html_contents, team.profile_url ?? ""];
    const prev = baselineRef.current;
    if (prev[0] !== next[0] || prev[1] !== next[1] || prev[2] !== next[2]) {
      setNickname(next[0]);
      setDescription(next[1]);
      setProfileUrl(next[2]);
      setBaseline(next);
    }
  }, [team.nickname, team.html_contents, team.profile_url]);

  const dirty = useMemo(
    () => nickname !== baseline[0] || description !== baseline[1] || profileUrl !== baseline[2],
    [nickname, description, profileUrl, baseline],
  );

  const onSave = () => {
    if (!dirty || saving) return;
    setSaving(true);
    void (async () => {
      try {
        await updateTeam({
          nickname,
          description,
          profile_url: profileUrl,
          dao_address: null,
          thumbnail_url: null,
        });
        onSaved();
      } catch (e) {
        toast.error(e);
      }
      setSaving(false);
    })();
  };

  const onConfirmDelete = () => {
    setSaving(true);
    void (async () => {
      try {
        await onDelete();
        setDeleteOpen(false);
      } catch (e) {
        toast.error(e);
      }
      setSaving(false);
    })();
  };

  return (
    <>
      <div className="ts-section-label">
        <span className="ts-section-label__dash" />
        <span className="ts-section-label__title">
          Team <strong>{tr.settingsLabel}</strong>
        </span>
        <span className="ts-section-label__dash" />
      </div>

      <div className="ts-page">
        {/* ── Profile card ── */}
        <div className="ts-card">
          <div className="ts-card__header">
            <span className="ts-card__title">{tr.teamProfile}</span>
            <span className="ts-card__dash" />
          </div>

          <div className="ts-field">
            <label className="ts-field__label">{tr.teamLogo}</label>
            <div className="ts-logo-row">
              {profileUrl !== "" ? (
                <img className="ts-logo-thumb" src={profileUrl} alt="team logo" />
              ) : (
                <div className="ts-logo-thumb">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.91 11.12L12 2L3.09 11.12c-.6.6-.6 1.57 0 2.17L11 21a2 2 0 0 0 2 0l7.91-7.71c.6-.6.6-1.57 0-2.17z" />
                    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
                  </svg>
                </div>
              )}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: 0, alignItems: "flex-start" }}
              >
                <FileUploader accept="image/*" onUploadSuccess={(url) => setProfileUrl(url)} className="ts-logo-upload-wrap">
                  <span className="ts-logo-upload-btn">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {tr.uploadLogo}
                  </span>
                </FileUploader>
                <span className="ts-field__hint">{tr.logoHint}</span>
              </div>
            </div>
          </div>

          <div className="ts-field">
            <label className="ts-field__label" htmlFor="ts-team-name">
              {tr.teamName}
            </label>
            <input
              id="ts-team-name"
              className="ts-field__input"
              type="text"
              value={nickname}
              placeholder={tr.teamNamePlaceholder}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div className="ts-field">
            <label className="ts-field__label" htmlFor="ts-team-desc">
              {tr.description}
            </label>
            <textarea
              id="ts-team-desc"
              className="ts-field__textarea"
              placeholder={tr.descriptionPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="ts-save-footer">
            <span className="ts-save-timestamp">
              {`${tr.lastSaved} `}
              <strong>{formatLocalDateTime(team.updated_at)}</strong>
            </span>
            <button className="ts-btn-primary" type="button" disabled={!dirty || saving} onClick={onSave}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {tr.saveChanges}
            </button>
          </div>
        </div>

        {/* ── Subscription & Billing ── */}
        <TsSubscriptionCard username={username} />

        {/* ── Danger zone ── */}
        <div className="ts-card ts-danger-card">
          <div className="ts-danger-card__header">
            <div className="ts-danger-card__left">
              <span className="ts-danger-card__title">{tr.dangerZone}</span>
              <span className="ts-danger-card__desc">{tr.dangerZoneDesc}</span>
            </div>
            <button className="ts-btn-danger" type="button" onClick={() => setDeleteOpen(true)}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
              {tr.deleteTeam}
            </button>
          </div>
        </div>
      </div>

      {/* ── Delete confirm modal ── */}
      {deleteOpen && (
        <div className="ts-modal-overlay" onClick={() => setDeleteOpen(false)}>
          <div className="ts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ts-modal__header">
              <span className="ts-modal__title">{tr.deleteTeamConfirmTitle}</span>
              <button className="ts-modal__close" type="button" aria-label="Close" onClick={() => setDeleteOpen(false)}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="ts-modal__body">
              <p className="ts-modal__desc">
                {tr.deleteConfirmPre}
                <strong>{displayNameForDelete}</strong>
                {tr.deleteConfirmPost}
              </p>
              <div className="ts-modal__actions">
                <button className="ts-modal__cancel" type="button" onClick={() => setDeleteOpen(false)}>
                  {tr.cancel}
                </button>
                <button className="ts-modal__confirm-danger" type="button" disabled={saving} onClick={onConfirmDelete}>
                  {tr.delete}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TsSubscriptionCard({ username }: { username: string }) {
  const tr = useTeamSettingsI18n();
  const toast = useToast();
  const { membership, billing, updateCard } = useTeamBilling(username);

  const tierLabel = formatMembershipTierLabel(membership.tier, tr.enterprise);
  const isFree = tierLabel.toLowerCase() === "free";
  const tierClass =
    tierLabel === "Pro"
      ? "ts-plan-badge ts-plan-badge--pro"
      : tierLabel === "Max"
        ? "ts-plan-badge ts-plan-badge--max"
        : tierLabel === "Vip"
          ? "ts-plan-badge ts-plan-badge--vip"
          : "ts-plan-badge";

  const [showCardForm, setShowCardForm] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [birthOrBiz, setBirthOrBiz] = useState("");
  const [cardPassword, setCardPassword] = useState("");
  const [cardSaving, setCardSaving] = useState(false);

  const isValid =
    cardNumber.trim() !== "" &&
    expiryMonth.trim() !== "" &&
    expiryYear.trim() !== "" &&
    birthOrBiz.trim() !== "" &&
    cardPassword.trim() !== "";

  const onSaveCard = async () => {
    if (!isValid || cardSaving) return;
    setCardSaving(true);
    try {
      await updateCard({
        card_number: cardNumber.trim(),
        expiry_year: expiryYear.trim(),
        expiry_month: expiryMonth.trim(),
        birth_or_business_registration_number: birthOrBiz.trim(),
        password_two_digits: cardPassword.trim(),
      });
      setCardNumber("");
      setExpiryMonth("");
      setExpiryYear("");
      setBirthOrBiz("");
      setCardPassword("");
      setShowCardForm(false);
      toast.info(tr.cardUpdated);
    } catch (e) {
      toast.error(e);
    }
    setCardSaving(false);
  };

  return (
    <div className="ts-card">
      <div className="ts-card__header">
        <span className="ts-card__title">{tr.subscriptionBilling}</span>
        <span className="ts-card__dash" />
      </div>

      <div className="ts-billing-row">
        <span className="ts-billing-row__label">{tr.currentPlan}</span>
        <div className="ts-billing-row__right">
          <span className={tierClass}>{tierLabel}</span>
          <Link className="ts-plan-change-link" data-testid="team-settings-view-membership" to={`/${username}/memberships`}>
            {tr.viewMembership}
          </Link>
          <Link className="ts-plan-change-link" data-testid="team-settings-change-plan" to={`/${username}/settings/subscription`}>
            {tr.changePlan}
          </Link>
        </div>
      </div>

      <div className="ts-billing-row">
        <span className="ts-billing-row__label">{tr.credits}</span>
        <div className="ts-billing-row__right">
          <span className="ts-credit-value">
            {membership.remaining_credits}
            <span>{` / ${membership.total_credits}`}</span>
          </span>
        </div>
      </div>

      {!isFree && (
        <>
          <div className="ts-billing-row">
            <span className="ts-billing-row__label">{tr.expires}</span>
            <div className="ts-billing-row__right">
              <span className="ts-credit-value">{formatLocalDate(membership.expired_at)}</span>
            </div>
          </div>
          {billing.maskedCardNumber != null && (
            <div className="ts-billing-row">
              <span className="ts-billing-row__label">{tr.card}</span>
              <div className="ts-billing-row__right">
                <span className="ts-credit-value">{billing.maskedCardNumber}</span>
              </div>
            </div>
          )}
          {billing.customerName !== "" && (
            <div className="ts-billing-row">
              <span className="ts-billing-row__label">{tr.cardHolder}</span>
              <div className="ts-billing-row__right">
                <span className="ts-credit-value">{billing.customerName}</span>
              </div>
            </div>
          )}
          <div className="ts-billing-row">
            <span className="ts-billing-row__label" />
            <div className="ts-billing-row__right">
              <button className="ts-logo-upload-btn" type="button" onClick={() => setShowCardForm(!showCardForm)}>
                {showCardForm ? tr.cancel : billing.hasCard ? tr.changeCard : tr.addCard}
              </button>
            </div>
          </div>

          {showCardForm && (
            <div className="ts-card-form">
              <div className="ts-field">
                <label className="ts-field__label">{tr.cardNumber}</label>
                <input
                  className="ts-field__input"
                  type="text"
                  placeholder="0000000000000000"
                  maxLength={16}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(digitsOnly(e.target.value))}
                />
              </div>
              <div className="ts-field-row">
                <div className="ts-field">
                  <label className="ts-field__label">{tr.expiryMonth}</label>
                  <input
                    className="ts-field__input"
                    type="text"
                    placeholder="MM"
                    maxLength={2}
                    value={expiryMonth}
                    onChange={(e) => setExpiryMonth(digitsOnly(e.target.value))}
                  />
                </div>
                <div className="ts-field">
                  <label className="ts-field__label">{tr.expiryYear}</label>
                  <input
                    className="ts-field__input"
                    type="text"
                    placeholder="YY"
                    maxLength={2}
                    value={expiryYear}
                    onChange={(e) => setExpiryYear(digitsOnly(e.target.value))}
                  />
                </div>
              </div>
              <div className="ts-field">
                <label className="ts-field__label">{tr.birthDate}</label>
                <input
                  className="ts-field__input"
                  type="text"
                  placeholder="YYMMDD"
                  maxLength={10}
                  value={birthOrBiz}
                  onChange={(e) => setBirthOrBiz(e.target.value)}
                />
              </div>
              <div className="ts-field">
                <label className="ts-field__label">{tr.cardPasswordLabel}</label>
                <input
                  className="ts-field__input"
                  type="password"
                  placeholder="••"
                  maxLength={2}
                  value={cardPassword}
                  onChange={(e) => setCardPassword(digitsOnly(e.target.value))}
                />
              </div>
              <div className="ts-save-footer">
                <span className="ts-save-timestamp" />
                <button
                  className="ts-btn-primary"
                  type="button"
                  disabled={!isValid || cardSaving}
                  onClick={() => void onSaveCard()}
                >
                  {cardSaving ? tr.savingCard : tr.saveCard}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
