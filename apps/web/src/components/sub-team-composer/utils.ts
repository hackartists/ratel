import type { FileExtension } from "@ratel/ts-bridges";

// Pure helpers ported from
// app/ratel/src/features/sub_team/pages/doc_compose/component.rs (top of
// file) and app/ratel/src/common/utils/time.rs `time_ago`.

/**
 * `parse_size_to_bytes`: parses a human size string ("248 KB", "1.2 MB")
 * back into bytes, the inverse of `prettySize`/`format_file_size`.
 */
export function parseSizeToBytes(s: string): number {
  const upper = s.trim().toUpperCase();
  let num: string;
  let mul: number;
  if (upper.endsWith("MB")) {
    num = upper.slice(0, -2);
    mul = 1024 * 1024;
  } else if (upper.endsWith("KB")) {
    num = upper.slice(0, -2);
    mul = 1024;
  } else if (upper.endsWith("B")) {
    num = upper.slice(0, -1);
    mul = 1;
  } else {
    num = upper;
    mul = 1;
  }
  const parsed = Number.parseFloat(num.trim());
  const value = Number.isFinite(parsed) ? parsed : 0;
  return Math.trunc(Math.max(value, 0) * mul);
}

/** `pretty_size`: MB with one decimal at ≥1MB, else whole KB (min 1). */
export function prettySize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${Math.round(Math.max(kb, 1))} KB`;
}

/** `file_icon_modifier`. */
export function fileIconModifier(ext: FileExtension): string {
  switch (ext) {
    case "PDF":
      return "file-row__icon--pdf";
    case "JPG":
    case "PNG":
      return "file-row__icon--img";
    default:
      return "";
  }
}

/** `file_ext_label`. */
export function fileExtLabel(ext: FileExtension): string {
  switch (ext) {
    case "PDF":
      return "PDF";
    case "PNG":
      return "PNG";
    case "JPG":
      return "JPG";
    case "WORD":
      return "DOCX";
    case "PPTX":
      return "PPTX";
    case "EXCEL":
      return "XLSX";
    case "ZIP":
      return "ZIP";
    case "MP4":
      return "MP4";
    case "MOV":
      return "MOV";
    case "MKV":
      return "MKV";
    case "M4A":
      return "M4A";
    case "MP3":
      return "MP3";
    case "WAV":
      return "WAV";
    default:
      return "FILE";
  }
}

/** `FileExtension::from_ext_str`. */
function fileExtensionFromExtStr(ext: string): FileExtension {
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

/** `std::path::Path::extension()`: no extension for a dotless or dotfile name. */
function pathExtension(pathOrName: string): string | null {
  const base = pathOrName.split("/").pop() ?? pathOrName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1);
}

/** `FileExtension::from_name_or_url`. */
export function fileExtensionFromNameOrUrl(name: string, url: string): FileExtension {
  const nameExt = pathExtension(name);
  if (nameExt) return fileExtensionFromExtStr(nameExt);
  const path = url.split("?")[0]?.replace(/\/+$/, "") ?? "";
  const urlExt = pathExtension(path);
  if (urlExt) return fileExtensionFromExtStr(urlExt);
  return "ETC";
}

/** `common::utils::time::time_ago` (integer division truncates toward zero). */
export function timeAgo(timestampMillis: number): string {
  const diff = Date.now() - timestampMillis;
  const div = (n: number) => String(Math.trunc(diff / n));
  if (diff < 60 * 1000) return `${div(1000)}s ago`;
  if (diff < 3600 * 1000) return `${div(1000 * 60)}m ago`;
  if (diff < 86400 * 1000) return `${div(1000 * 3600)}h ago`;
  if (diff < 604800 * 1000) return `${div(1000 * 86400)}d ago`;
  if (diff < 31536000 * 1000) return `${div(1000 * 604800)}w ago`;
  return `${div(1000 * 31536000)}y ago`;
}

/** `str.parse::<TeamPartition>()`: strips the `"TEAM#"` prefix if present. */
export function toTeamId(pk: string): string {
  return pk.startsWith("TEAM#") ? pk.slice(5) : pk;
}
