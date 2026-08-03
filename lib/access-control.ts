import { NAV_ITEMS, ROLE_ID_BY_NAME } from "@/constants";
import type { RoleName, User } from "@/types";

export type NavItem = (typeof NAV_ITEMS)[number];

/** Routes a normal user can access (registrations, partners, seminars). */
export const USER_ALLOWED_HREFS = [
  "/registrations",
  "/partners",
  "/seminars",
] as const;

const SUPERUSER_HREFS = NAV_ITEMS.map((item) => item.href);

export const ROUTES_BY_ROLE: Record<RoleName, readonly string[]> = {
  superuser: SUPERUSER_HREFS,
  user: USER_ALLOWED_HREFS,
};

export function getDefaultRouteForRole(role: RoleName): string {
  return role === "superuser" ? "/dashboard" : "/registrations";
}

export function getNavItemsForRole(role: RoleName): NavItem[] {
  const allowed = new Set<string>(ROUTES_BY_ROLE[role]);
  return NAV_ITEMS.filter((item) => allowed.has(item.href));
}

export function canAccessRoute(role: RoleName, pathname: string): boolean {
  const allowed = ROUTES_BY_ROLE[role];
  return allowed.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
}

export function isSuperuser(user: User | null | undefined): boolean {
  return user?.role === "superuser" && user.status === "Active";
}

export function canLogin(user: User): boolean {
  return user.status === "Active";
}

export function loginBlockedMessage(status: User["status"]): string {
  switch (status) {
    case "Pending Approval":
      return "Your account is pending approval. You'll receive an email once a superuser approves your access.";
    case "Rejected":
      return "Your account request was not approved. Contact an administrator if you believe this is a mistake.";
    case "Inactive":
      return "Your account is inactive. Contact an administrator for access.";
    case "Suspended":
      return "Your account has been suspended. Contact an administrator.";
    default:
      return "Your account cannot sign in at this time.";
  }
}

export function roleIdFor(role: RoleName): string {
  return ROLE_ID_BY_NAME[role];
}
