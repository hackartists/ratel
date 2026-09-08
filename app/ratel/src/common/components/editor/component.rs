use crate::common::*;
use serde::{Deserialize, Serialize};

/// Caret-anchored slash-command signal — emitted by the editor's JS
/// when it detects a `/<word>` pattern at the caret. `raw` is the full
/// matched token starting with `/`; an empty `raw` means the slash
/// state was cleared (caret moved, popup should close). Coordinates
/// are viewport-relative pixel offsets from `getBoundingClientRect`.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct EditorSlashSignal {
    pub raw: String,
    pub caret_x: f64,
    pub caret_y: f64,
    /// `"below"` (popup top sits right under the caret) or
    /// `"above"` (popup bottom sits right above the caret) — flipped
    /// when the lower part of the viewport doesn't have room.
    pub placement: String,
}

#[derive(Props, Clone, PartialEq)]
pub struct EditorProps {
    #[props(default)]
    pub content: String,
    #[props(default = true)]
    pub editable: bool,
    #[props(default = "Type here...".to_string())]
    pub placeholder: String,
    #[props(default)]
    pub on_content_change: Option<EventHandler<String>>,
    #[props(default)]
    pub class: String,
    /// Optional "Insert data" affordance — when set, the toolbar
    /// renders an extra primary-tone button that fires this handler.
    /// Consumers (e.g. the report detail page) open a picker modal in
    /// response and write back to `content` to inject a block.
    #[props(default)]
    pub on_insert_data: Option<EventHandler<()>>,
    /// Label shown next to the insert-data icon. Defaults to the
    /// English string; pass a translated string from the consumer.
    #[props(default = "Insert data".to_string())]
    pub insert_data_label: String,
    /// Optional slash-command hook. The editor's JS watches every input
    /// and parses a `/<word>` token at the caret; each transition (open,
    /// keystroke, clear) fires this handler. Empty `raw` ⇒ cleared.
    /// Consumers render a popup anchored at the supplied caret position.
    #[props(default)]
    pub on_slash: Option<EventHandler<EditorSlashSignal>>,
}

