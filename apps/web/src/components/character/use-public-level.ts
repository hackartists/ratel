import { useSuspenseQuery } from "@tanstack/react-query";
import { getPublicCharacterHandler } from "@ratel/ts-bridges";

/**
 * `LevelChip`'s loader (level_chip/component.rs:22-28):
 * `get_public_character_handler(username).await.map(|r| r.level).unwrap_or(1)`.
 * Suspends until it resolves; never errors.
 */
export function usePublicLevel(username: string): number {
  const query = useSuspenseQuery({
    queryKey: ["getPublicCharacter", "level", username],
    queryFn: () =>
      getPublicCharacterHandler(username)
        .then((r) => r.level)
        .catch(() => 1),
  });
  return query.data;
}
