import { Head } from "vite-react-ssg";

// app/ratel/src/common/components/seo_meta — same tags. Rendered into the
// document head through react-helmet-async (prerendered on SSG routes).

export const Robots = {
  IndexFollow: "index, follow",
  NoindexFollow: "noindex, follow",
  IndexNofollow: "index, nofollow",
  NoindexNofollow: "noindex, nofollow",
} as const;
export type Robots = (typeof Robots)[keyof typeof Robots];

export interface SeoMetaProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  ogType?: string;
  keywords?: string[];
  canonical?: string;
  robots?: Robots;
}

export function SeoMeta({
  title,
  description = "",
  image = "",
  url = "",
  ogType = "website",
  keywords = [],
  canonical = "",
  robots = Robots.IndexFollow,
}: SeoMetaProps) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords.length > 0 && <meta name="keywords" content={keywords.join(", ")} />}
      <meta name="robots" content={robots} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      {url !== "" && <meta property="og:url" content={url} />}
      {image !== "" && <meta property="og:image" content={image} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image !== "" && <meta name="twitter:image" content={image} />}
      {canonical !== "" && <link rel="canonical" href={canonical} />}
    </Head>
  );
}
