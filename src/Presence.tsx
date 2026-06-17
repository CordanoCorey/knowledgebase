import { useEffect, useState, type ReactNode } from "react";

export type PresenceState = "enter" | "exit";

const DEFAULT_EXIT_DURATION_MS = 180;

export function Presence({
  children,
  durationMs = DEFAULT_EXIT_DURATION_MS,
  present,
}: {
  children: (presenceState: PresenceState) => ReactNode;
  durationMs?: number;
  present: boolean;
}) {
  const [shouldRender, setShouldRender] = useState(present);
  const [presenceState, setPresenceState] = useState<PresenceState>(
    present ? "enter" : "exit",
  );

  useEffect(() => {
    if (present) {
      setShouldRender(true);
      setPresenceState("enter");
      return;
    }

    if (!shouldRender) {
      return;
    }

    setPresenceState("exit");
    const timeoutId = window.setTimeout(() => setShouldRender(false), durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [durationMs, present, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  return <>{children(presenceState)}</>;
}
