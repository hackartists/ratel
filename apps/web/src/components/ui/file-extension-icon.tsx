import { File } from "@/components/icons/file";
import { Docx, Jpg, Mov, Mp4, Pdf, Png, Pptx, Xlsx, Zip } from "@/components/icons/files";

// app/ratel/src/common/components/file_extension_icon. `FileExtension` values
// are the serde names of app/ratel/src/common/types/file.rs.

export const FileExtension = {
  JPG: "JPG",
  PNG: "PNG",
  PDF: "PDF",
  ZIP: "ZIP",
  WORD: "WORD",
  PPTX: "PPTX",
  EXCEL: "EXCEL",
  MP4: "MP4",
  MOV: "MOV",
  MKV: "MKV",
  M4A: "M4A",
  MP3: "MP3",
  WAV: "WAV",
  ETC: "ETC",
} as const;
export type FileExtension = (typeof FileExtension)[keyof typeof FileExtension];

const ICON_CLASS =
  "text-card-meta [&>path:first-child]:fill-transparent [&>path:first-child]:stroke-current [&>rect:first-child]:fill-transparent [&>rect:first-child]:stroke-current [&_g>path:first-child]:fill-transparent [&_g>path:first-child]:stroke-current";
const GENERIC_CLASS = "text-card-meta [&>path]:stroke-current [&>path]:fill-none";

const GLYPHS = {
  PDF: Pdf,
  JPG: Jpg,
  PNG: Png,
  ZIP: Zip,
  WORD: Docx,
  PPTX: Pptx,
  EXCEL: Xlsx,
  MP4: Mp4,
  MOV: Mov,
} as const;

/** Rust `icon_size_attr`: only these sizes exist; anything else renders at 36. */
function sizeAttr(size: number): string {
  return [14, 16, 20, 24, 32, 36, 40].includes(size) ? String(size) : "36";
}

export interface FileExtensionIconProps {
  ext: FileExtension;
  size?: number;
}

export function FileExtensionIcon({ ext, size = 36 }: FileExtensionIconProps) {
  const s = sizeAttr(size);
  const Glyph = GLYPHS[ext as keyof typeof GLYPHS];
  // No dedicated glyph for MKV/M4A/MP3/WAV/ETC — the generic file icon.
  if (!Glyph) return <File width={s} height={s} className={GENERIC_CLASS} />;
  return <Glyph width={s} height={s} className={ICON_CLASS} />;
}
