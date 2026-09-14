import { LegalCloseButton } from "./legal-close-button";

// The document body shared by app/ratel/src/views/{privacy,terms,child_safety}/mod.rs.
// The three Rust components render the same tree from per-language data
// tables (`*_page_data(is_korean)`); only the data differs. Terms sections
// have no bullet list, which is the same DOM as an empty `items`.

export const CONTACT_EMAIL = "hi@biyard.co";

export const COMPANY = {
  en: { companyName: "Biyard Corp.", address: "1st Floor, 4, Eonnam 17-gil, Seocho-gu, Seoul" },
  ko: { companyName: "(주)바이야드", address: "서울특별시 서초구 언남17길 4, 1층" },
} as const;

export interface LegalSection {
  title: string;
  content: string;
  items?: readonly string[];
}

export interface LegalPageData {
  title: string;
  lastUpdated: string;
  effectiveDate: string;
  sections: readonly LegalSection[];
  contact: {
    title: string;
    content: string;
    emailLabel: string;
    addressLabel: string;
  };
  companyName: string;
  address: string;
}

export function LegalDocument({ data }: { data: LegalPageData }) {
  // Rust: `format!("© {} {}. All rights reserved.", Utc::now().year(), company_name)`.
  const copyright = `© ${new Date().getUTCFullYear()} ${data.companyName}. All rights reserved.`;

  return (
    <div className="overflow-y-auto w-full h-screen bg-bg text-text-primary">
      <LegalCloseButton />
      <div className="py-12 px-4 mx-auto w-full max-w-desktop">
        <div className="flex flex-col gap-8">
          <div className="text-center">
            <h1 className="mb-4 text-3xl font-bold md:text-4xl text-text-primary">{data.title}</h1>
            <p className="text-sm md:text-base text-muted-foreground">{`${data.lastUpdated}: ${data.effectiveDate}`}</p>
          </div>

          <div className="flex flex-col gap-6 mt-8">
            {data.sections.map((section) => (
              <section key={section.title}>
                <h2 className="mb-3 text-xl font-semibold md:text-2xl text-text-primary">{section.title}</h2>
                <p className="leading-7 whitespace-pre-wrap text-text-primary">{section.content}</p>
                {section.items && section.items.length > 0 && (
                  <ul className="pl-5 mt-3 space-y-2 list-disc text-text-primary">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <section>
              <h2 className="mb-3 text-xl font-semibold md:text-2xl text-text-primary">{data.contact.title}</h2>
              <p className="mb-4 leading-7 whitespace-pre-wrap text-text-primary">{data.contact.content}</p>
              <div className="flex flex-col gap-2 pl-4">
                <p className="text-text-primary">
                  <span className="font-semibold">{data.companyName}</span>
                </p>
                <p className="text-text-primary">
                  <span className="font-semibold">{`${data.contact.emailLabel}:`}</span>
                  <a className="hover:underline text-primary" href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                  </a>
                </p>
                <p className="text-text-primary">
                  <span className="font-semibold">{`${data.contact.addressLabel}:`}</span>
                  {data.address}
                </p>
              </div>
            </section>
          </div>

          <div className="pt-8 mt-12 border-t border-divider">
            <p className="text-sm text-center text-muted-foreground">{copyright}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
