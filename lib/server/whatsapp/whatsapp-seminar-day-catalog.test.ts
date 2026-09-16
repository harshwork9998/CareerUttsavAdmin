import { describe, expect, it } from "vitest";

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

describe("whatsapp seminar day catalog", () => {
  const options = buildTestSeminarOptions();
  const catalog = buildTestSeminarDayCatalog(options);

  it("groups Day 1 from actual Day 1 seminar data", () => {
    expect(catalog.day1.map((seminar) => seminar.id)).toEqual([
      "sem-d1-1",
      "sem-d1-2",
      "sem-d1-3",
    ]);
  });

  it("groups Day 2 from actual Day 2 seminar data", () => {
    expect(catalog.day2.map((seminar) => seminar.id)).toEqual([
      "sem-d2-1",
      "sem-d2-2",
    ]);
  });

  it("uses numeric keys for Day 1 display", () => {
    const message = formatCombinedSeminarSelectionMessage(catalog);
    expect(message).toContain("1. Day 1 Seminar 1");
    expect(message).toContain("3. Day 1 Seminar 3");
  });

  it("uses alphabetic keys for Day 2 display", () => {
    const message = formatCombinedSeminarSelectionMessage(catalog);
    expect(message).toContain("a. Day 2 Seminar 1");
    expect(message).toContain("b. Day 2 Seminar 2");
  });

  it("includes both days in one message", () => {
    const message = formatCombinedSeminarSelectionMessage(catalog);
    expect(message).toContain("Day 1");
    expect(message).toContain("Day 2");
    expect(message).toContain("Seminar Preferences");
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
  });
});

describe("parseSeminarSelectionInput", () => {
  const catalog = buildTestSeminarDayCatalog();

  it.each([
    ["2", ["sem-d1-2"]],
    ["b", ["sem-d2-2"]],
    ["2,3", ["sem-d1-2", "sem-d1-3"]],
    ["2,b", ["sem-d1-2", "sem-d2-2"]],
    ["1,2,b", ["sem-d1-1", "sem-d1-2", "sem-d2-2"]],
  ])("accepts valid input %s", (input, expectedIds) => {
    const parsed = parseSeminarSelectionInput(input, catalog);
    expect(parsed).toEqual({ ok: true, seminarIds: expectedIds });
  });

  it("accepts uppercase Day 2 letters", () => {
    expect(parseSeminarSelectionInput("A", catalog)).toEqual({
      ok: true,
      seminarIds: ["sem-d2-1"],
    });
  });

  it("accepts whitespace variants", () => {
    expect(parseSeminarSelectionInput("2 , 3", catalog)).toEqual({
      ok: true,
      seminarIds: ["sem-d1-2", "sem-d1-3"],
    });
  });

  it.each([
    "2,2",
    "a,a",
    "1,2,3,4",
    "0",
    "-1",
    "99",
    "z",
    "two,seven",
    "2 and 7",
    "",
  ])("rejects invalid input %s", (input) => {
    expect(parseSeminarSelectionInput(input, catalog).ok).toBe(false);
  });

  it("maps numeric keys to Day 1 seminar IDs", () => {
    const parsed = parseSeminarSelectionInput("1", catalog);
    expect(parsed).toEqual({ ok: true, seminarIds: ["sem-d1-1"] });
  });

  it("maps letter keys to Day 2 seminar IDs", () => {
    const parsed = parseSeminarSelectionInput("a", catalog);
    expect(parsed).toEqual({ ok: true, seminarIds: ["sem-d2-1"] });
  });

  it("supports 1, 2, and 3 selections only", () => {
    expect(parseSeminarSelectionInput("1", catalog).ok).toBe(true);
    expect(parseSeminarSelectionInput("1,2", catalog).ok).toBe(true);
    expect(parseSeminarSelectionInput("1,2,b", catalog).ok).toBe(true);
    expect(parseSeminarSelectionInput("1,2,3,b", catalog).ok).toBe(false);
  });
});

describe("buildSeminarFinishSummaryBody", () => {
  const catalog = buildTestSeminarDayCatalog();

  it("groups selected seminars by day and omits empty day headings", () => {
    const body = buildSeminarFinishSummaryBody(
      catalog,
      ["sem-d1-1", "sem-d1-2", "sem-d2-1"],
      buildTestSeminarOptions()
    );
    expect(body).toContain("Day 1");
    expect(body).toContain("• Day 1 Seminar 1");
    expect(body).toContain("Day 2");
    expect(body).toContain("• Day 2 Seminar 1");
    expect(body).toContain("Completing your registration");
  });

  it("omits Day 2 when only Day 1 seminars are selected", () => {
    const body = buildSeminarFinishSummaryBody(
      catalog,
      ["sem-d1-1"],
      buildTestSeminarOptions()
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
