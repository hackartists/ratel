// `AutosaveStatusBadge` — duplicated verbatim in each Rust creator card
// (poll/quiz content cards, follow targets card, discussion content card).
// The labels come from each page's own translate block.

export type SaveStatus = "Idle" | "Saving" | "Saved" | "Unsaved";

export interface AutosaveLabels {
  autosaveSaving: string;
  autosaveSaved: string;
  autosaveUnsaved: string;
}

export function AutosaveStatusBadge({ status, labels }: { status: SaveStatus; labels: AutosaveLabels }) {
  if (status === "Idle") return null;
  const [label, modifier] =
    status === "Saving"
      ? [labels.autosaveSaving, "autosave--saving"]
      : status === "Saved"
        ? [labels.autosaveSaved, "autosave--saved"]
        : [labels.autosaveUnsaved, "autosave--unsaved"];
  return (
    <span className={`autosave ${modifier}`}>
      <span className="autosave__dot" />
      {label}
    </span>
  );
}
