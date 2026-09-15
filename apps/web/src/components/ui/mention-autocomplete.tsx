// app/ratel/src/common/components/mention_autocomplete/mod.rs
// (`MentionAutocomplete`): a `<div class="relative">` wrapping `children`
// (the composer's `<textarea>`) that listens for bubbled `input`/`keydown`
// events to detect an active `@query` and render a suggestion dropdown.
//
// The dropdown state is recomputed from the current `text` on every bubbled
// `input` event (not a `useEffect` over `text` — mirrors the Rust comment:
// prop-signal effects are unreliable after hydration there; here it simply
// keeps the DOM-event-driven behavior identical for parity).
import * as React from "react";
import { useDismissOnOutside } from "@/lib/use-dismiss-on-outside-click";
import { mentionDisplay } from "@/lib/mention";

export interface MentionCandidate {
  userPk: string;
  displayName: string;
  username: string;
  profileUrl: string;
}

export interface MentionInsert {
  startOffset: number;
  endOffset: number;
  displayText: string;
  displayName: string;
  userPk: string;
}

export interface MentionAutocompleteProps {
  text: string;
  onSelect: (insert: MentionInsert) => void;
  members: MentionCandidate[];
  /** `""` = `@` typed with no characters yet; `null` = no active mention. */
  onQueryChange?: (query: string | null) => void;
  /** Priority-ordered user pks (earlier = higher rank). */
  priorityUserPks?: string[];
  children: React.ReactNode;
}

function findActiveAt(text: string): number | null {
  let i = text.length;
  while (i > 0) {
    i -= 1;
    if (text[i] === "@") {
      if (text[i + 1] === "[") continue; // completed mention markup
      const after = text.slice(i + 1);
      let queryPart = "";
      for (const ch of after) {
        if (/\s/.test(ch)) break;
        queryPart += ch;
      }
      if (queryPart.length < after.length) continue; // whitespace after query
      return i;
    }
  }
  return null;
}

function buildMentionInsert(member: MentionCandidate, atPos: number, q: string): MentionInsert {
  return {
    startOffset: atPos,
    endOffset: atPos + 1 + q.length,
    displayText: mentionDisplay(member.displayName),
    displayName: member.displayName,
    userPk: member.userPk,
  };
}

export function MentionAutocomplete({
  text,
  onSelect,
  members,
  onQueryChange,
  priorityUserPks = [],
  children,
}: MentionAutocompleteProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [atPosition, setAtPosition] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const lastReported = React.useRef<string | null>(null);

  useDismissOnOutside(rootRef, () => setShowDropdown(false));

  const recompute = () => {
    const pos = findActiveAt(text);
    if (pos !== null) {
      const afterAt = text.slice(pos + 1);
      let q = "";
      for (const ch of afterAt) {
        if (/\s/.test(ch)) break;
        q += ch;
      }
      if (lastReported.current !== q) {
        lastReported.current = q;
        onQueryChange?.(q);
      }
      setQuery(q);
      setAtPosition(pos);
      setShowDropdown(true);
      setSelectedIndex(0);
    } else {
      if (lastReported.current !== null) {
        lastReported.current = null;
        onQueryChange?.(null);
      }
      setShowDropdown(false);
    }
  };

  const q = query.toLowerCase();
  const filtered = showDropdown
    ? members.filter((m) => m.displayName.toLowerCase().startsWith(q) || m.username.toLowerCase().startsWith(q))
    : [];
  if (priorityUserPks.length > 0) {
    const rank = new Map(priorityUserPks.map((pk, i) => [pk, i]));
    filtered.sort((a, b) => (rank.get(a.userPk) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.userPk) ?? Number.MAX_SAFE_INTEGER));
  }

  const select = (member: MentionCandidate) => {
    onSelect(buildMentionInsert(member, atPosition, query));
    setShowDropdown(false);
  };

  return (
    <div
      className="relative"
      ref={rootRef}
      onInput={recompute}
      onKeyDown={(evt) => {
        if (!showDropdown) return;
        switch (evt.key) {
          case "ArrowDown": {
            evt.preventDefault();
            const max = Math.max(0, filtered.length - 1);
            setSelectedIndex((i) => Math.min(i + 1, max));
            break;
          }
          case "ArrowUp": {
            evt.preventDefault();
            setSelectedIndex((i) => Math.max(0, i - 1));
            break;
          }
          case "Enter":
          case "Tab": {
            if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
            const member = filtered[selectedIndex];
            if (member) {
              evt.preventDefault();
              evt.stopPropagation();
              select(member);
            }
            break;
          }
          case "Escape":
            setShowDropdown(false);
            break;
          default:
            break;
        }
      }}
    >
      {children}

      {showDropdown && filtered.length > 0 && (
        <div
          className="overflow-y-auto absolute right-0 left-0 z-50 mt-1 rounded-lg shadow-lg max-h-[200px] bg-popover"
          role="listbox"
        >
          {filtered.map((member, i) => {
            const isSelected = i === selectedIndex;
            return (
              <button
                key={member.userPk}
                className="flex gap-2 items-center py-1 px-3 w-full text-left transition-colors text-text-primary aria-selected:bg-hover hover:bg-hover"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(evt) => evt.preventDefault()}
                onClick={() => select(member)}
              >
                {member.profileUrl !== "" ? (
                  <img className="object-cover w-6 h-6 rounded shrink-0" src={member.profileUrl} alt={member.displayName} />
                ) : (
                  <div className="flex justify-center items-center w-6 h-6 text-sm font-medium rounded shrink-0 bg-hover text-foreground-muted">
                    {member.displayName.charAt(0) || "?"}
                  </div>
                )}
                <span className="flex overflow-hidden flex-1 gap-2 items-baseline min-w-0">
                  <span className="text-sm font-semibold truncate text-text-primary">{member.displayName}</span>
                  {member.username !== "" && (
                    <span className="text-xs truncate shrink text-foreground-muted">{`@${member.username}`}</span>
                  )}
                </span>
                {isSelected && (
                  <span className="py-0.5 px-2 text-xs rounded border shrink-0 text-foreground-muted border-border">
                    Enter
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
