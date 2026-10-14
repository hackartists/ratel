import { useSpace } from "@/components/space/space-context";

/**
 * The admin-written greeting shown at the top of the Candidate waiting cards
 * (`WaitingCard`, `SamplingEntryCard`). Renders nothing while the greeting is
 * empty. The HTML comes from the space settings editor and is stored with
 * inline colors stripped server-side, the same way the space overview content
 * is rendered.
 */
export function WaitingGreeting() {
  const greeting = useSpace().greeting;
  if (greeting.trim() === "") return null;
  return <div className="waiting-greeting" data-testid="waiting-greeting" dangerouslySetInnerHTML={{ __html: greeting }} />;
}
