import * as React from "react";
import { useAnimatedOpen } from "@/lib/animated-open";
import { useControlled } from "@/lib/controlled";
import { dataBool, joinClass } from "@/lib/dom";
import { useFocusItem, useFocusState, type FocusState } from "@/lib/focus-state";

// app/ratel/src/common/components/select + dioxus_primitives::select.
// Select (div[data-state]) > SelectTrigger (button; renders its children twice —
// a mobile-only centered copy and a desktop copy — then the chevron) and
// SelectList (div[role=listbox], only in the DOM while open). While the list is
// closed its options still mount (render nothing) so SelectValue can show the
// selected option's text.
//
// Values are compared with `Object.is`. `value === null` is Rust's `None`
// (nothing selected); leave `value` undefined for an uncontrolled select.
//
// Typeahead: the primitive's adaptive keyboard-layout matcher is reduced to a
// case-insensitive prefix (then substring) match on each option's text value,
// with the same buffer timeout.

interface OptionState {
  tabIndex: number;
  value: unknown;
  textValue: string;
  id: string;
}

interface SelectCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  value: unknown;
  setValue: (value: unknown) => void;
  options: OptionState[];
  registerOption: (option: OptionState) => () => void;
  listId: string | null;
  setListId: (id: string | null) => void;
  focus: FocusState;
  disabled: boolean;
  placeholder: string;
  initialFocus: React.MutableRefObject<number | null>;
  typeaheadTimeout: number;
  typeaheadBuffer: React.MutableRefObject<string>;
  typeaheadTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

const SelectContext = React.createContext<SelectCtx | null>(null);
/** Whether the list is rendering (false: children mount but render nothing). */
const SelectListRenderContext = React.createContext(false);
const SelectGroupContext = React.createContext<{ setLabelledBy: (id: string) => void } | null>(null);
const SelectOptionContext = React.createContext(false);

function useSelectCtx(): SelectCtx {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("Select parts must be used inside <Select>");
  return ctx;
}

export interface SelectProps<T> extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  value?: T | null;
  defaultValue?: T | null;
  onValueChange?: (value: T | null) => void;
  disabled?: boolean;
  /** Form name (kept for API parity; the primitive renders no native input). */
  name?: string;
  placeholder?: string;
  rovingLoop?: boolean;
  /** Milliseconds before the typeahead buffer clears. */
  typeaheadTimeout?: number;
}

