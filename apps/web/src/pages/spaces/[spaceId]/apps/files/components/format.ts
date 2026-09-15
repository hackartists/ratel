import type { File, FileExtension, FileLinkInfo } from "@ratel/ts-bridges";

// Pure helpers from app/ratel/src/features/spaces/pages/apps/apps/file/views/home/mod.rs
// and common/types/file.rs (`FileExtension::from_ext_str` / `from_name_or_url`).
//
// `FileLinkTarget` is serialized by `DynamoEnum` Display: "FILES", "OVERVIEW",
// "BOARD#<discussion id>", "QUIZ#<quiz id>".

export const DEFAULT_SPACE_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

export type FileTab = "All" | "Overview" | "Boards" | "Quiz";

export const isOverviewTarget = (target: string) => target === "OVERVIEW";
export const isBoardTarget = (target: string) => target.startsWith("BOARD#");
export const isQuizTarget = (target: string) => target.startsWith("QUIZ#");

/** `FileExtension::from_ext_str`. */
export function fromExtStr(ext: string): FileExtension {
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

/** `std::path::Path::extension` of the last path component. */
function pathExtension(path: string): string | null {
  const fileName = path.replace(/\/+$/, "").split("/").pop() ?? "";
  if (fileName === "" || fileName === "..") return null;
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return null;
  return fileName.slice(dot + 1);
}

/** `FileExtension::from_name_or_url`. */
export function fromNameOrUrl(name: string, url: string): FileExtension {
  const fromName = pathExtension(name);
  if (fromName !== null) return fromExtStr(fromName);
  const fromUrl = pathExtension(url.split("?")[0].replace(/\/+$/, ""));
  if (fromUrl !== null) return fromExtStr(fromUrl);
  return "ETC";
}

/** `effective_ext`: the filename wins over the stored (possibly legacy) `ext`. */
export function effectiveExt(file: File): FileExtension {
  const derived = fromNameOrUrl(file.name, file.url ?? "");
  return derived === "ETC" ? file.ext : derived;
}

export const isImageExt = (ext: FileExtension) => ext === "JPG" || ext === "PNG";
export const isVideoExt = (ext: FileExtension) => ext === "MP4" || ext === "MOV" || ext === "MKV";
export const isAudioExt = (ext: FileExtension) => ext === "M4A" || ext === "MP3" || ext === "WAV";
const isDocExt = (ext: FileExtension) => ext === "PDF" || ext === "WORD" || ext === "PPTX" || ext === "EXCEL";

const EXT_LABEL: Record<FileExtension, string> = {
  JPG: "JPG",
  PNG: "PNG",
  PDF: "PDF",
  ZIP: "ZIP",
  WORD: "DOC",
  PPTX: "PPT",
  EXCEL: "XLS",
  MP4: "MP4",
  MOV: "MOV",
  MKV: "MKV",
  M4A: "M4A",
  MP3: "MP3",
  WAV: "WAV",
  ETC: "FILE",
};

/** `ext_label`. */
export const extLabel = (ext: FileExtension) => EXT_LABEL[ext];

/** `icon_modifier`. */
export function iconModifier(ext: FileExtension): string {
  if (isImageExt(ext)) return "sfa-file-card__icon sfa-file-card__icon--img";
  if (isVideoExt(ext)) return "sfa-file-card__icon sfa-file-card__icon--vid";
  if (ext === "ZIP") return "sfa-file-card__icon sfa-file-card__icon--zip";
  if (isDocExt(ext)) return "sfa-file-card__icon sfa-file-card__icon--doc";
  return "sfa-file-card__icon sfa-file-card__icon--doc";
}

/** `filter_by_target`. */
export function filterByTarget(files: File[], links: FileLinkInfo[], predicate: (target: string) => boolean): File[] {
  const linked = links.filter((link) => predicate(link.link_target)).map((link) => link.file_url);
  return files.filter((f) => f.url !== null && linked.includes(f.url));
}

/** `link_for`: the first link row for the file's URL. */
export function linkFor(file: File, links: FileLinkInfo[]): FileLinkInfo | undefined {
  if (file.url === null) return undefined;
  return links.find((link) => link.file_url === file.url);
}

/** `tag_class` + `tag_label`; `null` for "FILES" (no chip). */
export function tagFor(target: string): { className: string; label: string } | null {
  if (isOverviewTarget(target)) return { className: "sfa-file-card__tag sfa-file-card__tag--overview", label: "Overview" };
  if (isBoardTarget(target)) return { className: "sfa-file-card__tag sfa-file-card__tag--board", label: "Board" };
  if (isQuizTarget(target)) return { className: "sfa-file-card__tag sfa-file-card__tag--quiz", label: "Quiz" };
  return null;
}
