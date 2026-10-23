import { describe, expect, it } from "vitest";

import { CAREER_UTTSAV_SEMINARS } from "@/features/dashboard/seminars";
import { CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS } from "@/lib/server/career-uttsav-2026-artwork-event-seminars";
import {
  REGISTRATION_INTERACTIVE_IDS,
} from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  META_BUTTON_TITLE_LIMIT,
  validateWhatsAppButtonAction,
} from "@/lib/server/whatsapp/meta-action-mapper";
import {
  ArtworkSeminarMappingError,
  WHATSAPP_ARTWORK_SEMINAR_DEFINITIONS,
  WHATSAPP_SEMINAR_ARTWORK_PATH,
  WHATSAPP_SEMINAR_IMAGE_CAPTION,
  buildSeminarArtworkSummaryBody,
  buildWhatsAppSeminarPickerMediaAction,
  parseArtworkSeminarSelectionInput,
  resolveArtworkSeminarSelection,
} from "@/lib/server/whatsapp/whatsapp-artwork-seminar-catalog";
import { buildWhatsAppRegistrationReminder2hActions } from "@/lib/server/whatsapp/whatsapp-registration-reminder-messages";
import { createInitialConversationState } from "@/lib/server/whatsapp/registration-conversation";
import {
  buildTestEventArtworkSeminarOptions,
} from "@/lib/server/whatsapp/whatsapp-seminar-test-fixtures";

describe("whatsapp artwork seminar catalog", () => {
  const eventOptions = buildTestEventArtworkSeminarOptions();
  const resolution = resolveArtworkSeminarSelection(eventOptions);

  it("defines exactly 14 artwork seminars with the canonical titles", () => {
    expect(WHATSAPP_ARTWORK_SEMINAR_DEFINITIONS).toHaveLength(14);
    expect(
      WHATSAPP_ARTWORK_SEMINAR_DEFINITIONS.map((definition) => definition.title)
    ).toEqual([...CAREER_UTTSAV_SEMINARS]);
    expect(
      WHATSAPP_ARTWORK_SEMINAR_DEFINITIONS.map((definition) => definition.number)
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("maps all 14 artwork numbers to distinct event seminar IDs", () => {
    const ids = WHATSAPP_ARTWORK_SEMINAR_DEFINITIONS.map(
      (definition) => resolution.numberToId.get(definition.number)
    );
    expect(ids).toHaveLength(14);
    expect(new Set(ids).size).toBe(14);
    for (const id of ids) {
      expect(id).toMatch(/^sem-2026-/);
    }
  });

  it("maps #1 and #11 to dedicated event records", () => {
    expect(resolution.numberToId.get(1)).toBe("sem-2026-01");
    expect(resolution.numberToId.get(11)).toBe("sem-2026-11");
  });

  it("maps #3 unambiguously to Design, Architecture & Creative Careers", () => {
    expect(resolution.numberToId.get(3)).toBe("sem-2026-03");
    expect(resolution.idToTitle.get("sem-2026-03")).toBe(CAREER_UTTSAV_SEMINARS[2]);
  });

  it("does not share IDs between #2 and #12 or #4 and #10", () => {
    expect(resolution.numberToId.get(2)).toBe("sem-2026-02");
    expect(resolution.numberToId.get(12)).toBe("sem-2026-12");
    expect(resolution.numberToId.get(4)).toBe("sem-2026-04");
    expect(resolution.numberToId.get(10)).toBe("sem-2026-10");
    expect(resolution.numberToId.get(2)).not.toBe(resolution.numberToId.get(12));
    expect(resolution.numberToId.get(4)).not.toBe(resolution.numberToId.get(10));
  });

  it("does not resolve artwork numbers from catalogue-only cat-* options", () => {
    const catalogueOnly = [
      {
        id: "cat-how-to-score-well-in-board-exams",
        title: "How to score well in Board Exams?",
      },
    ];
    expect(() => resolveArtworkSeminarSelection(catalogueOnly)).toThrow(
      ArtworkSeminarMappingError
    );
  });

  it("uses artwork titles in WhatsApp finish summary", () => {
    const body = buildSeminarArtworkSummaryBody(
      ["sem-2026-02", "sem-2026-08", "sem-2026-14"],
      resolution
    );
    expect(body).toContain(`Day 1\n• ${CAREER_UTTSAV_SEMINARS[1]}`);
    expect(body).toContain(`Day 2\n• ${CAREER_UTTSAV_SEMINARS[7]}`);
    expect(body).toContain(`• ${CAREER_UTTSAV_SEMINARS[13]}`);
    expect(body).not.toContain("New-age Engineering Careers");
    expect(body).not.toContain("How to score well in Board Exams?");
  });

  it("omits an empty day heading", () => {
    const body = buildSeminarArtworkSummaryBody(["sem-2026-02"], resolution);
    expect(body).toContain("Day 1");
    expect(body).toContain(CAREER_UTTSAV_SEMINARS[1]);
    expect(body).not.toContain("Day 2");
  });

  it("accepts valid numeric selections and persists event IDs", () => {
    expect(parseArtworkSeminarSelectionInput("2", resolution)).toEqual({
      ok: true,
      seminarIds: ["sem-2026-02"],
      numbers: [2],
    });
    expect(parseArtworkSeminarSelectionInput("2,8,14", resolution)).toEqual({
      ok: true,
      seminarIds: ["sem-2026-02", "sem-2026-08", "sem-2026-14"],
      numbers: [2, 8, 14],
    });
    expect(parseArtworkSeminarSelectionInput("2, 8, 14", resolution)).toEqual({
      ok: true,
      seminarIds: ["sem-2026-02", "sem-2026-08", "sem-2026-14"],
      numbers: [2, 8, 14],
    });
    expect(parseArtworkSeminarSelectionInput("1,2,3,4", resolution)).toEqual({
      ok: false,
      error: "TOO_MANY_SELECTIONS",
    });
  });

  it("builds seminar picker media from approved asset path", () => {
    const action = buildWhatsAppSeminarPickerMediaAction();
    expect(action.type).toBe("MEDIA");
    if (action.type !== "MEDIA") return;
    expect(action.filename).toBe("career-uttsav-2026-seminars.png");
    expect(action.caption).toBe(WHATSAPP_SEMINAR_IMAGE_CAPTION);
    expect(WHATSAPP_SEMINAR_ARTWORK_PATH).toBe(
      "public/whatsapp/career-uttsav-2026-seminars.png"
    );
    expect(action.contentBase64.length).toBeGreaterThan(100);
  });

  it("aligns JSON fixture event seminars with artwork definitions", () => {
    expect(CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS).toHaveLength(14);
    for (const definition of WHATSAPP_ARTWORK_SEMINAR_DEFINITIONS) {
      const eventRow = CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS.find(
        (seminar) => seminar.title === definition.title
      );
      expect(eventRow?.id).toBe(
        resolution.numberToId.get(definition.number)
      );
    }
  });

  it("uses Continue as the visible 2h reminder button within Meta limits", () => {
    const actions = buildWhatsAppRegistrationReminder2hActions({
      ...createInitialConversationState("919876543210"),
      studentName: "Aarav Sharma",
    });
    const buttons = actions[0]?.type === "BUTTONS" ? actions[0].buttons : [];
    expect(buttons[0]).toEqual({
      id: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
      title: "Continue",
    });
    expect(buttons[0]?.title.length).toBeLessThanOrEqual(META_BUTTON_TITLE_LIMIT);
    if (actions[0]?.type === "BUTTONS") {
      expect(validateWhatsAppButtonAction(actions[0]).ok).toBe(true);
    }
  });
});
