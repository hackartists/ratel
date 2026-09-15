import { LegalDocument } from "@/components/legal/legal-document";
import { useTermsI18n } from "./i18n";

// `/terms` — app/ratel/src/views/terms/mod.rs (`TermsOfServicePage`).
export function Component() {
  return <LegalDocument data={useTermsI18n()} />;
}
