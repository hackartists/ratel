// app/ratel/src/common/components/file_uploader/mod.rs (`upload_via_presigned`)
// + common/utils/web.rs (`s3_put_object_native`): ask the server for a
// presigned S3 URL (`GET /api/assets?total_count=1&file_type=<ext>`), PUT the
// file there, and hand back the public URL.
//
// Browser: a direct `fetch` PUT. Tauri: the native `s3_put_object` command (a
// WebView fetch to S3 dies on the CORS preflight), falling back to fetch when
// the IPC bridge is missing.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getPutObjectUri } from "@ratel/ts-bridges";
import { bytesToBase64, isTauri, s3PutObject } from "./native";

/** Rust `UploadedFileMeta`. */
export interface UploadedFileMeta {
  url: string;
  name: string;
  size: string;
}

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Rust `FileUploadError` variants, thrown as `Error(message = variant)`. */
export class FileUploadError extends Error {
  constructor(public readonly variant: "FileSizeLimitExceeded" | "UploadFailed" | "InvalidUploadResponse" | "NotFound") {
    super(variant);
    this.name = "FileUploadError";
  }
}

/** Rust `format_file_size`. */
export function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

/** Rust `guess_file_type`: the extension, else a type from the MIME, else "bin". */
export function guessFileType(file: File): string {
  const name = file.name.toLowerCase();
  const parts = name.split(".");
  const ext = parts[parts.length - 1];
  if (ext !== undefined && ext !== name) return ext;
  const mime = file.type.toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("pdf")) return "pdf";
  return "bin";
}

async function putWithFetch(url: string, file: File): Promise<void> {
  const headers: Record<string, string> = {};
  if (file.type !== "") headers["Content-Type"] = file.type;
  let res: Response;
  try {
    res = await fetch(url, { method: "PUT", body: file, headers });
  } catch (e) {
    console.error(`upload: ${String(e)}`);
    throw new FileUploadError("UploadFailed");
  }
  if (!res.ok) {
    console.error(`Upload failed (${res.status})`);
    throw new FileUploadError("UploadFailed");
  }
}

async function putWithNative(url: string, file: File): Promise<void> {
  if (!isTauri()) return putWithFetch(url, file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let resp: { status: number; body: string };
  try {
    resp = await s3PutObject(url, file.type, bytesToBase64(bytes));
  } catch {
    return putWithFetch(url, file);
  }
  if (resp.status < 200 || resp.status >= 300) {
    console.error(`s3_put_object_native failed: ${resp.status} ${resp.body}`);
    throw new FileUploadError("UploadFailed");
  }
}

/** Uploads one file through a presigned URL and resolves with its public URL and metadata. */
export function useFileUpload(): (file: File) => Promise<UploadedFileMeta> {
  const queryClient = useQueryClient();
  return useCallback(
    async (file: File) => {
      if (file.size > MAX_UPLOAD_BYTES) throw new FileUploadError("FileSizeLimitExceeded");
      const fileType = guessFileType(file);
      const presigned = await queryClient.fetchQuery({
        queryKey: ["getPutObjectUri", 1, fileType, file.name, file.size, Date.now()],
        queryFn: () => getPutObjectUri(1, fileType),
        gcTime: 0,
      });
      const presignedUrl = presigned.presigned_uris[0];
      const publicUrl = presigned.uris[0];
      if (presignedUrl === undefined || publicUrl === undefined) throw new FileUploadError("NotFound");
      await putWithNative(presignedUrl, file);
      return { url: publicUrl, name: file.name, size: formatFileSize(file.size) };
    },
    [queryClient],
  );
}
