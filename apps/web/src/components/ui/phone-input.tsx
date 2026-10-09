import * as React from "react";
import { useTranslation } from "react-i18next";
import RawPhoneInput, { type Value as E164Value } from "react-phone-number-input";
import en from "react-phone-number-input/locale/en.json";
import ko from "react-phone-number-input/locale/ko.json";

// Country-combobox + as-you-type national-number formatting for phone
// login (apps/web/src/components/auth/login-modal.tsx) and the poll
// PrivacyConsent flow (apps/web/src/components/space-actions/question-viewer.tsx).
// Wraps `react-phone-number-input`'s default export, which is backed by
// `libphonenumber-js`'s `AsYouType` formatter: the national-number field
// renders grouped per the selected country's own convention (Korean mobile
// comes out "010-1234-5678", i.e. 3-4-4 with hyphens) while `value`/`onChange`
// always carry the combined E.164 string with no separators — exactly what
// `sendPhoneCode`/`loginWithPhone`
// (app/ratel/src/features/auth/controllers/send_code.rs) need. No hand-rolled
// mask: the display formatting and the E.164 combination both come from the
// library, not from this wrapper.

const LOCALES: Record<string, Record<string, string>> = { en, ko };

export type PhoneInputValue = E164Value;

export interface PhoneInputProps {
  id?: string;
  name?: string;
  autoComplete?: string;
  disabled?: boolean;
  placeholder?: string;
  value: PhoneInputValue | undefined;
  onChange: (value: PhoneInputValue | undefined) => void;
  onConfirm?: () => void;
  /** Applied to the national-number `<input>`; the country `<select>` gets `${testId}-country`. */
  "data-testid"?: string;
}

/** Default country when nothing else is known yet, same as the Rust server's SMS region (ap-northeast-1 / KR). */
const DEFAULT_COUNTRY = "KR";

export function PhoneInput({
  id,
  name,
  autoComplete = "tel",
  disabled,
  placeholder,
  value,
  onChange,
  onConfirm,
  "data-testid": testId,
}: PhoneInputProps) {
  const { i18n } = useTranslation();
  const labels = LOCALES[i18n.language] ?? LOCALES.en;

  return (
    <RawPhoneInput
      id={id}
      name={name}
      autoComplete={autoComplete}
      className="phone-input"
      countrySelectProps={testId ? { disabled, "data-testid": `${testId}-country` } : { disabled }}
      defaultCountry={DEFAULT_COUNTRY}
      disabled={disabled}
      labels={labels}
      numberInputProps={testId ? { "data-testid": testId } : undefined}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") {
          e.preventDefault();
          onConfirm?.();
        }
      }}
    />
  );
}
