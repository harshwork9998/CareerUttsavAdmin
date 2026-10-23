import { describe, expect, it } from "vitest";

import { CAREER_UTTSAV_SEMINARS } from "@/features/dashboard/seminars";
import type { SeminarOption } from "@/lib/server/whatsapp/registration-conversation";
import {
  buildSeminarFinishSummaryBody,
  buildWhatsAppSeminarDayCatalog,
  formatCombinedSeminarSelectionMessage,
  indexToDay2Letter,
  parseSeminarSelectionInput,
} from "@/lib/server/whatsapp/whatsapp-seminar-day-catalog";
import {
  TEST_EVENT_END_DATE,
  TEST_EVENT_START_DATE,
  buildTestSeminarDayCatalog,
  buildTestSeminarOptions,
} from "@/lib/server/whatsapp/whatsapp-seminar-test-fixtures";

function buildLargeCatalog(): {
  options: SeminarOption[];
  catalog: ReturnType<typeof buildWhatsAppSeminarDayCatalog>;
} {
  const day1 = Array.from({ length: 10 }, (_, index) => ({
    id: `d1-${index + 1}`,
    title: `Day One Topic ${index + 1}`,
    date: TEST_EVENT_START_DATE,
    startTime: `${String(9 + index).padStart(2, "0")}:00`,
  }));
  const day2 = Array.from({ length: 10 }, (_, index) => ({
    id: `d2-${index + 1}`,
    title: `Day Two Topic ${index + 1}`,
    date: TEST_EVENT_END_DATE,
    startTime: `${String(9 + index).padStart(2, "0")}:00`,
  }));
  const options = [...day1, ...day2];
  return {
    options,
    catalog: buildWhatsAppSeminarDayCatalog(
      options,
      TEST_EVENT_START_DATE,
      TEST_EVENT_END_DATE
    ),
  };
}

function scheduledCanonicalOptions(): SeminarOption[] {
  return CAREER_UTTSAV_SEMINARS.map((title, index) => ({
    id: `sem-2026-${String(index + 1).padStart(2, "0")}`,
    title,
    date: index < 7 ? TEST_EVENT_START_DATE : TEST_EVENT_END_DATE,
    startTime: `${String(10 + (index % 7)).padStart(2, "0")}:00`,
  }));
}

describe("whatsapp seminar day catalog", () => {
  const options = scheduledCanonicalOptions();
  const catalog = buildTestSeminarDayCatalog(options);

  it("leaves undecided canonical seminars out of the day list", () => {
    const undecided = buildTestSeminarDayCatalog();
    expect(undecided.day1).toEqual([]);
    expect(undecided.day2).toEqual([]);
  });

  it("groups Day 1 from actual Day 1 seminar data", () => {
    expect(catalog.day1.map((seminar) => seminar.id)).toEqual([
      "sem-2026-01",
      "sem-2026-02",
      "sem-2026-03",
      "sem-2026-04",
      "sem-2026-05",
      "sem-2026-06",
      "sem-2026-07",
    ]);
  });

  it("groups Day 2 from actual Day 2 seminar data", () => {
    expect(catalog.day2.map((seminar) => seminar.id)).toEqual([
      "sem-2026-08",
      "sem-2026-09",
      "sem-2026-10",
      "sem-2026-11",
      "sem-2026-12",
      "sem-2026-13",
      "sem-2026-14",
    ]);
  });

  it("uses numeric keys for Day 1 display", () => {
    const message = formatCombinedSeminarSelectionMessage(catalog);
    expect(message).toContain(`1. ${CAREER_UTTSAV_SEMINARS[0]}`);
    expect(message).toContain(`3. ${CAREER_UTTSAV_SEMINARS[2]}`);
  });

  it("uses alphabetic keys for Day 2 display", () => {
    const message = formatCombinedSeminarSelectionMessage(catalog);
    expect(message).toContain(`a. ${CAREER_UTTSAV_SEMINARS[7]}`);
    expect(message).toContain(`b. ${CAREER_UTTSAV_SEMINARS[8]}`);
  });

  it("includes both days in one message", () => {
    const message = formatCombinedSeminarSelectionMessage(catalog);
    expect(message).toContain("Day 1");
    expect(message).toContain("Day 2");
    expect(message).toContain("Choose up to 3 seminars you'd like to attend.");
  });

  it("orders seminars deterministically by start time", () => {
    const shuffled: SeminarOption[] = [
      {
        id: "late",
        title: "Late",
        date: TEST_EVENT_START_DATE,
        startTime: "15:00",
      },
      {
        id: "early",
        title: "Early",
        date: TEST_EVENT_START_DATE,
        startTime: "09:00",
      },
    ];
    const ordered = buildWhatsAppSeminarDayCatalog(
      shuffled,
      TEST_EVENT_START_DATE,
      TEST_EVENT_END_DATE
    );
    expect(ordered.day1.map((seminar) => seminar.id)).toEqual(["early", "late"]);
    const withUnscheduled = buildWhatsAppSeminarDayCatalog(
      [...shuffled, { id: "later", title: "Undecided" }],
      TEST_EVENT_START_DATE,
      TEST_EVENT_END_DATE
    );
    expect(withUnscheduled.day1.map((seminar) => seminar.id)).toEqual([
      "early",
      "late",
    ]);
    expect(withUnscheduled.day2).toEqual([]);
  });
});

