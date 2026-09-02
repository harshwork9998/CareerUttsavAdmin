import { normalizeWaId } from "@/lib/server/whatsapp/registration-conversation";

/**
 * Per-waId inbound serialization for a single Node process only.
 *
 * Before running CareerUttsavAdmin with PM2 cluster mode, multiple Node
 * instances, multiple VMs, or horizontally scaled/serverless instances that
 * process WhatsApp concurrently, replace this with a DB-backed distributed
 * serialization mechanism (lease row, advisory lock, or durable queue).
 */
const serializedTailByWaId = new Map<string, Promise<void>>();

export async function runSerializedForWaId<T>(
  waId: string,
  fn: () => Promise<T>
): Promise<T> {
  const normalizedWaId = normalizeWaId(waId);
  const previousTail =
    serializedTailByWaId.get(normalizedWaId) ?? Promise.resolve();

  const runPromise = previousTail.catch(() => {}).then(() => fn());
  const nextTail = runPromise.then(
    () => undefined,
    () => undefined
  );

  serializedTailByWaId.set(normalizedWaId, nextTail);

  try {
    return await runPromise;
  } finally {
    if (serializedTailByWaId.get(normalizedWaId) === nextTail) {
      serializedTailByWaId.delete(normalizedWaId);
    }
  }
}

export function getWaIdSerializerActiveCountForTests(): number {
  return serializedTailByWaId.size;
}

export function resetWaIdSerializerForTests(): void {
  serializedTailByWaId.clear();
}
