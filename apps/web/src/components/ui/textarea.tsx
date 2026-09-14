import * as React from "react";

// app/ratel/src/common/components/textarea — a bare `<textarea class="{class}">`
// (the class string is exactly the caller's, empty by default).
export type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className = "", placeholder = "", value = "", ...props }, ref) => (
    <textarea ref={ref} className={className} placeholder={placeholder} value={value} {...props} />
  ),
);
TextArea.displayName = "TextArea";
