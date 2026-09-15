// Text for a failed API call, the way the Dioxus app shows `Error::translate`:
// the serialized `common::Error` in the response (`data`: `"UnauthorizedAccess"`
// or `{"Auth":"UserNotFound"}`) is looked up in the generated `enum` i18n
// namespace, following `#[translate(from)]` delegates into the wrapped enum.
import { ApiError } from "@ratel/ts-bridges/runtime";
import i18n from "@/i18n";
import { delegates } from "@/i18n/generated/enums.i18n";

const DELEGATES = delegates as Record<string, Record<string, string> | undefined>;

function variantText(enumName: string, data: unknown): string | null {
  if (typeof data === "string") {
    const key = `${enumName}.${data}`;
    return i18n.exists(key, { ns: "enum" }) ? i18n.t(key, { ns: "enum" }) : null;
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const [variant, inner] = Object.entries(data)[0] ?? [];
    if (variant === undefined) return null;
    const delegate = DELEGATES[enumName]?.[variant];
    if (delegate) return variantText(delegate, inner);
    return variantText(enumName, variant);
  }
  return null;
}

/** Localized message for any thrown value, falling back to the server's own message. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const server = error.server;
    // No serialized `common::Error` (text/plain extractor rejection such as
    // "No session found", gateway page, network failure): the Dioxus client
    // gets a `ServerFnError`, which converts to `Error::Internal`
    // (common/types/error.rs `impl From<ServerFnError> for Error`).
    if (!server) return variantText("Error", "Internal") ?? error.body ?? error.message;
    return variantText("Error", server.data) ?? server.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
