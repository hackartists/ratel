// File upload over a presigned S3 URL — the React counterpart of
// app/ratel/src/common/components/file_uploader (`upload_via_presigned`) and
// app/ratel/src/common/utils/web.rs (`s3_put_object_native`).
//
//   1. `GET /api/assets?total_count=1&file_type=<ext>` returns a presigned PUT
//      URL and the public URL the object will live at.
//   2. The bytes are PUT to S3 like `s3_put_object_native`:
//      - first through the native `s3_put_object` command (`lib/native.ts`) —
//        inside the Tauri WebView a fetch from `tauri://localhost` to S3 dies on
//        the CORS preflight;
//      - if that call rejects (no Tauri bridge: a plain browser), a `fetch` PUT
//        with the file's `Content-Type`;
//      - a native non-2xx status is a real failure and throws.
//
// Usage:
//   const { url, name, size } = await uploadFile(file);
//   // or step by step:
//   const { presignedUrl, publicUrl } = await requestPresignedUpload("png");
//   await putPresignedObject(presignedUrl, file.type, file);
import { getPutObjectUri } from "@ratel/ts-bridges";
import i18n from "@/i18n";
import { bytesToBase64, s3PutObject, type NativeHttpResponse } from "@/lib/native";

/** Rust `upload_via_presigned`: files above 100 MB are rejected before any request. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** `FileUploadError` variants (plus the Rust `Error::NotFound` presign cases). */
export type UploadErrorKind =
  | "FileSizeLimitExceeded"
  | "UploadFailed"
  | "InvalidUploadResponse"
  | "MissingPresignedUrl"
  | "MissingPublicUrl";

const NOT_FOUND_TEXT: Partial<Record<UploadErrorKind, string>> = {
  MissingPresignedUrl: "Missing presigned URL.",
  MissingPublicUrl: "Missing public URL.",
};

/** A failed upload. `message` is the translated `FileUploadError` text; `detail` is for logs. */
export class UploadError extends Error {
  constructor(
    public readonly kind: UploadErrorKind,
    public readonly detail?: string,
  ) {
    super(NOT_FOUND_TEXT[kind] ?? i18n.t(`FileUploadError.${kind}`, { ns: "enum" }));
    this.name = "UploadError";
  }
}

/** Rust `UploadedFileMeta`. */
export interface UploadedFile {
  /** Public URL of the uploaded object. */
  url: string;
  /** Original file name. */
  name: string;
  /** Human-readable size, e.g. `1.2 MB` / `512.0 KB`. */
  size: string;
}

export interface PresignedUpload {
  presignedUrl: string;
  publicUrl: string;
}

/** Rust `format_file_size`. */
export function formatFileSize(sizeBytes: number): string {
  const mb = sizeBytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

/**
 * Rust `guess_file_type`: the text after the last `.` of the lowercased name
 * (when the name has a dot), else a guess from the MIME type.
 */
export function guessFileType(file: Pick<File, "name" | "type">): string {
  const name = file.name.toLowerCase();
  const parts = name.split(".");
  const ext = parts[parts.length - 1];
  if (ext !== name) return ext;
  const mime = file.type.toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("pdf")) return "pdf";
  return "bin";
}

/** Rust `request_presigned_url`: one presigned PUT URL for `fileType`. */
export async function requestPresignedUpload(fileType: string): Promise<PresignedUpload> {
  const presigned = await getPutObjectUri(1, fileType);
  const presignedUrl = presigned.presigned_uris[0];
  if (presignedUrl === undefined) throw new UploadError("MissingPresignedUrl");
  const publicUrl = presigned.uris[0];
  if (publicUrl === undefined) throw new UploadError("MissingPublicUrl");
  return { presignedUrl, publicUrl };
}

/** Rust `s3_put_object_native`: native PUT, falling back to `fetch` when there is no bridge. */
export async function putPresignedObject(presignedUrl: string, contentType: string, file: Blob): Promise<void> {
  let res: NativeHttpResponse;
  try {
    const bodyB64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    res = await s3PutObject(presignedUrl, contentType, bodyB64);
  } catch {
    // No Tauri IPC bridge (running in a browser) — use fetch instead.
    return putPresignedObjectFetch(presignedUrl, contentType, file);
  }
  if (res.status < 200 || res.status >= 300) {
    throw new UploadError("UploadFailed", `s3_put_object_native failed: ${res.status} ${res.body}`);
  }
}

/** Rust `s3_put_object_fetch` (also the plain-web upload path). */
async function putPresignedObjectFetch(presignedUrl: string, contentType: string, file: Blob): Promise<void> {
  const headers: Record<string, string> = {};
  if (contentType !== "") headers["Content-Type"] = contentType;
  let res: Response;
  try {
    res = await fetch(presignedUrl, { method: "PUT", body: file, headers });
  } catch (err) {
    throw new UploadError("UploadFailed", `upload: ${String(err)}`);
  }
  if (!res.ok) throw new UploadError("UploadFailed", `Upload failed (${res.status})`);
}

/** Presigned URL + PUT for one file. Rejects with `UploadError` (or the presign `ApiError`). */
export async function uploadFile(file: File): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("FileSizeLimitExceeded");
  const { presignedUrl, publicUrl } = await requestPresignedUpload(guessFileType(file));
  await putPresignedObject(presignedUrl, file.type, file);
  return { url: publicUrl, name: file.name, size: formatFileSize(file.size) };
}
