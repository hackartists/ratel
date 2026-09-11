//! Close a popover-style component when the user presses anywhere outside it.
//!
//! ```ignore
//! let mut open = use_signal(|| false);
//! use_dismiss_on_outside_click(open, ".home-arena .hud-teams");
//! ```
//!
//! `selector` must match the component's ROOT — the element that contains both
//! the trigger and the panel. A press inside that subtree is left alone so the
//! trigger keeps owning its own toggle.
//!
//! Prefer this over the transparent full-screen backdrop pattern used
//! elsewhere in the codebase. A backdrop is `position: fixed`, so any ancestor
//! that establishes a stacking or containing block — a topbar carrying
//! `z-index` or `backdrop-filter`, of which this app has many — confines it to
//! that ancestor's box, and presses beyond it silently do nothing.

use crate::*;

/// `root_selector` is taken by value rather than as `&'static str` because
/// per-row menus (a comment's "…", a table row's overflow) render one instance
/// per item — a shared class would make `querySelector` resolve to the FIRST
/// row for every one of them, and a press inside row 5's open menu would be
/// judged "outside". Those call sites stamp a unique `id` on their root and
/// pass `#that-id`.
pub fn use_dismiss_on_outside_click(mut open: Signal<bool>, root_selector: impl Into<String>) {
    use_dismiss_on_outside(root_selector, move || {
        // `peek`, not a plain read: writing an unchanged `false` would still
        // mark the signal dirty and re-render the component on every stray
        // press anywhere in the app.
        if *open.peek() {
            open.set(false);
        }
    });
}

/// The same dismissal, for state that isn't a `bool` — a page whose panels
/// share one `Signal<ActivePanel>`, say. `on_dismiss` must be `Copy` because
/// it is moved into a long-lived task.
pub fn use_dismiss_on_outside(
    root_selector: impl Into<String>,
    on_dismiss: impl FnMut() + Copy + 'static,
) {
    let root_selector = root_selector.into();
    // `use_future`, not `use_hook`: `document::eval` must not run during
    // render. Doing so re-enters the reactive runtime and panics with
    // "closure invoked recursively or after being dropped" — a wasm trap in
    // release builds.
    use_future(move || {
        let root_selector = root_selector.clone();
        async move {
            let js = include_str!("dismiss_outside.js").replace("__DISMISS_SEL__", &root_selector);
            let mut runner = document::eval(&js);
            let mut on_dismiss = on_dismiss;
            while runner.recv::<bool>().await.is_ok() {
                on_dismiss();
            }
        }
    });
}