#[component]
pub fn Editor(props: EditorProps) -> Element {
    // Snapshot the initial HTML once at mount and never re-apply it on
    // subsequent renders. Re-applying `dangerous_inner_html` on every
    // render destroys the user's caret position — most visibly during
    // Korean (or any IME) composition where every keystroke triggers
    // `on_content_change` → `content.set` → re-render → innerHTML
    // overwrite → cursor jumps to start. Use `key=` on the parent to
    // force a remount when the editor needs to be reset.
    let content = use_hook(|| props.content.clone());
    let placeholder = props.placeholder.clone();
    let is_editable = props.editable;
    let editable = if is_editable { "true" } else { "false" };
    let extra_class = props.class.clone();
    let slash_enabled = props.on_slash.is_some();
    let slash_attr = if slash_enabled { "true" } else { "false" };
    // Only the mobile format sheet needs translated strings — the desktop
    // toolbar communicates through icons plus `data-tip` tooltips, which
    // have no mobile equivalent (there is no hover), so the sheet spells
    // every command out in words instead.
    let tr: EditorTranslate = use_translate();

    rsx! {
        document::Script { defer: true, src: asset!("./script.js") }

        div {
            class: "ratel-editor {extra_class}",
            "data-bound": "false",
            "data-placeholder": "{placeholder}",
            "data-editable": "{editable}",
            "data-slash": "{slash_attr}",
            // Hidden input bridge — JS writes the latest editor HTML into
            // its `value` and dispatches a synthetic `input` event. Going
            // through a real <input> instead of a div CustomEvent is the
            // only reliable way to get the payload across Dioxus's mobile
            // IPC bridge (the WebView serializes form values, not custom
            // event detail fields).
            input {
                class: "re-bridge",
                r#type: "text",
                hidden: true,
                "aria-hidden": "true",
                tabindex: "-1",
                oninput: move |evt| {
                    if let Some(handler) = &props.on_content_change {
                        handler.call(evt.value());
                    }
                },
            }
            // Second bridge: JS writes a JSON-encoded `EditorSlashSignal`
            // (or empty string for "cleared") whenever it detects a
            // `/<word>` token at the caret. Only rendered when the
            // consumer opted into the slash hook so the JS watcher knows
            // to attach.
            if slash_enabled {
                input {
                    class: "re-slash-bridge",
                    r#type: "text",
                    hidden: true,
                    "aria-hidden": "true",
                    tabindex: "-1",
                    oninput: move |evt| {
                        let Some(handler) = &props.on_slash else {
                            return;
                        };
                        let raw = evt.value();
                        if raw.is_empty() {
                            handler.call(EditorSlashSignal::default());
                            return;
                        }
                        match serde_json::from_str::<EditorSlashSignal>(&raw) {
                            Ok(signal) => handler.call(signal),
                            Err(_) => handler.call(EditorSlashSignal::default()),
                        }
                    },
                }
            }
            if is_editable {
                div {
                    aria_label: "Editor toolbar",
                    class: "re-toolbar",
                    role: "toolbar",
                    div { class: "re-toolbar__group",
                        button {
                            aria_label: "Undo",
                            class: "re-tb-btn",
                            "data-cmd": "undo",
                            "data-tip": "Undo",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                path { d: "M3 7v6h6" }
                                path { d: "M21 17a9 9 0 0 0-15-6.7L3 13" }
                            }
                        }
                        button {
                            aria_label: "Redo",
                            class: "re-tb-btn",
                            "data-cmd": "redo",
                            "data-tip": "Redo",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                path { d: "M21 7v6h-6" }
                                path { d: "M3 17a9 9 0 0 1 15-6.7L21 13" }
                            }
                        }
                    }
                    div { class: "re-toolbar__group",
                        div { class: "re-block", "data-open": "false",
                            button {
                                aria_expanded: "false",
                                aria_haspopup: "listbox",
                                class: "re-block__btn",
                                r#type: "button",
                                span { class: "re-block__label", "Paragraph" }
                                svg {
                                    fill: "none",
                                    stroke: "currentColor",
                                    stroke_linecap: "round",
                                    stroke_linejoin: "round",
                                    stroke_width: "2.5",
                                    view_box: "0 0 24 24",
                                    polyline { points: "6 9 12 15 18 9" }
                                }
                            }
                            div { class: "re-block__menu", role: "listbox",
                                button {
                                    class: "re-block__item",
                                    "data-block": "P",
                                    r#type: "button",
                                    span { "Paragraph" }
                                    span { class: "re-block__item-hint", "P" }
                                }
                                button {
                                    class: "re-block__item re-block__item--h1",
                                    "data-block": "H1",
                                    r#type: "button",
                                    span { "Heading 1" }
                                    span { class: "re-block__item-hint", "H1" }
                                }
                                button {
                                    class: "re-block__item re-block__item--h2",
                                    "data-block": "H2",
                                    r#type: "button",
                                    span { "Heading 2" }
                                    span { class: "re-block__item-hint", "H2" }
                                }
                                button {
                                    class: "re-block__item re-block__item--h3",
                                    "data-block": "H3",
                                    r#type: "button",
                                    span { "Heading 3" }
                                    span { class: "re-block__item-hint", "H3" }
                                }
                                button {
                                    class: "re-block__item re-block__item--quote",
                                    "data-block": "BLOCKQUOTE",
                                    r#type: "button",
                                    span { "Quote" }
                                    span { class: "re-block__item-hint", "\"" }
                                }
                                button {
                                    class: "re-block__item re-block__item--code",
                                    "data-block": "PRE",
                                    r#type: "button",
                                    span { "Code block" }
                                    span { class: "re-block__item-hint", "{{ }}" }
                                }
                            }
                        }
                    }
                    div { class: "re-toolbar__group",
                        button {
                            aria_label: "Bold",
                            class: "re-tb-btn",
                            "data-cmd": "bold",
                            "data-tip": "Bold",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2.4",
                                view_box: "0 0 24 24",
                                path { d: "M6 4h8a4 4 0 0 1 0 8H6z" }
                                path { d: "M6 12h9a4 4 0 0 1 0 8H6z" }
                            }
                        }
                        button {
                            aria_label: "Italic",
                            class: "re-tb-btn",
                            "data-cmd": "italic",
                            "data-tip": "Italic",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                line {
                                    x1: "19",
                                    x2: "10",
                                    y1: "4",
                                    y2: "4",
                                }
                                line {
                                    x1: "14",
                                    x2: "5",
                                    y1: "20",
                                    y2: "20",
                                }
                                line {
                                    x1: "15",
                                    x2: "9",
                                    y1: "4",
                                    y2: "20",
                                }
                            }
                        }
                        button {
                            aria_label: "Underline",
                            class: "re-tb-btn",
                            "data-cmd": "underline",
                            "data-tip": "Underline",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                path { d: "M6 4v6a6 6 0 0 0 12 0V4" }
                                line {
                                    x1: "4",
                                    x2: "20",
                                    y1: "20",
                                    y2: "20",
                                }
                            }
                        }
                        button {
                            aria_label: "Strikethrough",
                            class: "re-tb-btn",
                            "data-cmd": "strikeThrough",
                            "data-tip": "Strikethrough",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                line {
                                    x1: "4",
                                    x2: "20",
                                    y1: "12",
                                    y2: "12",
                                }
                                path { d: "M16 6c-1.5-1.3-3.5-2-6-2-3 0-5 1.5-5 4 0 2 1.5 3 5 4" }
                                path { d: "M8 18c1.5 1.3 3.5 2 6 2 3 0 5-1.5 5-4 0-1-.4-1.8-1-2.4" }
                            }
                        }
                        button {
                            aria_label: "Inline code",
                            class: "re-tb-btn",
                            "data-cmd": "code-inline",
                            "data-tip": "Inline code",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                polyline { points: "16 18 22 12 16 6" }
                                polyline { points: "8 6 2 12 8 18" }
                            }
                        }
                    }
                    div { class: "re-toolbar__group",
                        button {
                            aria_label: "Align left",
                            class: "re-tb-btn",
                            "data-cmd": "justifyLeft",
                            "data-tip": "Align left",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                line {
                                    x1: "17",
                                    x2: "3",
                                    y1: "10",
                                    y2: "10",
                                }
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "6",
                                    y2: "6",
                                }
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "14",
                                    y2: "14",
                                }
                                line {
                                    x1: "17",
                                    x2: "3",
                                    y1: "18",
                                    y2: "18",
                                }
                            }
                        }
                        button {
                            aria_label: "Align center",
                            class: "re-tb-btn",
                            "data-cmd": "justifyCenter",
                            "data-tip": "Align center",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                line {
                                    x1: "18",
                                    x2: "6",
                                    y1: "10",
                                    y2: "10",
                                }
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "6",
                                    y2: "6",
                                }
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "14",
                                    y2: "14",
                                }
                                line {
                                    x1: "18",
                                    x2: "6",
                                    y1: "18",
                                    y2: "18",
                                }
                            }
                        }
                        button {
                            aria_label: "Align right",
                            class: "re-tb-btn",
                            "data-cmd": "justifyRight",
                            "data-tip": "Align right",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                line {
                                    x1: "21",
                                    x2: "7",
                                    y1: "10",
                                    y2: "10",
                                }
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "6",
                                    y2: "6",
                                }
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "14",
                                    y2: "14",
                                }
                                line {
                                    x1: "21",
                                    x2: "7",
                                    y1: "18",
                                    y2: "18",
                                }
                            }
                        }
                        button {
                            aria_label: "Justify",
                            class: "re-tb-btn",
                            "data-cmd": "justifyFull",
                            "data-tip": "Justify",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "10",
                                    y2: "10",
                                }
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "6",
                                    y2: "6",
                                }
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "14",
                                    y2: "14",
                                }
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "18",
                                    y2: "18",
                                }
                            }
                        }
                    }
                    div { class: "re-toolbar__group",
                        button {
                            aria_label: "Bullet list",
                            class: "re-tb-btn",
                            "data-cmd": "insertUnorderedList",
                            "data-tip": "Bullet list",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                line {
                                    x1: "8",
                                    x2: "21",
                                    y1: "6",
                                    y2: "6",
                                }
                                line {
                                    x1: "8",
                                    x2: "21",
                                    y1: "12",
                                    y2: "12",
                                }
                                line {
                                    x1: "8",
                                    x2: "21",
                                    y1: "18",
                                    y2: "18",
                                }
                                circle { cx: "4", cy: "6", r: "1" }
                                circle { cx: "4", cy: "12", r: "1" }
                                circle { cx: "4", cy: "18", r: "1" }
                            }
                        }
                        button {
                            aria_label: "Numbered list",
                            class: "re-tb-btn",
                            "data-cmd": "insertOrderedList",
                            "data-tip": "Numbered list",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                line {
                                    x1: "10",
                                    x2: "21",
                                    y1: "6",
                                    y2: "6",
                                }
                                line {
                                    x1: "10",
                                    x2: "21",
                                    y1: "12",
                                    y2: "12",
                                }
                                line {
                                    x1: "10",
                                    x2: "21",
                                    y1: "18",
                                    y2: "18",
                                }
                                path { d: "M4 6h1v4" }
                                path { d: "M4 10h2" }
                                path { d: "M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" }
                            }
                        }
                        button {
                            aria_label: "Outdent",
                            class: "re-tb-btn",
                            "data-cmd": "outdent",
                            "data-tip": "Outdent",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "5",
                                    y2: "5",
                                }
                                line {
                                    x1: "21",
                                    x2: "3",
                                    y1: "19",
                                    y2: "19",
                                }
                                line {
                                    x1: "21",
                                    x2: "11",
                                    y1: "9",
                                    y2: "9",
                                }
                                line {
                                    x1: "21",
                                    x2: "11",
                                    y1: "15",
                                    y2: "15",
                                }
                                polyline { points: "7 9 3 12 7 15" }
                            }
                        }
                        button {
                            aria_label: "Indent",
                            class: "re-tb-btn",
                            "data-cmd": "indent",
                            "data-tip": "Indent",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                line {
                                    x1: "3",
                                    x2: "21",
                                    y1: "5",
                                    y2: "5",
                                }
                                line {
                                    x1: "3",
                                    x2: "21",
                                    y1: "19",
                                    y2: "19",
                                }
                                line {
                                    x1: "13",
                                    x2: "3",
                                    y1: "9",
                                    y2: "9",
                                }
                                line {
                                    x1: "13",
                                    x2: "3",
                                    y1: "15",
                                    y2: "15",
                                }
                                polyline { points: "17 9 21 12 17 15" }
                            }
                        }
                    }
                    div { class: "re-toolbar__group",
                        button {
                            aria_label: "Insert link",
                            class: "re-tb-btn",
                            "data-cmd": "link",
                            "data-tip": "Insert link",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                path { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }
                                path { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }
                            }
                        }
                        button {
                            aria_label: "Remove link",
                            class: "re-tb-btn",
                            "data-cmd": "unlink",
                            "data-tip": "Remove link",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                path { d: "M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" }
                                path { d: "M5.16 11.75L3.44 13.46a5 5 0 0 0 7.07 7.07l1.71-1.71" }
                                line {
                                    x1: "2",
                                    x2: "22",
                                    y1: "2",
                                    y2: "22",
                                }
                            }
                        }
                        button {
                            aria_label: "Insert image",
                            class: "re-tb-btn",
                            "data-cmd": "image",
                            "data-tip": "Insert image",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                rect {
                                    height: "18",
                                    rx: "2",
                                    width: "18",
                                    x: "3",
                                    y: "3",
                                }
                                circle { cx: "8.5", cy: "8.5", r: "1.5" }
                                polyline { points: "21 15 16 10 5 21" }
                            }
                        }
                        button {
                            aria_label: "Embed YouTube",
                            class: "re-tb-btn",
                            "data-cmd": "youtube",
                            "data-tip": "Embed YouTube",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                path { d: "M22 8.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v7a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4z" }
                                polygon { points: "10 8 16 12 10 16 10 8" }
                            }
                        }
                        button {
                            aria_label: "Insert table",
                            class: "re-tb-btn",
                            "data-cmd": "table",
                            "data-tip": "Insert table",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                rect {
                                    height: "18",
                                    rx: "2",
                                    width: "18",
                                    x: "3",
                                    y: "3",
                                }
                                line {
                                    x1: "3",
                                    x2: "21",
                                    y1: "9",
                                    y2: "9",
                                }
                                line {
                                    x1: "3",
                                    x2: "21",
                                    y1: "15",
                                    y2: "15",
                                }
                                line {
                                    x1: "9",
                                    x2: "9",
                                    y1: "3",
                                    y2: "21",
                                }
                                line {
                                    x1: "15",
                                    x2: "15",
                                    y1: "3",
                                    y2: "21",
                                }
                            }
                        }
                        button {
                            aria_label: "Horizontal rule",
                            class: "re-tb-btn",
                            "data-cmd": "hr",
                            "data-tip": "Horizontal rule",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                line {
                                    x1: "4",
                                    x2: "20",
                                    y1: "12",
                                    y2: "12",
                                }
                            }
                        }
                    }
                    div { class: "re-toolbar__group",
                        button {
                            aria_label: "Clear formatting",
                            class: "re-tb-btn",
                            "data-cmd": "removeFormat",
                            "data-tip": "Clear formatting",
                            r#type: "button",
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2",
                                view_box: "0 0 24 24",
                                path { d: "M4 7V4h16v3" }
                                line {
                                    x1: "5",
                                    x2: "11",
                                    y1: "20",
                                    y2: "20",
                                }
                                line {
                                    x1: "13",
                                    x2: "8",
                                    y1: "4",
                                    y2: "20",
                                }
                                line {
                                    x1: "3",
                                    x2: "21",
                                    y1: "3",
                                    y2: "21",
                                }
                            }
                        }
                    }
                    if let Some(handler) = props.on_insert_data {
                        div { class: "re-toolbar__group re-toolbar__group--insert",
                            button {
                                aria_label: "{props.insert_data_label}",
                                class: "re-tb-btn re-tb-btn--insert-data",
                                "data-tip": "{props.insert_data_label}",
                                r#type: "button",
                                onclick: move |_| handler.call(()),
                                svg {
                                    fill: "none",
                                    stroke: "currentColor",
                                    stroke_linecap: "round",
                                    stroke_linejoin: "round",
                                    stroke_width: "2.2",
                                    view_box: "0 0 24 24",
                                    polyline { points: "22 12 18 12 15 21 9 3 6 12 2 12" }
                                }
                                span { "{props.insert_data_label}" }
                            }
                        }
                    }
                }
            }
            if is_editable {
                // ── Mobile format surface ─────────────────────────────
                // Below 980px the wide `.re-toolbar` degrades into a
                // horizontally-scrollable strip — every command past the
                // fourth is off-screen and undiscoverable on a phone. CSS
                // hides the toolbar there and shows this pair instead: a
                // compact always-visible bar plus a Slack-style bottom
                // sheet holding the full command set, laid out in labelled
                // sections rather than one long row.
                //
                // Nothing new is wired up: every button carries the same
                // `data-cmd` / `data-block` the toolbar uses, so the
                // editor's existing delegated handlers and `aria-pressed`
                // state sync pick these up unchanged. Desktop rendering is
                // untouched — both nodes are `display: none` above 980px.
                div {
                    class: "re-mobile-bar",
                    role: "toolbar",
                    aria_label: "{tr.format}",
                    button {
                        aria_expanded: "false",
                        aria_label: "{tr.format}",
                        class: "re-mobile-bar__fmt",
                        "data-fmt-open": "true",
                        r#type: "button",
                        span { class: "re-mobile-bar__fmt-glyph", "Aa" }
                        span { class: "re-mobile-bar__fmt-label", "{tr.format}" }
                    }
                    button {
                        aria_label: "{tr.image}",
                        class: "re-tb-btn re-mobile-bar__btn",
                        "data-cmd": "image",
                        r#type: "button",
                        svg {
                            fill: "none",
                            stroke: "currentColor",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            stroke_width: "2",
                            view_box: "0 0 24 24",
                            rect {
                                height: "18",
                                rx: "2",
                                width: "18",
                                x: "3",
                                y: "3",
                            }
                            circle { cx: "8.5", cy: "8.5", r: "1.5" }
                            polyline { points: "21 15 16 10 5 21" }
                        }
                    }
                    button {
                        aria_label: "{tr.link}",
                        class: "re-tb-btn re-mobile-bar__btn",
                        "data-cmd": "link",
                        r#type: "button",
                        svg {
                            fill: "none",
                            stroke: "currentColor",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            stroke_width: "2",
                            view_box: "0 0 24 24",
                            path { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }
                            path { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }
                        }
                    }
                    if let Some(handler) = props.on_insert_data {
                        button {
                            aria_label: "{props.insert_data_label}",
                            class: "re-mobile-bar__btn re-mobile-bar__btn--insert",
                            r#type: "button",
                            onclick: move |_| handler.call(()),
                            svg {
                                fill: "none",
                                stroke: "currentColor",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                stroke_width: "2.2",
                                view_box: "0 0 24 24",
                                polyline { points: "22 12 18 12 15 21 9 3 6 12 2 12" }
                            }
                        }
                    }
                }
                div { class: "re-fmt-sheet", "data-open": "false",
                    div {
                        class: "re-fmt-sheet__scrim",
                        "data-fmt-close": "true",
                    }
                    div {
                        aria_label: "{tr.format}",
                        aria_modal: "false",
                        class: "re-fmt-sheet__panel",
                        role: "dialog",
                        div { class: "re-fmt-sheet__grip" }
                        div { class: "re-fmt-sheet__head",
                            span { class: "re-fmt-sheet__title", "{tr.format}" }
                            button {
                                class: "re-fmt-sheet__done",
                                "data-fmt-close": "true",
                                r#type: "button",
                                "{tr.done}"
                            }
                        }
                        div { class: "re-fmt-sheet__body",
                            div { class: "re-fmt-sheet__section",
                                span { class: "re-fmt-sheet__label", "{tr.text_style}" }
                                div { class: "re-fmt-sheet__blocks",
                                    button {
                                        class: "re-fmt-block re-fmt-block--p",
                                        "data-block": "P",
                                        r#type: "button",
                                        "{tr.body}"
                                    }
                                    button {
                                        class: "re-fmt-block re-fmt-block--h1",
                                        "data-block": "H1",
                                        r#type: "button",
                                        "{tr.heading1}"
                                    }
                                    button {
                                        class: "re-fmt-block re-fmt-block--h2",
                                        "data-block": "H2",
                                        r#type: "button",
                                        "{tr.heading2}"
                                    }
                                    button {
                                        class: "re-fmt-block re-fmt-block--h3",
                                        "data-block": "H3",
                                        r#type: "button",
                                        "{tr.heading3}"
                                    }
                                    button {
                                        class: "re-fmt-block re-fmt-block--quote",
                                        "data-block": "BLOCKQUOTE",
                                        r#type: "button",
                                        "{tr.quote}"
                                    }
                                    button {
                                        class: "re-fmt-block re-fmt-block--code",
                                        "data-block": "PRE",
                                        r#type: "button",
                                        "{tr.code_block}"
                                    }
                                }
                            }
                            div { class: "re-fmt-sheet__section",
                                span { class: "re-fmt-sheet__label", "{tr.emphasis}" }
                                div { class: "re-fmt-sheet__row",
                                    button {
                                        aria_label: "{tr.bold}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "bold",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2.4",
                                            view_box: "0 0 24 24",
                                            path { d: "M6 4h8a4 4 0 0 1 0 8H6z" }
                                            path { d: "M6 12h9a4 4 0 0 1 0 8H6z" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.bold}" }
                                    }
                                    button {
                                        aria_label: "{tr.italic}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "italic",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            line {
                                                x1: "19",
                                                x2: "10",
                                                y1: "4",
                                                y2: "4",
                                            }
                                            line {
                                                x1: "14",
                                                x2: "5",
                                                y1: "20",
                                                y2: "20",
                                            }
                                            line {
                                                x1: "15",
                                                x2: "9",
                                                y1: "4",
                                                y2: "20",
                                            }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.italic}" }
                                    }
                                    button {
                                        aria_label: "{tr.underline}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "underline",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            path { d: "M6 4v6a6 6 0 0 0 12 0V4" }
                                            line {
                                                x1: "4",
                                                x2: "20",
                                                y1: "20",
                                                y2: "20",
                                            }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.underline}" }
                                    }
                                    button {
                                        aria_label: "{tr.strikethrough}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "strikeThrough",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            line {
                                                x1: "4",
                                                x2: "20",
                                                y1: "12",
                                                y2: "12",
                                            }
                                            path { d: "M16 6c-1.5-1.3-3.5-2-6-2-3 0-5 1.5-5 4 0 2 1.5 3 5 4" }
                                            path { d: "M8 18c1.5 1.3 3.5 2 6 2 3 0 5-1.5 5-4 0-1-.4-1.8-1-2.4" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.strikethrough}" }
                                    }
                                    button {
                                        aria_label: "{tr.inline_code}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "code-inline",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            polyline { points: "16 18 22 12 16 6" }
                                            polyline { points: "8 6 2 12 8 18" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.inline_code}" }
                                    }
                                }
                            }
                            div { class: "re-fmt-sheet__section",
                                span { class: "re-fmt-sheet__label", "{tr.lists}" }
                                div { class: "re-fmt-sheet__row",
                                    button {
                                        aria_label: "{tr.bullet_list}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "insertUnorderedList",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            line {
                                                x1: "8",
                                                x2: "21",
                                                y1: "6",
                                                y2: "6",
                                            }
                                            line {
                                                x1: "8",
                                                x2: "21",
                                                y1: "12",
                                                y2: "12",
                                            }
                                            line {
                                                x1: "8",
                                                x2: "21",
                                                y1: "18",
                                                y2: "18",
                                            }
                                            circle { cx: "4", cy: "6", r: "1" }
                                            circle { cx: "4", cy: "12", r: "1" }
                                            circle { cx: "4", cy: "18", r: "1" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.bullet_list}" }
                                    }
                                    button {
                                        aria_label: "{tr.numbered_list}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "insertOrderedList",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            line {
                                                x1: "10",
                                                x2: "21",
                                                y1: "6",
                                                y2: "6",
                                            }
                                            line {
                                                x1: "10",
                                                x2: "21",
                                                y1: "12",
                                                y2: "12",
                                            }
                                            line {
                                                x1: "10",
                                                x2: "21",
                                                y1: "18",
                                                y2: "18",
                                            }
                                            path { d: "M4 6h1v4" }
                                            path { d: "M4 10h2" }
                                            path { d: "M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.numbered_list}" }
                                    }
                                    button {
                                        aria_label: "{tr.outdent}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "outdent",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "5",
                                                y2: "5",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "19",
                                                y2: "19",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "11",
                                                y1: "9",
                                                y2: "9",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "11",
                                                y1: "15",
                                                y2: "15",
                                            }
                                            polyline { points: "7 9 3 12 7 15" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.outdent}" }
                                    }
                                    button {
                                        aria_label: "{tr.indent}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "indent",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            line {
                                                x1: "3",
                                                x2: "21",
                                                y1: "5",
                                                y2: "5",
                                            }
                                            line {
                                                x1: "3",
                                                x2: "21",
                                                y1: "19",
                                                y2: "19",
                                            }
                                            line {
                                                x1: "13",
                                                x2: "3",
                                                y1: "9",
                                                y2: "9",
                                            }
                                            line {
                                                x1: "13",
                                                x2: "3",
                                                y1: "15",
                                                y2: "15",
                                            }
                                            polyline { points: "17 9 21 12 17 15" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.indent}" }
                                    }
                                }
                            }
                            div { class: "re-fmt-sheet__section",
                                span { class: "re-fmt-sheet__label", "{tr.alignment}" }
                                div { class: "re-fmt-sheet__row",
                                    button {
                                        aria_label: "{tr.align_left}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "justifyLeft",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            line {
                                                x1: "17",
                                                x2: "3",
                                                y1: "10",
                                                y2: "10",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "6",
                                                y2: "6",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "14",
                                                y2: "14",
                                            }
                                            line {
                                                x1: "17",
                                                x2: "3",
                                                y1: "18",
                                                y2: "18",
                                            }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.align_left}" }
                                    }
                                    button {
                                        aria_label: "{tr.align_center}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "justifyCenter",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            line {
                                                x1: "18",
                                                x2: "6",
                                                y1: "10",
                                                y2: "10",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "6",
                                                y2: "6",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "14",
                                                y2: "14",
                                            }
                                            line {
                                                x1: "18",
                                                x2: "6",
                                                y1: "18",
                                                y2: "18",
                                            }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.align_center}" }
                                    }
                                    button {
                                        aria_label: "{tr.align_right}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "justifyRight",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            line {
                                                x1: "21",
                                                x2: "7",
                                                y1: "10",
                                                y2: "10",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "6",
                                                y2: "6",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "14",
                                                y2: "14",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "7",
                                                y1: "18",
                                                y2: "18",
                                            }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.align_right}" }
                                    }
                                    button {
                                        aria_label: "{tr.align_justify}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "justifyFull",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "10",
                                                y2: "10",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "6",
                                                y2: "6",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "14",
                                                y2: "14",
                                            }
                                            line {
                                                x1: "21",
                                                x2: "3",
                                                y1: "18",
                                                y2: "18",
                                            }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.align_justify}" }
                                    }
                                }
                            }
                            div { class: "re-fmt-sheet__section",
                                span { class: "re-fmt-sheet__label", "{tr.insert}" }
                                div { class: "re-fmt-sheet__row",
                                    button {
                                        aria_label: "{tr.link}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "link",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            path { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }
                                            path { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.link}" }
                                    }
                                    button {
                                        aria_label: "{tr.unlink}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "unlink",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            path { d: "M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" }
                                            path { d: "M5.16 11.75L3.44 13.46a5 5 0 0 0 7.07 7.07l1.71-1.71" }
                                            line {
                                                x1: "2",
                                                x2: "22",
                                                y1: "2",
                                                y2: "22",
                                            }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.unlink}" }
                                    }
                                    button {
                                        aria_label: "{tr.image}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "image",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            rect {
                                                height: "18",
                                                rx: "2",
                                                width: "18",
                                                x: "3",
                                                y: "3",
                                            }
                                            circle {
                                                cx: "8.5",
                                                cy: "8.5",
                                                r: "1.5",
                                            }
                                            polyline { points: "21 15 16 10 5 21" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.image}" }
                                    }
                                    button {
                                        aria_label: "{tr.video}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "youtube",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            path { d: "M22 8.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v7a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4z" }
                                            polygon { points: "10 8 16 12 10 16 10 8" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.video}" }
                                    }
                                    button {
                                        aria_label: "{tr.table}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "table",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            rect {
                                                height: "18",
                                                rx: "2",
                                                width: "18",
                                                x: "3",
                                                y: "3",
                                            }
                                            line {
                                                x1: "3",
                                                x2: "21",
                                                y1: "9",
                                                y2: "9",
                                            }
                                            line {
                                                x1: "3",
                                                x2: "21",
                                                y1: "15",
                                                y2: "15",
                                            }
                                            line {
                                                x1: "9",
                                                x2: "9",
                                                y1: "3",
                                                y2: "21",
                                            }
                                            line {
                                                x1: "15",
                                                x2: "15",
                                                y1: "3",
                                                y2: "21",
                                            }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.table}" }
                                    }
                                    button {
                                        aria_label: "{tr.divider}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "hr",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            line {
                                                x1: "4",
                                                x2: "20",
                                                y1: "12",
                                                y2: "12",
                                            }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.divider}" }
                                    }
                                }
                            }
                            div { class: "re-fmt-sheet__section",
                                span { class: "re-fmt-sheet__label", "{tr.clear}" }
                                div { class: "re-fmt-sheet__row",
                                    button {
                                        aria_label: "{tr.clear_format}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "removeFormat",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            path { d: "M4 7V4h16v3" }
                                            line {
                                                x1: "5",
                                                x2: "11",
                                                y1: "20",
                                                y2: "20",
                                            }
                                            line {
                                                x1: "13",
                                                x2: "8",
                                                y1: "4",
                                                y2: "20",
                                            }
                                            line {
                                                x1: "3",
                                                x2: "21",
                                                y1: "3",
                                                y2: "21",
                                            }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.clear_format}" }
                                    }
                                }
                            }
                            // Undo/redo live here rather than in the compact
                            // bar: the bar has to fit a 360dp phone (the most
                            // common Android width) without clipping, and of
                            // everything competing for that space these two are
                            // the least reached for on a touch keyboard, which
                            // carries its own undo gesture.
                            div { class: "re-fmt-sheet__section",
                                span { class: "re-fmt-sheet__label", "{tr.history}" }
                                div { class: "re-fmt-sheet__row",
                                    button {
                                        aria_label: "{tr.undo}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "undo",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            path { d: "M3 7v6h6" }
                                            path { d: "M21 17a9 9 0 0 0-15-6.7L3 13" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.undo}" }
                                    }
                                    button {
                                        aria_label: "{tr.redo}",
                                        class: "re-tb-btn re-fmt-btn",
                                        "data-cmd": "redo",
                                        r#type: "button",
                                        svg {
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_linecap: "round",
                                            stroke_linejoin: "round",
                                            stroke_width: "2",
                                            view_box: "0 0 24 24",
                                            path { d: "M21 7v6h-6" }
                                            path { d: "M3 17a9 9 0 0 1 15-6.7L21 13" }
                                        }
                                        span { class: "re-fmt-btn__label", "{tr.redo}" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            div {
                autocapitalize: "sentences",
                class: "re-content",
                contenteditable: "{editable}",
                "data-empty": "true",
                spellcheck: "true",
                dangerous_inner_html: "{content}",
            }
            if is_editable {
                // Floating mini-toolbar shown when the caret is inside
                // a `<table>` in the body. Buttons are pure DOM ops
                // (no execCommand) so they work consistently across
                // browsers. JS positions + toggles visibility.
                div {
                    class: "re-table-actions",
                    role: "toolbar",
                    "aria-label": "Table actions",
                    "data-visible": "false",
                    button {
                        class: "re-table-actions__btn",
                        "data-act": "row-above",
                        "data-tip": "Insert row above",
                        r#type: "button",
                        "aria-label": "Insert row above",
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            path { d: "M12 5v8" }
                            path { d: "M8 9l4-4 4 4" }
                            line {
                                x1: "4",
                                y1: "17",
                                x2: "20",
                                y2: "17",
                            }
                            line {
                                x1: "4",
                                y1: "21",
                                x2: "20",
                                y2: "21",
                            }
                        }
                    }
                    button {
                        class: "re-table-actions__btn",
                        "data-act": "row-below",
                        "data-tip": "Insert row below",
                        r#type: "button",
                        "aria-label": "Insert row below",
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            line {
                                x1: "4",
                                y1: "3",
                                x2: "20",
                                y2: "3",
                            }
                            line {
                                x1: "4",
                                y1: "7",
                                x2: "20",
                                y2: "7",
                            }
                            path { d: "M12 11v8" }
                            path { d: "M8 15l4 4 4-4" }
                        }
                    }
                    span { class: "re-table-actions__sep" }
                    button {
                        class: "re-table-actions__btn",
                        "data-act": "col-left",
                        "data-tip": "Insert column left",
                        r#type: "button",
                        "aria-label": "Insert column left",
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            path { d: "M13 12h8" }
                            path { d: "M17 8l-4 4 4 4" }
                            line {
                                x1: "3",
                                y1: "4",
                                x2: "3",
                                y2: "20",
                            }
                            line {
                                x1: "7",
                                y1: "4",
                                x2: "7",
                                y2: "20",
                            }
                        }
                    }
                    button {
                        class: "re-table-actions__btn",
                        "data-act": "col-right",
                        "data-tip": "Insert column right",
                        r#type: "button",
                        "aria-label": "Insert column right",
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            path { d: "M3 12h8" }
                            path { d: "M7 8l4 4-4 4" }
                            line {
                                x1: "17",
                                y1: "4",
                                x2: "17",
                                y2: "20",
                            }
                            line {
                                x1: "21",
                                y1: "4",
                                x2: "21",
                                y2: "20",
                            }
                        }
                    }
                    span { class: "re-table-actions__sep" }
                    button {
                        class: "re-table-actions__btn",
                        "data-act": "row-delete",
                        "data-tip": "Delete row",
                        r#type: "button",
                        "aria-label": "Delete row",
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            line {
                                x1: "4",
                                y1: "5",
                                x2: "20",
                                y2: "5",
                            }
                            line {
                                x1: "4",
                                y1: "19",
                                x2: "20",
                                y2: "19",
                            }
                            line {
                                x1: "8",
                                y1: "12",
                                x2: "16",
                                y2: "12",
                            }
                        }
                    }
                    button {
                        class: "re-table-actions__btn",
                        "data-act": "col-delete",
                        "data-tip": "Delete column",
                        r#type: "button",
                        "aria-label": "Delete column",
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            line {
                                x1: "5",
                                y1: "4",
                                x2: "5",
                                y2: "20",
                            }
                            line {
                                x1: "19",
                                y1: "4",
                                x2: "19",
                                y2: "20",
                            }
                            line {
                                x1: "12",
                                y1: "8",
                                x2: "12",
                                y2: "16",
                            }
                        }
                    }
                    span { class: "re-table-actions__sep" }
                    button {
                        class: "re-table-actions__btn",
                        "data-act": "merge",
                        "data-tip": "Merge selected cells",
                        r#type: "button",
                        "aria-label": "Merge selected cells",
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            rect {
                                x: "3",
                                y: "4",
                                width: "18",
                                height: "16",
                                rx: "1.5",
                            }
                            path { d: "M8 8h8" }
                            path { d: "M8 16h8" }
                        }
                    }
                    button {
                        class: "re-table-actions__btn",
                        "data-act": "split",
                        "data-tip": "Split merged cell",
                        r#type: "button",
                        "aria-label": "Split merged cell",
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            rect {
                                x: "3",
                                y: "4",
                                width: "18",
                                height: "16",
                                rx: "1.5",
                            }
                            line {
                                x1: "12",
                                y1: "4",
                                x2: "12",
                                y2: "20",
                            }
                            line {
                                x1: "3",
                                y1: "12",
                                x2: "21",
                                y2: "12",
                            }
                        }
                    }
                    span { class: "re-table-actions__sep" }
                    button {
                        class: "re-table-actions__btn re-table-actions__btn--danger",
                        "data-act": "table-delete",
                        "data-tip": "Delete table",
                        r#type: "button",
                        "aria-label": "Delete table",
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            polyline { points: "3 6 5 6 21 6" }
                            path { d: "M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" }
                            line {
                                x1: "10",
                                y1: "11",
                                x2: "10",
                                y2: "17",
                            }
                            line {
                                x1: "14",
                                y1: "11",
                                x2: "14",
                                y2: "17",
                            }
                        }
                    }
                }
                // Selection-triggered floating toolbar. Hidden by default;
                // the JS controller positions it below (or above, on auto-flip)
                // the active selection and toggles `data-visible`. Buttons
                // reuse the existing `.re-tb-btn` / `.re-block` classes so the
                // top-toolbar's click handlers and aria-pressed sync apply
                // automatically. Touch / coarse-pointer devices skip wiring
                // entirely — see script.js.
                div {
                    aria_label: "Selection toolbar",
                    class: "re-bubble",
                    "data-visible": "false",
                    role: "toolbar",
                    div { class: "re-bubble__inner",
                        div {
                            class: "re-block re-block--bubble",
                            "data-open": "false",
                            button {
                                aria_expanded: "false",
                                aria_haspopup: "listbox",
                                class: "re-block__btn",
                                r#type: "button",
                                span { class: "re-block__label", "Paragraph" }
                                svg {
                                    fill: "none",
                                    stroke: "currentColor",
                                    stroke_linecap: "round",
                                    stroke_linejoin: "round",
                                    stroke_width: "2.5",
                                    view_box: "0 0 24 24",
                                    polyline { points: "6 9 12 15 18 9" }
                                }
                            }
                            div { class: "re-block__menu", role: "listbox",
                                button {
                                    class: "re-block__item",
                                    "data-block": "P",
                                    r#type: "button",
                                    span { "Paragraph" }
                                    span { class: "re-block__item-hint", "P" }
                                }
                                button {
                                    class: "re-block__item re-block__item--h1",
                                    "data-block": "H1",
                                    r#type: "button",
                                    span { "Heading 1" }
                                    span { class: "re-block__item-hint", "H1" }
                                }
                                button {
                                    class: "re-block__item re-block__item--h2",
                                    "data-block": "H2",
                                    r#type: "button",
                                    span { "Heading 2" }
                                    span { class: "re-block__item-hint", "H2" }
                                }
                                button {
                                    class: "re-block__item re-block__item--h3",
                                    "data-block": "H3",
                                    r#type: "button",
                                    span { "Heading 3" }
                                    span { class: "re-block__item-hint", "H3" }
                                }
                                button {
                                    class: "re-block__item re-block__item--quote",
                                    "data-block": "BLOCKQUOTE",
                                    r#type: "button",
                                    span { "Quote" }
                                    span { class: "re-block__item-hint", "\"" }
                                }
                                button {
                                    class: "re-block__item re-block__item--code",
                                    "data-block": "PRE",
                                    r#type: "button",
                                    span { "Code block" }
                                    span { class: "re-block__item-hint", "{{ }}" }
                                }
                            }
                        }
                        div { class: "re-toolbar__group",
                            button {
                                aria_label: "Bold",
                                class: "re-tb-btn",
                                "data-cmd": "bold",
                                "data-tip": "Bold",
                                r#type: "button",
                                svg {
                                    fill: "none",
                                    stroke: "currentColor",
                                    stroke_linecap: "round",
                                    stroke_linejoin: "round",
                                    stroke_width: "2.4",
                                    view_box: "0 0 24 24",
                                    path { d: "M6 4h8a4 4 0 0 1 0 8H6z" }
                                    path { d: "M6 12h9a4 4 0 0 1 0 8H6z" }
                                }
                            }
                            button {
                                aria_label: "Italic",
                                class: "re-tb-btn",
                                "data-cmd": "italic",
                                "data-tip": "Italic",
                                r#type: "button",
                                svg {
                                    fill: "none",
                                    stroke: "currentColor",
                                    stroke_linecap: "round",
                                    stroke_linejoin: "round",
                                    stroke_width: "2",
                                    view_box: "0 0 24 24",
                                    line {
                                        x1: "19",
                                        x2: "10",
                                        y1: "4",
                                        y2: "4",
                                    }
                                    line {
                                        x1: "14",
                                        x2: "5",
                                        y1: "20",
                                        y2: "20",
                                    }
                                    line {
                                        x1: "15",
                                        x2: "9",
                                        y1: "4",
                                        y2: "20",
                                    }
                                }
                            }
                            button {
                                aria_label: "Underline",
                                class: "re-tb-btn",
                                "data-cmd": "underline",
                                "data-tip": "Underline",
                                r#type: "button",
                                svg {
                                    fill: "none",
                                    stroke: "currentColor",
                                    stroke_linecap: "round",
                                    stroke_linejoin: "round",
                                    stroke_width: "2",
                                    view_box: "0 0 24 24",
                                    path { d: "M6 4v6a6 6 0 0 0 12 0V4" }
                                    line {
                                        x1: "4",
                                        x2: "20",
                                        y1: "20",
                                        y2: "20",
                                    }
                                }
                            }
                            button {
                                aria_label: "Strikethrough",
                                class: "re-tb-btn",
                                "data-cmd": "strikeThrough",
                                "data-tip": "Strikethrough",
                                r#type: "button",
                                svg {
                                    fill: "none",
                                    stroke: "currentColor",
                                    stroke_linecap: "round",
                                    stroke_linejoin: "round",
                                    stroke_width: "2",
                                    view_box: "0 0 24 24",
                                    line {
                                        x1: "4",
                                        x2: "20",
                                        y1: "12",
                                        y2: "12",
                                    }
                                    path { d: "M16 6c-1.5-1.3-3.5-2-6-2-3 0-5 1.5-5 4 0 2 1.5 3 5 4" }
                                    path { d: "M8 18c1.5 1.3 3.5 2 6 2 3 0 5-1.5 5-4 0-1-.4-1.8-1-2.4" }
                                }
                            }
                            button {
                                aria_label: "Inline code",
                                class: "re-tb-btn",
                                "data-cmd": "code-inline",
                                "data-tip": "Inline code",
                                r#type: "button",
                                svg {
                                    fill: "none",
                                    stroke: "currentColor",
                                    stroke_linecap: "round",
                                    stroke_linejoin: "round",
                                    stroke_width: "2",
                                    view_box: "0 0 24 24",
                                    polyline { points: "16 18 22 12 16 6" }
                                    polyline { points: "8 6 2 12 8 18" }
                                }
                            }
                            button {
                                aria_label: "Insert link",
                                class: "re-tb-btn",
                                "data-cmd": "link",
                                "data-tip": "Insert link",
                                r#type: "button",
                                svg {
                                    fill: "none",
                                    stroke: "currentColor",
                                    stroke_linecap: "round",
                                    stroke_linejoin: "round",
                                    stroke_width: "2",
                                    view_box: "0 0 24 24",
                                    path { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }
                                    path { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }
                                }
                            }
                        }
                    }
                }
                div { class: "re-statusbar",
                    div { class: "re-statusbar__chips",
                        span { class: "re-statusbar__chip",
                            "Words "
                            strong { class: "re-word-count", "0" }
                        }
                        span { class: "re-statusbar__chip",
                            "Chars "
                            strong { class: "re-char-count", "0" }
                        }
                    }
                    div { class: "re-statusbar__chip re-ime-state", "composing…" }
                }
                div { class: "re-modal-mask", "data-modal": "link",
                    div {
                        aria_label: "Insert link",
                        class: "re-modal",
                        role: "dialog",
                        div { class: "re-modal__title", "Insert link" }
                        div { class: "re-modal__field",
                            label { "URL" }
                            input {
                                autocomplete: "off",
                                class: "re-link-url",
                                placeholder: "https://example.com",
                                r#type: "url",
                            }
                        }
                        div { class: "re-modal__actions",
                            button {
                                class: "re-btn",
                                "data-close-modal": "false",
                                r#type: "button",
                                "Cancel"
                            }
                            button {
                                class: "re-btn re-btn--primary re-link-confirm",
                                r#type: "button",
                                "Insert"
                            }
                        }
                    }
                }
                div { class: "re-modal-mask", "data-modal": "image",
                    div {
                        aria_label: "Insert image",
                        class: "re-modal",
                        role: "dialog",
                        div { class: "re-modal__title", "Insert image" }

                        label { class: "re-dropzone", "data-dragging": "false",
                            input {
                                class: "re-image-file",
                                accept: "image/*",
                                hidden: true,
                                r#type: "file",
                            }
                            svg {
                                class: "re-dropzone__icon",
                                view_box: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                stroke_width: "1.5",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                rect {
                                    x: "3",
                                    y: "3",
                                    width: "18",
                                    height: "18",
                                    rx: "2",
                                }
                                circle { cx: "8.5", cy: "8.5", r: "1.5" }
                                polyline { points: "21 15 16 10 5 21" }
                            }
                            div { class: "re-dropzone__title", "Drag & drop an image" }
                            div { class: "re-dropzone__hint",
                                "or tap to browse — PNG, JPG, GIF, WebP"
                            }
                        }

                        label { class: "re-camera-btn",
                            input {
                                class: "re-image-camera",
                                accept: "image/*",
                                capture: "environment",
                                hidden: true,
                                r#type: "file",
                            }
                            svg {
                                view_box: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                stroke_width: "1.8",
                                stroke_linecap: "round",
                                stroke_linejoin: "round",
                                path { d: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" }
                                circle { cx: "12", cy: "13", r: "4" }
                            }
                            span { "Take a photo" }
                        }

                        div { class: "re-modal__divider",
                            span { "OR PASTE A URL" }
                        }

                        div { class: "re-modal__field",
                            input {
                                class: "re-image-url",
                                placeholder: "https://example.com/image.png",
                                r#type: "url",
                            }
                        }

                        div { class: "re-modal__actions",
                            button {
                                class: "re-btn",
                                "data-close-modal": "false",
                                r#type: "button",
                                "Cancel"
                            }
                            button {
                                class: "re-btn re-btn--primary re-image-confirm",
                                r#type: "button",
                                "Insert URL"
                            }
                        }
                    }
                }
                div { class: "re-modal-mask", "data-modal": "youtube",
                    div {
                        aria_label: "Embed YouTube",
                        class: "re-modal",
                        role: "dialog",
                        div { class: "re-modal__title", "Embed YouTube video" }
                        div { class: "re-modal__field",
                            label { "YouTube URL or ID" }
                            input {
                                class: "re-youtube-url",
                                placeholder: "https://youtu.be/dQw4w9WgXcQ",
                                r#type: "text",
                            }
                        }
                        div { class: "re-modal__actions",
                            button {
                                class: "re-btn",
                                "data-close-modal": "false",
                                r#type: "button",
                                "Cancel"
                            }
                            button {
                                class: "re-btn re-btn--primary re-youtube-confirm",
                                r#type: "button",
                                "Embed"
                            }
                        }
                    }
                }
                div { class: "re-modal-mask", "data-modal": "table",
                    div {
                        aria_label: "Insert table",
                        class: "re-modal",
                        role: "dialog",
                        div { class: "table re-modal__title", "Insert" }
                        div { class: "re-modal__row",
                            div { class: "re-modal__field",
                                label { "Rows" }
                                input {
                                    class: "re-table-rows",
                                    max: "20",
                                    min: "1",
                                    r#type: "number",
                                    value: "3",
                                }
                            }
                            div { class: "re-modal__field",
                                label { "Columns" }
                                input {
                                    class: "re-table-cols",
                                    max: "10",
                                    min: "1",
                                    r#type: "number",
                                    value: "3",
                                }
                            }
                        }
                        div { class: "re-modal__field",
                            label { class: "re-modal__checkbox",
                                input {
                                    checked: "false",
                                    class: "re-table-header",
                                    r#type: "checkbox",
                                }
                                " First row is header\n        "
                            }
                        }
                        div { class: "re-modal__actions",
                            button {
                                class: "re-btn",
                                "data-close-modal": "false",
                                r#type: "button",
                                "Cancel"
                            }
                            button {
                                class: "re-btn re-btn--primary re-table-confirm",
                                r#type: "button",
                                "Insert"
                            }
                        }
                    }
                }
            }
        }
    }
}

