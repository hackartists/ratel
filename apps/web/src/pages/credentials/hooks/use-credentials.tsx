import { useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { getCredentialsHandler, getDidSummaryHandler } from "@ratel/ts-bridges";
import type { CredentialResponse, DidSummaryResponse } from "@ratel/ts-bridges";
import { useSignAttributes } from "@ratel/ts-bridges/hooks";
import { ApiError } from "@ratel/ts-bridges/runtime";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useCredentialsI18n } from "@/pages/credentials/credentials.i18n";
import { useUserContext } from "@/lib/auth";
import { portoneConfig } from "@/lib/portone";
import { useToast } from "@/lib/toast";
import { clearKycHistory, exportVcDownload, requestIdentityVerification, takePgReturnId } from "./kyc";

// Controller for app/ratel/src/features/social/pages/credentials/views/mod.rs
// (`Home`): the DID summary + credentials loaders, refresh, the PortOne KYC
// flow, code redemption, VC export, and the WebView PG-return finalize.

export interface UseCredentials {
  summary: DidSummaryResponse;
  /** Rust `user_ctx().did()`: the signed-in user's DID, "-" when signed out. */
  fallbackDid: string;
  /** Rust `refresh`: restarts both loaders. */
  refresh: () => void;
  /** Rust `on_kyc` / `on_kyc_redo`: PortOne identity verification, then refresh. */
  runKyc: () => Promise<void>;
  /** `sign_attributes_handler(SignAttributesRequest::Code { code })`. Throws on failure. */
  submitCode: (code: string) => Promise<CredentialResponse>;
  /** Rust `export_vc`: downloads the VC JSON as `ratel-vc.json`. */
  exportVc: () => void;
}

const CredentialsContext = createContext<UseCredentials | null>(null);
export const CredentialsProvider = CredentialsContext.Provider;

export function useCredentials(): UseCredentials {
  const ctx = useContext(CredentialsContext);
  if (!ctx) throw new Error("useCredentials must be used under CredentialsProvider");
  return ctx;
}

/**
 * A Dioxus `use_loader(handler)?`: pending suspends, failure reaches the
 * route error boundary. The Dioxus web client decodes a JSON handler error
 * into its typed `common::Error`, but anything else (a text/plain extractor
 * rejection such as the signed-out 401 "No session found", a network failure)
 * becomes `ServerFnError` → `Error::Internal` (common/types/error.rs
 * `impl From<ServerFnError> for Error`); the reference build shows
 * "An unexpected error occurred" for signed-out `/credentials`. JSON errors
 * are rethrown as-is so `ErrorPage` translates them and detects session
 * errors; the rest become that `Internal` message. No retries (Dioxus doesn't
 * retry), and `gcTime: 0` drops the result on unmount so a remount loads again.
 */
function useLoader<T>(key: string, load: () => Promise<T>, internalMessage: string) {
  const query = useSuspenseQuery<T>({
    queryKey: [key],
    queryFn: () =>
      load().catch((err: unknown) => {
        if (err instanceof ApiError && err.server !== null) throw err;
        console.error("Server function error:", err);
        throw new Error(internalMessage);
      }),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  return { data: query.data, refetch: query.refetch };
}

/** `build_vc_document`. serde_json has no `preserve_order` here, so object keys serialize sorted. */
function buildVcDocument(summary: DidSummaryResponse): unknown {
  const subject: Record<string, string> = { id: summary.did };
  for (const attr of summary.attributes) {
    if (attr.verified && attr.value !== null) subject[attr.key] = attr.value;
  }
  const sortedSubject: Record<string, string> = {};
  for (const key of Object.keys(subject).sort()) sortedSubject[key] = subject[key];
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    credentialSubject: sortedSubject,
    issuer: "did:web:ratel.foundation:issuer",
    type: ["VerifiableCredential", "RatelPersonalIdentity"],
  };
}

export function useCredentialsProvider(): UseCredentials {
  const tr = useCredentialsI18n();
  const te = useEnumI18n();
  const toast = useToast();
  const { user } = useUserContext();
  const signAttributes = useSignAttributes();

  const internalMessage = te("Error", "Internal");
  const summary = useLoader("getDidSummary", getDidSummaryHandler, internalMessage);
  const credential = useLoader("getCredentials", getCredentialsHandler, internalMessage);

  const refresh = useCallback(() => {
    void summary.refetch();
    void credential.refetch();
  }, [summary.refetch, credential.refetch]);

  // interop `verify_identity` (non-bypass build): open the SDK, then finalize
  // the returned id on the server.
  const verifyIdentity = useCallback(
    async (storeId: string, channelKey: string, prefix: string) => {
      let value: unknown;
      try {
        value = await requestIdentityVerification(storeId, channelKey, prefix);
      } catch (err) {
        console.error("Failed to request identity verification:", err);
        throw new Error(te("Error", "PortOneRequestFailure"));
      }
      if (typeof value !== "string") throw new Error(te("Error", "PortOneInicisInvalidIdentity"));
      return signAttributes.mutateAsync({ type: "port_one", id: value });
    },
    [signAttributes.mutateAsync, te],
  );

  const runKyc = useCallback(async () => {
    const prefix = user?.id;
    if (!prefix) {
      toast.warn(tr.verificationError);
      return;
    }
    try {
      await verifyIdentity(portoneConfig.storeId, portoneConfig.inicisChannelKey, prefix);
      refresh();
    } catch (err) {
      toast.error(err);
    }
  }, [user?.id, toast, tr.verificationError, verifyIdentity, refresh]);

  const submitCode = useCallback(
    (code: string) => signAttributes.mutateAsync({ type: "code", code }),
    [signAttributes.mutateAsync],
  );

  const exportVc = useCallback(() => {
    exportVcDownload(JSON.stringify(buildVcDocument(summary.data), null, 2));
  }, [summary.data]);

  // WebView/mobile PortOne return: finalize the credential from the query the
  // redirect appended, once per mount (the Rust `use_effect` in `Home`).
  const latest = useRef({ signAttributes: signAttributes.mutateAsync, refresh, toast, tr });
  latest.current = { signAttributes: signAttributes.mutateAsync, refresh, toast, tr };
  const pgReturnStarted = useRef(false);
  useEffect(() => {
    if (pgReturnStarted.current) return;
    pgReturnStarted.current = true;
    void (async () => {
      const id = await takePgReturnId();
      if (!id) return;
      const { signAttributes: sign, refresh: reload, toast: notify, tr: text } = latest.current;
      try {
        await sign({ type: "port_one", id });
        notify.info(text.verificationSuccess);
        reload();
        await clearKycHistory();
      } catch (err) {
        console.error("kyc: finalize failed:", err);
        notify.error(err);
        await clearKycHistory();
      }
    })();
  }, []);

  return {
    summary: summary.data,
    fallbackDid: user ? `did:web:ratel.foundation:${user.username}` : "-",
    refresh,
    runKyc,
    submitCode,
    exportVc,
  };
}
