import type { File, FileExtension } from "@ratel/ts-bridges";
import { FileUploader } from "@/components/ui/file-uploader";
import { useSpaceFileI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/file/space-file.i18n";

// app/ratel/src/features/spaces/pages/apps/apps/file/components/file_upload_zone.rs
// (`FileUploadZone`), shared by the overview panel and the file app. Also
// `FileExtension::from_name_or_url` / `extract_filename_from_url` (common/types/file.rs).

/** Rust `FileExtension::from_ext_str`. */
export function fileExtensionFromExt(ext: string): FileExtension {
  const e = ext.toLowerCase();
  if (e === "jpg" || e === "jpeg") return "JPG";
  if (e === "png") return "PNG";
  if (e === "pdf") return "PDF";
  if (e === "zip") return "ZIP";
  if (e === "doc" || e === "docx") return "WORD";
  if (e === "ppt" || e === "pptx") return "PPTX";
  if (e === "xls" || e === "xlsx") return "EXCEL";
  if (e === "mp4") return "MP4";
  if (e === "mov") return "MOV";
  if (e === "mkv") return "MKV";
  if (e === "m4a") return "M4A";
  if (e === "mp3") return "MP3";
  if (e === "wav") return "WAV";
  return "ETC";
}

/** `std::path::Path::extension()`: the part after the last dot of the last segment, ignoring leading-dot names. */
function pathExtension(path: string): string | null {
  const last = path.split("/").pop() ?? "";
  const i = last.lastIndexOf(".");
  if (i <= 0 || i === last.length - 1) return null;
  return last.slice(i + 1);
}

/** Rust `FileExtension::from_name_or_url`. */
export function fileExtensionFromNameOrUrl(name: string, url: string): FileExtension {
  const fromName = pathExtension(name);
  if (fromName !== null) return fileExtensionFromExt(fromName);
  const path = (url.split("?")[0] ?? url).replace(/\/+$/, "");
  const fromUrl = pathExtension(path);
  if (fromUrl !== null) return fileExtensionFromExt(fromUrl);
  return "ETC";
}

/** Rust `extract_filename_from_url`. */
export function extractFilenameFromUrl(url: string): string {
  const path = url.split("?")[0] ?? url;
  const trimmed = path.replace(/\/+$/, "");
  if (trimmed === "") return "untitled";
  const segment = trimmed.split("/").pop() ?? "";
  return segment === "" ? "untitled" : segment;
}

export function FileUploadZone({ onUpload }: { onUpload: (file: File) => void }) {
  const tr = useSpaceFileI18n();
  return (
    <FileUploader
      accept="*/*"
      onUploadSuccess={() => {}}
      onUploadMeta={({ url, name, size }) => {
        const fileName = name.trim() === "" ? extractFilenameFromUrl(url) : name;
        onUpload({
          id: url,
          name: fileName,
          size,
          ext: fileExtensionFromNameOrUrl(fileName, url),
          url,
          uploader_name: null,
          uploader_profile_url: null,
          uploaded_at: null,
        });
      }}
    >
      <div className="relative w-full min-h-[140px] rounded-xl border-2 border-dashed border-separator hover:border-btn-primary-bg transition-colors duration-150 ease-in-out flex items-center justify-center cursor-pointer">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full border border-separator flex items-center justify-center text-card-meta text-2xl leading-none">
            +
          </div>
          <p className="text-sm text-card-meta font-medium">{tr.upload}</p>
          <p className="text-xs text-card-meta">{tr.dragOrClick}</p>
        </div>
      </div>
    </FileUploader>
  );
}
