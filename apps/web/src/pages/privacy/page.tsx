import { LegalDocument } from "@/components/legal/legal-document";
import { usePrivacyI18n } from "./i18n";

// `/privacy` — app/ratel/src/views/privacy/mod.rs (`PrivacyPolicyPage`).
export function Component() {
  return <LegalDocument data={usePrivacyI18n()} />;
}
