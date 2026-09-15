import { useState } from "react";
import { Button, ButtonStyle } from "@/components/ui/button";
import { FileUploader } from "@/components/ui/file-uploader";
import { useTeamCreationFormI18n } from "./team-creation-form.i18n";
import { dataBool } from "@/lib/dom";
import type { TeamCreationPayload } from "@/lib/teams";

// app/ratel/src/common/components/team_creation_form/team_creation_form.rs —
// logo upload, team name / id / description, cancel + create. The team id is
// lower-cased as typed and must be 3+ characters of `[a-z0-9_]`.

const DEFAULT_PROFILE = "https://metadata.ratel.foundation/ratel/default-profile.png";

export interface TeamCreationFormProps {
  onSubmit: (payload: TeamCreationPayload) => void;
  onCancel?: () => void;
  submitting?: boolean;
  errorMessage?: string | null;
}

export function TeamCreationForm({ onSubmit, onCancel, submitting = false, errorMessage = null }: TeamCreationFormProps) {
  const tr = useTeamCreationFormI18n();
  const [profileUrl, setProfileUrl] = useState("");
  const [nickname, setNickname] = useState("");
  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");

  let validationError: string | null = null;
  if (username !== "") {
    // Rust `u.len() < 3` counts UTF-8 bytes.
    if (new TextEncoder().encode(username).length < 3) validationError = tr.usernameTooShort;
    else if (!/^[a-z0-9_]*$/.test(username)) validationError = tr.usernameInvalidChars;
  }
  const valid = validationError === null;
  const canSubmit = valid && username !== "" && nickname !== "" && !submitting;
  const previewUrl = profileUrl === "" ? DEFAULT_PROFILE : profileUrl;

  return (
    <div className="flex flex-col gap-10 items-center w-100 max-tablet:w-full">
      <FileUploader
        onUploadSuccess={setProfileUrl}
        className="group relative flex items-center justify-center size-40 max-mobile:size-20 mx-auto"
        accept="image/*"
      >
        <img
          src={previewUrl}
          alt="logo"
          className="object-cover relative w-40 h-40 rounded-full cursor-pointer group max-mobile:size-20"
        />
        <div className="flex absolute inset-0 justify-center items-center w-40 h-40 font-semibold text-center text-white rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-component-bg/50">
          {tr.uploadLogo}
        </div>
      </FileUploader>

      <div className="flex flex-col gap-2.5 w-full">
        <input
          className="py-2 px-3 w-full text-sm rounded-lg border outline-none border-divider bg-bg text-text-primary placeholder:text-c-secondary focus:border-primary"
          type="text"
          placeholder={tr.teamDisplayName}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          data-testid="team-nickname-input"
        />
        <div className="flex flex-col gap-0.25">
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-c-secondary">@</span>
            <input
              className="py-2 pr-3 pl-8 w-full text-sm rounded-lg border outline-none border-divider bg-bg text-text-primary placeholder:text-c-secondary focus:border-primary"
              type="text"
              placeholder={`${tr.teamId} (ex. ratel)`}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              data-testid="team-username-input"
              aria-invalid={dataBool(!valid)}
            />
          </div>
          {validationError !== null && <p className="text-xs text-red-500">{validationError}</p>}
        </div>
        <textarea
          className="py-2 px-3 w-full text-sm rounded-lg border outline-none resize-none border-divider bg-bg text-text-primary placeholder:text-c-secondary focus:border-primary"
          rows={3}
          placeholder={tr.teamDescription}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          data-testid="team-description-input"
        />
      </div>

      {errorMessage !== null && <p className="text-xs text-center text-red-500">{errorMessage}</p>}

      <div className="grid grid-cols-2 gap-2.5 w-full">
        <Button buttonStyle={ButtonStyle.Secondary} className="w-full" onClick={() => onCancel?.()}>
          {tr.cancel}
        </Button>
        <Button
          buttonStyle={ButtonStyle.Primary}
          className="w-full"
          disabled={!canSubmit}
          data-testid="team-create-submit"
          onClick={() => {
            if (!canSubmit) return;
            onSubmit({
              profile_url: profileUrl === "" ? DEFAULT_PROFILE : profileUrl,
              username,
              nickname,
              description,
            });
          }}
        >
          {tr.create}
        </Button>
      </div>
    </div>
  );
}
