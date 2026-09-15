import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { factFoldMatchingPath, factFoldRoundPath } from "@/components/arcade/paths";
import { SeoMeta } from "@/components/ui/seo-meta";
import { LobbyView } from "./components/lobby-view";
import { useLobby, useMyStats } from "./hooks/use-arcade-home";

// app/ratel/src/features/arcade/pages/home/component.rs (`ArcadeHomePage`,
// `/arcade/home`) — the lobby. A player already inside a live round is sent
// straight to the matching page (Waiting) or the game room.
export function Component() {
  const lobby = useLobby();
  const myStats = useMyStats();
  const navigate = useNavigate();

  const round = lobby.current_round;
  const joined = round !== null && lobby.already_joined;
  const redirect =
    joined && round.status !== "Settled"
      ? round.status === "Waiting"
        ? factFoldMatchingPath(round.id)
        : factFoldRoundPath(round.id)
      : null;

  useEffect(() => {
    if (redirect) navigate(redirect);
  }, [redirect, navigate]);

  if (joined && round.status === "Settled") {
    return (
      <section className="ff-home">
        {/* Untranslated in Rust too (component.rs ArcadeHomePage). */}
        <div className="ff-home__placeholder">Round just settled — refresh to see results.</div>
      </section>
    );
  }

  return (
    <>
      <SeoMeta title="Ratel Arcade" />
      <section className="ff-home">
        <LobbyView lobby={lobby} myStats={myStats} />
      </section>
    </>
  );
}
