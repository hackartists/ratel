import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { apiGet, apiPost, pathValue } from "@ratel/ts-bridges/runtime";

// app/ratel/src/features/character/hooks/use_character.rs — the Character
// page controller: the character loader plus the level-up action, which
// refetches the character on success.
//
// The two requests below stand in for the generated `@ratel/ts-bridges`
// handlers (not generated yet at this point of the migration); same routes,
// same response shape (features/character/dto/character_response.rs).

/** `SkillId` — serde `snake_case`. */
export type SkillId = "money_tree" | "ranker" | "influencer" | "sweeper";

export interface CharacterSkillResponse {
  skill_id: SkillId;
  level: number;
  max_level: number;
  /** `null` at max level. */
  next_level_cost: number | null;
  multiplier_permille: number;
  is_released: boolean;
}

export interface CharacterResponse {
  total_xp: number;
  level: number;
  xp_to_next_level: number;
  xp_progress_in_level: number;
  xp_span_of_level: number;
  unspent_sp: number;
  total_sp_granted: number;
  total_sp_spent: number;
  skills: CharacterSkillResponse[];
}

/** `CharacterResponse::default()` — what a signed-out visitor sees. */
export const DEFAULT_CHARACTER: CharacterResponse = {
  total_xp: 0,
  level: 0,
  xp_to_next_level: 0,
  xp_progress_in_level: 0,
  xp_span_of_level: 0,
  unspent_sp: 0,
  total_sp_granted: 0,
  total_sp_spent: 0,
  skills: [],
};

/** `#[get("/api/me/character", user: User)] get_character_handler` */
function getCharacterHandler(): Promise<CharacterResponse> {
  return apiGet<CharacterResponse>("/api/me/character");
}

/** `#[post("/api/me/skills/{skill_id}/level-up", user: User)] level_up_handler` */
function levelUpHandler(skillId: string): Promise<CharacterResponse> {
  return apiPost<CharacterResponse>(`/api/me/skills/${pathValue(skillId)}/level-up`);
}

// BLOCKED — the React app has no auth context yet. Rust reads
// `use_user_context()().is_logged_in()` (use_character.rs:30-31) and only then
// calls `get_character_handler`; until the auth context is ported this stays
// `false`, i.e. the signed-out branch (`CharacterResponse::default()`).
const IS_LOGGED_IN_PLACEHOLDER = false;

export interface UseCharacter {
  character: CharacterResponse;
  levelUp: (skillId: SkillId) => void;
}

/** Suspends until the character resolves; a load failure reaches the error boundary. */
export function useCharacter(): UseCharacter {
  const loggedIn = IS_LOGGED_IN_PLACEHOLDER;
  const character = useSuspenseQuery({
    queryKey: ["character", loggedIn],
    queryFn: () => (loggedIn ? getCharacterHandler() : Promise.resolve(DEFAULT_CHARACTER)),
  });

  const levelUp = useMutation({
    mutationFn: (skillId: SkillId) => levelUpHandler(skillId),
    onSuccess: () => {
      void character.refetch();
    },
  });

  return {
    character: character.data,
    levelUp: (skillId) => levelUp.mutate(skillId),
  };
}
