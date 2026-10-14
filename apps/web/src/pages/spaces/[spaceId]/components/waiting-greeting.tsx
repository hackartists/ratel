import { useSpace } from "@/components/space/space-context";

/** Whether the space has a non-empty waiting greeting. */
export function hasGreeting(greeting: string): boolean {
  return greeting.trim() !== "";
}

/**
 * The admin-written greeting shown at the top of the Candidate waiting cards
 * (`WaitingCard` shows it in place of its icon and heading, `SamplingEntryCard`
 * above its heading). Renders nothing while the greeting is empty.
 * The HTML comes from the greeting settings editor and is stored with inline
 * colors stripped server-side, the same way the space overview content is
 * rendered.
 */
export function WaitingGreeting() {
  const greeting = useSpace().greeting;
  if (!hasGreeting(greeting)) return null;
  return <div className="waiting-greeting" data-testid="waiting-greeting" dangerouslySetInnerHTML={{ __html: greeting }} />;
}
