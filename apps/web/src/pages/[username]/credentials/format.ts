// app/ratel/src/features/social/pages/credentials/views/mod.rs — date and
// attribute-label formatting helpers used by the credentials page.
import type { DidAttributeItem } from "@ratel/ts-bridges";
import type { CredentialsI18n } from "@/i18n/generated/features/social/pages/credentials/views/credentials.i18n";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export { YEAR_MS };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** chrono `%b %d, %Y` (`format_date`). */
export function formatDate(tsMillis: number): string {
  const d = new Date(tsMillis);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${day}, ${d.getUTCFullYear()}`;
}

/** chrono `%Y-%m-%d %H:%M UTC` (`format_datetime_utc`). */
export function formatDateTimeUtc(tsMillis: number): string {
  const d = new Date(tsMillis);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** `attr_label_for`. */
export function attrLabelFor(key: string, tr: CredentialsI18n): string {
  switch (key) {
    case "age":
      return tr.attrAge;
    case "gender":
      return tr.attrGender;
    case "university":
      return tr.attrUniversity;
    case "employer":
      return tr.attrEmployer;
    case "membership":
      return tr.attrMembership;
    default:
      return key;
  }
}

/** `gender_label`. */
export function genderLabel(raw: string, tr: CredentialsI18n): string {
  switch (raw.toLowerCase()) {
    case "male":
      return tr.attrMale;
    case "female":
      return tr.attrFemale;
    default:
      return raw;
  }
}

/** `build_vc_document`: the VC JSON downloaded by the "Export VC" button. */
export function buildVcDocument(summary: { did: string; attributes: DidAttributeItem[] }): unknown {
  const subject: Record<string, unknown> = { id: summary.did };
  for (const attr of summary.attributes) {
    if (attr.verified && attr.value != null) {
      subject[attr.key] = attr.value;
    }
  }
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "RatelPersonalIdentity"],
    issuer: "did:web:ratel.foundation:issuer",
    credentialSubject: subject,
  };
}
