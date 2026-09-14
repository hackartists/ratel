import { Outlet, useParams } from "react-router-dom";
import { SpaceContextProvider, SpaceLayoutUiProvider, useSpace } from "@/components/space/space-context";
import { SeoMeta } from "@/components/ui/seo-meta";
import { Layover, LayoverProvider } from "@/lib/layover";

// app/ratel/src/features/spaces/layout.rs (`SpaceLayout`):
//   SpaceContextProvider::init(space_id)?  → <SpaceContextProvider> (suspends until loaded)
//   LayoverService                         → <LayoverProvider>
//   SpaceLayoutUiContext { sidebar_visible } → <SpaceLayoutUiProvider>
//   SeoMeta { title, description, image } + Outlet + Layover
// Providers render no DOM, so `#main` holds exactly what the Dioxus layout renders.
//
// `SpaceNav` / `SpaceTop` (space_common/components) are not mounted by the Rust
// layout (nor anywhere else in the route tree), so nothing renders them here.
const DEFAULT_SEO_IMAGE = "https://metadata.ratel.foundation/logos/logo-symbol.png";

export function Component() {
  const { spaceId = "" } = useParams();
  return (
    // Keyed so a different space starts from fresh state, like a new Dioxus scope.
    <SpaceContextProvider key={spaceId} spaceId={spaceId}>
      <LayoverProvider>
        <SpaceLayoutUiProvider>
          <SpaceSeoMeta />
          <Outlet />
          <Layover />
        </SpaceLayoutUiProvider>
      </LayoverProvider>
    </SpaceContextProvider>
  );
}

function SpaceSeoMeta() {
  const space = useSpace();
  return (
    <SeoMeta
      title={space.title}
      description={spaceDescription(space.content)}
      image={space.logo === "" ? DEFAULT_SEO_IMAGE : space.logo}
    />
  );
}

/**
 * Rust `SpaceResponse::description()` (space_common/controllers/get_space.rs:233):
 * the content with every `<[^>]*>` tag removed (no trimming).
 */
function spaceDescription(content: string): string {
  return content.replace(/<[^>]*>/g, "");
}
