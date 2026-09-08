// Outside-click dismissal driver. `use_dismiss_on_outside_click` interpolates
// the component root's CSS selector into __DISMISS_SEL__.
//
// Listens on the document in the CAPTURE phase, so it sees the click no matter
// what the page does with bubbling — an inner handler calling
// `stopPropagation()` for its own reasons cannot swallow the dismissal.
//
// Why not the transparent full-screen backdrop this codebase uses elsewhere:
// a backdrop is `position: fixed`, so it is trapped by any ancestor that
// establishes a stacking or containing block (a topbar with `z-index` or a
// `backdrop-filter`, both common here). Then it covers only that ancestor's
// box and clicks past it never reach the handler — which is exactly how the
// home team dropdown ended up not closing. A document listener has no such
// failure mode.
(function () {
  var SEL = "__DISMISS_SEL__";

  function onPointerDown(e) {
    if (!document.querySelector(SEL)) {
      // The component unmounted (route change). Stop listening — the Rust
      // side's receiver is gone too, so anything sent here is dropped.
      document.removeEventListener("pointerdown", onPointerDown, true);
      return;
    }
    // `closest`, not `querySelector(...).contains(...)`: it asks whether THIS
    // press sits inside a matching element, which stays correct when the
    // selector is a comma-separated list. Panels whose trigger lives outside
    // them — a bottom-bar button opening a sibling panel, say — need exactly
    // that, and `querySelector` would only ever test the first match.
    //
    // A press that starts inside the component is never "outside", including
    // on the trigger itself — letting the trigger's own handler own the
    // toggle instead of fighting it.
    if (e.target instanceof Element && e.target.closest(SEL)) return;
    dioxus.send(true);
  }

  document.addEventListener("pointerdown", onPointerDown, true);
})();
