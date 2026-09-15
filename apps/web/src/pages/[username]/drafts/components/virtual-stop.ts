import type { SyntheticEvent } from "react";

// Dioxus `e.stop_propagation()` on web only stops bubbling through the virtual
// DOM (dioxus-core events.rs: `propagates = false`); the native event still
// reaches `document`, where the drafts page script (`script.js`) listens for
// clicks. React's `e.stopPropagation()` would also stop the native event at the
// root container, hiding it from that script. So parents check this mark
// instead of relying on React propagation.

const stopped = new WeakSet<Event>();

/** Marks the event as "propagation stopped" for ancestor handlers on this page. */
export function stopVirtual(e: SyntheticEvent): void {
  stopped.add(e.nativeEvent);
}

/** Whether a descendant handler already called `stopVirtual` for this event. */
export function isVirtuallyStopped(e: SyntheticEvent): boolean {
  return stopped.has(e.nativeEvent);
}
