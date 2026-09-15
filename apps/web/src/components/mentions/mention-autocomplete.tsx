import { useMemo, useRef, useState } from "react";
import { useDismissOnOutsideClick } from "@/lib/use-dismiss-on-outside-click";

// app/ratel/src/common/components/mention_autocomplete — wraps a text
// input/textarea child, watching its bubbled `input` events for an active
// "@query" run and offering a dropdown of matching `members`. The posts
// feature (post_detail's comment/reply composers) always passes an empty
// `members` list (kept on the hook "for future work that wires actual
// candidates" per the Rust comment), so the dropdown never renders there —
// but the wrapper still owns the `oninput`/`onKeyDown` contract other
// surfaces (space discussion) rely on, so it is ported in full.

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

let nextId = 0;

function findActiveAt(text: string): number | null {
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] !== "@") continue;
    if (text[i + 1] === "[") continue; // completed @[name](user:pk) markup
    const after = text.slice(i + 1);
    let queryPart = "";
    for (const ch of after) {
      if (/\s/.test(ch)) break;
      queryPart += ch;
    }
    if (queryPart.length < after.length) continue; // whitespace after "@" — no longer active
    return i;
  }
  return null;
}

function buildInsert(member: MentionCandidate, atPos: number, q: string): MentionInsert {
  return {
    startOffset: atPos,
    endOffset: atPos + 1 + q.length,
    displayText: `@${member.displayName} `,
    displayName: member.displayName,
    userPk: member.userPk,
  };
}

export interface MentionAutocompleteProps {
  text: string;
  onSelect: (insert: MentionInsert) => void;
  members: MentionCandidate[];
  onQueryChange?: (query: string | null) => void;
  /** Priority-ordered user pks; earlier ranks higher in the dropdown. */
  priorityUserPks?: string[];
  children: React.ReactNode;
}

export function MentionAutocomplete({
  text,
  onSelect,
  members,
  onQueryChange,
  priorityUserPks = [],
  children,
}: MentionAutocompleteProps) {
  const [rootId] = useState(() => `mention-ac-${nextId++}`);
  const rootRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const [atPosition, setAtPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const lastReported = useRef<string | null | undefined>(undefined);

  useDismissOnOutsideClick(rootRef, showDropdown, setShowDropdown);

  const filtered = useMemo(() => {
    if (!showDropdown) return [];
    const q = query.toLowerCase();
    const matches = members.filter(
      (m) => m.displayName.toLowerCase().startsWith(q) || m.username.toLowerCase().startsWith(q),
    );
    if (priorityUserPks.length === 0) return matches;
    const rank = new Map(priorityUserPks.map((pk, i) => [pk, i]));
    return [...matches].sort((a, b) => (rank.get(a.userPk) ?? Infinity) - (rank.get(b.userPk) ?? Infinity));
  }, [showDropdown, query, members, priorityUserPks]);

  const recompute = () => {
    const val = text;
    const pos = findActiveAt(val);
    if (pos !== null) {
      const after = val.slice(pos + 1);
      let q = "";
      for (const ch of after) {
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
      if (lastReported.current !== null && lastReported.current !== undefined) {
        lastReported.current = null;
        onQueryChange?.(null);
      }
      setShowDropdown(false);
    }
  };

  const select = (member: MentionCandidate) => {
    onSelect(buildInsert(member, atPosition, query));
    setShowDropdown(false);
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      id={rootId}
      onInput={recompute}
      onKeyDown={(e) => {
        if (!showDropdown) return;
        switch (e.key) {
          case "ArrowDown": {
            e.preventDefault();
            const max = Math.max(filtered.length - 1, 0);
            setSelectedIndex((i) => Math.min(i + 1, max));
            break;
          }
          case "ArrowUp": {
            e.preventDefault();
            setSelectedIndex((i) => Math.max(i - 1, 0));
            break;
          }
          case "Enter":
          case "Tab": {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const member = filtered[selectedIndex];
            if (member) {
              e.preventDefault();
              e.stopPropagation();
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
          {filtered.map((member, i) => (
            <button
              key={member.userPk}
              className="flex gap-2 items-center py-1 px-3 w-full text-left transition-colors text-text-primary aria-selected:bg-hover hover:bg-hover"
              role="option"
              aria-selected={i === selectedIndex}
              onMouseDown={(e) => e.preventDefault()}
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
                  <span className="text-xs truncate shrink text-foreground-muted">@{member.username}</span>
                )}
              </span>
              {i === selectedIndex && (
                <span className="py-0.5 px-2 text-xs rounded border shrink-0 text-foreground-muted border-border">
                  Enter
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
