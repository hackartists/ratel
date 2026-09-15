// app/ratel/src/common/config/environment.rs — `Environment::default()` parses
// the build-time `ENV` (`option_env!("ENV")`, default "local"; unknown values
// read as Local). Vite bakes build-time values in with `VITE_`-prefixed
// variables, so the React build reads `VITE_ENV`.

export const Environment = {
  Local: "local",
  Dev: "dev",
  Staging: "staging",
  Production: "production",
} as const;
export type Environment = (typeof Environment)[keyof typeof Environment];

/** Rust `Environment::from_str` (case-insensitive, unknown → Local). */
export function parseEnvironment(value: string): Environment {
  switch (value.toLowerCase()) {
    case "dev":
    case "development":
      return Environment.Dev;
    case "staging":
      return Environment.Staging;
    case "prod":
    case "production":
      return Environment.Production;
    default:
      return Environment.Local;
  }
}

/** Rust `Environment::default()`. */
export function currentEnvironment(): Environment {
  const raw: unknown = import.meta.env.VITE_ENV;
  return parseEnvironment(typeof raw === "string" ? raw : "local");
}
