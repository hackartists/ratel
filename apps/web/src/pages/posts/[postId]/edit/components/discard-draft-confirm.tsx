import { Button, ButtonStyle } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MainAxisAlign } from "@/components/ui/layout";
import { Row } from "@/components/ui/row";
import type { PostEditI18n } from "@/i18n/generated/features/posts/views/post_edit/post-edit.i18n";

// app/ratel/src/features/posts/views/post_edit/component.rs (`DiscardDraftConfirm`).

export interface DiscardDraftConfirmProps {
  tr: PostEditI18n;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DiscardDraftConfirm({ tr, onCancel, onConfirm }: DiscardDraftConfirmProps) {
  return (
    <Card className="gap-4 p-6 min-w-[320px]">
      <h3 className="text-base font-semibold text-text-primary">{tr.discardConfirmTitle}</h3>
      <p className="text-sm text-foreground-muted">{tr.discardConfirmBody}</p>
      <Row mainAxisAlign={MainAxisAlign.End} className="gap-2">
        <Button buttonStyle={ButtonStyle.Outline} onClick={onCancel}>
          {tr.cancel}
        </Button>
        <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>
          {tr.discardDraft}
        </Button>
      </Row>
    </Card>
  );
}
