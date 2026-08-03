export const BRAND = {
  primary: "#1F3864",
  secondary: "#0E7C7B",
  accent: "#3B82F6",
  name: "Career Uttsav",
  org: "K2 Group",
  logo: "/images/career-uttsav-logo.png?v=3",
} as const;

export const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { title: "Events", href: "/events", icon: "CalendarDays" },
  { title: "Registrations", href: "/registrations", icon: "Users" },
  { title: "Partners", href: "/partners", icon: "Handshake" },
  { title: "Seminars", href: "/seminars", icon: "Mic2" },
  { title: "Users", href: "/users", icon: "UserCog" },
] as const;

export const ROLES = ["user", "superuser"] as const;

export const ROLE_ID_BY_NAME: Record<(typeof ROLES)[number], string> = {
  user: "role-user",
  superuser: "role-superuser",
};

export const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  user: "User",
  superuser: "Superuser",
};

export const REGISTRATION_STATUSES = [
  "Pending",
  "Confirmed",
  "Checked In",
  "Cancelled",
] as const;

export const UNIVERSITY_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Changes Requested",
] as const;

export const PARTNER_CATEGORIES = [
  "Platinum Sponsor",
  "Gold Sponsor",
  "Silver Sponsor",
  "Media Partner",
  "Technology Partner",
  "Education Partner",
] as const;

/** Partner onboarding lifecycle (university sponsors). */
export const PARTNER_LIFECYCLE_STAGES = [
  "New",
  "Contacted",
  "Meeting Scheduled",
  "Negotiation",
  "Confirmed",
  "Not Proceeding",
] as const;

export const SPONSORSHIP_TIERS = [
  "Presenting Partner",
  "Co-Presenting Partner",
  "University Partner",
  "Knowledge Partner (Gold)",
  "Knowledge Partner (Silver)",
  "Education Partner",
  "Stall Partner",
] as const;

export const RELATIONSHIP_OWNER_ORGS = ["K2", "IES"] as const;

export {
  PARTNER_DELIVERABLE_DEFINITIONS,
  STALL_SIZE_OPTIONS,
  BOOK_AD_PLUS2_OPTIONS,
  PANEL_DURATION_OPTIONS,
  STALL_LOGO_POSITIONING_OPTIONS,
  BOOK_PREMIUM_SPOT_OPTIONS,
  PRE_REG_ACCESS_OPTIONS,
  buildDeliverablesForTier,
  applyTierDefaultsPreservingCustom,
  normalizeDeliverableOptions,
} from "./partner-deliverables";
export type {
  PartnerDeliverableKey,
  DeliverableDefinition,
} from "./partner-deliverables";

export const EVENT_STATUSES = ["Draft", "Published", "Live", "Completed", "Archived"] as const;

export const MOCK_ADMIN = {
  email: "admin@careeruttsav.com",
  password: "admin123",
};
