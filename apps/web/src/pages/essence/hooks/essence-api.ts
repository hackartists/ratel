import { apiDelete, apiGet, pathValue } from "@ratel/ts-bridges/runtime";

// Wire types and calls for app/ratel/src/features/essence/{types,controllers}.
//
// Stand-ins for the generated `@ratel/ts-bridges` handlers (`make gen-ts`),
// which don't exist at this point of the migration. Same routes, same
// argument names, same response shapes; only the page's controller hook
// (`use-essence-sources.tsx`) imports this file, like only
// `use_essence_sources.rs` imports the Rust handlers. Replace with the
// generated handlers once they land.

/** `EssenceSourceKind` — serde default (externally tagged unit variants). */
export type EssenceSourceKind =
  | "Post"
  | "Poll"
  | "Quiz"
  | "PostComment"
  | "DiscussionComment"
  | "Notion"
  | "FactFoldRationale";

/** `EssenceResponse` (types/response.rs). */
export interface EssenceResponse {
  id: string;
  source_kind: EssenceSourceKind;
  title: string;
  source_path: string;
  source_pk: string;
  source_sk: string;
  space_pk?: string | null;
  word_count: number;
  updated_at: number;
}

/** `EssenceStatsResponse` (types/response.rs). */
export interface EssenceStatsResponse {
  total_sources: number;
  total_words: number;
  total_notion: number;
  total_post: number;
  total_comment: number;
  total_poll: number;
  total_quiz: number;
}

/** `ListResponse<EssenceResponse>`. */
export interface EssenceListResponse {
  items: EssenceResponse[];
  bookmark: string | null;
}

/** `#[get("/api/essences/stats", user: User)] get_essence_stats_handler` */
export async function getEssenceStatsHandler(): Promise<EssenceStatsResponse> {
  const res = await apiGet<Partial<EssenceStatsResponse>>("/api/essences/stats");
  // `#[serde(default)]` on the per-kind counters.
  return {
    total_sources: res.total_sources ?? 0,
    total_words: res.total_words ?? 0,
    total_notion: res.total_notion ?? 0,
    total_post: res.total_post ?? 0,
    total_comment: res.total_comment ?? 0,
    total_poll: res.total_poll ?? 0,
    total_quiz: res.total_quiz ?? 0,
  };
}

/** `#[get("/api/essences?sort&bookmark&kind&limit", user: User)] list_essences_handler` */
export function listEssencesHandler(
  sort: string | null,
  bookmark: string | null,
  kind: string | null,
  limit: number | null,
): Promise<EssenceListResponse> {
  return apiGet<EssenceListResponse>("/api/essences", { sort, bookmark, kind, limit });
}

/** `#[delete("/api/essences/:essence_id", user: User)] delete_essence_handler` */
export function deleteEssenceHandler(essenceId: string): Promise<void> {
  return apiDelete<void>(`/api/essences/${pathValue(essenceId)}`);
}
