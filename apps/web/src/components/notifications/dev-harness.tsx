import { useState } from "react";
import { PremiumSwitch } from "@/components/ui/premium-switch";
import { useUserContext } from "@/lib/auth";
import { NotificationBell } from "./notification-bell";
import { NotificationPanel } from "./notification-panel";
import { SpaceNotificationsProvider } from "./context";

// DEV-ONLY test harness. No ported page shows the bell yet (in Rust: the home
// view `/` and `SpaceIndexPage`), so pages/not-found mounts this in `vite dev`
// when the URL has `?__notifications_harness=1`; production builds compile it
// out. It renders what the home view renders for a signed-in user — the bell
// in a `hud-btn` toggling the panel — plus a `PremiumSwitch`.
// `&space_id=<id>` wraps it in a space scope, like `SpaceIndexPage`.

export default function NotificationsHarness({ spaceId }: { spaceId: string | null }) {
  const hasUser = useUserContext().user !== null;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);

  const content = (
    <>
      {hasUser && <NotificationBell className="hud-btn" onClick={() => setOpen((o) => !o)} />}
      {hasUser && <NotificationPanel open={open} onClose={() => setOpen(false)} />}
      {hasUser && (
        <div data-testid="premium-switch-harness">
          <PremiumSwitch active={active} onToggle={() => setActive((a) => !a)} label="Harness" />
        </div>
      )}
    </>
  );

  return spaceId ? <SpaceNotificationsProvider spaceId={spaceId}>{content}</SpaceNotificationsProvider> : content;
}
