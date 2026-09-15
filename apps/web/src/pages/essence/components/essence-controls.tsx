import { useEssenceSourcesI18n } from "@/i18n/generated/features/essence/pages/sources/essence-sources.i18n";
import { useEssenceSources, type EssenceSort } from "../hooks/use-essence-sources";

// app/ratel/src/features/essence/pages/sources/controls/component.rs — search
// input (⌘K / Ctrl+K focus lives in the page's legacy script.js) and sort.

function sortValue(s: EssenceSort): string {
  switch (s) {
    case "LastEditedDesc":
      return "last-edited";
    case "WordCountDesc":
      return "word-count";
    case "TitleAsc":
      return "title";
  }
}

function sortFromValue(v: string): EssenceSort {
  if (v === "word-count") return "WordCountDesc";
  if (v === "title") return "TitleAsc";
  return "LastEditedDesc";
}

/** Rust reads `navigator.platform` in the web build ("Ctrl K" when unavailable). */
function isMac(): boolean {
  return typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
}

export function EssenceControls() {
  const tr = useEssenceSourcesI18n();
  const { searchQuery, setSearchQuery, sortOrder, setSort } = useEssenceSources();
  const kbdLabel = isMac() ? "⌘ K" : "Ctrl K";

  return (
    <section className="essence-controls">
      <label className="essence-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder={tr.searchPlaceholder}
          data-essence-search-input="true"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <kbd>{kbdLabel}</kbd>
      </label>

      <select className="essence-sort" value={sortValue(sortOrder)} onChange={(e) => setSort(sortFromValue(e.target.value))}>
        <option value="last-edited">{tr.sortLastEdited}</option>
        <option value="word-count">{tr.sortWordCount}</option>
        <option value="title">{tr.sortTitle}</option>
      </select>
    </section>
  );
}
