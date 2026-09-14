import * as React from "react";
import { getPutObjectUri } from "@ratel/ts-bridges";
import { isTauri } from "@ratel/ts-bridges/runtime";

// app/ratel/src/common/components/file_uploader/mod.rs (`FileUploader`): a
// `<label class="cursor-pointer …">` wrapping a hidden file input and the
// children. A picked or dropped file is PUT to a presigned S3 URL
// (`GET /api/assets`), then `onUploadSuccess(publicUrl)` and
// `onUploadMeta({ url, name, size })` fire. Failures are only logged, like Rust.

export interface UploadedFileMeta {
  url: string;
  name: string;
  size: string;
}

export interface FileUploaderProps {
  onUploadSuccess: (url: string) => void;
  onUploadMeta?: (meta: UploadedFileMeta) => void;
  className?: string;
  /** Default `image/*`. */
  accept?: string;
  children?: React.ReactNode;
}

const MAX_BYTES = 100 * 1024 * 1024;

/** Rust `format_file_size`. */
export function formatFileSize(sizeBytes: number): string {
  const mb = sizeBytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

/** Rust `guess_file_type`. */
function guessFileType(file: globalThis.File): string {
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

/** Rust `upload_via_presigned` (plain-web branch; Tauri goes through the native PUT command). */
export async function uploadViaPresigned(file: globalThis.File): Promise<UploadedFileMeta> {
  if (file.size > MAX_BYTES) throw new Error("FileSizeLimitExceeded");
  const presigned = await getPutObjectUri(1, guessFileType(file));
  const presignedUrl = presigned.presigned_uris[0];
  const publicUrl = presigned.uris[0];
  if (!presignedUrl) throw new Error("Missing presigned URL.");
  if (!publicUrl) throw new Error("Missing public URL.");
  const size = formatFileSize(file.size);

  if (isTauri()) {
    // common/utils/web.rs `s3_put_object_native`: the bytes cross the invoke bridge base64-encoded.
    const { invoke } = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args: unknown) => Promise<unknown> } })
      .__TAURI_INTERNALS__;
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const resp = (await invoke("s3_put_object", { url: presignedUrl, contentType: file.type, bodyB64: btoa(binary) })) as {
      status: number;
      body: string;
    };
    if (resp.status < 200 || resp.status >= 300) {
      console.error(`s3_put_object_native failed: ${resp.status} ${resp.body}`);
      throw new Error("UploadFailed");
    }
  } else {
    const headers: Record<string, string> = {};
    if (file.type !== "") headers["Content-Type"] = file.type;
    const resp = await fetch(presignedUrl, { method: "PUT", body: file, headers });
    if (!resp.ok) {
      console.error(`Upload failed (${resp.status})`);
      throw new Error("UploadFailed");
    }
  }
  return { url: publicUrl, name: file.name, size };
}

export function FileUploader({ onUploadSuccess, onUploadMeta, className, accept = "image/*", children }: FileUploaderProps) {
  const classes = className !== undefined ? `cursor-pointer ${className}` : "cursor-pointer";

  const startUpload = (file: globalThis.File) => {
    uploadViaPresigned(file)
      .then((meta) => {
        onUploadSuccess(meta.url);
        onUploadMeta?.(meta);
      })
      .catch((err) => console.error(`FileUploader: ${err instanceof Error ? err.message : String(err)}`));
  };

  return (
    <label
      className={classes}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) startUpload(file);
      }}
    >
      <input
        className="hidden"
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (!file) return;
          startUpload(file);
          // Reset so the same file can be picked again after removal.
          e.currentTarget.value = "";
        }}
      />
      {children}
    </label>
  );
}
