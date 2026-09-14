import type { File } from "@ratel/ts-bridges";
import { Clear } from "@/components/icons/validations";
import { Button, ButtonSize, ButtonStyle } from "@/components/ui/button";
import { FileExtensionIcon } from "@/components/ui/file-extension-icon";
import { SpaceCard } from "@/components/ui/space-card";

// app/ratel/src/features/spaces/pages/apps/apps/file/components/file_card —
// shown read-only under quiz/discussion overviews, editable in creator
// question/content cards that let files be attached and removed.

export interface FileCardProps {
  file: File;
  editable: boolean;
  onDelete?: (fileId: string) => void;
}

export function FileCard({ file, editable, onDelete }: FileCardProps) {
  const fileUrl = file.url ?? "";

  return (
    <SpaceCard
      className="flex flex-row gap-2 justify-start items-center p-4 w-full rounded-[8px] bg-card cursor-pointer transition-colors hover:bg-card-hover"
      onClick={() => {
        if (fileUrl !== "") window.open(fileUrl, "_blank");
      }}
    >
      <div className="shrink-0 [&>svg]:size-9">
        <FileExtensionIcon ext={file.ext} size={36} />
      </div>
      <div className="flex flex-col gap-1 justify-start items-start w-full min-w-0">
        <p className="w-full text-xs font-semibold truncate text-web-font-primary">{file.name}</p>
        {file.size !== "" && <p className="text-xs font-normal text-card-meta">{file.size}</p>}
      </div>
      {editable && (
        <Button
          className="!p-0 shrink-0 size-6 !text-red-400 hover:!bg-transparent hover:!text-red-300"
          size={ButtonSize.Icon}
          buttonStyle={ButtonStyle.Text}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(file.id);
          }}
        >
          <Clear width="16" height="16" className="[&>path]:stroke-current" />
        </Button>
      )}
    </SpaceCard>
  );
}
