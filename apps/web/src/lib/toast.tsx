// app/ratel/src/common/providers/toast_provider — stacked toasts, auto-dismissed
// after 5s, swipe left to dismiss, optional link opened on click.
import * as React from "react";
import { errorMessage } from "@/lib/server-error";

export type ToastLevel = "info" | "warn" | "error";

interface ToastItem {
  id: number;
  level: ToastLevel;
  message: string;
  link?: string;
  dismissing: boolean;
}

export interface ToastOptions {
  /** Opened in a new window when the toast is clicked. */
  link?: string;
}

export interface ToastService {
  info(message: string, options?: ToastOptions): void;
  warn(message: string, options?: ToastOptions): void;
  /** Shows the translated `common::Error` for API failures (Rust `toast.error(err)`). */
  error(error: unknown, options?: ToastOptions): void;
}

interface ToastInternals {
  toasts: ToastItem[];
  dismiss(id: number): void;
  remove(id: number): void;
}

const ToastServiceContext = React.createContext<ToastService | null>(null);
const ToastInternalsContext = React.createContext<ToastInternals | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(0);

  const service = React.useMemo<ToastService>(() => {
    const push = (level: ToastLevel, message: string, options?: ToastOptions) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, level, message, link: options?.link, dismissing: false }]);
    };
    return {
      info: (message, options) => push("info", message, options),
      warn: (message, options) => push("warn", message, options),
      error: (error, options) => push("error", errorMessage(error), options),
    };
  }, []);

  const internals = React.useMemo<ToastInternals>(
    () => ({
      toasts,
      dismiss: (id) => setToasts((list) => list.map((t) => (t.id === id ? { ...t, dismissing: true } : t))),
      remove: (id) => setToasts((list) => list.filter((t) => t.id !== id)),
    }),
    [toasts],
  );

  return (
    <ToastServiceContext.Provider value={service}>
      <ToastInternalsContext.Provider value={internals}>{children}</ToastInternalsContext.Provider>
    </ToastServiceContext.Provider>
  );
}

export function useToast(): ToastService {
  const service = React.useContext(ToastServiceContext);
  if (!service) throw new Error("useToast must be used inside ToastProvider");
  return service;
}

/** The toast stack (Dioxus `ToastProvider` component). Mounted once, after the popup zone. */
export function ToastZone() {
  const internals = React.useContext(ToastInternalsContext);
  if (!internals || internals.toasts.length === 0) return null;
  return (
    <div className="flex fixed top-4 right-4 flex-col gap-3 z-[102] max-w-[380px]">
      {internals.toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} internals={internals} />
      ))}
    </div>
  );
}

const BORDER: Record<ToastLevel, string> = {
  info: "border-l-blue-500",
  warn: "border-l-yellow-500",
  error: "border-l-red-500",
};

function ToastCard({ toast, internals }: { toast: ToastItem; internals: ToastInternals }) {
  const [mounted, setMounted] = React.useState(false);
  const [dragStartX, setDragStartX] = React.useState<number | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const { dismiss, remove } = internals;
  const dismissRef = React.useRef({ dismiss, remove });
  dismissRef.current = { dismiss, remove };

  React.useEffect(() => setMounted(true), []);

  // Auto-dismiss after 5 seconds, then remove once the slide-out finishes.
  React.useEffect(() => {
    const timers = [
      window.setTimeout(() => dismissRef.current.dismiss(toast.id), 5000),
      window.setTimeout(() => dismissRef.current.remove(toast.id), 5300),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [toast.id]);

  const slideClass = toast.dismissing
    ? "translate-x-full opacity-0"
    : mounted
      ? "translate-x-0 opacity-100"
      : "translate-x-full opacity-0";

  return (
    <div
      className={`flex gap-3 items-center p-4 rounded-lg border border-l-4 shadow-lg transition-all duration-300 cursor-pointer bg-[#1a1a2e] border-[#2a2a3e] ${BORDER[toast.level]} ${slideClass}`}
      style={dragOffset < 0 ? { transform: `translateX(${dragOffset}px)` } : undefined}
      onMouseDown={(e) => setDragStartX(e.clientX)}
      onMouseMove={(e) => {
        if (dragStartX === null) return;
        const diff = e.clientX - dragStartX;
        if (diff < 0) setDragOffset(diff);
      }}
      onMouseUp={() => {
        if (dragOffset < -80) {
          dismiss(toast.id);
          window.setTimeout(() => dismissRef.current.remove(toast.id), 300);
        } else {
          setDragOffset(0);
        }
        setDragStartX(null);
      }}
      onClick={() => {
        if (toast.link) window.open(toast.link);
      }}
    >
      <span className="flex-1 text-sm select-none text-[#e0e0e0]">{toast.message}</span>
      {toast.link && <span className="text-xs text-blue-400">↗</span>}
    </div>
  );
}
