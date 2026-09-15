import { useState } from "react";
import { useAdminLiteralsI18n } from "../admin-literals.i18n";
import { displayError } from "../hooks/format";
import { useTestAccounts } from "../hooks/use-admin-main";

// `TestAccountsSection` (admin/views/main/mod.rs): reviewer test accounts that
// log in with the fixed code without a verification email.
export function TestAccountsSection() {
  const lit = useAdminLiteralsI18n();
  const { accounts, add, remove } = useTestAccounts();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<[string, boolean] | null>(null);

  const onAdd = async () => {
    const normalized = email.trim().toLowerCase();
    if (normalized === "" || !normalized.includes("@")) {
      setMessage([lit.text("test_invalid_email"), false]);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await add({ email: normalized, note });
      setSaving(false);
      setEmail("");
      setNote("");
      setMessage([lit.text("test_added"), true]);
    } catch (err) {
      setSaving(false);
      setMessage([lit.fill("test_add_failed", { err: displayError(err) }), false]);
    }
  };

  return (
    <section className="admin-arena__section">
      <div className="admin-arena__section-head">
        <span className="admin-arena__section-title">{lit.text("test_title")}</span>
        <span className="admin-arena__section-meta">{lit.fill("test_count", { count: accounts.length })}</span>
      </div>
      <div className="admin-arena__form admin-arena__form--stretch">
        <div className="admin-arena__form-row">
          <input
            className="admin-arena__form-input"
            type="email"
            placeholder={lit.text("test_email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="admin-arena__form-input"
            type="text"
            placeholder={lit.text("test_note_placeholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="admin-arena__btn" type="button" disabled={saving} onClick={() => void onAdd()}>
            {saving ? lit.text("test_adding") : lit.text("test_add")}
          </button>
        </div>
        <span className="admin-arena__form-hint">{lit.text("test_hint")}</span>
        {message !== null && (
          <span
            className={message[1] ? "admin-arena__status admin-arena__status--ok" : "admin-arena__status admin-arena__status--err"}
          >
            {message[0]}
          </span>
        )}
      </div>
      <div className="admin-arena__table-wrap">
        <table className="admin-arena__table">
          <thead>
            <tr>
              <th>{lit.text("test_col_email")}</th>
              <th>{lit.text("test_col_note")}</th>
              <th className="text-right">{lit.text("test_col_manage")}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td className="admin-arena__table-empty" colSpan={3}>
                  {lit.text("test_empty")}
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.email}>
                  <td>{account.email}</td>
                  <td>{account.note}</td>
                  <td className="text-right">
                    <button
                      className="admin-arena__table-link"
                      style={{ color: "#ef4444" }}
                      type="button"
                      onClick={() => void remove(account.email)}
                    >
                      {lit.text("test_delete")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
