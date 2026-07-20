import type {
  ROLES,
  REGISTRATION_STATUSES,
  UNIVERSITY_STATUSES,
  PARTNER_CATEGORIES,
  EVENT_STATUSES,
} from "@/constants";

// ─── Status & enum types (derived from constants) ───────────────────────────

export type RoleName = (typeof ROLES)[number];
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export type UniversityStatus = (typeof UNIVERSITY_STATUSES)[number];
export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];

export type UserStatus = "Active" | "Inactive" | "Suspended";
export type PaymentStatus = "Paid" | "Pending" | "Waived";
export type UniversityType = "Government" | "Private" | "Deemed" | "Autonomous";
export type BlogStatus = "Draft" | "Published" | "Archived";
export type GalleryCategory =
  | "Event Highlights"
  | "Speakers"
  | "Stalls"
  | "Students"
  | "Awards"
  | "Workshops";
export type NotificationType =
  | "Info"
  | "Success"
  | "Warning"
  | "Error"
  | "Registration"
  | "Event"
  | "System";
export type NotificationAudience =
  | "All"
  | "Students"
  | "Universities"
  | "Partners"
  | "Admins";
export type NotificationChannel = "Email" | "SMS" | "Push" | "In-App";
export type NotificationStatus = "Draft" | "Scheduled" | "Sent" | "Failed";
export type ReportType =
  | "Registration"
  | "Event Performance"
  | "University"
  | "Partner"
  | "Revenue"
  | "Engagement";
export type ReportFormat = "PDF" | "Excel" | "CSV";
export type ReportStatus = "Generating" | "Ready" | "Failed";
export type TaskPriority = "High" | "Medium" | "Low";
export type TaskStatus = "Pending" | "In Progress" | "Completed";
export type ActivityResourceType =
  | "event"
  | "registration"
  | "university"
  | "partner"
  | "blog"
  | "gallery"
  | "notification"
  | "user"
  | "role"
  | "settings"
  | "report"
  | "system";
export type RecentActivityType =
  | "registration"
  | "event"
  | "university"
  | "partner"
  | "blog"
  | "system";

// ─── Core entities ──────────────────────────────────────────────────────────

export interface Permission {
  resource: string;
  actions: ("create" | "read" | "update" | "delete")[];
}

