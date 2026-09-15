import { useState, type ReactNode } from "react";
import { useMyAiI18n, type MyAiI18n } from "@/pages/my-ai/i18n";
import { dataBool } from "@/lib/dom";

// component.rs `GuideTabButton`, `render_panel` and the panel pieces
// (`Step`, `CodeBlock`, `VerifyCard`).

export type GuideTab = "ClaudeCode" | "ClaudeDesktop" | "Cursor" | "Generic";

export function GuideTabButton({
  activeTab,
  tab,
  label,
  testId,
  onSelect,
  children,
}: {
  activeTab: GuideTab;
  tab: GuideTab;
  label: string;
  testId: string;
  onSelect: (tab: GuideTab) => void;
  children: ReactNode;
}) {
  return (
    <button
      className="my-ai__guide-tab"
      role="tab"
      aria-selected={dataBool(activeTab === tab)}
      data-testid={testId}
      onClick={() => onSelect(tab)}
    >
      {children}
      {label}
    </button>
  );
}

/** `render_panel` — the active tab's instructions, with `url` woven into the snippets. */
export function GuidePanel({ tab, url }: { tab: GuideTab; url: string }) {
  const tr = useMyAiI18n();
  switch (tab) {
    case "ClaudeCode":
      return <ClaudeCodePanel url={url} tr={tr} />;
    case "ClaudeDesktop":
      return <ClaudeDesktopPanel url={url} tr={tr} />;
    case "Cursor":
      return <CursorPanel url={url} tr={tr} />;
    case "Generic":
      return <GenericPanel url={url} tr={tr} />;
  }
}

interface PanelProps {
  url: string;
  tr: MyAiI18n;
}

function ClaudeCodePanel({ url, tr }: PanelProps) {
  const cmd = `claude mcp add --transport http ratel \\\n  ${url}`;
  return (
    <div className="my-ai__guide-panel">
      <p className="my-ai__lede">
        <strong>{tr.ccLedePrefix}</strong>
        {` ${tr.ccLedeBody}`}
      </p>
      <div className="my-ai__steps">
        <Step number={1} title={tr.ccStep1Title} hint={tr.ccStep1Hint} code={["terminal", cmd]} />
        <Step number={2} title={tr.ccStep2Title} hint={tr.ccStep2Hint} />
        <Step number={3} title={tr.ccStep3Title} hint={tr.ccStep3Hint} />
      </div>
      <VerifyCard title={tr.ccVerifyTitle} hint={tr.ccVerifyHint} />
    </div>
  );
}

function ClaudeDesktopPanel({ url, tr }: PanelProps) {
  const snippet = `{\n  "mcpServers": {\n    "ratel": {\n      "transport": "http",\n      "url": "${url}"\n    }\n  }\n}`;
  return (
    <div className="my-ai__guide-panel">
      <p className="my-ai__lede">{tr.cdLede}</p>
      <div className="my-ai__steps">
        <Step
          number={1}
          title={tr.cdStep1Title}
          hint={`${tr.cdStep1Macos}: ~/Library/Application Support/Claude/claude_desktop_config.json — ${tr.cdStep1Windows}: %APPDATA%\\Claude\\claude_desktop_config.json`}
        />
        <Step
          number={2}
          title={tr.cdStep2Title}
          hint={tr.cdStep2Hint}
          code={["claude_desktop_config.json", snippet]}
        />
        <Step number={3} title={tr.cdStep3Title} hint={tr.cdStep3Hint} />
      </div>
    </div>
  );
}

function CursorPanel({ url, tr }: PanelProps) {
  const snippet = `{\n  "mcpServers": {\n    "ratel": {\n      "url": "${url}"\n    }\n  }\n}`;
  return (
    <div className="my-ai__guide-panel">
      <p className="my-ai__lede">{tr.curLede}</p>
      <div className="my-ai__steps">
        <Step number={1} title={tr.curStep1Title} hint={tr.curStep1Hint} />
        <Step number={2} title={tr.curStep2Title} hint={tr.curStep2Hint} code={["~/.cursor/mcp.json", snippet]} />
        <Step number={3} title={tr.curStep3Title} hint={tr.curStep3Hint} />
      </div>
    </div>
  );
}

function GenericPanel({ url, tr }: PanelProps) {
  const cmd = `curl -X POST ${url} \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json, text/event-stream" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
  return (
    <div className="my-ai__guide-panel">
      <p className="my-ai__lede">{tr.genLede}</p>
      <div className="my-ai__steps">
        <Step number={1} title={tr.genStep1Title} hint={tr.genStep1Hint} code={["terminal", cmd]} />
        <Step number={2} title={tr.genStep2Title} hint={tr.genStep2Hint} />
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  hint,
  code,
}: {
  number: number;
  title: string;
  hint?: string;
  code?: [path: string, snippet: string];
}) {
  return (
    <div className="my-ai__step">
      <div className="my-ai__step-num">{number}</div>
      <div className="my-ai__step-body">
        <div className="my-ai__step-title">{title}</div>
        {hint !== undefined && <div className="my-ai__step-hint">{hint}</div>}
        {code && <CodeBlock path={code[0]} snippet={code[1]} />}
      </div>
    </div>
  );
}

function CodeBlock({ path, snippet }: { path: string; snippet: string }) {
  const [copied, setCopied] = useState(false);

  // Like the Rust handler, the result of the clipboard write is ignored.
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      // ignored
    }
    setCopied(true);
    await new Promise((resolve) => window.setTimeout(resolve, 1600));
    setCopied(false);
  };

  return (
    <div className="my-ai__code">
      <div className="my-ai__code-head">
        <span className="my-ai__code-path">
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {path}
        </span>
        <button className="my-ai__code-copy" data-copied={dataBool(copied)} onClick={() => void onCopy()}>
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect height="13" rx="2" width="13" x="9" y="9" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {/* component.rs hard-codes these two labels (no translate! keys). */}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{snippet}</pre>
    </div>
  );
}

function VerifyCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="my-ai__verify">
      <svg
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <div>
        <div className="my-ai__verify-title">{title}</div>
        <div className="my-ai__verify-hint">{hint}</div>
      </div>
    </div>
  );
}
