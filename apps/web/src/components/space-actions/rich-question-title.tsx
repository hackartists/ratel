/**
 * Read-only render of a question's rich-text `html_title`. Wrapped in a
 * non-editable `.ratel-editor` so the HTML gets exactly the typography the
 * author saw in the title editor, instead of the card's plain-title styles.
 */
export function RichQuestionTitle({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={className ? `ratel-editor question-rich-title ${className}` : "ratel-editor question-rich-title"}
      data-editable="false"
      data-question-title="true"
    >
      <div className="re-content" data-testid="question-rich-title" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
