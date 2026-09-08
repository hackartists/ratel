use crate::*;

/// Close ("X") affordance for the standalone legal pages — privacy policy,
/// terms of service and child safety.
///
/// Those three are reached from the sign-up sheet and from external links, and
/// they render as a bare scrolling document: no topbar, no back button. On the
/// web the browser's back button covers it, but inside the Android/iOS WebView
/// there is no chrome at all and the system back gesture does not reach the
/// SPA router, so the pages were a dead end — the only way out was to kill the
/// app.
///
/// `go_back` is the right action rather than a fixed route: these pages are
/// always pushed on top of wherever the reader was. When there is no history
/// to pop (the page was opened directly by URL, e.g. from the store listing)
/// falling back to the home route keeps the button from doing nothing.
#[component]
pub fn LegalCloseButton() -> Element {
    let nav = use_navigator();
    let tr: LegalCloseTranslate = use_translate();

    rsx! {
        button {
            r#type: "button",
            class: "legal-close",
            "aria-label": "{tr.close}",
            "data-testid": "legal-close",
            onclick: move |_| {
                if nav.can_go_back() {
                    nav.go_back();
                } else {
                    nav.push(Route::Index {});
                }
            },
            svg {
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                line {
                    x1: "18",
                    y1: "6",
                    x2: "6",
                    y2: "18",
                }
                line {
                    x1: "6",
                    y1: "6",
                    x2: "18",
                    y2: "18",
                }
            }
        }
    }
}

translate! {
    LegalCloseTranslate;
    close: {
        en: "Close",
        ko: "닫기",
    },
}
