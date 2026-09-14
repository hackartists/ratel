import {
  deleteEssenceHandler as deleteEssence,
  getEssenceStatsHandler as getEssenceStats,
  listEssencesHandler as listEssences,
} from "@ratel/ts-bridges";
import type { EssenceResponse, EssenceStatsResponse, ListResponse } from "@ratel/ts-bridges";

// Calls for app/ratel/src/features/essence/{types,controllers}, over the
// generated `@ratel/ts-bridges` handlers. Only the page's controller hook
// (`use-essence-sources.tsx`) imports this file, like only
// `use_essence_sources.rs` imports the Rust handlers.

export type { EssenceResponse, EssenceSourceKind, EssenceStatsResponse } from "@ratel/ts-bridges";

/** `ListResponse<EssenceResponse>`. */
export type EssenceListResponse = ListResponse<EssenceResponse>;

/** `#[get("/api/essences/stats", user: User)] get_essence_stats_handler` */
export async function getEssenceStatsHandler(): Promise<EssenceStatsResponse> {
  const res: Partial<EssenceStatsResponse> = await getEssenceStats();
  // `#[serde(default)]` on the per-kind counters: older rows omit them.
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
  return listEssences(sort, bookmark, kind, limit);
}

/** `#[delete("/api/essences/:essence_id", user: User)] delete_essence_handler` */
export async function deleteEssenceHandler(essenceId: string): Promise<void> {
  await deleteEssence(essenceId);
}
