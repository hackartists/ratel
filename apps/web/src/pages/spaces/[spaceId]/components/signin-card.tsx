import { LoginModal } from "@/components/auth";
import { useSpaceContext } from "@/components/space/space-context";
import { useSpaceViewerI18n } from "./space-viewer.i18n";
import { usePopup } from "@/lib/popup";

// app/ratel/src/features/spaces/pages/index/signin_card/component.rs (`SigninCard`):
// the login modal titled "Join the Movement"; a successful login restarts the space context.
export function SigninCard({
  participants,
  remaining,
  rewards,
}: {
  participants: string;
  remaining: string;
  rewards: string;
}) {
  const tr = useSpaceViewerI18n();
  const popup = usePopup();
  const ctx = useSpaceContext();

  return (
    <div className="participate-card" data-testid="card-signin">
      <span className="participate-card__heading">{tr.welcomeHeading}</span>
      <p className="participate-card__desc">{tr.welcomeDesc}</p>
      <div className="participate-card__stats">
        <div className="stat">
          <span className="stat__value">{participants}</span>
          <span className="stat__label">{tr.participants}</span>
        </div>
        {ctx.space.quota > 0 && (
          <div className="stat">
            <span className="stat__value">{remaining}</span>
            <span className="stat__label">{tr.remaining}</span>
          </div>
        )}
        <div className="stat">
          <span className="stat__value">{rewards}</span>
          <span className="stat__label">{tr.rewards}</span>
        </div>
      </div>
      <button
        className="cta-signin"
        data-testid="btn-signin"
        onClick={() => {
          popup.open(<LoginModal onSuccess={() => void ctx.restart()} />, { title: tr.loginTitle });
        }}
      >
        {tr.signIn}
      </button>
    </div>
  );
}
