// Upload path of app/ratel/src/common/components/file_uploader/mod.rs
// (`upload_via_presigned`): 100 MB cap → `GET /api/assets` presigned URL → PUT
// the bytes → hand back the public URL. In the Tauri WebView the PUT goes
// through the native `s3_put_object` command (common/utils/web.rs
// `s3_put_object_native`), falling back to a direct fetch when the bridge is
// missing.
import { getPutObjectUri } from "@ratel/ts-bridges";
import { isTauri } from "@ratel/ts-bridges/runtime";

export interface UploadedFileMeta {
  url: string;
  name: string;
  size: string;
}

/** Rust `format_file_size`. */
export function formatFileSize(sizeBytes: number): string {
  const mb = sizeBytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

/** Rust `guess_file_type`: the extension, else a MIME-based guess. */
export function guessFileType(file: File): string {
  const name = file.name.toLowerCase();
  const parts = name.split(".");
  const ext = parts[parts.length - 1] ?? "";
  if (ext !== name) return ext;
  const mime = file.type.toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("pdf")) return "pdf";
  return "bin";
}

interface TauriInternals {
  invoke<R>(cmd: string, args?: Record<string, unknown>): Promise<R>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return window.btoa(binary);
}

async function putViaFetch(url: string, contentType: string, file: File): Promise<void> {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;
  const resp = await fetch(url, { method: "PUT", body: file, headers });
  if (!resp.ok) {
    console.error(`Upload failed (${resp.status})`);
    throw new Error("UploadFailed");
  }
}

/** Rust `s3_put_object_native`: native command first, direct PUT when absent. */
async function putViaNative(url: string, contentType: string, file: File): Promise<void> {
  const bodyB64 = toBase64(new Uint8Array(await file.arrayBuffer()));
  let resp: { status: number; body: string };
  try {
    resp = await window.__TAURI_INTERNALS__!.invoke<{ status: number; body: string }>("s3_put_object", {
      url,
      contentType,
      bodyB64,
    });
  } catch {
    await putViaFetch(url, contentType, file);
    return;
  }
  if (resp.status < 200 || resp.status >= 300) {
    console.error(`Upload failed (${resp.status})`);
    throw new Error("UploadFailed");
  }
}

/**
 * Uploads one file and returns its public URL + metadata, or throws (the Rust
 * component logs the error and keeps going).
 */
export async function uploadFile(file: File): Promise<UploadedFileMeta> {
  if (file.size > 100 * 1024 * 1024) throw new Error("FileSizeLimitExceeded");

  const fileType = guessFileType(file);
  const presigned = await getPutObjectUri(1, fileType);
  const presignedUrl = presigned.presigned_uris[0];
  const publicUrl = presigned.uris[0];
  if (!presignedUrl) throw new Error("Missing presigned URL.");
  if (!publicUrl) throw new Error("Missing public URL.");

  if (isTauri()) await putViaNative(presignedUrl, file.type, file);
  else await putViaFetch(presignedUrl, file.type, file);

  return { url: publicUrl, name: file.name, size: formatFileSize(file.size) };
}
