import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, BadgeColor } from "@/components/ui/badge";
import { Button, ButtonSize, ButtonStyle } from "@/components/ui/button";
import { Card, CardVariant } from "@/components/ui/card";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input, InputType } from "@/components/ui/input";
import { CrossAxisAlign, MainAxisAlign } from "@/components/ui/layout";
import { Row } from "@/components/ui/row";
import { TextArea } from "@/components/ui/textarea";
import { useUserSettingsI18n } from "@/i18n/generated/features/social/pages/setting/user/views/user-settings.i18n";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/server-error";
import { useChangePassword, useMcpSecret, useUserBilling, useUserDetail } from "../hooks/use-user-settings";
import { digitsOnly, formatMembershipTierLabel, formatUtcDate } from "./format";

// app/ratel/src/features/social/pages/setting/user/views/mod.rs — `Home`
// (user variant of `SocialSetting`) with the Password, Subscription & Billing
// and MCP Server cards. The Password and Subscription cards hardcode their
// English copy in Rust; it is copied verbatim.

type Message = [text: string, success: boolean];

const messageClass = (success: boolean) => (success ? "text-sm text-banner-success-text" : "text-sm text-destructive");

/** `is_blocked_text`. */
function isBlockedText(value: string): boolean {
  return value.toLowerCase().includes("test") || value.includes("테스트");
}

export function UserSettingsHome() {
  const tr = useUserSettingsI18n();
  const { userContext } = useAuth();
  const user = userContext.user;

  if (!user) {
    return (
      <div className="flex flex-col justify-center items-center py-10 w-full h-full">
        <p className="text-foreground-muted">{tr.loginRequired}</p>
      </div>
    );
  }
  return <UserSettingsForm key={user.id} />;
}

function UserSettingsForm() {
  const tr = useUserSettingsI18n();
  const auth = useAuth();
  const user = auth.userContext.user!;
  const { detail, updateProfile } = useUserDetail();

  const [profileUrl, setProfileUrl] = useState(user.profile_url);
  const [nickname, setNickname] = useState(user.display_name);
  const [description, setDescription] = useState(user.description);
  const [userEmail] = useState(detail.email);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const onSaveProfile = () => {
    const nick = nickname.trim();
    const desc = description.trim();
    if (isBlockedText(nick) || isBlockedText(desc)) {
      setMessage([tr.invalidWords, false]);
      return;
    }
    void (async () => {
      setSaving(true);
      setMessage(null);
      try {
        const resp = await updateProfile({ nickname: nick, profile_url: profileUrl, description: desc });
        setSaving(false);
        const ctx = auth.userContext;
        if (ctx.user) {
          auth.setUserContext({
            ...ctx,
            user: {
              ...ctx.user,
              display_name: resp.user.display_name,
              profile_url: resp.user.profile_url,
              description: resp.user.description,
            },
          });
        }
        setMessage([tr.profileUpdated, true]);
      } catch (e) {
        setSaving(false);
        setMessage([`Failed to update profile: ${errorMessage(e)}`, false]);
      }
    })();
  };

  const saveBlocked = isBlockedText(nickname) || isBlockedText(description);

  return (
    <div className="flex flex-col gap-6 px-4 mx-auto mt-5 w-full max-w-[800px]">
      <h1 className="text-xl font-bold text-text-primary">{tr.settings}</h1>

      {/* Card 1: Profile */}
      <Card variant={CardVariant.Outlined} className="p-6">
        <div className="flex flex-col gap-5 w-full">
          <h2 className="text-lg font-bold text-text-primary">{tr.profile}</h2>

          <div className="flex gap-4 items-center">
            <FileUploader onUploadSuccess={(url) => setProfileUrl(url)} accept="image/*">
              {profileUrl === "" ? (
                <div className="flex justify-center items-center w-16 h-16 text-xs rounded-full cursor-pointer bg-card-bg text-foreground-muted">
                  {tr.upload}
                </div>
              ) : (
                <img src={profileUrl} alt="Profile" className="object-cover w-16 h-16 rounded-full cursor-pointer" />
              )}
            </FileUploader>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-text-primary">{user.display_name}</span>
              <span className="text-xs text-foreground-muted">{`@${user.username}`}</span>
            </div>
          </div>

          <SettingsRow label={tr.username}>
            <Input value={`@${user.username}`} disabled readOnly />
          </SettingsRow>

          <SettingsRow label={tr.email}>
            <Input value={userEmail} disabled readOnly />
          </SettingsRow>

          <SettingsRow label={tr.displayName}>
            <Input
              value={nickname}
              placeholder={tr.displayNamePlaceholder}
              maxLength={30}
              onChange={(e) => setNickname(e.target.value)}
            />
          </SettingsRow>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-text-primary">{tr.description}</label>
            <TextArea
              value={description}
              placeholder={tr.descriptionPlaceholder}
              className="resize-y min-h-[100px]"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {message && <div className={messageClass(message[1])}>{message[0]}</div>}

          <div className="flex justify-end">
            <Button buttonStyle={ButtonStyle.Primary} disabled={saving || saveBlocked} onClick={onSaveProfile}>
              {saving ? tr.saving : tr.save}
            </Button>
          </div>
        </div>
      </Card>

      {/* Card 2: Password */}
      <Card variant={CardVariant.Outlined} className="p-6">
        <PasswordCard />
      </Card>

      {/* Card 3: Subscription & Billing */}
      <Card variant={CardVariant.Outlined} className="p-6">
        <SubscriptionCard />
      </Card>

      {/* Card 4: MCP Server */}
      <Card variant={CardVariant.Outlined} className="p-6">
        <McpServerCard />
      </Card>
    </div>
  );
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-text-primary">{label}</label>
      {children}
    </div>
  );
}

