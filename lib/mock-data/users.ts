import type { User } from "@/types";

export const mockUsers: User[] = [
  {
    id: "usr-superuser",
    name: "Admin User",
    email: "admin@careeruttsav.com",
    phone: "+91 98765 43210",
    role: "superuser",
    roleId: "role-superuser",
    status: "Active",
    department: "Administration",
    lastLogin: "2026-07-09T08:45:00+05:30",
    createdAt: "2024-01-15T10:00:00+05:30",
    updatedAt: "2026-07-09T08:45:00+05:30",
  },
  {
    id: "usr-demo",
    name: "Demo User",
    email: "user@careeruttsav.com",
    phone: "+91 98123 45678",
    role: "user",
    roleId: "role-user",
    status: "Active",
    department: "Operations",
    lastLogin: "2026-07-08T17:30:00+05:30",
    createdAt: "2024-06-10T09:30:00+05:30",
    updatedAt: "2026-07-08T17:30:00+05:30",
  },
];
