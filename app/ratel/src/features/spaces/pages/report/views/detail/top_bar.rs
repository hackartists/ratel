use super::i18n::ReportDetailTranslate;
use crate::features::spaces::pages::report::hooks::SaveStatus;
use crate::features::spaces::pages::report::*;
use crate::*;

/// Export the report as a PDF, scoped to the report body via the
/// `@media print` styles in `main.css`.
///
/// On the web this is the browser's print dialog — the user picks
/// "Save as PDF" as the destination. No extra dependency needed, and
/// the printed HTML is the same content the browser already renders,
/// so figures (charts / tables) survive without rasterization.
///
/// The mobile shell has no such dialog: `window.print()` is a silent
/// no-op in both Android System WebView and iOS WKWebView, so this
/// button did nothing at all in the shipped apps. There the job goes to
/// the native `print_page` command, which renders the same print-media
/// output through `PrintManager` (Android) / `UIPrintPageRenderer`
/// (iOS). See `common::utils::native_file`.
///
/// The fork is decided at RUNTIME (`is_native_shell`), not by a Cargo feature:
/// the web fullstack build enables `tauri-web` too, so gating on the flag put
/// the native branch in the web bundle and dropped `window.print` from it.
async fn trigger_pdf_print(job_name: String) -> crate::common::Result<()> {
    use crate::common::utils::native_file;

    if native_file::is_native_shell().await {
        return native_file::print_page(&job_name).await;
    }

    let _ = dioxus::document::eval(
        r#"
        // Use a tiny delay so any pending Dioxus re-render settles
        // before the print snapshot is taken. Without this, charts
        // freshly inserted via execCommand can flicker in the printed
        // output.
        setTimeout(function () { window.print(); }, 50);
        "#,
    );
    Ok(())
}

/// Top chrome row — back arrow + breadcrumb + autosave + Share /
/// Export / Publish buttons. Consumes detail context for the report
/// title (breadcrumb) and the autosave state (mock for now).
#[component]
pub fn TopBar() -> Element {
    let tr: ReportDetailTranslate = use_translate();
    let nav = use_navigator();
    let mut ctx = use_report_detail_context();
    let mut toast = use_toast();
    let autosave_label = match ctx.save_status() {
        SaveStatus::Idle | SaveStatus::Saved => tr.autosave_just_now.to_string(),
        SaveStatus::Unsaved => tr.autosave_unsaved.to_string(),
        SaveStatus::Saving => tr.autosave_saving.to_string(),
    };
    // Publish button keeps the same "Publish" label across first and
    // subsequent presses — re-publish is the same operation (push the
    // latest body to the published copy), so a separate "Edit &
    // Republish" label would just create surface area without changing
    // what the button does.
    let publish_pending = ctx.handle_publish.pending();
    let publish_label_dynamic = if publish_pending {
        tr.publishing_label.to_string()
    } else {
        tr.publish_btn.to_string()
    };

    rsx! {
        div { class: "report-detail__topbar",
            div { class: "report-detail__topbar-left",
                button {
                    class: "report-detail__back",
                    "aria-label": tr.back_aria,
                    onclick: move |_| nav.go_back(),
                    svg {
                        view_box: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        stroke_width: "2.2",
                        stroke_linecap: "round",
                        stroke_linejoin: "round",
                        polyline { points: "15 18 9 12 15 6" }
                    }
                }
                span { class: "report-detail__breadcrumb",
                    span { class: "report-detail__breadcrumb-root", "{tr.breadcrumb_root}" }
                    span { class: "report-detail__breadcrumb-sep", "{tr.breadcrumb_separator}" }
                    span { class: "report-detail__breadcrumb-current", "{ctx.initial_title()}" }
                }
                if ctx.can_edit_value() {
                    span { class: "report-detail__autosave", "{autosave_label}" }
                }
            }
            div { class: "report-detail__topbar-right",
                button {
                    class: "report-detail__topbar-btn",
                    "aria-label": tr.pdf_download_btn,
                    "data-testid": "pdf-download",
                    onclick: move |_| async move {
                        // The report title names the exported file, so a
                        // saved PDF is identifiable in Files / Downloads
                        // rather than landing as "document.pdf".
                        if trigger_pdf_print(ctx.initial_title()).await.is_err() {
                            // `Error::OnlyWebFunction` is what bubbles up here;
                            // its own translation ("web only") would confuse a
                            // user standing in the app, so say what happened.
                            toast.warn(tr.pdf_download_failed);
                        }
                    },
                    svg {
                        view_box: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        stroke_width: "2",
                        stroke_linecap: "round",
                        stroke_linejoin: "round",
                        path { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }
                        polyline { points: "14 2 14 8 20 8" }
                        line {
                            x1: "9",
                            y1: "15",
                            x2: "15",
                            y2: "15",
                        }
                        line {
                            x1: "12",
                            y1: "12",
                            x2: "12",
                            y2: "18",
                        }
                        polyline { points: "10 16 12 18 14 16" }
                    }
                    span { "{tr.pdf_download_btn}" }
                }
                // Publish button is a one-shot — visible only to admins
                // on a Draft. Once the report is Published the button
                // disappears entirely (per product decision); subsequent
                // edits stream into the published copy via the autosave
                // loop (`update_report` with `status: None` keeps the
                // Published status intact).
                if ctx.can_edit_value() && !ctx.is_published() {
                    button {
                        class: "report-detail__topbar-btn report-detail__topbar-btn--primary",
                        "data-testid": "publish-report",
                        disabled: publish_pending,
                        onclick: move |_| {
                            if publish_pending {
                                return;
                            }
                            ctx.open_publish_modal();
                        },
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            path { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }
                            polyline { points: "22 4 12 14.01 9 11.01" }
                        }
                        span { "{publish_label_dynamic}" }
                    }
                }
            }
        }
    }
}
