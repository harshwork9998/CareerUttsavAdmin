import { describe, expect, it } from "vitest";

import {
  buildPanelDiscussionDetailsEmail,
  buildParticipationReadinessEmail,
  buildPendingActionsEmail,
  buildSpeakerDetailsReceivedEmail,
  buildSpeakerDetailsRequestEmail,
} from "@/lib/server/partner-communication-email-template";

const PORTAL = "https://partners.careeruttsav.in";
const SUPPORT = "info@careeruttsav.in | +91 91130 64877";

const templates = [
  {
    name: "pending actions",
    cta: "COMPLETE PENDING ACTIONS",
    due: true,
    build: () =>
      buildPendingActionsEmail({
        institutionName: `Good & <script>alert("x")</script> University`,
        portalUrl: PORTAL,
        includeLogo: true,
        pendingItems: [
          { key: "logo", label: "University logo" },
          { key: "representatives:evt-001", label: "Event representatives" },
        ],
      }),
  },
  {
    name: "panel discussion",
    cta: "VIEW PANEL DISCUSSION DETAILS",
    due: true,
    build: () =>
      buildPanelDiscussionDetailsEmail({
        institutionName: `Good & <script>alert("x")</script> University`,
        portalUrl: PORTAL,
        includeLogo: true,
        sessions: [
          {
            eventId: "evt-001",
            seminarId: "sem-001",
            topic: "Design careers",
            dateLabel: null,
            timeLabel: null,
            hallLabel: null,
          },
        ],
      }),
  },
  {
    name: "speaker request",
    cta: "ADD SPEAKER DETAILS",
    due: true,
    build: () =>
      buildSpeakerDetailsRequestEmail({
        institutionName: `Good & <script>alert("x")</script> University`,
        portalUrl: PORTAL,
        includeLogo: true,
      }),
  },
  {
    name: "speaker received",
    cta: "VIEW SUBMISSION",
    due: true,
    build: () =>
      buildSpeakerDetailsReceivedEmail({
        institutionName: `Good & <script>alert("x")</script> University`,
        portalUrl: PORTAL,
        includeLogo: true,
        speakers: [
          {
            name: "Asha & Co",
            designation: "Dean",
            topic: "Design careers",
            scheduleLabel: "19 December 2026, 10:00 AM",
          },
        ],
      }),
  },
  {
    name: "readiness",
    cta: "VIEW PARTICIPATION SUMMARY",
    due: false,
    build: () =>
      buildParticipationReadinessEmail({
        institutionName: `Good & <script>alert("x")</script> University`,
        portalUrl: PORTAL,
        includeLogo: true,
        lines: [
          { label: "Institution information", status: "Complete" },
          { label: "Branding & collaterals", status: "Complete" },
          { label: "Panel Discussion", status: "Confirmed" },
          { label: "Speaker details", status: "Complete" },
          { label: "Event representatives", status: "Not Applicable" },
          { label: "Other applicable deliverables", status: "Complete" },
        ],
      }),
  },
] as const;

describe("partner communication email templates", () => {
  it.each(templates)("$name uses the shared shell, support line, and plain text", (template) => {
    const built = template.build();
    expect(built.subject.length).toBeGreaterThan(8);
    expect(built.subject).not.toMatch(/seminar/i);
    expect(built.html).toContain("<!-- partner-email-shell -->");
    expect(built.html).toContain("max-width:640px");
    expect(built.html).toContain("#FBFAF3");
    expect(built.html).toContain("#E5372B");
    expect(built.html).toContain("cid:career-uttsav-logo");
    expect(built.html).toContain(template.cta);
    expect(built.html).toContain(`href="${PORTAL}"`);
    expect(built.html).toContain("Good &amp; &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; University");
    expect(built.html).not.toContain("<script>");
    expect(built.html).toContain(
      'info@careeruttsav.in</a> | <span style="color:#3A3742;">+91 91130 64877</span>'
    );
    expect(built.text).toContain("Good & <script>alert(\"x\")</script> University");
    expect(built.text).toContain(`${template.cta}: ${PORTAL}`);
    expect(built.text).toContain(SUPPORT);
    expect(built.text).not.toMatch(/seminar/i);
    expect(built.html).not.toMatch(/seminar/i);
    if (template.due) {
      expect(built.html).toContain("1 December 2026");
      expect(built.text).toContain("1 December 2026");
    } else {
      expect(built.text).toContain("19–20 December");
      expect(built.text).toContain("Palace Grounds, Bengaluru");
    }
  });

  it("uses the approved subjects", () => {
    expect(
      buildPendingActionsEmail({
        institutionName: "Example Institute",
        portalUrl: PORTAL,
        pendingItems: [{ key: "logo", label: "University logo" }],
      }).subject
    ).toBe("Almost There — A Few Career Uttsav Actions Are Still Pending");
    expect(
      buildPanelDiscussionDetailsEmail({
        institutionName: "Example Institute",
        portalUrl: PORTAL,
        sessions: [],
      }).subject
    ).toBe("Your Career Uttsav Panel Discussion Slot is Ready for Confirmation");
    expect(
      buildSpeakerDetailsRequestEmail({
        institutionName: "Example Institute",
        portalUrl: PORTAL,
      }).subject
    ).toBe("Who Will Represent Example Institute on the Career Uttsav Stage?");
    expect(
      buildSpeakerDetailsReceivedEmail({
        institutionName: "Example Institute",
        portalUrl: PORTAL,
        speakers: [],
      }).subject
    ).toBe("Speaker Submission Confirmed for Example Institute");
    expect(
      buildParticipationReadinessEmail({
        institutionName: "Example Institute",
        portalUrl: PORTAL,
        lines: [],
      }).subject
    ).toBe("Your Career Uttsav Participation Details Are Complete");
  });
});
