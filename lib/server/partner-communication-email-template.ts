import type { PanelSessionView, PendingItem, ReadinessLine } from "@/lib/partner-pending-state";
import {
  PARTNER_EMAIL_DUE_DATE_LABEL,
  partnerEmailBulletList,
  partnerEmailCta,
  partnerEmailDetailCard,
  partnerEmailNote,
  partnerEmailParagraphs,
  renderPartnerEmailDocument,
  renderPartnerEmailText,
} from "@/lib/server/partner-email-layout";

export type PartnerCommunicationEmail = {
  subject: string;
  html: string;
  text: string;
};

type BaseEmailInput = {
  institutionName: string;
  portalUrl: string;
  includeLogo?: boolean;
};

function nameOf(value: string): string {
  return value.replace(/\s+/g, " ").trim() || "Partner";
}

function sessionRows(session: PanelSessionView): Array<{ label: string; value: string }> {
  const rows = [{ label: "Topic", value: session.topic || "Panel Discussion" }];
  if (session.dateLabel) rows.push({ label: "Date", value: session.dateLabel });
  if (session.timeLabel) rows.push({ label: "Time", value: session.timeLabel });
  if (session.hallLabel) rows.push({ label: "Venue / Hall", value: session.hallLabel });
  if (!session.dateLabel && !session.timeLabel && !session.hallLabel) {
    rows.push({ label: "Schedule", value: "To be confirmed" });
  }
  return rows;
}

function sessionPlainLines(session: PanelSessionView): string[] {
  const lines = [`Topic: ${session.topic || "Panel Discussion"}`];
  if (session.dateLabel) lines.push(`Date: ${session.dateLabel}`);
  if (session.timeLabel) lines.push(`Time: ${session.timeLabel}`);
  if (session.hallLabel) lines.push(`Venue / Hall: ${session.hallLabel}`);
  if (!session.dateLabel && !session.timeLabel && !session.hallLabel) {
    lines.push("Schedule: To be confirmed");
  }
  return lines;
}

export function buildPendingActionsEmail(
  input: BaseEmailInput & { pendingItems: PendingItem[] }
): PartnerCommunicationEmail {
  const institutionName = nameOf(input.institutionName);
  const subject = "Almost There — A Few Career Uttsav Actions Are Still Pending";
  const labels = input.pendingItems.map((item) => item.label);
  const intro = [
    `Dear ${institutionName} Team,`,
    "A few details required for your participation at Career Uttsav 2026 are still pending on the Partner Portal.",
    "Please complete the applicable items listed below:",
  ];
  const deadline = `Kindly complete the pending requirements by ${PARTNER_EMAIL_DUE_DATE_LABEL} so that we can plan your institution's participation, event collaterals and on-ground coordination smoothly.`;
  const followUp = [
    "If you have already updated any of the above, please log in to the portal and confirm that the latest information has been saved.",
    "For any assistance, please reach out to us.",
  ];
  const html = renderPartnerEmailDocument({
    title: subject,
    heading: "A few actions are still pending",
    includeLogo: input.includeLogo,
    bodyHtml: [
      partnerEmailParagraphs(intro),
      partnerEmailBulletList("Pending for your institution", labels),
      partnerEmailCta(input.portalUrl, "COMPLETE PENDING ACTIONS"),
      partnerEmailNote(deadline),
      partnerEmailParagraphs(followUp),
    ].join(""),
  });
  const text = renderPartnerEmailText({
    lines: [
      subject,
      "",
      ...intro.flatMap((line) => [line, ""]),
      "Pending for your institution",
      ...labels.map((label) => `- ${label}`),
      "",
      `COMPLETE PENDING ACTIONS: ${input.portalUrl}`,
      "",
      deadline,
      "",
      ...followUp,
    ],
  });
  return { subject, html, text };
}

export function buildPanelDiscussionDetailsEmail(
  input: BaseEmailInput & { sessions: PanelSessionView[] }
): PartnerCommunicationEmail {
  const institutionName = nameOf(input.institutionName);
  const subject =
    "Your Career Uttsav Panel Discussion Slot is Ready for Confirmation";
  const intro = [
    `Dear ${institutionName} Team,`,
    "Your institution has been allotted a Panel Discussion at Career Uttsav 2026.",
    "Please review the session details available on your Partner Portal.",
  ];
  const closing =
    "Please review the details and ensure that the appropriate speaker information is submitted through the portal by 1 December 2026.";
  const help =
    "If any clarification is required regarding the topic or session, please reach out to the Career Uttsav team before submitting the speaker details.";
  const html = renderPartnerEmailDocument({
    title: subject,
    heading: `Panel Discussion details for ${institutionName}`,
    includeLogo: input.includeLogo,
    bodyHtml: [
      partnerEmailParagraphs(intro),
      partnerEmailDetailCard(
        "Panel Discussion Details",
        input.sessions.map((session) => ({ rows: sessionRows(session) }))
      ),
      partnerEmailCta(input.portalUrl, "VIEW PANEL DISCUSSION DETAILS"),
      partnerEmailNote(closing),
      partnerEmailNote(help),
    ].join(""),
  });
  const text = renderPartnerEmailText({
    lines: [
      subject,
      "",
      ...intro.flatMap((line) => [line, ""]),
      "Panel Discussion Details",
      ...input.sessions.flatMap((session) => ["", ...sessionPlainLines(session)]),
      "",
      `VIEW PANEL DISCUSSION DETAILS: ${input.portalUrl}`,
      "",
      closing,
      "",
      help,
    ],
  });
  return { subject, html, text };
}

