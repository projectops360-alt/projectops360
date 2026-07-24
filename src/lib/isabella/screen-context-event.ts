import type { GuideContext } from "@/lib/knowledge-os/types";

export const ISABELLA_SCREEN_CONTEXT_EVENT = "isabella:screen-context";

export interface IsabellaScreenContextDetail {
  context: Partial<GuideContext> | null;
}

type IsabellaContextWindow = typeof window & {
  __po360IsabellaScreenContext?: Partial<GuideContext> | null;
};

export function readIsabellaScreenContext(): Partial<GuideContext> | null {
  if (typeof window === "undefined") return null;
  return (
    (window as IsabellaContextWindow).__po360IsabellaScreenContext ?? null
  );
}

export function publishIsabellaScreenContext(
  context: Partial<GuideContext> | null,
): void {
  if (typeof window === "undefined") return;
  (window as IsabellaContextWindow).__po360IsabellaScreenContext = context;
  window.dispatchEvent(
    new CustomEvent<IsabellaScreenContextDetail>(
      ISABELLA_SCREEN_CONTEXT_EVENT,
      { detail: { context } },
    ),
  );
}
