import { LegalDocument } from "@/components/legal/legal-document";
import { useChildSafetyI18n } from "./i18n";

// `/child-safety` — app/ratel/src/views/child_safety/mod.rs (`ChildSafetyPage`).
export function Component() {
  return <LegalDocument data={useChildSafetyI18n()} />;
}
