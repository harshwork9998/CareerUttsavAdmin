import {
  exportWhatsAppFirstName,
  type WhatsAppBotAction,
} from "@/lib/server/whatsapp/registration-conversation";
import { buildEditableWhatsAppShareUrl } from "@/lib/server/whatsapp/whatsapp-share-link";

type UrlCtaAction = Extract<WhatsAppBotAction, { type: "URL_CTA" }>;

export const WHATSAPP_POST_REGISTRATION_INSTAGRAM_DELAY_MS = 10 * 1000;
export const WHATSAPP_POST_REGISTRATION_PARENT_DELAY_MS = 60 * 60 * 1000;
export const WHATSAPP_POST_REGISTRATION_FRIEND_DELAY_MS = 3 * 60 * 60 * 1000;

export const WHATSAPP_INSTAGRAM_PROFILE_URL =
  "https://www.instagram.com/careeruttsav/";

/**
 * Registration is the homepage modal. The "Get Your FREE Pass" anchors use
 * /student-registration only as an href that click handlers cancel. There is
 * no student-registration page, so friends are sent to the public homepage.
 */
export const CAREER_UTTSAV_PUBLIC_REGISTRATION_URL = "https://careeruttsav.in/";

export const WHATSAPP_INSTAGRAM_CTA_LABEL = "Follow on Instagram";
export const WHATSAPP_PARENT_INVITE_CTA_LABEL = "Invite My Parents \u2192";
export const WHATSAPP_FRIEND_INVITE_CTA_LABEL = "Share With Friends \u2192";

export const WHATSAPP_PARENT_INVITE_SHARE_TEXT = `Mom & Dad, I\u2019ve registered for Career Uttsav 2026 at Palace Grounds on 19\u201320 Dec. There\u2019ll be universities, career experts, seminars and lots of career options to explore. I want you to come with me \u2013 it\u2019s about my future! Block your calendar NOW please \u{1F60A}

https://careeruttsav.in/`;

export const WHATSAPP_FRIEND_INVITE_SHARE_TEXT = `Hey Buddy!! I\u2019ve just found something we should check out \u{1F440}
Career Uttsav is happening at Palace Grounds on 19\u201320 Dec. Universities + career sessions + counselling + loads of career options. Entry is absolutely FREE.

Wanna come?
${CAREER_UTTSAV_PUBLIC_REGISTRATION_URL}`;

export type PostRegistrationGrowthKind =
  | "INSTAGRAM"
  | "PARENT_INVITE"
  | "FRIEND_INVITE";

export function postRegistrationGrowthDueAt(
  completedAt: Date
): Record<PostRegistrationGrowthKind, Date> {
  const completedMs = completedAt.getTime();
  return {
    INSTAGRAM: new Date(
      completedMs + WHATSAPP_POST_REGISTRATION_INSTAGRAM_DELAY_MS
    ),
    PARENT_INVITE: new Date(
      completedMs + WHATSAPP_POST_REGISTRATION_PARENT_DELAY_MS
    ),
    FRIEND_INVITE: new Date(
      completedMs + WHATSAPP_POST_REGISTRATION_FRIEND_DELAY_MS
    ),
  };
}

export function buildInstagramGrowthBody(studentName: string | null): string {
  const firstName = exportWhatsAppFirstName(studentName);
  return `${firstName}, we\u2019re revealing universities, speakers and what\u2019s happening at Career Uttsav \u{1F440}
Follow along so you don\u2019t miss the good stuff.`;
}

export function buildInstagramGrowthAction(
  studentName: string | null
): UrlCtaAction {
  return {
    type: "URL_CTA",
    body: buildInstagramGrowthBody(studentName),
    displayText: WHATSAPP_INSTAGRAM_CTA_LABEL,
    url: WHATSAPP_INSTAGRAM_PROFILE_URL,
  };
}

export const WHATSAPP_PARENT_INVITE_BODY = `\u{1F468}\u200D\u{1F469}\u200D\u{1F467} Bring your parents along.
Career decisions usually bring questions for them too.

They can meet universities, understand courses, fees, scholarships and career options \u2014 and explore everything with you.

Parents can attend FREE too.`;

export function buildParentInviteGrowthAction(): UrlCtaAction {
  return {
    type: "URL_CTA",
    body: WHATSAPP_PARENT_INVITE_BODY,
    displayText: WHATSAPP_PARENT_INVITE_CTA_LABEL,
    url: buildEditableWhatsAppShareUrl(WHATSAPP_PARENT_INVITE_SHARE_TEXT),
  };
}

export const WHATSAPP_FRIEND_INVITE_BODY = `And you probably know someone else who\u2019s also figuring out \u201CWhat next?\u201D \u{1F604}
Bring your gang along.

Career Uttsav is more fun when you explore it together.`;

export function buildFriendInviteGrowthAction(): UrlCtaAction {
  return {
    type: "URL_CTA",
    body: WHATSAPP_FRIEND_INVITE_BODY,
    displayText: WHATSAPP_FRIEND_INVITE_CTA_LABEL,
    url: buildEditableWhatsAppShareUrl(WHATSAPP_FRIEND_INVITE_SHARE_TEXT),
  };
}

export function buildPostRegistrationGrowthAction(input: {
  kind: PostRegistrationGrowthKind;
  studentName: string | null;
}): WhatsAppBotAction {
  if (input.kind === "INSTAGRAM") {
    return buildInstagramGrowthAction(input.studentName);
  }
  if (input.kind === "PARENT_INVITE") {
    return buildParentInviteGrowthAction();
  }
  return buildFriendInviteGrowthAction();
}
