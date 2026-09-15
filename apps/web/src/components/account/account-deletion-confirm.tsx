import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useDeleteAccount } from "@ratel/ts-bridges/hooks";
import { signOut } from "@/components/auth/sign-out";
import { useProfileDropdownI18n } from "@/components/profile-dropdown/i18n";
import { useAuth } from "@/lib/auth";
import { usePopup } from "@/lib/popup";

// app/ratel/src/components/profile_dropdown/mod.rs:203 (`AccountDeletionConfirm`), shared by
// the profile dropdown and the arena settings panel.
export function AccountDeletionConfirm() {
  const tr = useProfileDropdownI18n();
  const auth = useAuth();
  const popup = usePopup();
  const navigate = useNavigate();
  const deleteAccount = useDeleteAccount();
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5 max-w-full w-100">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-bold text-text-primary">{tr.deleteAccountTitle}</h3>
        <p className="text-sm leading-6 whitespace-pre-wrap text-c-secondary">{tr.deleteAccountWarning}</p>
      </div>

      {errorMessage !== null && <p className="text-sm text-red-500">{errorMessage}</p>}

      <div className="flex flex-col gap-2.5 w-full">
        <button
          className="py-2.5 px-4 w-full text-sm font-bold text-white rounded-lg cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
          style={{ backgroundColor: "#ef4444" }}
          disabled={loading}
          onClick={async () => {
            setErrorMessage(null);
            setLoading(true);
            try {
              await deleteAccount.mutateAsync();
            } catch (e) {
              console.error("delete account failed:", e);
              setLoading(false);
              setErrorMessage(tr.deleteFailed);
              return;
            }
            await signOut(auth.reset);
            navigate("/");
          }}
        >
          {tr.confirmDelete}
        </button>
        <button
          className="py-2.5 px-4 w-full text-sm font-medium rounded-lg border cursor-pointer disabled:opacity-50 disabled:pointer-events-none border-border text-c-secondary hover:bg-hover"
          disabled={loading}
          onClick={() => popup.close()}
        >
          {tr.cancel}
        </button>
      </div>
    </div>
  );
}
