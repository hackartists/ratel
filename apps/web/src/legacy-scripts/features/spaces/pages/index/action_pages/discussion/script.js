// ESM module. Loaded via `<script type="module">` for auto-init and
// imported by wasm_bindgen for `resetComposerHeight`. Both paths are
// idempotent thanks to `data-*-bound` flags so a double-load is safe.

function resizeTextarea(el) {
  // Reset to `auto` first — `scrollHeight` is clamped by the current
  // height, so reading it without the reset returns the previous value
  // and the textarea never shrinks after backspace.
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function initComposerAutogrow() {
  var inputs = document.querySelectorAll(
    ".comment-input__textarea:not([data-autogrow-bound]), .reply-input__field:not([data-autogrow-bound])",
  );
  inputs.forEach(function (el) {
    el.dataset.autogrowBound = "true";
    el.addEventListener("input", function () {
      resizeTextarea(el);
    });
    // Size for pre-filled content (draft restore) after layout settles.
    requestAnimationFrame(function () {
      resizeTextarea(el);
    });
  });
}

// Called from Rust after a successful submit. Programmatic value changes
// from Dioxus's signal binding do not fire `input`, so the autogrow
// listener never sees the clear and the inline height stays stretched.
export function resetComposerHeight() {
  var inputs = document.querySelectorAll(
    ".comment-input__textarea, .reply-input__field",
  );
  inputs.forEach(function (el) {
    if (!el.value) {
      el.style.height = "";
    }
  });
}

var DROPDOWN_MAX_HEIGHT = 220;
function initMentionFlip() {
  var dropdowns = document.querySelectorAll(
    '[role="listbox"]:not([data-mention-flip-bound])',
  );
  dropdowns.forEach(function (el) {
    var anchor = el.parentElement;
    if (!anchor || !anchor.classList.contains("relative")) return;
    el.dataset.mentionFlipBound = "true";
    var rect = anchor.getBoundingClientRect();
    var spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < DROPDOWN_MAX_HEIGHT) {
      anchor.setAttribute("data-mention-flip", "up");
    } else {
      anchor.removeAttribute("data-mention-flip");
    }
  });
}

// Sheet expand state is Dioxus-managed (see `sheet_expanded` signal in
// component.rs). The handle's click is wired via Rust `onclick`, and the
// `data-expanded` attribute on `.comments-panel` drives the CSS
// translate. Leaving expand state to JS caused it to reset whenever
// Dioxus re-rendered the panel content (e.g., on Reply tap → thread
// drill-down) because the `.expanded` class lived outside the VDOM.

// Drag-to-resize the comments panel. The width is JS-owned because Dioxus
// doesn't set `style` on `.comments-panel` — the inline width survives
// re-renders. CSS provides `min-width: 420px` (the previous fixed width);
// here we cap the upper bound at 70% of viewport so the discussion body
// always keeps room. Listeners are attached to `document` (not the 6px
// handle) so the cursor doesn't fall off the hit-area mid-drag.
var COMMENTS_PANEL_MIN = 420;
var COMMENTS_PANEL_MAX_PCT = 0.7;

function initCommentsPanelResizer() {
  var resizer = document.getElementById("comments-panel-resizer");
  if (!resizer || resizer.dataset.resizerBound) return;
  var panel = document.getElementById("discussion-comments-sheet");
  if (!panel) return;
  resizer.dataset.resizerBound = "true";

  var dragging = false;
  var startX = 0;
  var startWidth = 0;

  function onPointerMove(e) {
    if (!dragging) return;
    var clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
    // Panel is on the right; dragging left (smaller clientX) widens it.
    var deltaX = startX - clientX;
    var newWidth = startWidth + deltaX;
    var maxWidth = window.innerWidth * COMMENTS_PANEL_MAX_PCT;
    if (newWidth < COMMENTS_PANEL_MIN) newWidth = COMMENTS_PANEL_MIN;
    if (newWidth > maxWidth) newWidth = maxWidth;
    panel.style.width = newWidth + "px";
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove("dragging");
    document.body.classList.remove("comments-panel-resizing");
  }

  function onPointerDown(e) {
    e.preventDefault();
    dragging = true;
    startX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
    startWidth = panel.getBoundingClientRect().width;
    resizer.classList.add("dragging");
    document.body.classList.add("comments-panel-resizing");
  }

  resizer.addEventListener("mousedown", onPointerDown);
  resizer.addEventListener("touchstart", onPointerDown, { passive: false });
  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("touchmove", onPointerMove, { passive: false });
  document.addEventListener("mouseup", onPointerUp);
  document.addEventListener("touchend", onPointerUp);
  document.addEventListener("touchcancel", onPointerUp);
}

// Measure each `.comment-text > .comment-item__text` against its 3-line
// CSS clamp; flip `data-truncatable="true"` on the wrapper so the CSS
// rule reveals the "Show more" button. ResizeObserver fires once when
// `observe()` is called and again whenever the element's size changes
// (line-clamp toggle on expand, viewport resize, font load). We skip
// updates while expanded so the "접기" button stays visible.
var commentTextResizeObserver = null;

function getCommentTextObserver() {
  if (commentTextResizeObserver) return commentTextResizeObserver;
  commentTextResizeObserver = new ResizeObserver(function (entries) {
    entries.forEach(function (entry) {
      var textEl = entry.target;
      var wrapper = textEl.parentElement;
      if (!wrapper || !wrapper.classList.contains("comment-text")) return;
      if (wrapper.dataset.expanded === "true") return;
      // +1 tolerance for subpixel rounding.
      var truncated = textEl.scrollHeight > textEl.clientHeight + 1;
      if (truncated) {
        wrapper.dataset.truncatable = "true";
      } else {
        wrapper.removeAttribute("data-truncatable");
      }
    });
  });
  return commentTextResizeObserver;
}

