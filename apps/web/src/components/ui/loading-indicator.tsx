import * as React from "react";

// app/ratel/src/common/components/loading_indicator. The lottie player is a
// custom element; Dioxus renders custom-element attribute idents verbatim, so
// the size attribute really is `max_width`. (The dotlottie-wc definition script
// in common/provider.rs is not mounted, so the element stays inert in both apps.)

const DEFAULT_WRAPPER =
  "flex col-span-full row-span-full justify-center items-center w-full min-h-[50vh] h-full grow max-tablet:max-w-[150px] max-tablet:mx-auto";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "dotlottie-wc": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        autoplay?: string;
        loop?: string;
        max_width?: string;
      };
    }
  }
}

export interface LoadingIndicatorProps extends React.HTMLAttributes<HTMLElement> {
  maxWidth?: string;
  /** Replaces the wrapper classes (empty keeps the full-area default, like Dioxus). */
  className?: string;
}

export function LoadingIndicator({ maxWidth = "300px", className = "", ...props }: LoadingIndicatorProps) {
  return (
    <div className={className === "" ? DEFAULT_WRAPPER : className}>
      <dotlottie-wc src="/assets/animations/loading.lottie" autoplay="true" loop="true" max_width={maxWidth} {...props} />
    </div>
  );
}
