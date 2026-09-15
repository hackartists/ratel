import { SeoMeta } from "@/components/ui/seo-meta";
import { useEssenceSourcesI18n } from "./i18n";
import { EssenceBreakdown } from "./components/essence-breakdown";
import { EssenceBulkBar } from "./components/essence-bulk-bar";
import { EssenceControls } from "./components/essence-controls";
import { EssenceHero } from "./components/essence-hero";
import { EssenceSourcesTable } from "./components/essence-sources-table";
import { EssenceTopbar } from "./components/essence-topbar";
import { EssenceSourcesProvider, useEssenceSourcesProvider } from "./hooks/use-essence-sources";

// app/ratel/src/features/essence/pages/sources/component.rs (`EssenceSourcesPage`,
// `/essence`). Builds the shared controller (suspending on the stats loader,
// like `use_essence_sources()?`) and composes the arena sections.
export function Component() {
  const tr = useEssenceSourcesI18n();
  const controller = useEssenceSourcesProvider();

  return (
    <EssenceSourcesProvider value={controller}>
      <SeoMeta title={tr.seoTitle} />
      <div className="essence-arena">
        <EssenceTopbar />
        <main className="essence-page">
          <EssenceHero />
          <EssenceBreakdown />
          <EssenceControls />
          <EssenceBulkBar />
          <EssenceSourcesTable />
        </main>
      </div>
    </EssenceSourcesProvider>
  );
}
