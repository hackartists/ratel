import * as React from "react";
import { useAnimatedOpen } from "@/lib/animated-open";
import { useControlled } from "@/lib/controlled";
import { joinClass } from "@/lib/dom";
import { useGlobalEscapeListener } from "@/lib/escape-listener";
import { createFocusTrap, type FocusTrap } from "@/lib/focus-trap";

// dioxus_primitives::dialog (the `*Base` parts) and
// app/ratel/src/common/components/dialog (DialogRoot/Content/Title/Description).
//
// DialogRoot renders the overlay div only while open (or finishing its exit
// animation); clicking it closes the dialog. DialogContent is the
// `role="dialog"` box: clicks inside don't reach the overlay, Escape closes the
// top-most dialog, and a modal dialog traps focus while open.
//
// The primitive overlay has a static `class="dialog-overlay"` that the wrapper's
// class attribute replaces when Dioxus renders on the client, so only the
// wrapper class ("dialog-backdrop", "sheet-root") is rendered here.

interface DialogCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  isModal: boolean;
  labelledBy: string;
  setLabelledBy: (id: string) => void;
  describedBy: string;
  setDescribedBy: (id: string) => void;
}

const DialogContext = React.createContext<DialogCtx | null>(null);

export function useDialogCtx(): DialogCtx {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("Dialog parts must be used inside a dialog root");
  return ctx;
}

export interface DialogRootBaseProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled open state; leave undefined for uncontrolled. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Trap focus inside the content while open (default true). */
  isModal?: boolean;
}

export function DialogRootBase({
  id,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  isModal = true,
  onClick,
  children,
  ...props
}: DialogRootBaseProps) {
  const [open, setOpen] = useControlled(openProp, defaultOpen, onOpenChange);
  const generatedLabel = React.useId();
  const generatedDescription = React.useId();
  const generatedId = React.useId();
  const [labelledBy, setLabelledBy] = React.useState(generatedLabel);
  const [describedBy, setDescribedBy] = React.useState(generatedDescription);
  const rootId = id ?? generatedId;
  const render = useAnimatedOpen(rootId, open);

  const ctx = React.useMemo(
    () => ({ open, setOpen, isModal, labelledBy, setLabelledBy, describedBy, setDescribedBy }),
    [open, setOpen, isModal, labelledBy, describedBy],
  );

  return (
    <DialogContext.Provider value={ctx}>
      {render && (
        <div
          id={rootId}
          aria-hidden={open ? undefined : "true"}
          data-state={open ? "open" : "closed"}
          onClick={(e) => {
            setOpen(false);
            onClick?.(e);
          }}
          {...props}
        >
          {children}
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function DialogContentBase({ id, className = "dialog", onClick, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = useDialogCtx();
  const { open, isModal, setOpen } = ctx;
  const generatedId = React.useId();
  const contentId = id ?? generatedId;
  const trap = React.useRef<FocusTrap | null>(null);

  useGlobalEscapeListener(() => setOpen(false));

  React.useEffect(() => {
    if (!isModal) return;
    const element = document.getElementById(contentId);
    if (!element) return;
    if (open) {
      trap.current?.remove();
      trap.current = createFocusTrap(element);
    } else if (trap.current) {
      trap.current.remove();
      trap.current = null;
    }
  }, [contentId, open, isModal]);

  return (
    <div
      id={contentId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ctx.labelledBy}
      aria-describedby={ctx.describedBy}
      className={className}
      onClick={(e) => {
        // Keep the click from reaching the overlay.
        e.stopPropagation();
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogTitleBase({ id, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const ctx = useDialogCtx();
  const { setLabelledBy } = ctx;
  React.useEffect(() => {
    if (id !== undefined) setLabelledBy(id);
  }, [id, setLabelledBy]);
  return <h2 id={id ?? ctx.labelledBy} {...props} />;
}

export function DialogDescriptionBase({ id, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const ctx = useDialogCtx();
  const { setDescribedBy } = ctx;
  React.useEffect(() => {
    if (id !== undefined) setDescribedBy(id);
  }, [id, setDescribedBy]);
  return <p id={id ?? ctx.describedBy} {...props} />;
}

export function DialogRoot({ className, ...props }: DialogRootBaseProps) {
  return <DialogRootBase {...props} className={joinClass("dialog-backdrop", className)} />;
}

/**
 * The Dioxus wrapper always passes `class: "dialog"` and drops the caller's
 * class, so `className` is not accepted.
 */
export function DialogContent(props: Omit<React.HTMLAttributes<HTMLDivElement>, "className">) {
  return <DialogContentBase {...props} className="dialog" />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <DialogTitleBase {...props} className={joinClass("dialog-title", className)} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <DialogDescriptionBase {...props} className={joinClass("dialog-description", className)} />;
}