export function buildSpeakerDetailsRequestEmail(
  input: BaseEmailInput
): PartnerCommunicationEmail {
  const institutionName = nameOf(input.institutionName);
  const subject = `Who Will Represent ${institutionName} on the Career Uttsav Stage?`;
  const intro = [
    `Dear ${institutionName} Team,`,
    "We now need the details of the speaker who will represent your institution during the allotted Career Uttsav 2026 Panel Discussion.",
    "Please submit the following through your Partner Portal:",
  ];
  const items = [
    "Speaker name",
    "Designation",
    "Professional profile / short bio",
    "Photograph",
    "Contact details",
    "LinkedIn profile, if available",
    "Any other information requested in the speaker section",
  ];
  const deadline = `Kindly submit the final and approved speaker information by ${PARTNER_EMAIL_DUE_DATE_LABEL}.`;
  const accuracy =
    "The submitted details may be used for speaker coordination, event scheduling and public-facing Career Uttsav communication, so please ensure the information is accurate and approved by your institution.";
  const html = renderPartnerEmailDocument({
    title: subject,
    heading: `Speaker details for ${institutionName}`,
    includeLogo: input.includeLogo,
    bodyHtml: [
      partnerEmailParagraphs(intro),
      partnerEmailBulletList("Speaker details", items),
      partnerEmailCta(input.portalUrl, "ADD SPEAKER DETAILS"),
      partnerEmailNote(deadline),
      partnerEmailNote(accuracy),
    ].join(""),
  });
  const text = renderPartnerEmailText({
    lines: [
      subject,
      "",
      ...intro.flatMap((line) => [line, ""]),
      ...items.map((item) => `- ${item}`),
      "",
      `ADD SPEAKER DETAILS: ${input.portalUrl}`,
      "",
      deadline,
      "",
      accuracy,
    ],
  });
  return { subject, html, text };
}

export type ReceivedSpeaker = {
  name: string;
  designation: string;
  topic: string;
  scheduleLabel?: string | null;
};

export function buildSpeakerDetailsReceivedEmail(
  input: BaseEmailInput & { speakers: ReceivedSpeaker[] }
): PartnerCommunicationEmail {
  const institutionName = nameOf(input.institutionName);
  const subject = `Speaker Submission Confirmed for ${institutionName}`;
  const intro = [
    `Dear ${institutionName} Team,`,
    "Thank you. We have successfully received the speaker details submitted for your Career Uttsav 2026 Panel Discussion.",
  ];
  const review = `Please review the submitted information once in the Partner Portal. If any correction is required, update the details before ${PARTNER_EMAIL_DUE_DATE_LABEL}.`;
  const later =
    "Closer to the event, the Career Uttsav team will coordinate the final reporting time, venue and session requirements.";
  const html = renderPartnerEmailDocument({
    title: subject,
    heading: `Speaker submission confirmed`,
    includeLogo: input.includeLogo,
    bodyHtml: [
      partnerEmailParagraphs(intro),
      partnerEmailDetailCard(
        "Submission received for",
        input.speakers.map((speaker) => ({
          rows: [
            { label: "Speaker", value: speaker.name },
            { label: "Designation", value: speaker.designation },
            { label: "Panel Discussion", value: speaker.topic },
            ...(speaker.scheduleLabel
              ? [{ label: "Date & Time", value: speaker.scheduleLabel }]
              : []),
          ],
        }))
      ),
      partnerEmailCta(input.portalUrl, "VIEW SUBMISSION"),
      partnerEmailNote(review),
      partnerEmailNote(later),
    ].join(""),
  });
  const text = renderPartnerEmailText({
    lines: [
      subject,
      "",
      ...intro.flatMap((line) => [line, ""]),
      "Submission received for",
      ...input.speakers.flatMap((speaker) => [
        "",
        `Speaker: ${speaker.name}`,
        `Designation: ${speaker.designation}`,
        `Panel Discussion: ${speaker.topic}`,
        ...(speaker.scheduleLabel ? [`Date & Time: ${speaker.scheduleLabel}`] : []),
      ]),
      "",
      `VIEW SUBMISSION: ${input.portalUrl}`,
      "",
      review,
      "",
      later,
    ],
  });
  return { subject, html, text };
}

export function buildParticipationReadinessEmail(
  input: BaseEmailInput & { lines: ReadinessLine[] }
): PartnerCommunicationEmail {
  const institutionName = nameOf(input.institutionName);
  const subject = "Your Career Uttsav Participation Details Are Complete";
  const intro = [
    `Dear ${institutionName} Team,`,
    "Thank you. We have received all the mandatory information required for your participation at Career Uttsav 2026.",
    "Your Partner Portal requirements are now complete.",
  ];
  const review =
    "Please review your final information once in the Partner Portal and let us know promptly if any approved details change before the event.";
  const welcome =
    "We look forward to welcoming your team to Career Uttsav 2026 on 19–20 December at Palace Grounds, Bengaluru.";
  const summary = input.lines.map((line) => `${line.label} — ${line.status}`);
  const html = renderPartnerEmailDocument({
    title: subject,
    heading: `${institutionName} is event-ready`,
    includeLogo: input.includeLogo,
    bodyHtml: [
      partnerEmailParagraphs(intro),
      partnerEmailBulletList("Your participation readiness", summary),
      partnerEmailCta(input.portalUrl, "VIEW PARTICIPATION SUMMARY"),
      partnerEmailNote(review),
      partnerEmailNote(welcome),
    ].join(""),
  });
  const text = renderPartnerEmailText({
    lines: [
      subject,
      "",
      ...intro.flatMap((line) => [line, ""]),
      "Your participation readiness",
      ...summary.map((line) => `- ${line}`),
      "",
      `VIEW PARTICIPATION SUMMARY: ${input.portalUrl}`,
      "",
      review,
      "",
      welcome,
    ],
  });
  return { subject, html, text };
}
