import type { SeminarOption } from "@/lib/server/whatsapp/registration-conversation";
import {
  buildWhatsAppSeminarDayCatalog,
  type WhatsAppSeminarDayCatalog,
} from "@/lib/server/whatsapp/whatsapp-seminar-day-catalog";

export const TEST_EVENT_START_DATE = "2026-08-15";
export const TEST_EVENT_END_DATE = "2026-08-16";

export function buildTestSeminarOptions(): SeminarOption[] {
  const day1: SeminarOption[] = Array.from({ length: 3 }, (_, index) => ({
    id: `sem-d1-${index + 1}`,
    title: `Day 1 Seminar ${index + 1}`,
    date: TEST_EVENT_START_DATE,
    startTime: `${String(10 + index).padStart(2, "0")}:00`,
  }));
  const day2: SeminarOption[] = Array.from({ length: 2 }, (_, index) => ({
    id: `sem-d2-${index + 1}`,
    title: `Day 2 Seminar ${index + 1}`,
    date: TEST_EVENT_END_DATE,
    startTime: `${String(10 + index).padStart(2, "0")}:00`,
  }));
  return [...day1, ...day2];
}

export function buildTestSeminarDayCatalog(
  options: SeminarOption[] = buildTestSeminarOptions()
): WhatsAppSeminarDayCatalog {
  return buildWhatsAppSeminarDayCatalog(
    options,
    TEST_EVENT_START_DATE,
    TEST_EVENT_END_DATE
  );
}

export function seminarTurnContext(options: SeminarOption[] = buildTestSeminarOptions()) {
  return {
    seminarOptions: options,
    seminarDayCatalog: buildTestSeminarDayCatalog(options),
  };
}
