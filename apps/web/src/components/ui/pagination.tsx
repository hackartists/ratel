import * as React from "react";
import { dataBool, joinClass } from "@/lib/dom";

// app/ratel/src/common/components/pagination — same elements, data-slot and
// data-* attributes. The Dioxus component hardcodes its English labels
// ("Previous", "Next", "More pages", aria-labels) with no translate! entry, so
// they are kept verbatim here; override via props where needed.

export const PaginationLinkSize = { Icon: "icon", Default: "default" } as const;
export type PaginationLinkSize = (typeof PaginationLinkSize)[keyof typeof PaginationLinkSize];

export const PaginationLinkKind = { Previous: "previous", Next: "next" } as const;
export type PaginationLinkKind = (typeof PaginationLinkKind)[keyof typeof PaginationLinkKind];

export const Pagination = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <nav
      ref={ref}
      data-slot="pagination"
      role="navigation"
      aria-label="pagination"
      {...props}
      className={joinClass("pagination", className)}
    />
  ),
);
Pagination.displayName = "Pagination";

export const PaginationContent = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} data-slot="pagination-content" {...props} className={joinClass("pagination-content", className)} />
  ),
);
PaginationContent.displayName = "PaginationContent";

export const PaginationItem = React.forwardRef<HTMLLIElement, React.LiHTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} data-slot="pagination-item" {...props} className={joinClass("pagination-item", className)} />
  ),
);
PaginationItem.displayName = "PaginationItem";

export interface PaginationLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  isActive?: boolean;
  size?: PaginationLinkSize;
  dataKind?: PaginationLinkKind;
}

export const PaginationLink = React.forwardRef<HTMLAnchorElement, PaginationLinkProps>(
  ({ isActive = false, size = PaginationLinkSize.Icon, dataKind, className, ...props }, ref) => (
    <a
      ref={ref}
      data-slot="pagination-link"
      data-active={dataBool(isActive)}
      data-size={size}
      data-kind={dataKind}
      aria-current={isActive ? "page" : undefined}
      {...props}
      className={joinClass("pagination-link", className)}
    />
  ),
);
PaginationLink.displayName = "PaginationLink";

export type PaginationArrowProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;

export const PaginationPrevious = React.forwardRef<HTMLAnchorElement, PaginationArrowProps>((props, ref) => (
  <PaginationLink
    ref={ref}
    size={PaginationLinkSize.Default}
    aria-label="Go to previous page"
    dataKind={PaginationLinkKind.Previous}
    {...props}
  >
    <svg className="pagination-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <polyline points="15 6 9 12 15 18" />
    </svg>
    <span className="pagination-label">Previous</span>
  </PaginationLink>
));
PaginationPrevious.displayName = "PaginationPrevious";

export const PaginationNext = React.forwardRef<HTMLAnchorElement, PaginationArrowProps>((props, ref) => (
  <PaginationLink
    ref={ref}
    size={PaginationLinkSize.Default}
    aria-label="Go to next page"
    dataKind={PaginationLinkKind.Next}
    {...props}
  >
    <span className="pagination-label">Next</span>
    <svg className="pagination-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  </PaginationLink>
));
PaginationNext.displayName = "PaginationNext";

export const PaginationEllipsis = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="pagination-ellipsis"
      aria-hidden="true"
      {...props}
      className={joinClass("pagination-ellipsis", className)}
    >
      <svg className="pagination-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </svg>
      <span className="sr-only">More pages</span>
    </span>
  ),
);
PaginationEllipsis.displayName = "PaginationEllipsis";
