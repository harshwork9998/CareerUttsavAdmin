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
  phone: string;
  college: string;
  course: string;
  year: "1st Year" | "2nd Year" | "3rd Year" | "4th Year" | "Final Year" | "Graduate";
  city: string;
  state: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  amount?: number;
  checkInTime?: string;
  registeredAt: string;
  updatedAt: string;
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

export interface Partner {
  id: string;
  name: string;
  category: PartnerCategory;
  logo?: string;
  website?: string;
  description?: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  city: string;
  state: string;
  sponsorshipAmount?: number;
  benefits: string[];
  eventIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface DashboardData {
  kpis: DashboardKPI[];
  registrationTrend: ChartDataPoint[];
  eventPerformance: ChartDataPoint[];
  registrationsByCity: ChartDataPoint[];
  registrationsByStatus: ChartDataPoint[];
  recentActivities: RecentActivity[];
  upcomingTasks: DashboardTask[];
  upcomingEvents: UpcomingEventSummary[];
}
