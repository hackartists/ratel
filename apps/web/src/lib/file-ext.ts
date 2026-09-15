import { FileExtension } from "@/components/ui/file-extension-icon";

// app/ratel/src/common/types/file.rs — `extract_filename_from_url` and
// `FileExtension::{from_ext_str, from_name_or_url}`, ported verbatim.

/** Extract a human-readable filename from a URL, falling back to "untitled". */
export function extractFilenameFromUrl(url: string): string {
  const path = url.split("?")[0] ?? url;
  const trimmed = path.replace(/\/+$/, "");
  if (trimmed === "") return "untitled";
  const segments = trimmed.split("/");
  const last = segments[segments.length - 1];
  return last === "" || last === undefined ? "untitled" : last;
}

function extensionOf(name: string): string | null {
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx === name.length - 1) return null;
  return name.slice(idx + 1);
}

function fileExtensionFromExtStr(ext: string): FileExtension {
  const lower = ext.toLowerCase();
  if (lower === "jpg" || lower === "jpeg") return FileExtension.JPG;
  if (lower === "png") return FileExtension.PNG;
  if (lower === "pdf") return FileExtension.PDF;
  if (lower === "zip") return FileExtension.ZIP;
  if (lower === "doc" || lower === "docx") return FileExtension.WORD;
  if (lower === "ppt" || lower === "pptx") return FileExtension.PPTX;
  if (lower === "xls" || lower === "xlsx") return FileExtension.EXCEL;
  if (lower === "mp4") return FileExtension.MP4;
  if (lower === "mov") return FileExtension.MOV;
  if (lower === "mkv") return FileExtension.MKV;
  if (lower === "m4a") return FileExtension.M4A;
  if (lower === "mp3") return FileExtension.MP3;
  if (lower === "wav") return FileExtension.WAV;
  return FileExtension.ETC;
}

/** `FileExtension::from_name_or_url` — filename extension first, then the URL's. */
export function fileExtensionFromNameOrUrl(name: string, url: string): FileExtension {
  const nameExt = extensionOf(name);
  if (nameExt !== null) return fileExtensionFromExtStr(nameExt);
  const path = (url.split("?")[0] ?? url).replace(/\/+$/, "");
  const urlExt = extensionOf(path);
  if (urlExt !== null) return fileExtensionFromExtStr(urlExt);
  return FileExtension.ETC;
}
