import * as React from "react";
import { useControlled } from "@/lib/controlled";
import { dataBool, joinClass } from "@/lib/dom";

// app/ratel/src/common/components/collapsible + dioxus_primitives::collapsible.
// Collapsible (div) > CollapsibleTrigger (button + expand icon) and
// CollapsibleContent (div whose children mount only while open, unless
// `keepMounted`).
//
// Class order follows Dioxus: the root merges the caller's class before
// "collapsible" (`merge_attributes` over [caller attrs, pushed class]); the
// trigger merges "collapsible-trigger" before the caller's class.

type AsRender = (attributes: React.HTMLAttributes<HTMLElement>) => React.ReactNode;

interface CollapsibleCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  keepMounted: boolean;
  ariaControlsId: string;
  setAriaControlsId: (id: string) => void;
}

const CollapsibleContext = React.createContext<CollapsibleCtx | null>(null);

function useCollapsibleCtx(): CollapsibleCtx {
  const ctx = React.useContext(CollapsibleContext);
  if (!ctx) throw new Error("Collapsible parts must be used inside <Collapsible>");
  return ctx;
}

export interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  keepMounted?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  /** Controlled open state; leave undefined for uncontrolled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Render the root as a custom element. Like Dioxus, children are not passed. */
  as?: AsRender;
}

export function Collapsible({
  keepMounted = false,
  defaultOpen = false,
  disabled = false,
  open: openProp,
  onOpenChange,
  as,
  className,
  children,
  ...props
}: CollapsibleProps) {
  const [open, setOpen] = useControlled(openProp, defaultOpen, onOpenChange);
  const generatedId = React.useId();
  const [ariaControlsId, setAriaControlsId] = React.useState(generatedId);
  const ctx = React.useMemo(
    () => ({ open, setOpen, disabled, keepMounted, ariaControlsId, setAriaControlsId }),
    [open, setOpen, disabled, keepMounted, ariaControlsId],
  );

  const attributes: React.HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string> = {
    "data-open": dataBool(open),
    "data-disabled": dataBool(disabled),
    ...props,
    className: className === undefined ? "collapsible" : joinClass(className, "collapsible"),
  };

  return (
    <CollapsibleContext.Provider value={ctx}>
      {as ? as(attributes as React.HTMLAttributes<HTMLElement>) : <div {...attributes}>{children}</div>}
    </CollapsibleContext.Provider>
  );
}

export interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Render a custom element; it receives the trigger attributes and no children or icon. */
  as?: AsRender;
}

export function CollapsibleTrigger({ as, className, children, onClick, ...props }: CollapsibleTriggerProps) {
  const ctx = useCollapsibleCtx();
  const attributes: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<`data-${string}`, string> = {
    type: "button",
    "data-open": dataBool(ctx.open),
    "data-disabled": dataBool(ctx.disabled),
    disabled: ctx.disabled,
    "aria-controls": ctx.ariaControlsId,
    "aria-expanded": ctx.open,
    ...props,
    className: joinClass("collapsible-trigger", className),
    onClick: (e) => {
      ctx.setOpen(!ctx.open);
      onClick?.(e);
    },
  };

  if (as) return <>{as(attributes as React.HTMLAttributes<HTMLElement>)}</>;
  return (
    <button {...attributes}>
      {children}
      <svg className="collapsible-expand-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polyline points="6 15 12 21 18 15" />
        <polyline points="6 9 12 3 18 9" />
      </svg>
    </button>
  );
}

export type CollapsibleContentProps = React.HTMLAttributes<HTMLDivElement>;

export function CollapsibleContent({ id, className, children, ...props }: CollapsibleContentProps) {
  const ctx = useCollapsibleCtx();
  const { setAriaControlsId } = ctx;
  // `use_id_or`: a caller id also becomes the trigger's aria-controls.
  React.useEffect(() => {
    if (id !== undefined) setAriaControlsId(id);
  }, [id, setAriaControlsId]);

  return (
    <div
      id={id ?? ctx.ariaControlsId}
      data-open={dataBool(ctx.open)}
      data-disabled={dataBool(ctx.disabled)}
      {...props}
      className={joinClass("collapsible-content", className)}
    >
      {(ctx.open || ctx.keepMounted) && children}
    </div>
  );
}

/** Inline-styled wrappers kept from the Dioxus component (demo layout helpers). */
export function CollapsibleItem({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{ border: "1px solid var(--primary-color-6)", borderRadius: "0.5rem", padding: "1rem", ...style }}
      {...props}
    />
  );
}

export function CollapsibleList({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        maxWidth: "20rem",
        color: "var(--secondary-color-3)",
        ...style,
      }}
      {...props}
    />
  );
}
