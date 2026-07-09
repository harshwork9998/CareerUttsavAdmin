export const BRAND = {
  primary: "#1F3864",
  secondary: "#0E7C7B",
  accent: "#3B82F6",
  name: "Career Utsav",
  org: "K2 Group",
} as const;

export const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { title: "Events", href: "/events", icon: "CalendarDays" },
  { title: "Registrations", href: "/registrations", icon: "Users" },
  { title: "Universities", href: "/universities", icon: "GraduationCap" },
  { title: "Partners", href: "/partners", icon: "Handshake" },
  { title: "Blogs", href: "/blogs", icon: "FileText" },
  { title: "Gallery", href: "/gallery", icon: "Images" },
  { title: "Notifications", href: "/notifications", icon: "Bell" },
  { title: "Reports", href: "/reports", icon: "BarChart3" },
  { title: "Users", href: "/users", icon: "UserCog" },
  { title: "Roles & Permissions", href: "/roles", icon: "Shield" },
  { title: "Activity Logs", href: "/activity-logs", icon: "Activity" },
  { title: "Settings", href: "/settings", icon: "Settings" },
] as const;

export const ROLES = [
  "Super Admin",
  "Admin",
  "Marketing",
  "Content Editor",
  "Operations",
  "Read Only",
] as const;

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

export const EVENT_STATUSES = ["Draft", "Published", "Live", "Completed", "Archived"] as const;

export const MOCK_ADMIN = {
  email: "admin@careerutsav.com",
  password: "admin123",
};
