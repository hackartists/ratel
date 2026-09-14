import * as React from "react";

// app/ratel/src/common/components/textarea — a plain <textarea> pass-through;
// the Rust component has no built-in class, so callers always supply one.

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(({ className = "", ...props }, ref) => (
  <textarea ref={ref} className={className} {...props} />
));
TextArea.displayName = "TextArea";
