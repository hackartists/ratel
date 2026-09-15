import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { deleteMaterial, listMaterials, uploadMaterial } from "@ratel/ts-bridges";
import { Delete2 } from "@/components/icons/edit";
import { Upload1 } from "@/components/icons/upload-download";
import { FileExtension, FileExtensionIcon } from "@/components/ui/file-extension-icon";
import { useMaterialListI18n } from "./material-list.i18n";
import { FileUploader } from "@/components/ui/file-uploader";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/ai_moderator/components/material_list — PDF
// reference materials attached to a discussion's AI moderator.

export function MaterialList({ spaceId, discussionId }: { spaceId: string; discussionId: string }) {
  const tr = useMaterialListI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["listMaterials", spaceId, discussionId];
  const materials = useSuspenseQuery({
    queryKey,
    queryFn: () => listMaterials(spaceId, discussionId),
  }).data;

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  return (
    <div className="flex flex-col gap-3 w-full">
      <p className="font-semibold font-raleway text-[13px]/[16px] tracking-[-0.14px] text-web-font-neutral">
        {tr.referenceMaterials}
      </p>

      <FileUploader
        accept=".pdf"
        onUploadSuccess={() => undefined}
        onUploadMeta={({ url, name }) => {
          uploadMaterial(spaceId, discussionId, { file_name: name, file_url: url })
            .then(refresh)
            .catch((e) => toast.error(e));
        }}
      >
        <div className="flex gap-2 justify-center items-center py-3 px-4 w-full border border-dashed rounded-[8px] cursor-pointer border-border hover:border-primary/50 transition-colors">
          <Upload1 width="16" height="16" className="[&>path]:stroke-foreground-muted" />
          <span className="text-[13px] font-medium text-foreground-muted">{tr.uploadPdf}</span>
        </div>
      </FileUploader>

      {materials.items.length > 0 && (
        <div className="flex flex-col gap-2">
          {materials.items.map((item) => (
            <div
              key={item.material_id}
              className="flex gap-2 justify-between items-center py-2 px-3 rounded-[8px] bg-card-bg"
            >
              <div className="flex gap-2 items-center min-w-0">
                <FileExtensionIcon ext={FileExtension.PDF} size={20} />
                <span className="text-[13px] font-medium truncate text-text-primary">{item.file_name}</span>
              </div>
              <button
                type="button"
                className="shrink-0 p-1 rounded transition-colors hover:bg-destructive/10"
                onClick={() => {
                  deleteMaterial(spaceId, discussionId, item.material_id)
                    .then(refresh)
                    .catch((e) => toast.error(e));
                }}
              >
                <Delete2 width="14" height="14" className="[&>path]:stroke-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
