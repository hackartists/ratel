import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAdminLayoutI18n } from "@/i18n/generated/features/admin/admin-layout.i18n";
import { useAuth } from "@/lib/auth";
import { useAdminLiteralsI18n } from "@/pages/admin/admin-literals.i18n";

/** Rust `UserType::SystemAdmin` (app/ratel/src/common/types/auth/user_type.rs). */
const SYSTEM_ADMIN = 98;

// app/ratel/src/features/admin/layout.rs (`AppLayout`, re-exported as
// `AdminLayout`) — the only router-level access gate. A SystemAdmin gets the
// arena chrome (back button + brand) around the outlet; anyone else, signed
// out included, is pushed to `/` and the layout renders nothing.
export function Component() {
  const tr = useAdminLayoutI18n();
  const lit = useAdminLiteralsI18n();
  const auth = useAuth();
  const navigate = useNavigate();

  // The Rust RootLayout suspends until the user context has loaded, so the
  // guard never sees an unresolved user.
  if (!auth.ready) return null;

  if (auth.userContext.user?.user_type !== SYSTEM_ADMIN) {
    // `nav.push("/")` — a push, not a replace.
    return <Navigate to="/" />;
  }

  return (
    <section className="admin-arena">
      <header className="admin-arena__topbar">
        <button
          className="admin-arena__back"
          type="button"
          data-testid="admin-back"
          aria-label={lit.text("back")}
          onClick={() => navigate(-1)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>{lit.text("back")}</span>
        </button>
        <div className="ff-admin-arena__brand">
          <div className="ff-admin-arena__brand-logo">{lit.text("brand_logo")}</div>
          <div className="ff-admin-arena__brand-text">
            <div className="ff-admin-arena__brand-name">{tr.brandName}</div>
          </div>
        </div>
      </header>
      <Outlet />
    </section>
  );
}
