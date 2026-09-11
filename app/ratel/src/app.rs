use crate::common::*;
use crate::config;
use crate::*;

use crate::*;

pub const MAIN_CSS: Asset = asset!("/assets/main.css");
pub const MAIN_JS: Asset = asset!("/assets/ratel-app-shell.js");

#[cfg(feature = "server")]
pub fn app() -> crate::axum::Router {
    dioxus::server::router(App)
}

#[component]
pub fn App() -> Element {
    use_context_provider(|| PopupService::new());
    ToastService::init();
    ThemeService::init();
    // Hydrate language + cached user session from the WebView's
    // localStorage and keep them in sync on every change. Must run after
    // `Context::init` so we don't overwrite a server-validated user with
    // stale cached data.
    crate::common::services::use_persist_ui_state();
    use_effect(move || {
        document::eval(
            r#"
  const userAgent = navigator.userAgent.toLowerCase();
  const isKakaoInApp = userAgent.includes("kakaotalk");

  if (isKakaoInApp) {
    const targetUrl = window.location.href;
    window.location.replace(
      `kakaotalk://web/openExternal?url=${encodeURIComponent(targetUrl)}`,
    );
  }

  // Track the soft-keyboard height as `--kb-inset` on <html>. The Android
  // WebView only shrinks the *visual* viewport when the keyboard opens (the
  // layout viewport / `dvh` stays full), so CSS alone can't react. Full-screen
  // editors (`.composer-arena`) subtract this so their bottom toolbar stays
  // above the keyboard. Updates on resize/scroll of the visual viewport.
  (function () {
    var vv = window.visualViewport;
    if (!vv) return;
    // `--kb-inset` drives the modal's height (`.popup-backdrop` /
    // `.popup-box-capped`), so every write re-lays-out the modal. The WebView
    // reports the keyboard opening as a STREAM of values, not one step —
    // measured on a Galaxy S23 the dialog's top edge moved -13, -27, -17, -4
    // across four frames on a single field change. Each of those is a
    // separate resize, which reads as shaking, and resizing the box also
    // clamps the inner scroller (focusing the third field snapped the form
    // back to the top).
    //
    // So settle first, write once: hold the newest measurement and only
    // publish it after it has stopped changing for a moment. A real
    // open/close is one large step and survives the wait; the intermediate
    // frames of an animation never reach CSS.
    var lastKb = -1;
    var pendingKb = -1;
    var settleTimer = null;
    // Rect of the caret line, or null. A collapsed range inside a text node
    // has one zero-width rect; at an element boundary (an empty paragraph) it
    // has none, so fall back to the element holding the caret.
    function caretRect() {
      var s = window.getSelection();
      if (!s || !s.rangeCount) return null;
      var range = s.getRangeAt(0);
      var rects = range.getClientRects();
      if (rects.length) return rects[rects.length - 1];
      var n = range.startContainer;
      if (n && n.nodeType !== 1) n = n.parentElement;
      return n ? n.getBoundingClientRect() : null;
    }
    // Scroll the focused field back into view *inside its own scroller*.
    // Only ever touches the nearest scroller's `scrollTop` (a rich-text
    // editable can be that scroller itself), never the page, and never with
    // `behavior: smooth` -- both of those are what made the earlier `focusin`
    // + `scrollIntoView` attempt fight the WebView and shake. A no-op when the
    // field is already visible.
    function revealFocused() {
      var el = document.activeElement;
      if (!el) return;
      var tag = el.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && !el.isContentEditable) return;
      // In a rich-text editor the focused element is the whole editable root,
      // which can be its own scroller (the post composer's body) and is always
      // "in view" of itself -- aiming at it never scrolled. Measured: caret on
      // the 6th line, body shrunk to 5 lines by the keyboard, caret left just
      // below the visible area. So aim at the caret, and let the root itself
      // count as the scroller.
      var er = el.getBoundingClientRect();
      var start = el.parentElement;
      if (el.isContentEditable) {
        er = caretRect() || er;
        start = el;
      }
      // Prefer a scroller that is actually overflowing, but fall back to the
      // first `overflow-y: auto|scroll` ancestor: right after the modal is
      // capped the overflow may not have been recomputed yet.
      var sc = start, fallback = null;
      while (sc && sc !== document.body) {
        var oy = getComputedStyle(sc).overflowY;
        if (oy === "auto" || oy === "scroll") {
          if (sc.scrollHeight > sc.clientHeight) break;
          if (!fallback) fallback = sc;
        }
        sc = sc.parentElement;
      }
      if (!sc || sc === document.body) sc = fallback;
      if (!sc) return;
      var cr = sc.getBoundingClientRect();
      var m = 12;
      if (er.bottom > cr.bottom - m) {
        sc.scrollTop += er.bottom - (cr.bottom - m);
      } else if (er.top < cr.top + m) {
        sc.scrollTop -= (cr.top + m) - er.top;
      }
    }
    function publishKb(kb) {
      if (kb === lastKb) return;
      // The WebView scrolls a focused input into view at *focus* time. When
      // the keyboard was already open that is enough. When it was closed the
      // field was still visible at focus time, so nothing scrolled -- and
      // then the keyboard opening shrinks the modal out from under it. So
      // re-reveal the field, but only when the keyboard actually grew.
      var grew = kb > lastKb;
      lastKb = kb;
      document.documentElement.style.setProperty("--kb-inset", kb + "px");
      // A class as well as the variable: CSS can't select on a custom
      // property's value, and the post composer drops its non-typing chrome
      // (type tabs, publish bar) while the keyboard is up. Toggled on the same
      // settled write, so the layout changes once per open/close.
      document.documentElement.classList.toggle("kb-open", kb > 0);
      // Published together with the keyboard, and only once it has settled:
      // the modal's height derives from this, so writing it on every frame of
      // the keyboard animation is exactly the stepping that read as shaking.
      document.documentElement.style.setProperty(
        "--vv-height", Math.round(vv.height) + "px");
      if (grew && kb > 0) {
        requestAnimationFrame(function () {
          requestAnimationFrame(revealFocused);
        });
        // The capped height and the counter-translate both land a frame or
        // two later; re-run once things have settled so the measurement is
        // taken against the final layout. Idempotent -- a no-op when the
        // field is already in view.
        setTimeout(revealFocused, 150);
        setTimeout(revealFocused, 400);
      }
    }
    function update() {
      // Keyboard height is layout-viewport height minus visual-viewport
      // height. `offsetTop` is how far the WebView has SCROLLED the visual
      // viewport inside the layout viewport to reveal a focused field -- it
      // is not keyboard, and subtracting it was the bug: tapping the third
      // field made the WebView scroll (off=342), which cancelled the real
      // keyboard (342) to kb=0, so the modal never shrank and the field
      // stayed behind the keyboard. Measured on a Galaxy S23:
      //   ih=780 vvh=438 off=342  ->  old kb=0, correct kb=342
      var kb = Math.max(0, window.innerHeight - vv.height);
      if (kb !== pendingKb) {
        pendingKb = kb;
        clearTimeout(settleTimer);
        settleTimer = setTimeout(function () { publishKb(pendingKb); }, 150);
      }
      // iOS WKWebView shifts the *visual* viewport up (offsetTop > 0) to keep
      // a focused input above the keyboard, dragging `position: fixed`
      // elements with it. Expose the offset so the scroll lock can apply an
      // equal counter-translate. The Android WebView pans too when the caret
      // sits where the keyboard will open (measured 192 on a 640px screen).
      // Not debounced because nothing resizes off it.
      document.documentElement.style.setProperty(
        "--vv-offset-top", Math.round(vv.offsetTop) + "px");

    }
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.documentElement.style.setProperty(
      "--vv-height", Math.round(vv.height) + "px");
    update();

    // NOTE: there is deliberately no `focusin` handler here. The Android
    // WebView already scrolls a focused input into view inside its nearest
    // scrollable ancestor, and an earlier attempt to do it again from JS
    // fought that scroll -- the two ran against each other on every field
    // change, so the modal shook and tapping the third field jumped the form
    // back to the top.
    //
    // The one case the WebView does not cover is a tap taken while the
    // keyboard is CLOSED: the field is already visible at focus time, so
    // nothing scrolls, and the keyboard then shrinks the modal (via
    // `--kb-inset` on `.popup-backdrop` / `.popup-box-capped`) out from
    // under it. `revealFocused` covers exactly that, off the debounced
    // publish rather than off viewport frames, so it cannot re-enter.
  })();
"#,
        );
    });

    // iOS WKWebView auto-zooms into any focused input whose font-size < 16px
    // (Android has no such behavior), which shoves modals off-screen. In the
    // native Tauri shell pinch-zoom isn't wanted anyway, so `maximum-scale=1 +
    // user-scalable=no` kills the focus-zoom for every input at once. The
    // browser web build keeps user zoom for accessibility.
    #[cfg(feature = "tauri-web")]
    let viewport_content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content";
    #[cfg(not(feature = "tauri-web"))]
    let viewport_content = "width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content";

    rsx! {
        document::Meta {
            // `interactive-widget=resizes-content` shrinks the layout viewport
            // (and `dvh`) when the soft keyboard opens, so `100dvh`-based
            // layouts like the composer collapse to the area above the keyboard
            // and their bottom toolbar stays reachable instead of being hidden
            // behind the keyboard. Pairs with `adjustResize` on MainActivity.
            content: viewport_content,
            name: "viewport",
        }
        document::Link { rel: "icon", href: crate::common::assets::FAVICON }
        document::Link { rel: "preconnect", href: "https://fonts.googleapis.com" }
        document::Link {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
            crossorigin: "anonymous",
        }
        document::Stylesheet { href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700&display=swap" }
        document::Stylesheet { href: MAIN_CSS }
        document::Stylesheet { href: asset!("/assets/dx-components-theme.css") }
        // Loaded as a module: Dioxus's `asset!()` post-processes JS into
        // an ES module wrapper (the bundle ends with `export default …`),
        // so a classic `<script>` tag throws `Unexpected token 'export'`
        // and breaks `window.ratel` namespace setup. The bundle's only
        // side effect is populating `window.ratel`, which still happens
        // when loaded as a module.
        document::Script { r#type: "module", src: MAIN_JS }
        document::Script { r#type: "module", src: asset!("/assets/wallet-connect.js") }
        document::Script { src: "https://cdn.portone.io/v2/browser-sdk.js" }
        document::Stylesheet { href: asset!("/assets/tailwind.css") }

        // crate::common::Provider {}
        // Top-level SuspenseBoundary catches suspense propagated from
        // `RootLayout` (which calls `Context::init()?` / `TeamContext::init()?`
        // before its rsx! body). Without a boundary above the Router, the
        // suspended scope never gets re-rendered when its resource task
        // resolves, so the entire UI stays blank.
        SuspenseBoundary { Router::<Route> {} }
    }
}
