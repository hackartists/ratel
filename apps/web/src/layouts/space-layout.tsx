import { Outlet } from "react-router-dom";
import { Layover, LayoverProvider } from "@/lib/layover";

// Dioxus `SpaceLayout` (app/ratel/src/features/spaces/layout.rs): a space-scoped
// layover service, the route outlet, then the layover panel. The space context
// provider and SEO meta move here with P5.
export function Component() {
  return (
    <LayoverProvider>
      <Outlet />
      <Layover />
    </LayoverProvider>
  );
}
