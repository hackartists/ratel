import * as React from "react";
import { useActionEditFooterI18n } from "@/i18n/generated/features/spaces/pages/actions/components/action_edit_footer/action-edit-footer.i18n";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/spaces/pages/actions/components/action_edit_footer.
//
// `ActionEditSaveBus` is the cross-card "flush pending saves now" bus: cards in
// the editor pager drive their own debounced autosave, and the footer's Save
// button bumps a tick that every subscribed card reacts to.

interface SaveBus {
  subscribe(listener: () => void): () => void;
  flush(): void;
}

const SaveBusContext = React.createContext<SaveBus | null>(null);

/** Rust `ActionEditSaveBus::provide()`. */
export function ActionEditSaveBusProvider({ children }: { children: React.ReactNode }) {
  const bus = React.useMemo<SaveBus>(() => {
    const listeners = new Set<() => void>();
    return {
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      flush: () => listeners.forEach((listener) => listener()),
    };
  }, []);
  return <SaveBusContext.Provider value={bus}>{children}</SaveBusContext.Provider>;
}

/** Runs `callback` every time the footer Save button is pressed (a `flush_tick` bump). */
export function useActionEditFlush(callback: () => void): void {
  const bus = React.useContext(SaveBusContext);
  const latest = React.useRef(callback);
  latest.current = callback;
  React.useEffect(() => bus?.subscribe(() => latest.current()), [bus]);
}

export interface ActionEditFooterProps {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
  /** Kebab-case action type — drives the per-action accent via `data-action-type`. */
  actionTypeKey?: string;
}

/** Sticky bottom footer for action-editor pages — page counter + Previous / Next / Save. */
export function ActionEditFooter({ currentPage, onPageChange, totalPages, actionTypeKey = "" }: ActionEditFooterProps) {
  const tr = useActionEditFooterI18n();
  const toast = useToast();
  const bus = React.useContext(SaveBusContext);

  const prevDisabled = currentPage === 0;
  const nextDisabled = currentPage + 1 >= totalPages;

  return (
    <footer className="action-edit-footer" role="contentinfo" data-action-type={actionTypeKey}>
      <div className="action-edit-footer__pages" aria-label={tr.pagesAria}>
        {`${currentPage + 1} / ${totalPages}`}
      </div>
      <div className="action-edit-footer__buttons">
        <button
          className="aef-btn aef-btn--ghost"
          data-testid="footer-prev-btn"
          disabled={prevDisabled}
          onClick={() => {
            if (currentPage === 0) return;
            onPageChange(currentPage - 1);
          }}
        >
          {tr.previous}
        </button>
        <button
          className="aef-btn aef-btn--secondary"
          data-testid="footer-next-btn"
          disabled={nextDisabled}
          onClick={() => {
            if (currentPage + 1 >= totalPages) return;
            onPageChange(currentPage + 1);
          }}
        >
          {tr.next}
        </button>
        <button
          className="aef-btn aef-btn--primary"
          data-testid="footer-save-btn"
          onClick={() => {
            bus?.flush();
            toast.info(tr.saveToast);
          }}
        >
          {tr.save}
        </button>
      </div>
    </footer>
  );
}
