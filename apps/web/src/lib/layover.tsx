// app/ratel/src/common/components/layover — the right-side slide-in panel.
// The panel is always in the DOM (it slides), and closes on any route change.
import * as React from "react";
import { useLocation } from "react-router-dom";
import { Clear } from "@/components/icons/validations";

/** strum strings verbatim; `Fit` has no `serialize`, so Display is the variant name. */
export const LayoverSize = {
  Full: "w-full",
  Half: "w-[50%] max-tablet:w-full",
  Medium: "max-w-[800px] max-tablet:max-w-full",
  Small: "w-[337px] max-tablet:w-full",
  Fit: "Fit",
} as const;
export type LayoverSize = (typeof LayoverSize)[keyof typeof LayoverSize];

interface LayoverConfig {
  id: string;
  title: string;
  content: React.ReactNode;
  size?: LayoverSize;
}

export interface LayoverService {
  isOpen: boolean;
  /** Opens a panel; re-opening the panel that is already open (same id) is a no-op. */
  open(id: string, title: string, content: React.ReactNode): void;
  setSize(size: LayoverSize): void;
  close(): void;
}

const LayoverStateContext = React.createContext<LayoverConfig | null>(null);
const LayoverServiceContext = React.createContext<LayoverService | null>(null);

export function LayoverProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<LayoverConfig | null>(null);
  const service = React.useMemo<LayoverService>(
    () => ({
      isOpen: config !== null,
      open: (id, title, content) =>
        setConfig((current) => (current?.id === id ? current : { id, title, content })),
      setSize: (size) => setConfig((current) => (current ? { ...current, size } : current)),
      close: () => setConfig(null),
    }),
    [config !== null],
  );
  return (
    <LayoverServiceContext.Provider value={service}>
      <LayoverStateContext.Provider value={config}>{children}</LayoverStateContext.Provider>
    </LayoverServiceContext.Provider>
  );
}

export function useLayover(): LayoverService {
  const service = React.useContext(LayoverServiceContext);
  if (!service) throw new Error("useLayover must be used inside LayoverProvider");
  return service;
}

export function Layover() {
  const config = React.useContext(LayoverStateContext);
  const layover = useLayover();
  const location = useLocation();
  const path = `${location.pathname}${location.search}${location.hash}`;
  const previousPath = React.useRef(path);

  React.useEffect(() => {
    if (previousPath.current !== path) {
      previousPath.current = path;
      layover.close();
    }
  }, [path, layover]);

  const isOpen = config !== null;
  const title = config?.title ?? "";
  // Rust `container_class.unwrap_or_default()`: `LayoverSize` defaults to
  // `Full` ("w-full"), so the panel is full-width whenever no explicit size
  // was set — not just while open (`config` is `null` while closed too).
  const panelClasses = `absolute top-0 right-0 h-full bg-layover-bg border-l border-card-border rounded-l-[24px] overflow-hidden transition-transform duration-300 ease-in-out max-tablet:max-w-full max-tablet:rounded-none ${isOpen ? "translate-x-0" : "translate-x-full"} ${config?.size ?? LayoverSize.Full} shadow-[0_8px_20px_0_rgba(20,26,62,0.25)]`;

  return (
    <div className={isOpen ? "fixed inset-0 z-100" : "fixed inset-0 z-100 pointer-events-none"}>
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 backdrop-blur-sm ${isOpen ? "opacity-50" : "opacity-0 pointer-events-none"}`}
        onClick={() => layover.close()}
      />
      <div className={panelClasses} onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col h-full">
          {title !== "" && (
            <div className="flex flex-row gap-5 items-center px-5 h-16 border-b border-card-border shrink-0">
              <button
                className="flex justify-center items-center bg-transparent rounded-md transition-colors cursor-pointer size-6 hover:bg-layover-close-btn-hover-bg"
                onClick={() => layover.close()}
              >
                <Clear width="16" height="16" className="[&>path]:stroke-foreground-muted" />
              </button>
              <h4 className="font-bold text-text-primary text-[20px]/[24px] tracking-[-0.2px]">{title}</h4>
            </div>
          )}
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">{config?.content}</div>
        </div>
      </div>
    </div>
  );
}