function bindCommentTextObservers() {
  var nodes = document.querySelectorAll(
    ".comment-text .comment-item__text:not([data-truncation-bound])"
  );
  if (nodes.length === 0) return;
  var observer = getCommentTextObserver();
  nodes.forEach(function (el) {
    el.dataset.truncationBound = "true";
    observer.observe(el);
  });
}

// Mobile: drag the bottom sheet up/down instead of only tapping the handle.
// The tap toggle stays — this adds a gesture that tracks the finger between
// the two anchors (collapsed peek and the 75vh expanded height) and snaps to
// whichever one it ended nearest, or to the one the flick was heading toward.
//
// `data-expanded` stays Dioxus-owned (see the note above): JS only writes an
// inline `transform` while the finger is down, then hands the position back
// to CSS. To flip the state it fires a click on the handle, which is the same
// path a tap takes, so the Dioxus signal remains the single source of truth.
var SHEET_DRAG_SLOP_PX = 5;
// px/ms. Above this a flick wins over position, so a short fast swipe down
// closes a sheet that is still nearer the top.
var SHEET_FLICK_VELOCITY = 0.5;

function initCommentsSheetDrag() {
  var panel = document.getElementById("discussion-comments-sheet");
  if (!panel || panel.dataset.dragBound) return;
  var handle = panel.querySelector(".sheet-handle");
  if (!handle) return;
  panel.dataset.dragBound = "true";

  var startY = 0;
  var baseY = 0;
  var lastY = 0;
  var lastT = 0;
  var velocity = 0;
  var maxY = 0;
  var dragged = false;
  var active = false;
  var swallowNextClick = false;
  var swallowTimer = null;

  // Distance between the two anchors: the collapsed sheet shows only the
  // handle (plus the safe-area strip the CSS pads with), so that is exactly
  // how far it travels.
  function collapsedOffset() {
    var padBottom = parseFloat(getComputedStyle(panel).paddingBottom) || 0;
    return Math.max(0, panel.offsetHeight - handle.offsetHeight - padBottom);
  }

  function isExpanded() {
    return panel.getAttribute("data-expanded") === "true";
  }

  function begin(clientY) {
    // Desktop keeps the panel as a static column — the handle is CSS-hidden
    // there, but guard anyway so a stray mouse drag can not move it.
    if (getComputedStyle(handle).display === "none") return;
    active = true;
    dragged = false;
    maxY = collapsedOffset();
    baseY = isExpanded() ? 0 : maxY;
    startY = clientY;
    lastY = clientY;
    lastT = Date.now();
    velocity = 0;
    panel.classList.add("dragging");
  }

  function move(clientY) {
    if (!active) return;
    var dy = clientY - startY;
    if (!dragged && Math.abs(dy) < SHEET_DRAG_SLOP_PX) return;
    dragged = true;
    var now = Date.now();
    var dt = now - lastT;
    if (dt > 0) velocity = (clientY - lastY) / dt;
    lastY = clientY;
    lastT = now;
    var y = baseY + dy;
    if (y < 0) y = 0;
    if (y > maxY) y = maxY;
    panel.style.transform = "translateY(" + y + "px)";
  }

  function end() {
    if (!active) return;
    active = false;
    panel.classList.remove("dragging");
    if (!dragged) return;

    var y = baseY + (lastY - startY);
    if (y < 0) y = 0;
    if (y > maxY) y = maxY;

    var wantExpanded;
    if (Math.abs(velocity) > SHEET_FLICK_VELOCITY) {
      wantExpanded = velocity < 0;
    } else {
      wantExpanded = y < maxY / 2;
    }

    // Settle to the target with the CSS transition back on, then drop the
    // inline transform once `data-expanded` has caught up so CSS owns the
    // resting position again.
    panel.style.transform = "translateY(" + (wantExpanded ? 0 : maxY) + "px)";

    // A drag past the UA's slop usually suppresses the synthetic click, but
    // not always — swallow it either way and drive the toggle ourselves.
    swallowNextClick = true;
    if (swallowTimer) clearTimeout(swallowTimer);
    swallowTimer = setTimeout(function () {
      swallowNextClick = false;
    }, 400);

    setTimeout(function () {
      if (wantExpanded !== isExpanded()) {
        swallowNextClick = false;
        handle.click();
      }
    }, 0);

    setTimeout(function () {
      panel.style.transform = "";
    }, 420);
  }

  handle.addEventListener(
    "click",
    function (e) {
      if (!swallowNextClick) return;
      swallowNextClick = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true
  );

  // Passive: `.sheet-handle` carries `touch-action: none`, so the browser
  // never starts a native scroll here and there is nothing to cancel.
  handle.addEventListener(
    "touchstart",
    function (e) {
      begin(e.touches[0].clientY);
    },
    { passive: true }
  );
  handle.addEventListener(
    "touchmove",
    function (e) {
      move(e.touches[0].clientY);
    },
    { passive: true }
  );
  handle.addEventListener("touchend", end);
  handle.addEventListener("touchcancel", end);

  handle.addEventListener("mousedown", function (e) {
    begin(e.clientY);

    function onMouseMove(ev) {
      move(ev.clientY);
    }
    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      end();
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

function init() {
  initComposerAutogrow();
  initMentionFlip();
  initCommentsPanelResizer();
  initCommentsSheetDrag();
  bindCommentTextObservers();
}

init();
new MutationObserver(function () {
  init();
}).observe(document.body, { childList: true, subtree: true });
