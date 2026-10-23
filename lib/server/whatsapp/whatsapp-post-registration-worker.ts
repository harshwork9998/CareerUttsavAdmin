import { processPostRegistrationGrowthTriggers } from "@/lib/server/whatsapp/whatsapp-post-registration-processor";

/** Frequent enough for the Instagram message to land near completedAt + 10s. */
export const WHATSAPP_POST_REGISTRATION_POLL_MS = 5 * 1000;

let poller: ReturnType<typeof setInterval> | null = null;

export function startPostRegistrationGrowthWorker(): void {
  if (poller) return;
  poller = setInterval(() => {
    void processPostRegistrationGrowthTriggers().catch((error: unknown) => {
      console.error(
        "[whatsapp-growth] poll failed",
        error instanceof Error ? error.message : "unknown"
      );
    });
  }, WHATSAPP_POST_REGISTRATION_POLL_MS);
  poller.unref?.();
}

export function stopPostRegistrationGrowthWorkerForTests(): void {
  if (!poller) return;
  clearInterval(poller);
  poller = null;
}
