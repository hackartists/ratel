import type * as React from "react";
import { uploadFile, type UploadedFile } from "@/lib/upload";

// app/ratel/src/common/components/file_uploader — a `<label>` wrapping a hidden
// file input plus the children; choosing or dropping a file uploads it through
// `lib/upload.ts`. Failures are logged, like the Rust component.

export type UploadedFileMeta = UploadedFile;

export interface FileUploaderProps {
  /** Called with the public URL once the upload finishes. */
  onUploadSuccess: (url: string) => void;
  /** Called after `onUploadSuccess` with the URL, file name and formatted size. */
  onUploadMeta?: (meta: UploadedFileMeta) => void;
  /** Appended to `cursor-pointer`. */
  className?: string;
  /** The input's `accept` (default `image/*`). */
  accept?: string;
  children?: React.ReactNode;
}

export function FileUploader({ onUploadSuccess, onUploadMeta, className, accept, children }: FileUploaderProps) {
  const classes = className === undefined ? "cursor-pointer" : `cursor-pointer ${className}`;

  const startUpload = (file: File) => {
    uploadFile(file).then(
      (meta) => {
        onUploadSuccess(meta.url);
        onUploadMeta?.(meta);
      },
      (err: unknown) => {
        console.error(`FileUploader: ${err instanceof Error ? err.message : String(err)}`);
      },
    );
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
        accept={accept ?? "image/*"}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (!file) return;
          startUpload(file);
          // Reset so the same file can be picked again.
          e.currentTarget.value = "";
        }}
      />
      {children}
    </label>
  );
}
