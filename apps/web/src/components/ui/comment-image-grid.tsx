import * as React from "react";
import { DialogContent, DialogRoot } from "./dialog";

// app/ratel/src/common/components/comment_image_grid — thumbnails in a 1- or
// 2-column grid; clicking one opens it full size in a dialog. The alt texts are
// hardcoded English in Dioxus (no translate! entry) and kept verbatim.
//
// Dioxus passes a class to DialogContent that its wrapper drops, so the dialog
// box renders with class "dialog" only.

const IMAGE_CLASS =
  "aspect-video w-full cursor-pointer rounded-lg object-cover transition-opacity hover:opacity-90";

export interface CommentImageGridProps {
  images: string[];
}

export function CommentImageGrid({ images }: CommentImageGridProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  if (images.length === 0) return null;

  const gridClass = images.length === 1 ? "grid grid-cols-1 gap-2 max-w-[320px]" : "grid grid-cols-2 gap-2 max-w-[480px]";

  return (
    <>
      <div className={gridClass}>
        {images.map((url, i) => (
          <img key={i} className={IMAGE_CLASS} src={url} alt={`Comment image ${i}`} onClick={() => setSelected(url)} />
        ))}
      </div>
      {selected !== null && (
        <DialogRoot
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent>
            <img className="max-h-[85vh] max-w-full rounded-lg object-contain" src={selected} alt="Comment image full size" />
          </DialogContent>
        </DialogRoot>
      )}
    </>
  );
}
