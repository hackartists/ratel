import type { File, FileLinkInfo } from "@ratel/ts-bridges";
import { effectiveExt, extLabel, iconModifier, tagFor } from "./format";

// file/views/home/mod.rs `FileRow` — an extension tile, the name and a meta
// line (size + link tag). A file with a URL is a link opening in a new tab.
export function FileRow({ file, link }: { file: File; link: FileLinkInfo | undefined }) {
  const url = file.url ?? "";
  const ext = effectiveExt(file);
  const tag = link ? tagFor(link.link_target) : null;

  const row = (
    <>
      <div className={iconModifier(ext)}>{extLabel(ext)}</div>
      <div className="sfa-file-card__body">
        <span className="sfa-file-card__name">{file.name}</span>
        <span className="sfa-file-card__meta">
          <span>{file.size}</span>
          {tag && <span className={tag.className}>{tag.label}</span>}
        </span>
      </div>
    </>
  );

  if (url !== "") {
    return (
      <a className="sfa-file-card" href={url} target="_blank" rel="noopener noreferrer" data-testid="file-card">
        {row}
      </a>
    );
  }
  return (
    <div className="sfa-file-card" data-testid="file-card">
      {row}
    </div>
  );
}
