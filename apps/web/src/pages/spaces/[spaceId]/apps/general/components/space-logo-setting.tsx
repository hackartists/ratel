import { FileUploader } from "@/components/ui/file-uploader";
import { useGeneralI18n } from "@/pages/spaces/[spaceId]/apps/general/i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { useSpaceGeneralSettings } from "../hooks/use-space-general-settings";
import { wordInitials } from "./format";

// general/views/home/space_logo_setting.rs — logo preview, the "Upload Logo"
// label (the FileUploader's own <label> styled as the accent button) and Remove.
export function SpaceLogoSetting() {
  const tr = useGeneralI18n();
  const { space } = useSpaceAppsContext();
  const { updateLogo } = useSpaceGeneralSettings();

  const logo = space.logo;
  const placeholderInitials = wordInitials(space.title);

  return (
    <section className="sga-section" data-testid="section-space-logo">
      <div className="sga-section__head">
        <span className="sga-section__label">{tr.spaceLogo}</span>
        <span className="sga-section__hint">{tr.spaceLogoDescription}</span>
      </div>
      <div className="sga-logo-uploader">
        {logo === "" ? (
          <div className="sga-logo-preview sga-logo-preview--static" data-testid="space-logo-preview">
            {placeholderInitials}
          </div>
        ) : (
          <div className="sga-logo-preview sga-logo-preview--static" data-testid="space-logo-preview">
            <img src={logo} alt="Space logo" />
          </div>
        )}
        <div className="sga-logo-uploader__actions">
          <FileUploader className="sga-btn sga-btn--accent" onUploadSuccess={(url) => updateLogo.call(url)}>
            {tr.uploadLogo}
          </FileUploader>
          {logo !== "" && (
            <button
              type="button"
              className="sga-btn"
              data-testid="space-logo-remove"
              disabled={updateLogo.pending}
              onClick={() => updateLogo.call("")}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