translate! {
    EditorTranslate;

    format: { en: "Format", ko: "서식" },
    done: { en: "Done", ko: "완료" },

    history: { en: "History", ko: "되돌리기" },
    undo: { en: "Undo", ko: "실행 취소" },
    redo: { en: "Redo", ko: "다시 실행" },

    text_style: { en: "Text style", ko: "텍스트 스타일" },
    body: { en: "Body", ko: "본문" },
    heading1: { en: "Heading 1", ko: "큰 제목" },
    heading2: { en: "Heading 2", ko: "중간 제목" },
    heading3: { en: "Heading 3", ko: "작은 제목" },
    quote: { en: "Quote", ko: "인용" },
    code_block: { en: "Code block", ko: "코드 블록" },

    emphasis: { en: "Emphasis", ko: "강조" },
    bold: { en: "Bold", ko: "굵게" },
    italic: { en: "Italic", ko: "기울임" },
    underline: { en: "Underline", ko: "밑줄" },
    strikethrough: { en: "Strikethrough", ko: "취소선" },
    inline_code: { en: "Code", ko: "인라인 코드" },

    lists: { en: "Lists", ko: "목록" },
    bullet_list: { en: "Bulleted", ko: "글머리 기호" },
    numbered_list: { en: "Numbered", ko: "번호 매기기" },
    outdent: { en: "Outdent", ko: "내어쓰기" },
    indent: { en: "Indent", ko: "들여쓰기" },

    alignment: { en: "Alignment", ko: "정렬" },
    align_left: { en: "Left", ko: "왼쪽" },
    align_center: { en: "Center", ko: "가운데" },
    align_right: { en: "Right", ko: "오른쪽" },
    align_justify: { en: "Justify", ko: "양쪽" },

    insert: { en: "Insert", ko: "삽입" },
    link: { en: "Link", ko: "링크" },
    unlink: { en: "Unlink", ko: "링크 해제" },
    image: { en: "Image", ko: "이미지" },
    video: { en: "Video", ko: "동영상" },
    table: { en: "Table", ko: "표" },
    divider: { en: "Divider", ko: "구분선" },

    clear: { en: "Clear", ko: "지우기" },
    clear_format: { en: "Clear formatting", ko: "서식 지우기" },
}
