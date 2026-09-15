import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { Card } from "@/components/ui/card";
import { useSpaceAnalyzesAppI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/analyzes/space-analyzes-app.i18n";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/analyze/discussion/page.rs
// (`SpaceAnalyzeDiscussionPage`). Creator-only placeholder surface; renders
// nothing for everyone else.
export function Component() {
  const tr = useSpaceAnalyzesAppI18n();
  const { role } = useSpaceAppsContext();

  if (role !== "Creator") return null;

  return (
    <div className="flex w-full flex-col gap-5">
      <h3 className="font-bold font-raleway text-[24px]/[28px] tracking-[-0.24px] text-web-font-primary">
        {tr.discussionSectionTitle}
      </h3>
      <Card className="flex min-h-[320px] w-full items-center justify-center">
        <div className="text-center text-lg font-semibold text-text-secondary">{tr.toBeContinue}</div>
      </Card>
    </div>
  );
}