export interface Role {
  id: string;
  name: RoleName;
  description: string;
  permissions: Permission[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: RoleName;
  roleId: string;
  status: UserStatus;
  department?: string;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventSeminar {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD within event start..end
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  panelistSlots: number;
  /** 1-based auditorium number within the venue (1..event.hallCount) */
  hall: number;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  status: EventStatus;
  venue: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  startDate: string;
  endDate: string;
  /** Fair open time (HH:mm) */
  startTime: string;
  /** Fair close time (HH:mm) */
  endTime: string;
  /** Number of auditoriums / seminar rooms at the venue */
  hallCount: number;
  seminars: EventSeminar[];
  registrationDeadline: string;
  maxCapacity: number;
  registrationCount: number;
  checkInCount: number;
  bannerImage?: string;
  isFeatured: boolean;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Registration {
  id: string;
  registrationNumber: string;
  eventId: string;
  eventTitle: string;
  studentName: string;
  email: string;
  /** Student mobile number */
  phone: string;
  parentPhone?: string;
  /** School / college name */
  college: string;
  classLabel?: string;
  interestedStream?: string;
  board?: string;
  gender?: "Male" | "Female" | "Other";
  city: string;
  state: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  amount?: number;
  checkInTime?: string;
  registeredAt: string;
  updatedAt: string;
  /** Seminar sessions selected at registration (catalog titles). */
  seminarInterests?: string[];
  /** Legacy — prefer interestedStream */
  course?: string;
  /** Legacy — prefer classLabel */
  year?:
    | "1st Year"
    | "2nd Year"
    | "3rd Year"
    | "4th Year"
    | "Final Year"
    | "Graduate";
}

export type BroadcastChannel = "email" | "whatsapp";

export interface SeminarBroadcastRequest {
  eventId: string;
  seminarTitle: string;
  channel: BroadcastChannel;
  subject?: string;
  message: string;
  recipientIds: string[];
}

export interface SeminarBroadcastResult {
  channel: BroadcastChannel;
  sent: number;
  failed: number;
  batchId: string;
}

export interface University {
  id: string;
  name: string;
  shortName?: string;
  status: UniversityStatus;
  type: UniversityType;
  city: string;
  state: string;
  website?: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  studentCount?: number;
  courses: string[];
  logo?: string;
  stallNumber?: string;
  eventIds: string[];
  submittedAt: string;
  approvedAt?: string;
  updatedAt: string;
}

export interface PartnerContact {
  name: string;
  designation: string;
  phone: string;
  email: string;
}

export interface RelationshipOwner {
  /** K2, IES, or a custom company name */
  organization: string;
  managerName: string;
  managerPhone: string;
  managerEmail: string;
}

export interface PartnerStageRemark {
  id: string;
  fromStage: PartnerLifecycleStage;
  toStage: PartnerLifecycleStage;
  remark: string;
  createdAt: string;
}

export type PartnerMeetingOutcome = "won" | "lost" | "in_discussion";

/** A logged meeting or follow-up touchpoint during Meeting Scheduled stage */
export interface PartnerMeetingLog {
  id: string;
  /** ISO local datetime e.g. 2026-07-20T14:30:00 */
  meetingAt: string;
  notes?: string;
  outcome?: PartnerMeetingOutcome;
  followUpNotes?: string;
  /** ISO datetime for the next scheduled follow-up */
  followUpAt?: string;
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** Checklist item for a partner's package — custom rows are unique to that partner. */
export interface PartnerDeliverable {
  id: string;
  /** Predefined key, or `"custom"` for salesperson-added items */
  key: string;
  label: string;
  included: boolean;
  /** Selected option when the deliverable has a dropdown */
  option?: string;
  isCustom?: boolean;
}

/** Per-event sponsorship package — tier, deliverables, and seminar slot budget */
export interface PartnerEventPartnership {
  eventId: string;
  sponsorshipTier: SponsorshipTier;
  deliverables: PartnerDeliverable[];
  /** Total panelist slots allotted for this event (set in deliverables step) */
  seminarSlotCount: number;
}

export interface Partner {
  id: string;
  /** University / institution name */
  name: string;
  city: string;
  state: string;
  primaryContact: PartnerContact;
  secondaryContact: PartnerContact;
  eventIds: string[];
  relationshipOwner: RelationshipOwner;
  stage: PartnerLifecycleStage;
  stageRemarks: PartnerStageRemark[];
  sponsorshipTier?: SponsorshipTier;
  /** Notes from the meeting on sponsorship interest */
  sponsorshipNotes?: string;
  /** Per-event sponsorship tiers, deliverables, and slot budgets */
  eventPartnerships?: PartnerEventPartnership[];
  /** Package deliverables checklist — legacy flat list; prefer eventPartnerships */
  deliverables?: PartnerDeliverable[];
  /** Set when the deliverables step is submitted */
  deliverablesConfirmedAt?: string;
  /** Panelist slot allotments across selected events/seminars */
  seminarSlotAssignments?: PartnerSeminarSlotAssignment[];
  /** Set when seminar slot allotment is submitted */
  seminarSlotsConfirmedAt?: string;
  /** Package list price (INR) */
  totalAmount?: number;
  /** Discount offered (INR) */
  discountAmount?: number;
  /** Net payable after discount (INR) */
  netAmount?: number;
  /** Set when commercials step is submitted */
  commercialsConfirmedAt?: string;
  /** Partner portal login (usually primary contact email) */
  portalLogin?: string;
  /** Temporary password issued for first partner-portal login */
  portalTempPassword?: string;
  /** Email address the invite was sent to */
  portalInviteEmail?: string;
  /** When the welcome email with credentials was sent */
  portalInviteSentAt?: string;
  /** Brand assets & documents uploaded from the partner portal */
  portalDocuments?: PartnerPortalDocument[];
  /** First outreach */
  contactedAt?: string;
  contactedNotes?: string;
  /** Meeting fixed — legacy; synced from latest meeting log */
  meetingAt?: string;
  meetingNotes?: string;
  /** Multiple meetings logged while in Meeting Scheduled stage */
  meetings?: PartnerMeetingLog[];
  /** When marked Not Proceeding */
  notProceedingAt?: string;
  /** Mandatory reason when marked Not Proceeding */
  notProceedingReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type PartnerFollowUpItem = {
  partner: Partner;
  meeting: PartnerMeetingLog;
};

/** How many panelist seats a partner holds on a seminar */
export interface PartnerSeminarSlotAssignment {
  eventId: string;
  seminarId: string;
  slots: number;
}

export type SeminarSpeakerStatus = "Confirmed" | "Invited" | "Tentative";

/** Moderator or panelist seated on a seminar session */
export interface SeminarSpeaker {
  id: string;
  name: string;
  designation?: string;
  organization: string;
  partnerId?: string;
  status: SeminarSpeakerStatus;
}

/** Admin-managed roster for a seminar (panel + moderator) */
export interface SeminarSessionRoster {
  seminarId: string;
  eventId: string;
  moderator: SeminarSpeaker | null;
  panelists: SeminarSpeaker[];
  topicBrief?: string;
  notes?: string;
  updatedAt: string;
}

/** Files uploaded by the partner via the Career Uttsav partner portal */
export type PartnerPortalDocumentKind =
  | "logo"
  | "banner"
  | "writeup"
  | "company_profile"
  | "brochure"
  | "faculty_photo"
  | "brand_guidelines"
  | "agreement"
  | "tax_details"
  | "collateral"
  | "other";

export interface PartnerPortalDocument {
  id: string;
  kind: PartnerPortalDocumentKind;
  label: string;
  fileName: string;
  mimeType: string;
  /** Preview / download URL (or data URI in mocks) */
  url: string;
  fileSizeBytes: number;
  uploadedAt: string;
}

export interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  author: string;
  authorId: string;
  status: BlogStatus;
  tags: string[];
  viewCount: number;
  readTimeMinutes: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryImage {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  eventId?: string;
  eventName?: string;
  category: GalleryCategory;
  uploadedBy: string;
  uploadedAt: string;
  isPublished: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  audience: NotificationAudience;
  channel: NotificationChannel;
  status: NotificationStatus;
  eventId?: string;
  scheduledAt?: string;
  sentAt?: string;
  recipientCount?: number;
  readCount?: number;
  createdBy: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: ActivityResourceType;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface Report {
  id: string;
  name: string;
  type: ReportType;
  description?: string;
  dateRange: { from: string; to: string };
  format: ReportFormat;
  status: ReportStatus;
  generatedAt?: string;
  downloadUrl?: string;
  generatedBy: string;
  createdAt: string;
}

// ─── Settings ───────────────────────────────────────────────────────────────

export interface GeneralSettings {
  siteName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  defaultCity: string;
  timezone: string;
  registrationFee: number;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  registrationConfirmation: boolean;
  eventReminders: boolean;
  marketingEmails: boolean;
}

export interface IntegrationSettings {
  razorpayEnabled: boolean;
  whatsappEnabled: boolean;
  googleAnalyticsId?: string;
  mailchimpListId?: string;
}

export interface AppearanceSettings {
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
}

export interface Settings {
  general: GeneralSettings;
  notifications: NotificationSettings;
  integrations: IntegrationSettings;
  appearance: AppearanceSettings;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardKPI {
  id: string;
  label: string;
  value: number;
  change: number;
  changeType: "increase" | "decrease" | "neutral";
  format: "number" | "currency" | "percentage";
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface DashboardTask {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  assignedTo?: string;
  relatedResource?: ActivityResourceType;
}

export interface RecentActivity {
  id: string;
  type: RecentActivityType;
  title: string;
  description: string;
  timestamp: string;
  link?: string;
}

export interface UpcomingEventSummary {
  id: string;
  title: string;
  startDate: string;
  city: string;
  status: EventStatus;
  registrationCount: number;
  maxCapacity: number;
}

export interface DashboardTarget {
  id: string;
  label: string;
  current: number;
  target: number;
  format: "number" | "currency" | "percentage";
  periodLabel?: string;
}

export interface DashboardInsight {
  id: string;
  severity: "info" | "success" | "warning" | "critical";
  title: string;
  description: string;
}

export interface InstitutionRanking {
  name: string;
  value: number;
  city?: string;
}

export interface LiveRegistrationItem {
  id: string;
  studentName: string;
  classLabel: string;
  stream?: string;
  board?: string;
  school: string;
  city: string;
  seminar?: string;
  timestamp: string;
}

export interface StudentRegistrationAnalytics {
  total: number;
  todayCount: number;
  byClass: ChartDataPoint[];
  byStream: ChartDataPoint[];
  byBoard: ChartDataPoint[];
  byGender: ChartDataPoint[];
  /** Event city split (Bangalore / Mysore / Hubli) */
  byCity: ChartDataPoint[];
  /** Hometown / location students entered on the registration form */
  byRegistrantCity: ChartDataPoint[];
  bySeminar: ChartDataPoint[];
  /** Weekly registrations Aug–Dec 2026 */
  weeklyTrend: ChartDataPoint[];
  topSchools: InstitutionRanking[];
  liveFeed: LiveRegistrationItem[];
  /** Optional legacy mock fields */
  target?: number;
  weeklyGrowth?: number;
  dailyTrend?: ChartDataPoint[];
  bySession?: ChartDataPoint[];
  bySource?: ChartDataPoint[];
  topColleges?: InstitutionRanking[];
}

export type SponsorshipTier =
  | "Stall Partner"
  | "Education Partner"
  | "Knowledge Partner (Silver)"
  | "Knowledge Partner (Gold)"
  | "University Partner"
  | "Co-Presenting Partner"
  | "Presenting Partner";

export type PartnerLifecycleStage =
  | "New"
  | "Contacted"
  | "Meeting Scheduled"
  | "Negotiation"
  | "Confirmed"
  | "Not Proceeding";

export type PartnerJourneyStage =
  | PartnerLifecycleStage
  | "Won"
  | "Lost"
  /** @deprecated Use Negotiation */
  | "Discussion"
  /** @deprecated Removed from lifecycle */
  | "Proposal Sent";

/** @deprecated Use PartnerJourneyStage */
export type PartnerPipelineStage = PartnerJourneyStage;

export type PartnerSalesStatus =
  | "Confirmed"
  | "In Discussion"
  | "Not Proceeding"
  | "In Process"
  | "Lost";

export interface PartnerSalesDeal {
  id: string;
  universityName: string;
  tier: SponsorshipTier;
  stage: PartnerJourneyStage;
  status: PartnerSalesStatus;
  value: number;
  city: string;
  owner: string;
  lastActivity: string;
  notes?: string;
}

export interface PartnerTierProgress {
  name: SponsorshipTier;
  current: number;
  target: number;
  value: number;
}

export interface PartnerSalesActivity {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  universityName: string;
  tier: SponsorshipTier;
  stage: PartnerJourneyStage;
  value: number;
}

export interface PartnerJourneyStageMetric {
  name: PartnerJourneyStage;
  count: number;
  amount: number;
}

/** @deprecated Use PartnerJourneyStageMetric */
export type PartnerPipelineStageMetric = PartnerJourneyStageMetric;

export interface PartnerSalesAnalytics {
  totalPartners: number;
  confirmed: number;
  byTier: ChartDataPoint[];
  byStage: PartnerJourneyStageMetric[];
  byStatus: ChartDataPoint[];
  byCity: ChartDataPoint[];
  tierProgress: PartnerTierProgress[];
  recentActivity: PartnerSalesActivity[];
  deals: PartnerSalesDeal[];
  inDiscussion?: number;
  notProceeding?: number;
  /** Kept for older mock slices; UI should prefer inDiscussion / notProceeding */
  inProcess?: number;
  lost?: number;
  pipelineValue?: number;
  wonValue?: number;
  conversionRate?: number;
  leaderboard?: Array<{
    name: string;
    deals: number;
    won: number;
    value: number;
  }>;
}

export type OperatingCity = "Bangalore" | "Mysore" | "Hubli";
export type DashboardCityFilter = "all" | OperatingCity;

export interface CityComparisonMetric {
  id: string;
  label: string;
  cityValue: number;
  averageValue: number;
  format: "number" | "currency" | "percentage";
  deltaPercent: number;
}

export interface CityDashboardSlice {
  kpis: DashboardKPI[];
  targets: DashboardTarget[];
  insights: DashboardInsight[];
  registrationTrend: ChartDataPoint[];
  eventPerformance: ChartDataPoint[];
  registrationsByStatus: ChartDataPoint[];
  recentActivities: RecentActivity[];
  upcomingTasks: DashboardTask[];
  upcomingEvents: UpcomingEventSummary[];
  studentRegistration: StudentRegistrationAnalytics;
  partnerSales: PartnerSalesAnalytics;
  vsAverage: CityComparisonMetric[];
}

export interface DashboardData {
  kpis: DashboardKPI[];
  registrationTrend: ChartDataPoint[];
  eventPerformance: ChartDataPoint[];
  registrationsByCity: ChartDataPoint[];
  registrationsByStatus: ChartDataPoint[];
  recentActivities: RecentActivity[];
  upcomingTasks: DashboardTask[];
  upcomingEvents: UpcomingEventSummary[];
  targets: DashboardTarget[];
  insights: DashboardInsight[];
  studentRegistration: StudentRegistrationAnalytics;
  partnerSales: PartnerSalesAnalytics;
  citySlices: Record<OperatingCity, CityDashboardSlice>;
}