export function Select<T>({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  disabled = false,
  name: _name,
  placeholder = "Select an option",
  rovingLoop = true,
  typeaheadTimeout = 1000,
  className,
  children,
  ...props
}: SelectProps<T>) {
  const [value, setValue] = useControlled<T | null>(valueProp, defaultValue, onValueChange);
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<OptionState[]>([]);
  const [listId, setListId] = React.useState<string | null>(null);
  const focus = useFocusState(rovingLoop);
  const initialFocus = React.useRef<number | null>(null);
  const typeaheadBuffer = React.useRef("");
  const typeaheadTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (open) return;
    if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
    typeaheadTimer.current = null;
    typeaheadBuffer.current = "";
  }, [open]);

  const registerOption = React.useCallback((option: OptionState) => {
    setOptions((list) => [...list.filter((o) => o.id !== option.id), option]);
    return () => setOptions((list) => list.filter((o) => o.id !== option.id));
  }, []);

  const ctx = React.useMemo<SelectCtx>(
    () => ({
      open,
      setOpen,
      value,
      setValue: setValue as (value: unknown) => void,
      options,
      registerOption,
      listId,
      setListId,
      focus,
      disabled,
      placeholder,
      initialFocus,
      typeaheadTimeout,
      typeaheadBuffer,
      typeaheadTimer,
    }),
    [open, value, setValue, options, registerOption, listId, focus, disabled, placeholder, typeaheadTimeout],
  );

  return (
    <SelectContext.Provider value={ctx}>
      <div data-state={open ? "open" : "closed"} {...props} className={joinClass("select @max-mobile:w-full", className)}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

function selectCurrentItem(ctx: SelectCtx): void {
  if (!ctx.open) return;
  const focused = ctx.focus.currentFocus();
  if (focused === null) return;
  const option = ctx.options.find((o) => o.tabIndex === focused);
  if (option) {
    ctx.setValue(option.value);
    ctx.setOpen(false);
  }
}

function addToTypeahead(ctx: SelectCtx, text: string): void {
  if (ctx.typeaheadTimer.current) clearTimeout(ctx.typeaheadTimer.current);
  ctx.typeaheadBuffer.current += text;
  ctx.typeaheadTimer.current = setTimeout(() => {
    ctx.typeaheadBuffer.current = "";
    ctx.typeaheadTimer.current = null;
  }, ctx.typeaheadTimeout);
  const query = ctx.typeaheadBuffer.current.toLowerCase();
  const match =
    ctx.options.find((o) => o.textValue.toLowerCase().startsWith(query)) ??
    ctx.options.find((o) => o.textValue.toLowerCase().includes(query));
  if (match) ctx.focus.setFocus(match.tabIndex);
}

export function SelectTrigger({ className, onClick, onKeyDown, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = useSelectCtx();
  return (
    <button
      disabled={ctx.disabled}
      type="button"
      onClick={(e) => {
        ctx.setOpen(!ctx.open);
        onClick?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          ctx.setOpen(true);
          const count = ctx.focus.itemCount();
          ctx.initialFocus.current = e.key === "ArrowUp" ? (count > 0 ? count - 1 : null) : count > 0 ? 0 : null;
          e.preventDefault();
          e.stopPropagation();
        }
        onKeyDown?.(e);
      }}
      aria-haspopup="listbox"
      aria-expanded={ctx.open}
      aria-controls={ctx.listId ?? undefined}
      {...props}
      className={joinClass("select-trigger @max-mobile:w-full", className)}
    >
      <div className="hidden @max-mobile:w-full @max-mobile:flex @max-mobile:justify-center @max-mobile:items-center">{children}</div>
      <div className="@max-mobile:hidden">{children}</div>
      <svg className="select-expand-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

export function SelectValue({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  const ctx = useSelectCtx();
  const selectedText =
    ctx.value === null || ctx.value === undefined
      ? undefined
      : ctx.options.find((o) => Object.is(o.value, ctx.value))?.textValue;
  return (
    <span
      data-placeholder={dataBool(ctx.value === null || ctx.value === undefined)}
      {...props}
      className={joinClass("@max-mobile:text-center", className)}
    >
      {selectedText ?? ctx.placeholder}
    </span>
  );
}

export function SelectList({ id, className, onKeyDown, onBlur, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = useSelectCtx();
  const { focus, open, setOpen, setListId, initialFocus } = ctx;
  const generatedId = React.useId();
  const listId = id ?? generatedId;
  const listbox = React.useRef<HTMLDivElement | null>(null);
  const openRef = React.useRef(open);
  openRef.current = open;

  React.useEffect(() => {
    setListId(listId);
  }, [listId, setListId]);

  React.useEffect(() => {
    if (open && !focus.anyFocused()) listbox.current?.focus();
  }, [open, focus]);

  const render = useAnimatedOpen(listId, open);

  React.useEffect(() => {
    if (render) focus.setFocus(initialFocus.current);
    else initialFocus.current = null;
    // Runs when the list mounts/unmounts, like the Dioxus effect on `render`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render]);

  if (!render) {
    return <SelectListRenderContext.Provider value={false}>{children}</SelectListRenderContext.Provider>;
  }

  return (
    <SelectListRenderContext.Provider value>
      <div
        ref={listbox}
        id={listId}
        role="listbox"
        tabIndex={open && !focus.anyFocused() ? 0 : -1}
        data-state={open ? "open" : "closed"}
        onKeyDown={(e) => {
          const stop = () => {
            e.preventDefault();
            e.stopPropagation();
          };
          const arrow = () => {
            ctx.typeaheadBuffer.current = "";
            stop();
          };
          if (e.key.length === 1) {
            if (e.key === " ") {
              selectCurrentItem(ctx);
              stop();
            } else {
              addToTypeahead(ctx, e.key);
            }
          } else if (e.key === "ArrowUp") {
            arrow();
            focus.focusPrev();
          } else if (e.key === "End") {
            arrow();
            focus.focusLast();
          } else if (e.key === "ArrowDown") {
            arrow();
            focus.focusNext();
          } else if (e.key === "Home") {
            arrow();
            focus.focusFirst();
          } else if (e.key === "Enter") {
            selectCurrentItem(ctx);
            setOpen(false);
            stop();
          } else if (e.key === "Escape") {
            setOpen(false);
            stop();
          }
          onKeyDown?.(e);
        }}
        onBlur={(e) => {
          if (e.target === e.currentTarget && openRef.current && !focus.anyFocused()) setOpen(false);
          onBlur?.(e);
        }}
        {...props}
        className={joinClass("select-list", className)}
      >
        {children}
      </div>
    </SelectListRenderContext.Provider>
  );
}

export interface SelectGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
}

/** The primitive accepts an `id` prop but never renders it; neither does this. */
export function SelectGroup({ disabled = false, id: _id, className, children, ...props }: SelectGroupProps) {
  const ctx = useSelectCtx();
  const render = React.useContext(SelectListRenderContext);
  const [labelledBy, setLabelledBy] = React.useState<string | null>(null);
  const group = React.useMemo(() => ({ setLabelledBy }), []);

  return (
    <SelectGroupContext.Provider value={group}>
      {render ? (
        <div
          role="group"
          aria-disabled={dataBool(ctx.disabled || disabled)}
          aria-labelledby={labelledBy ?? undefined}
          {...props}
          className={joinClass("select-group", className)}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </SelectGroupContext.Provider>
  );
}

export function SelectGroupLabel({ id, className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const group = React.useContext(SelectGroupContext);
  const render = React.useContext(SelectListRenderContext);
  const generatedId = React.useId();
  const labelId = id ?? generatedId;
  const setLabelledBy = group?.setLabelledBy;

  React.useEffect(() => {
    setLabelledBy?.(labelId);
  }, [labelId, setLabelledBy]);

  if (!render) return null;
  return (
    <div id={labelId} {...props} className={joinClass("select-group-label", className)}>
      {children}
    </div>
  );
}

export interface SelectOptionProps<T> extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  value: T;
  /** Text for typeahead and SelectValue; defaults to `value` when it is a string. */
  textValue?: string;
  disabled?: boolean;
  /** Keyboard focus order. */
  index: number;
}

export function SelectOption<T>({
  value,
  textValue,
  disabled = false,
  id,
  index,
  className,
  onPointerDown,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onBlur,
  children,
  ...props
}: SelectOptionProps<T>) {
  const ctx = useSelectCtx();
  const { focus, registerOption } = ctx;
  const render = React.useContext(SelectListRenderContext);
  const generatedId = React.useId();
  const optionId = id ?? generatedId;
  const text = textValue ?? (typeof value === "string" ? value : "");
  const didDrag = React.useRef(false);

  React.useEffect(
    () => registerOption({ tabIndex: index, value, textValue: text, id: optionId }),
    [registerOption, index, value, text, optionId],
  );

  const ref = useFocusItem<HTMLDivElement>(focus, index);
  const isDisabled = ctx.disabled || disabled;
  const selected = ctx.value !== null && ctx.value !== undefined && Object.is(ctx.value, value);

  const choose = () => {
    ctx.setValue(value);
    ctx.setOpen(false);
  };

  return (
    <SelectOptionContext.Provider value={selected}>
      {render && (
        <div
          ref={ref}
          role="option"
          id={optionId}
          tabIndex={focus.isFocused(index) ? 0 : -1}
          aria-selected={selected}
          aria-disabled={dataBool(isDisabled)}
          onPointerDown={(e) => {
            if (!isDisabled && e.pointerType === "mouse" && e.button === 0) choose();
            onPointerDown?.(e);
          }}
          onTouchStart={(e) => {
            didDrag.current = false;
            onTouchStart?.(e);
          }}
          onTouchEnd={(e) => {
            if (!isDisabled && !didDrag.current) choose();
            onTouchEnd?.(e);
          }}
          onTouchMove={(e) => {
            didDrag.current = true;
            onTouchMove?.(e);
          }}
          onBlur={(e) => {
            if (e.target === e.currentTarget && focus.isFocused(index)) {
              focus.blur();
              ctx.setOpen(false);
            }
            onBlur?.(e);
          }}
          {...props}
          className={joinClass("select-option", className)}
        >
          {children}
        </div>
      )}
    </SelectOptionContext.Provider>
  );
}

/** The check mark, shown only inside the selected option. */
export function SelectItemIndicator() {
  const selected = React.useContext(SelectOptionContext);
  if (!selected) return null;
  return (
    <svg className="select-check-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
