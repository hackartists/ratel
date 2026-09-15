import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { factFoldRoundPath } from "@/components/arcade/paths";
import { SeoMeta } from "@/components/ui/seo-meta";
import { MatchingShell } from "./components/matching-shell";
import { useMatchingLobby } from "./hooks/use-fact-fold-matching";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/matching/component.rs
// (`FactFoldMatchingPage`, `/arcade/games/fact-or-fold/matching/:round_id`) —
// the pre-round waiting room. The lobby refreshes every 2s; the player moves
// to the game room once their round leaves `Waiting`, or once the lobby no
// longer points at it (capacity filled and the lobby pointer moved on).
export function Component() {
  const { roundId = "" } = useParams();
  const lobby = useMatchingLobby();
  const navigate = useNavigate();

  const round = lobby.current_round;
  const stay = round !== null && round.id === roundId && round.status === "Waiting";

  useEffect(() => {
    if (!stay) navigate(factFoldRoundPath(roundId));
  }, [stay, roundId, navigate]);

  return (
    <>
      <SeoMeta title="Matching · Fact or Fold" />
      <section className="ff-matching">
        <MatchingShell lobby={lobby} />
      </section>
    </>
  );
}
