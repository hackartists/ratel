// dioxus_primitives `ts/focus-trap.ts` (loaded by DialogRoot as
// `window.createFocusTrap`), as a module: focuses the first focusable child,
// cycles Tab/Shift+Tab inside the container, and restores the previously
// focused element on `remove()`.

function focusable(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.getAttribute("disabled")) return false;
  switch (element.tagName) {
    case "A":
      return !!(element as HTMLAnchorElement).href && (element as HTMLAnchorElement).rel !== "ignore";
    case "INPUT":
      return (element as HTMLInputElement).type !== "hidden";
    case "BUTTON":
    case "SELECT":
    case "TEXTAREA":
      return true;
    default:
      return false;
  }
}

export class FocusTrap {
  private container: HTMLElement;
  private restoreFocusElement: HTMLElement | null;
  private nodeWalker: TreeWalker;
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    if (event.shiftKey) this.focusPrevious();
    else this.focusNext();
    event.preventDefault();
  };

  constructor(container: HTMLElement) {
    this.container = container;
    this.restoreFocusElement = document.activeElement as HTMLElement | null;
    this.nodeWalker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) =>
        node instanceof HTMLElement && focusable(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
    });
    this.focusNext();
    container.addEventListener("keydown", this.onKeyDown);
  }

  remove(): void {
    this.container.removeEventListener("keydown", this.onKeyDown);
    this.restoreFocusElement?.focus?.();
  }

  private focusNext(): void {
    const next = this.nodeWalker.nextNode() as HTMLElement | null;
    if (next) {
      next.focus();
      return;
    }
    this.nodeWalker.currentNode = this.container;
    (this.nodeWalker.nextNode() as HTMLElement | null)?.focus();
  }

  private focusPrevious(): void {
    const previous = this.nodeWalker.previousNode() as HTMLElement | null;
    if (previous) {
      previous.focus();
      return;
    }
    this.nodeWalker.currentNode = this.container;
    (this.nodeWalker.lastChild() as HTMLElement | null)?.focus();
  }
}

export function createFocusTrap(container: HTMLElement): FocusTrap {
  return new FocusTrap(container);
}
