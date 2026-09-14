import { dataBool } from "@/lib/dom";

// app/ratel/src/common/components/image_upload_preview — a 4-column grid of
// pending images with a hover remove button (hidden while uploading) and a
// spinner overlay while uploading. Rust takes a `Signal<Vec<PendingImage>>` and
// removes in place; here the caller owns the list and gets `onChange`.
// The "Remove image" / "Pending image {i}" labels are hardcoded English in
// Dioxus (no translate! entry) and kept verbatim.

export interface PendingImage {
  localUrl: string;
  remoteUrl?: string | null;
  uploading: boolean;
}

export function isPendingImageReady(image: PendingImage): boolean {
  return image.remoteUrl != null && !image.uploading;
}

export interface ImageUploadPreviewProps {
  images: PendingImage[];
  onChange: (images: PendingImage[]) => void;
}

export function ImageUploadPreview({ images, onChange }: ImageUploadPreviewProps) {
  if (images.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-4 gap-2">
      {images.map((img, i) => (
        <div key={i} className="group relative">
          <img
            className="aspect-video w-full rounded-lg object-cover aria-busy:animate-pulse aria-busy:opacity-50"
            aria-busy={dataBool(img.uploading)}
            src={img.localUrl}
            alt={`Pending image ${i}`}
          />
          {!img.uploading && (
            <button
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs opacity-0 transition-opacity bg-destructive text-btn-primary-text group-hover:opacity-100"
              aria-label="Remove image"
              onClick={() => onChange(images.filter((_, at) => at !== i))}
            >
              {"×"}
            </button>
          )}
          {img.uploading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