function PasswordCard() {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const onChange = () => {
    const current = currentPassword.trim();
    const newPw = newPassword.trim();
    const confirm = confirmPassword.trim();

    if (current === "" || newPw === "" || confirm === "") {
      setMessage(["All fields are required.", false]);
      return;
    }
    // Rust `String::len()` counts UTF-8 bytes.
    if (new TextEncoder().encode(newPw).length < 8) {
      setMessage(["Password must be at least 8 characters.", false]);
      return;
    }
    if (newPw !== confirm) {
      setMessage(["Passwords do not match.", false]);
      return;
    }

    void (async () => {
      setSaving(true);
      setMessage(null);
      try {
        await changePassword({ current_password: current, new_password: newPw });
        setSaving(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setMessage(["Password changed successfully.", true]);
      } catch (e) {
        setSaving(false);
        setMessage([errorMessage(e), false]);
      }
    })();
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      <h2 className="text-lg font-bold text-text-primary">Password</h2>

      <SettingsRow label="Current Password">
        <Input
          type={InputType.Password}
          placeholder="Enter current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </SettingsRow>

      <SettingsRow label="New Password">
        <Input
          type={InputType.Password}
          placeholder="Min 8 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </SettingsRow>

      <SettingsRow label="Confirm Password">
        <Input
          type={InputType.Password}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </SettingsRow>

      {message && <div className={messageClass(message[1])}>{message[0]}</div>}

      <div className="flex justify-end">
        <Button buttonStyle={ButtonStyle.Secondary} disabled={saving} onClick={onChange}>
          {saving ? "Changing..." : "Change Password"}
        </Button>
      </div>
    </div>
  );
}

function SubscriptionCard() {
  const tr = useUserSettingsI18n();
  const { membership, billing, updateCard } = useUserBilling();

  const tierLabel = formatMembershipTierLabel(membership.tier, tr.enterprise);
  const isFree = tierLabel.toLowerCase() === "free";
  const expiryText = membership.expired_at === 0 ? "Unlimited" : formatUtcDate(membership.expired_at);

  const [showCardForm, setShowCardForm] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [birthOrBiz, setBirthOrBiz] = useState("");
  const [cardPassword, setCardPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [cardMessage, setCardMessage] = useState<Message | null>(null);

  const isValid =
    cardNumber.trim() !== "" &&
    expiryMonth.trim() !== "" &&
    expiryYear.trim() !== "" &&
    birthOrBiz.trim() !== "" &&
    cardPassword.trim() !== "";

  const onSaveCard = () => {
    const info = {
      card_number: cardNumber.trim(),
      expiry_year: expiryYear.trim(),
      expiry_month: expiryMonth.trim(),
      birth_or_business_registration_number: birthOrBiz.trim(),
      password_two_digits: cardPassword.trim(),
    };
    void (async () => {
      setSaving(true);
      setCardMessage(null);
      try {
        await updateCard(info);
        setCardNumber("");
        setExpiryMonth("");
        setExpiryYear("");
        setBirthOrBiz("");
        setCardPassword("");
        setShowCardForm(false);
        setCardMessage(["Card updated successfully.", true]);
      } catch (e) {
        setCardMessage([errorMessage(e), false]);
      }
      setSaving(false);
    })();
  };

  const badgeColor =
    tierLabel === "Pro"
      ? BadgeColor.Blue
      : tierLabel === "Max"
        ? BadgeColor.Purple
        : tierLabel === "Vip"
          ? BadgeColor.Orange
          : BadgeColor.Grey;

  return (
    <div className="flex flex-col gap-5 w-full">
      <h2 className="text-lg font-bold text-text-primary">Subscription &amp; Billing</h2>

      <div className="flex flex-col gap-3">
        <Row mainAxisAlign={MainAxisAlign.Between} crossAxisAlign={CrossAxisAlign.Center}>
          <span className="text-sm text-foreground-muted">Current Plan</span>
          <Row className="gap-2" crossAxisAlign={CrossAxisAlign.Center}>
            <Badge color={badgeColor}>{tierLabel}</Badge>
            <Link to="/membership" className="text-xs no-underline hover:underline text-primary">
              Change Plan
            </Link>
          </Row>
        </Row>
        {!isFree ? (
          <>
            <Row mainAxisAlign={MainAxisAlign.Between}>
              <span className="text-sm text-foreground-muted">Credits</span>
              <span className="text-sm text-text-primary">{`${membership.remaining_credits} / ${membership.total_credits}`}</span>
            </Row>
            <Row mainAxisAlign={MainAxisAlign.Between}>
              <span className="text-sm text-foreground-muted">Expires</span>
              <span className="text-sm text-text-primary">{expiryText}</span>
            </Row>
          </>
        ) : (
          <Row mainAxisAlign={MainAxisAlign.Between}>
            <span className="text-sm text-foreground-muted">Credits</span>
            <span className="text-sm text-text-primary">{`0 / ${membership.total_credits}`}</span>
          </Row>
        )}
        {!isFree && (
          <>
            {billing.maskedCardNumber != null && (
              <Row mainAxisAlign={MainAxisAlign.Between}>
                <span className="text-sm text-foreground-muted">Card</span>
                <span className="text-sm text-text-primary">{billing.maskedCardNumber}</span>
              </Row>
            )}
            {billing.customerName !== "" && (
              <Row mainAxisAlign={MainAxisAlign.Between}>
                <span className="text-sm text-foreground-muted">Card Holder</span>
                <span className="text-sm text-text-primary">{billing.customerName}</span>
              </Row>
            )}
            <div className="flex justify-end pt-1">
              <Button buttonStyle={ButtonStyle.Secondary} onClick={() => setShowCardForm(!showCardForm)}>
                {showCardForm ? "Cancel" : billing.hasCard ? "Change Card" : "Add Card"}
              </Button>
            </div>
          </>
        )}
      </div>

      {!isFree && (
        <>
          {cardMessage && <div className={messageClass(cardMessage[1])}>{cardMessage[0]}</div>}

          {showCardForm && (
            <div className="flex flex-col gap-4 p-4 border rounded-[10px] border-border">
              <SettingsRow label="Card Number">
                <Input
                  placeholder="0000000000000000"
                  maxLength={16}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(digitsOnly(e.target.value))}
                />
              </SettingsRow>
              <div className="flex gap-3">
                <div className="flex flex-col flex-1 gap-1.5">
                  <label className="text-sm font-semibold text-text-primary">Expiry Month</label>
                  <Input
                    placeholder="MM"
                    maxLength={2}
                    value={expiryMonth}
                    onChange={(e) => setExpiryMonth(digitsOnly(e.target.value))}
                  />
                </div>
                <div className="flex flex-col flex-1 gap-1.5">
                  <label className="text-sm font-semibold text-text-primary">Expiry Year</label>
                  <Input
                    placeholder="YY"
                    maxLength={2}
                    value={expiryYear}
                    onChange={(e) => setExpiryYear(digitsOnly(e.target.value))}
                  />
                </div>
              </div>
              <SettingsRow label="Birth Date (YYMMDD)">
                <Input
                  placeholder="YYMMDD"
                  maxLength={10}
                  value={birthOrBiz}
                  onChange={(e) => setBirthOrBiz(digitsOnly(e.target.value))}
                />
              </SettingsRow>
              <SettingsRow label="Card Password (first 2 digits)">
                <Input
                  type={InputType.Password}
                  className="w-20"
                  placeholder="••"
                  maxLength={2}
                  value={cardPassword}
                  onChange={(e) => setCardPassword(digitsOnly(e.target.value))}
                />
              </SettingsRow>
              <div className="flex justify-end">
                <Button buttonStyle={ButtonStyle.Primary} disabled={!isValid || saving} onClick={onSaveCard}>
                  {saving ? "Saving..." : "Save Card"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** `use_origin()`: the backend base URL in the Tauri build, the page origin on the web. */
function useOrigin(): string {
  const [origin] = useState(() => {
    if (import.meta.env.VITE_TAURI === "1") return import.meta.env.VITE_MOBILE_API_URL ?? "https://dev.ratel.foundation";
    return typeof window === "undefined" ? "" : window.location.origin;
  });
  return origin;
}

function McpServerCard() {
  const tr = useUserSettingsI18n();
  const { hasSecret, regenerate } = useMcpSecret();

  // Holds the raw token only right after generation (not persisted across reloads).
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mcpMessage, setMcpMessage] = useState<Message | null>(null);
  const origin = useOrigin();

  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onGenerate = () => {
    void (async () => {
      setGenerating(true);
      setMcpMessage(null);
      try {
        const resp = await regenerate();
        setRawToken(resp.secret);
      } catch (e) {
        setMcpMessage([errorMessage(e), false]);
      }
      setGenerating(false);
    })();
  };

  const mcpUrl = rawToken !== null ? `${origin}/mcp/${rawToken}` : null;

  const onCopy = () => {
    if (mcpUrl === null) return;
    void (async () => {
      try {
        await navigator.clipboard.writeText(mcpUrl);
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 2000);
      } catch {
        setMcpMessage(["Failed to copy to clipboard. Please copy it manually.", false]);
      }
    })();
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      <h2 className="text-lg font-bold text-text-primary">{tr.mcpServer}</h2>
      <p className="text-sm text-foreground-muted">{tr.mcpDescription}</p>

      {mcpUrl !== null ? (
        // Just generated — show the full URL with copy button
        <SettingsRow label={tr.mcpServerUrl}>
          <div className="flex gap-2 items-center">
            <Input value={mcpUrl} disabled readOnly />
            <Button buttonStyle={ButtonStyle.Secondary} size={ButtonSize.Small} onClick={onCopy}>
              {copied ? tr.mcpCopied : tr.mcpCopy}
            </Button>
          </div>
        </SettingsRow>
      ) : hasSecret ? (
        <p className="text-sm italic text-foreground-muted">{tr.mcpSecretExists}</p>
      ) : (
        <p className="text-sm italic text-foreground-muted">{tr.mcpNotGenerated}</p>
      )}

      {mcpMessage && <div className={messageClass(mcpMessage[1])}>{mcpMessage[0]}</div>}

      <div className="flex justify-end">
        <Button
          buttonStyle={hasSecret ? ButtonStyle.Secondary : ButtonStyle.Primary}
          disabled={generating}
          onClick={onGenerate}
        >
          {generating ? tr.mcpGenerating : hasSecret ? tr.mcpRegenerate : tr.mcpGenerate}
        </Button>
      </div>
    </div>
  );
}
