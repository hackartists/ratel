import type * as React from "react";
import { SpaceStatus, useSpaceContext } from "@/components/space/space-context";
import { useSpaceViewerI18n } from "@/i18n/generated/features/spaces/pages/index/space-viewer.i18n";
import { useUserContext } from "@/lib/auth";
import { dataBool } from "@/lib/dom";
import { DEFAULT_LOGO, DEFAULT_PROFILE, formatNumber } from "./format";
import { ParticipateCard } from "./participate-card";
import { SigninCard } from "./signin-card";
import { VerificationCard } from "./verification-card";

// app/ratel/src/features/spaces/pages/index/arena_viewer/component.rs (`ArenaViewer`).

export function ArenaViewer({ dimmed, candidateView }: { dimmed: boolean; candidateView?: React.ReactNode }) {
  const tr = useSpaceViewerI18n();
  const ctx = useSpaceContext();
  const space = ctx.space;
  const isLoggedIn = useUserContext().user !== null;

  const logo = space.logo === "" ? DEFAULT_LOGO : space.logo;
  const authorProfile = space.author_profile_url === "" ? DEFAULT_PROFILE : space.author_profile_url;
  const statusText =
    space.status === SpaceStatus.Ongoing
      ? tr.statusOngoing
      : space.status === SpaceStatus.Finished
        ? tr.statusFinished
        : tr.statusOpen;
  const participants = formatNumber(space.participants);
  const remaining = space.quota === 0 ? "-" : formatNumber(space.remains);
  const rewards = space.rewards !== null ? formatNumber(space.rewards) : "0";

  const showParticipate = !space.participated && space.can_participate;
  const panelRequirements = ctx.panelRequirements;
  const hasUnsatisfied = panelRequirements.some((r) => !r.satisfied);
  const hasRequirements = panelRequirements.length > 0;
  const needsVerification = hasRequirements && hasUnsatisfied;

  let card: React.ReactNode = null;
  if (candidateView !== undefined) {
    card = candidateView;
  } else if (isLoggedIn && showParticipate && needsVerification) {
    card = (
      <VerificationCard
        requirements={panelRequirements}
        onVerified={() => {
          void ctx.restartSpace();
          void ctx.restartRole();
          void ctx.restartPanelRequirements();
        }}
      />
    );
  } else if (isLoggedIn && showParticipate) {
    card = (
      <ParticipateCard
        participants={participants}
        remaining={remaining}
        rewards={rewards}
        requireConsent={hasRequirements}
        onJoined={() => {}}
      />
    );
  } else if (!isLoggedIn) {
    card = <SigninCard participants={participants} remaining={remaining} rewards={rewards} />;
  }

  return (
    <div className="arena-viewer">
      <div className="arena-ring" />
      <div className="arena-ring arena-ring--mid" />
      <div className="arena-ring arena-ring--inner" />

      <div className="particle" />
      <div className="particle particle--2" />
      <div className="particle particle--3" />
      <div className="particle particle--4" />
      <div className="particle particle--5" />
      <div className="particle particle--6" />
      <div className="particle particle--7" />
      <div className="particle particle--8" />

      <div className="portal" data-testid="portal" data-dimmed={dataBool(dimmed)}>
        <div className="portal-header">
          <img alt="Space logo" className="portal-logo" src={logo} />
          <h1 className="portal-title">{space.title}</h1>
        </div>
        <div className="portal-status">{statusText}</div>
        {card}
      </div>

      <div className="portal-author" data-dimmed={dataBool(dimmed)}>
        <img alt="Author" className="portal-author__avatar" src={authorProfile} />
        <div>
          <div className="portal-author__name">{space.author_display_name}</div>
          <div className="portal-author__label">{tr.spaceCreator}</div>
        </div>
      </div>
    </div>
  );
}
