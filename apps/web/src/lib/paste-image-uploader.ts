// app/ratel/src/common/components/paste_image_uploader/mod.rs
// (`handle_paste_event`): called from a comment composer's `onPaste`. Reads
// the first pasted image, shows an instant local-blob preview, and uploads
// it to S3 in the background — mirrors `PendingImage` bookkeeping in
// `components/ui/image-upload-preview.tsx`.
import type { Dispatch, SetStateAction } from "react";
import { getPutObjectUri } from "@ratel/ts-bridges";
import { isTauri, s3PutObject, bytesToBase64 } from "@/lib/native";
import type { PendingImage } from "@/components/ui/image-upload-preview";

export const MAX_COMMENT_IMAGES = 4;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function guessExtension(file: File): string {
  const mime = file.type.toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("webp")) return "webp";
  return "bin";
}

async function uploadBlobToS3(file: File): Promise<string> {
  const presigned = await getPutObjectUri(1, "comment-images");
  const presignedUrl = presigned.presigned_uris[0];
  const publicUrl = presigned.uris[0];
  if (!presignedUrl) throw new Error("No presigned URL returned");
  if (!publicUrl) throw new Error("No public URL returned");

  const contentType = file.type;
  if (isTauri()) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // web.rs `s3_put_object_native`: a native non-2xx is an upload failure.
    const resp = await s3PutObject(presignedUrl, contentType, bytesToBase64(bytes));
    if (resp.status < 200 || resp.status >= 300) throw new Error(`Upload failed with status ${resp.status}`);
  } else {
    const headers: Record<string, string> = {};
    if (contentType !== "") headers["Content-Type"] = contentType;
    const resp = await fetch(presignedUrl, { method: "PUT", body: file, headers });
    if (!resp.ok) throw new Error(`Upload failed with status ${resp.status}`);
  }
  return publicUrl;
}

/**
 * Call from a composer's `onPaste`. Returns `true` if an image was captured
 * (caller should `preventDefault()`), `false` for a normal text paste.
 */
export function handlePasteEvent(
  event: React.ClipboardEvent,
  pendingImages: PendingImage[],
  setPendingImages: Dispatch<SetStateAction<PendingImage[]>>,
): boolean {
  const files = event.clipboardData?.files;
  if (!files || files.length === 0) return false;
  const file = files[0];
  if (!file || !file.type.startsWith("image/")) return false;

  if (pendingImages.length >= MAX_COMMENT_IMAGES) {
    console.warn(`Maximum ${MAX_COMMENT_IMAGES} images per comment`);
    return true;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    console.warn(`Image too large: ${file.size} bytes (max ${MAX_IMAGE_SIZE_BYTES})`);
    return true;
  }

  const localUrl = URL.createObjectURL(file);
  const idx = pendingImages.length;
  setPendingImages((current) => [...current, { localUrl, remoteUrl: null, uploading: true }]);
  void guessExtension(file); // parity note: kept for future content-type-aware naming

  uploadBlobToS3(file)
    .then((publicUrl) => {
      setPendingImages((current) => current.map((img, i) => (i === idx ? { ...img, remoteUrl: publicUrl, uploading: false } : img)));
    })
    .catch((err) => {
      console.error(`Image upload failed: ${err instanceof Error ? err.message : String(err)}`);
      setPendingImages((current) => current.filter((_, i) => i !== idx));
    });

  return true;
}
