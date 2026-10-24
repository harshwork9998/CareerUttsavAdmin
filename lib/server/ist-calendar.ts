export const IST_TIME_ZONE = "Asia/Kolkata";

/** Calendar date yyyy-MM-dd in Asia/Kolkata for the given instant. */
export function istCalendarDateFromDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
