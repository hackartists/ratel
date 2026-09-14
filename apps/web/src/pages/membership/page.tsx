import { MembershipPlan } from "./components/membership-plan";

// `MembershipHome` (`/membership`) → app/ratel/src/features/membership/views/home/mod.rs.
// The Rust page also injects the PortOne SDK `<script>`; the React app loads
// that SDK once, globally, from index.html (migration plan §12).
export function Component() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-space-bg text-font-primary">
      <div className="flex flex-col p-5 grow">
        <MembershipPlan />
      </div>
    </div>
  );
}
