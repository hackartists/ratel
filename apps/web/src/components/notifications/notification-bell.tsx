import { useUnreadCount } from "./context";

// app/ratel/src/features/notifications/components/notification_bell/component.rs.
// The outline bell uses `stroke: currentColor` so `.hud-btn svg` rules color it
// like its topbar siblings. The Rust `aria-label` is hardcoded English.

export interface NotificationBellProps {
  onClick: () => void;
  className?: string;
}

export function NotificationBell({ onClick, className = "" }: NotificationBellProps) {
  const { count } = useUnreadCount();
  const label = count >= 100 ? "99+" : String(count);

  return (
    <button
      className={`notification-bell ${className}`}
      aria-label="Notifications"
      data-testid="notification-bell"
      onClick={() => onClick()}
    >
      <svg
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="notification-bell__badge" data-testid="notification-bell-badge">
          {label}
        </span>
      )}
    </button>
  );
}
