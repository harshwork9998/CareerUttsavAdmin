let tail: Promise<unknown> = Promise.resolve();

/**
 * Serializes partner allocation writes inside this process.
 * PostgreSQL row locks cover concurrent processes; this queue covers the
 * JSON store, where two requests can otherwise read the same occupancy and
 * both commit.
 */
export function withSeminarAllocationLock<T>(work: () => Promise<T>): Promise<T> {
  const run = tail.then(work, work);
  tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
