import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { DataPicker } from "./components/data-picker";
import { DocCanvas } from "./components/doc-canvas";
import { Outline } from "./components/outline";
import { PublishConfirmModal } from "./components/publish-modal";
import { SlashPopup } from "./components/slash-popup";
import { TopBar } from "./components/top-bar";
import { ReportDetailProvider, useReportDetail, useReportDetailContext } from "./hooks/use-report-detail";

// app/ratel/src/features/spaces/pages/report/views/detail/component.rs
// (`ReportDetailPage`) — installs the report-detail context and arranges the
// sub-components. Owns the command bridge `<input>` that `detail_actions.js`
// uses to push figure-button click events (swap/delete) and slash-popup
// keyboard navigation back into React.
//
// Access enforcement lives server-side in `get_report` — non-admins
// requesting an unpublished draft get a server-side `NoPermission` error
// (surfaces via the suspense query's error boundary). The client only
// branches the rendering mode (edit vs. viewer chrome) based on the user's
// role.

export function Component() {
  const { spaceId = "", reportId = "" } = useParams();
  const ctrl = useReportDetail(spaceId, reportId);
  return (
    <ReportDetailProvider value={ctrl}>
      <ReportDetailPage />
    </ReportDetailProvider>
  );
}

function ReportDetailPage() {
  const ctx = useReportDetailContext();
  const rootClass = ctx.canEdit ? "report-detail" : "report-detail report-detail--viewer";

  return (
    <div className={rootClass}>
      <CommandBridge />
      <TopBar />
      <div className="report-detail__grid">
        <DocCanvas />
        <Outline />
      </div>
      <DataPicker />
      <SlashPopup />
      <PublishConfirmModal />
    </div>
  );
}

/**
 * Hidden bridge: `detail_actions.js` writes `"swap:<chart-id>"` /
 * `"delete:<id>"` / `"slash-down:"` etc. here and dispatches a native
 * `input` event; a plain `addEventListener` picks it up (React's `onChange`
 * never sees a value assigned directly to the DOM node — same reasoning as
 * the shared `Editor`'s `.re-bridge`).
 */
function CommandBridge() {
  const ctx = useReportDetailContext();
  const ref = useRef<HTMLInputElement>(null);
  const handlerRef = useRef<(raw: string) => void>(() => {});
  handlerRef.current = (raw: string) => {
    const sep = raw.indexOf(":");
    if (sep === -1) return;
    const act = raw.slice(0, sep);
    const arg = raw.slice(sep + 1);
    switch (act) {
      case "swap":
        ctx.openChartSwap(arg);
        break;
      case "delete":
        ctx.deleteChart(arg);
        break;
      case "slash-down":
        ctx.moveSlashSelection(1);
        break;
      case "slash-up":
        ctx.moveSlashSelection(-1);
        break;
      case "slash-enter":
        ctx.applySlashSelected();
        break;
      case "slash-close":
        ctx.closeSlash();
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const listener = () => handlerRef.current(el.value);
    el.addEventListener("input", listener);
    return () => el.removeEventListener("input", listener);
  }, []);

  return (
    <input
      ref={ref}
      className="report-detail__cmd-bridge"
      type="text"
      hidden
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
