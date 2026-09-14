import { useEffect } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { useSpaceLayoutUi } from "@/components/space/space-context";

// app/ratel/src/features/spaces/pages/actions/components/full_action_layover —
// full-width action viewer with a fixed bottom action bar.

const BASE_CONTENT_CLASS =
  "mx-auto flex w-full max-w-desktop flex-1 flex-col gap-4 overflow-y-auto scrollbar-none pb-20 max-tablet:pb-36";
const BASE_BOTTOM_CLASS =
  "fixed bottom-0 left-0 right-0 flex items-center justify-between gap-3 border-t border-card-border bg-card-bg px-5 py-3 z-30";

export interface FullActionLayoverProps extends HTMLAttributes<HTMLDivElement> {
  contentClassName?: string;
  bottomClassName?: string;
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
}

export function FullActionLayover({
  contentClassName = "",
  bottomClassName = "",
  bottomLeft,
  bottomRight,
  children,
  ...props
}: FullActionLayoverProps) {
  // Rust hides the space sidebar while mounted
  // (`use_space_layout_ui().sidebar_visible.set(false)`, restored on drop).
  // `SpaceNav`/`SpaceTop` aren't mounted anywhere in the React route tree yet
  // (see layouts/space-layout.tsx), so this has no visible effect today, but
  // it keeps the shared `sidebarVisible` flag correct for when they land.
  const { setSidebarVisible } = useSpaceLayoutUi();
  useEffect(() => {
    setSidebarVisible(false);
    return () => setSidebarVisible(true);
  }, [setSidebarVisible]);

  const contentClass = contentClassName === "" ? BASE_CONTENT_CLASS : `${BASE_CONTENT_CLASS} ${contentClassName}`;
  const bottomClass = bottomClassName === "" ? BASE_BOTTOM_CLASS : `${BASE_BOTTOM_CLASS} ${bottomClassName}`;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col" {...props}>
      <div className={contentClass}>{children}</div>

      <div className={bottomClass}>
        <div>{bottomLeft}</div>
        <div className="flex items-center gap-3">{bottomRight}</div>
      </div>
    </div>
  );
}
