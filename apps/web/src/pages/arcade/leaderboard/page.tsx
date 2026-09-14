import { SeoMeta } from "@/components/ui/seo-meta";
import { LeaderboardView, MoreSentinel } from "./components/leaderboard-view";
import { useLeaderboard } from "./hooks/use-leaderboard";

// app/ratel/src/features/arcade/pages/home/component.rs
// (`ArcadeLeaderboardPage`, `/arcade/leaderboard`).
export function Component() {
  const { entries, hasMore, isLoading, next } = useLeaderboard();

  return (
    <>
      <SeoMeta title="Ratel Arcade · Leaderboard" />
      <section className="ff-home">
        <LeaderboardView entries={entries} />
        <MoreSentinel hasMore={hasMore} isLoading={isLoading} next={next} />
      </section>
    </>
  );
}
