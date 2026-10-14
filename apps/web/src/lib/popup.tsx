// app/ratel/src/common/components/popup — the single app-wide modal.
// Rust `popup.open(content).with_title(..).with_backdrop_close()` becomes
// `popup.open(content, { title, backdropClosable })`.
import * as React from "react";
import { Clear } from "@/components/icons/validations";
import { useScrollLock } from "@/lib/scroll-lock";

export interface PopupOptions {
  id?: string;
  title?: string;
  description?: string;
  /** Shows the close button (default true). */
  closable?: boolean;
  /** Clicking the backdrop closes the popup (default false). */
  backdropClosable?: boolean;
  /** Let content (e.g. dropdowns) escape the box instead of scrolling (default false). */
  overflow?: boolean;
}

interface PopupConfig extends Required<Omit<PopupOptions, "title" | "description">> {
  title?: string;
  description?: string;
  content: React.ReactNode;
}

export interface PopupService {
  isOpen: boolean;
  open(content: React.ReactNode, options?: PopupOptions): void;
  close(): void;
}

const PopupStateContext = React.createContext<PopupConfig | null>(null);
const PopupServiceContext = React.createContext<PopupService | null>(null);

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<PopupConfig | null>(null);
  const service = React.useMemo<PopupService>(
    () => ({
      isOpen: config !== null,
      open: (content, options = {}) =>
        setConfig({
          id: options.id ?? "popup-zone-1",
          title: options.title,
          description: options.description,
          content,
          closable: options.closable ?? true,
          backdropClosable: options.backdropClosable ?? false,
          overflow: options.overflow ?? false,
        }),
      close: () => setConfig(null),
    }),
    [config !== null],
  );
  return (
    <PopupServiceContext.Provider value={service}>
      <PopupStateContext.Provider value={config}>{children}</PopupStateContext.Provider>
    </PopupServiceContext.Provider>
  );
}

export function usePopup(): PopupService {
  const service = React.useContext(PopupServiceContext);
  if (!service) throw new Error("usePopup must be used inside PopupProvider");
  return service;
}

/** Renders the open popup (or nothing). Mounted once, after the route outlet. */
export function PopupZone() {
  const config = React.useContext(PopupStateContext);
  const popup = usePopup();
  useScrollLock(config !== null);
  if (!config) return null;

  // Default popups cap their height to the viewport (following the keyboard)
  // and scroll the inner content; `overflow` popups let content escape.
  const boxOverflow = config.overflow ? "overflow-visible" : "popup-box-capped overflow-hidden";
  const contentOverflow = config.overflow ? "" : "overflow-y-auto overflow-x-hidden min-h-0";

  return (
    <div
      // `popup-backdrop` (not `h-screen`) subtracts `--kb-inset` so centering
      // happens within the visible area on Android; the translate counters
      // iOS WKWebView's keyboard-avoidance shift.
      className="flex fixed top-0 left-0 justify-center items-center w-screen popup-backdrop bg-popup-background backdrop-blur-[10px] z-[101] bg-no-s"
      style={{ transform: "translateY(var(--vv-offset-top, 0px))" }}
      onClick={() => {
        if (config.backdropClosable) popup.close();
      }}
    >
      <div
        className={`flex relative flex-col rounded-[20px] p-[25px] min-w-[300px] max-mobile:!w-full max-mobile:!mx-[20px] bg-popover text-text-primary ${boxOverflow}`}
        style={{ boxShadow: "0px 0px 100px rgba(255, 206, 71, 0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {config.closable && (
          <button
            className="absolute bg-transparent rounded-sm cursor-pointer group top-[25px] right-[25px] hover:bg-secondary"
            onClick={() => popup.close()}
          >
            <Clear className="[&>path]:stroke-icon-primary group-hover:[&>path]:stroke-icon-primary" />
          </button>
        )}
        <div id={config.id} className={`flex flex-col items-center gap-[25px] w-full ${contentOverflow}`}>
          {config.title !== undefined && <div className="font-bold text-[20px] text-text-primary">{config.title}</div>}
          {config.description !== undefined && (
            // `.popup-description` caps the width (main.css).
            <div className="popup-description whitespace-pre-line text-text-primary-muted">{config.description}</div>
          )}
          {config.content}
        </div>
      </div>
    </div>
  );
}
