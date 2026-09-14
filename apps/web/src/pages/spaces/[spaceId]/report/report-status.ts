import type { ReportStatus } from "@ratel/ts-bridges";

// Generated-type bug (report, don't `make gen-ts` yourself — see
// docs/superpower/2026-09-14-react-frontend-migration.md §4.2 on
// `SerializeDisplay`/`DynamoEnum` enums needing special ts-rs handling):
//
// `packages/ts-bridges/src/types/ReportStatus.ts` declares
// `export type ReportStatus = "Draft" | "Published"` — ts-rs read the bare
// Rust enum variant identifiers. But
// `app/ratel/src/features/spaces/pages/report/types/report_item.rs:17`'s
// `ReportStatus` derives `SerializeDisplay` + `DynamoEnum`
// (`packages/by-macros/src/dynamo_enum.rs:196` generates the `Display` impl,
// and its unit-variant branch at line ~163-166 writes
// `variant_name.to_case(UpperSnake)`), so the ACTUAL wire value coming back
// from every `GetReportResponse.status` / `ReportListItem.status` field is
// `"DRAFT"` / `"PUBLISHED"` — confirmed live against `GET /v3/spaces/{id}/reports`
// (`{"items":[{"status":"DRAFT",...}]}`). The TS union is simply wrong for
// values read off the wire (`DeserializeFromStr`'s `FromStr` impl on the Rust
// side is lenient — it also accepts the UpperCamel spelling — so *sending*
// `status: "Published"` in `UpdateReportRequest` still round-trips fine; only
// *reading* the response needs this normalizer).
export function isReportPublished(status: ReportStatus): boolean {
  return String(status).toUpperCase() === "PUBLISHED";
}
