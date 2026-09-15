import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { getCharacterHandler, levelUpHandler } from "@ratel/ts-bridges";
import type { CharacterResponse, SkillId } from "@ratel/ts-bridges";
import { useAuth } from "@/lib/auth";

// app/ratel/src/features/character/hooks/use_character.rs — the Character
// page controller: the character loader plus the level-up action, which
// refetches the character on success.

export type { CharacterResponse, CharacterSkillResponse, SkillId } from "@ratel/ts-bridges";

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

export interface UseCharacter {
  character: CharacterResponse;
  levelUp: (skillId: SkillId) => void;
}

/** Suspends until the character resolves; a load failure reaches the error boundary. */
export function useCharacter(): UseCharacter {
  // Rust reads `use_user_context()().is_logged_in()` (use_character.rs:30-31)
  // and only then calls `get_character_handler`.
  const { loggedIn } = useAuth();
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
