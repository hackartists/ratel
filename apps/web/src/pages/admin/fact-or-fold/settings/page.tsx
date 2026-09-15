import { SeoMeta } from "@/components/ui/seo-meta";
import { useAdminLiteralsI18n } from "../../admin-literals.i18n";
import { useAdminSettings } from "../hooks/use-admin-settings";
import { SettingsForm } from "./components/settings-form";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/admin/settings/component.rs
// (`FactFoldAdminSettingsPage`, `/admin/fact-or-fold/settings`): suspends on
// the settings singleton, then hands it to the form as its initial values.
export function Component() {
  const lit = useAdminLiteralsI18n();
  const { settings, save } = useAdminSettings();
  return (
    <>
      <SeoMeta title={lit.text("ff_settings_page_title")} />
      <SettingsForm initial={settings} save={save} />
    </>
  );
}
