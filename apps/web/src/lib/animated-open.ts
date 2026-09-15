// dioxus_primitives `use_animated_open` (primitives/src/lib.rs): an element is
// in the DOM as soon as `open` turns true; on close it stays until the
// animations running on `#id` finish, so exit animations (`[data-state=closed]`
// keyframes in main.css) can play.
import { useEffect, useState } from "react";

export function useAnimatedOpen(id: string, open: boolean): boolean {
  const [showInDom, setShowInDom] = useState(open);
  useEffect(() => {
    if (open) {
      setShowInDom(true);
      return;
    }
    let cancelled = false;
    const element = document.getElementById(id);
    const animations = element?.getAnimations?.() ?? [];
    Promise.all(animations.map((a) => a.finished.catch(() => undefined))).then(() => {
      if (!cancelled) setShowInDom(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, open]);
  return showInDom;
}
