import { Suspense } from "react";
import { useLaunchpadPartnerI18n } from "./i18n";
import { usePopup } from "@/lib/popup";
import { PointConversionModal } from "./conversion-modal";

// app/ratel/src/features/launchpad_partner/views/connect_button.rs
// (`PointConversionButton`) — opens `PointConversionModal` in the popup.

export function PointConversionButton({ availablePoints }: { availablePoints: number }) {
  const tr = useLaunchpadPartnerI18n();
  const popup = usePopup();

  return (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-extrabold cursor-pointer transition-transform hover:-translate-y-px"
      style={{
        background: "linear-gradient(135deg,#ffd24a 0%,#fcb300 100%)",
        color: "#0a0a0a",
        boxShadow: "0 10px 24px -10px rgba(252,179,0,0.5)",
      }}
      onClick={() =>
        popup.open(
          // The modal suspends on its entry-URL loader. The popup zone sits
          // outside the route Suspense, so give it its own (renders nothing).
          <Suspense fallback={null}>
            <PointConversionModal availablePoints={availablePoints} />
          </Suspense>,
          { title: tr.modalTitle },
        )
      }
    >
      {tr.convertCta}
    </button>
  );
}
