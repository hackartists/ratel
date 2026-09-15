import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMcpSecretHandler } from "@ratel/ts-bridges";
import { useRegenerateMcpSecret } from "@ratel/ts-bridges/hooks";
import { ApiError } from "@ratel/ts-bridges/runtime";
import { useMyAiI18n } from "@/pages/my-ai/i18n";
import { errorMessage as translatedError } from "@/lib/server-error";
import { useOrigin } from "@/lib/origin";

// app/ratel/src/features/me/pages/my_ai/component.rs (`MyAiPage`) — the page's
// state: the MCP secret loader, the one-time raw token, and the generate /
// copy-URL actions.

const PLACEHOLDER_TOKEN = "<your-token>";

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Rust `format!("{e}")` — the error's Display text, which the server sends as `message`. */
function displayError(error: unknown): string {
  if (error instanceof ApiError && error.server?.message) return error.server.message;
  return translatedError(error);
}

export interface UseMyAi {
  hasSecret: boolean;
  /** `{origin}/mcp/{token}` — only right after generating. */
  mcpUrl: string | null;
  /** `mcpUrl`, or the placeholder URL used in the setup guide. */
  displayUrl: string;
  generating: boolean;
  urlCopied: boolean;
  errorMessage: string | null;
  generate: () => Promise<void>;
  copyUrl: () => Promise<void>;
}

/** Suspends until the secret status loads; a load failure reaches the error boundary. */
export function useMyAi(): UseMyAi {
  const tr = useMyAiI18n();
  const origin = useOrigin();
  const mcpStatus = useSuspenseQuery({ queryKey: ["getMcpSecret"], queryFn: () => getMcpSecretHandler() });
  const regenerate = useRegenerateMcpSecret();

  const [rawToken, setRawToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mcpUrl = rawToken === null ? null : `${origin}/mcp/${rawToken}`;
  const displayUrl = mcpUrl ?? `${origin}/mcp/${PLACEHOLDER_TOKEN}`;

  const generate = async () => {
    setGenerating(true);
    setErrorMessage(null);
    try {
      const resp = await regenerate.mutateAsync();
      setRawToken(resp.secret);
      void mcpStatus.refetch();
    } catch (e) {
      setErrorMessage(displayError(e));
    }
    setGenerating(false);
  };

  const copyUrl = async () => {
    if (mcpUrl === null) return;
    try {
      await navigator.clipboard.writeText(mcpUrl);
    } catch {
      setErrorMessage(tr.errorClipboard);
      return;
    }
    setUrlCopied(true);
    await sleep(2000);
    setUrlCopied(false);
  };

  return {
    hasSecret: mcpStatus.data.has_secret,
    mcpUrl,
    displayUrl,
    generating,
    urlCopied,
    errorMessage,
    generate,
    copyUrl,
  };
}
