// URLs of the arcade `Route` variants (app/ratel/src/route.rs), shared by the
// arcade layout and pages.

export const ARCADE_HOME_PATH = "/arcade/home";
export const ARCADE_LEADERBOARD_PATH = "/arcade/leaderboard";
export const FACT_FOLD_ROUND_PATTERN = "/arcade/games/fact-or-fold/rounds/:roundId";
/** `Route::FactFoldAdminNewSubjectPage {}`. */
export const FACT_FOLD_ADMIN_NEW_SUBJECT_PATH = "/admin/fact-or-fold/subjects/new";

/** `Route::FactFoldMatchingPage { round_id }`. */
export function factFoldMatchingPath(roundId: string): string {
  return `/arcade/games/fact-or-fold/matching/${encodeURIComponent(roundId)}`;
}

/** `Route::FactFoldGameRoomPage { round_id }`. */
export function factFoldRoundPath(roundId: string): string {
  return `/arcade/games/fact-or-fold/rounds/${encodeURIComponent(roundId)}`;
}