describe("parseSeminarSelectionInput", () => {
  const catalog = buildLargeCatalog().catalog;

  it.each([
    ["2", ["d1-2"]],
    ["b", ["d2-2"]],
    ["2,3", ["d1-2", "d1-3"]],
    ["2,b", ["d1-2", "d2-2"]],
    ["1,2,b", ["d1-1", "d1-2", "d2-2"]],
  ])("accepts valid input %s", (input, expectedIds) => {
    const parsed = parseSeminarSelectionInput(input, catalog);
    expect(parsed).toEqual({ ok: true, seminarIds: expectedIds });
  });

  it("accepts uppercase Day 2 letters", () => {
    expect(parseSeminarSelectionInput("A", catalog)).toEqual({
      ok: true,
      seminarIds: ["d2-1"],
    });
  });

  it("accepts whitespace variants", () => {
    expect(parseSeminarSelectionInput("2 , 3", catalog)).toEqual({
      ok: true,
      seminarIds: ["d1-2", "d1-3"],
    });
  });

  it.each([
    ["2,2", "DUPLICATE_SELECTION"],
    ["a,a", "DUPLICATE_SELECTION"],
    ["1,2,3,4", "TOO_MANY_SELECTIONS"],
    ["0", "EMPTY_OR_MALFORMED"],
    ["-1", "EMPTY_OR_MALFORMED"],
    ["99", "INVALID_OR_OUT_OF_RANGE_SELECTION"],
    ["z", "INVALID_OR_OUT_OF_RANGE_SELECTION"],
    ["two,seven", "EMPTY_OR_MALFORMED"],
    ["2 and 7", "EMPTY_OR_MALFORMED"],
    ["", "EMPTY_OR_MALFORMED"],
  ])("rejects invalid input %s with %s", (input, error) => {
    expect(parseSeminarSelectionInput(input, catalog)).toEqual({
      ok: false,
      error,
    });
  });

  it("maps numeric keys to Day 1 seminar IDs", () => {
    const parsed = parseSeminarSelectionInput("1", catalog);
    expect(parsed).toEqual({ ok: true, seminarIds: ["d1-1"] });
  });

  it("maps letter keys to Day 2 seminar IDs", () => {
    const parsed = parseSeminarSelectionInput("a", catalog);
    expect(parsed).toEqual({ ok: true, seminarIds: ["d2-1"] });
  });

  it("supports 1, 2, and 3 selections only", () => {
    expect(parseSeminarSelectionInput("1", catalog).ok).toBe(true);
    expect(parseSeminarSelectionInput("1,2", catalog).ok).toBe(true);
    expect(parseSeminarSelectionInput("1,2,b", catalog).ok).toBe(true);
    expect(parseSeminarSelectionInput("1,2,3,b", catalog).ok).toBe(false);
  });
});

describe("buildSeminarFinishSummaryBody", () => {
  const { catalog, options } = buildLargeCatalog();

  it("groups selected seminars by day and omits empty day headings", () => {
    const body = buildSeminarFinishSummaryBody(
      catalog,
      ["d1-1", "d1-2", "d2-1"],
      options
    );
    expect(body).toContain("Day 1");
    expect(body).toContain("• Day One Topic 1");
    expect(body).toContain("Day 2");
    expect(body).toContain("• Day Two Topic 1");
    expect(body).toContain("Completing your registration");
  });

  it("omits Day 2 when only Day 1 seminars are selected", () => {
    const body = buildSeminarFinishSummaryBody(
      catalog,
      ["d1-1"],
      options
    );
    expect(body).toContain("Day 1");
    expect(body).not.toContain("Day 2");
  });
});

describe("message length", () => {
  it("fits within a safe WhatsApp text limit for 20 seminars", () => {
    const { catalog } = buildLargeCatalog();
    const message = formatCombinedSeminarSelectionMessage(catalog);
    expect(message.length).toBeLessThan(4096);
  });

  it("supports Day 2 letters through j for 10 seminars", () => {
    const { catalog } = buildLargeCatalog();
    expect(indexToDay2Letter(9)).toBe("j");
    expect(parseSeminarSelectionInput("j", catalog)).toEqual({
      ok: true,
      seminarIds: ["d2-10"],
    });
  });
});
