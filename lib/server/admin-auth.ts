import { NextResponse } from "next/server";

import { isSuperuser, loginBlockedMessage } from "@/lib/access-control";
import {
  findAdminUserById,
  getAdminUserAuthVersion,
  type AdminAuthLookupResult,
} from "@/lib/server/admin-user-service";
import { getAdminSession } from "@/lib/server/admin-session";
import type { User } from "@/types";

export async function getAuthenticatedAdminUser(): Promise<User | null> {
  const session = await getAdminSession();
  if (!session) return null;

  const user = await findAdminUserById(session.userId);
  if (!user || user.status !== "Active") {
    return null;
  }

  const authVersion = await getAdminUserAuthVersion(session.userId);
  if (session.authVersion !== authVersion) {
    return null;
  }

  return user;
}

export async function requireAdminUser(): Promise<
  { user: User } | NextResponse
> {
  const user = await getAuthenticatedAdminUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user };
}

export async function requireSuperuser(): Promise<
  { user: User } | NextResponse
> {
  const result = await requireAdminUser();
  if (result instanceof NextResponse) {
    return result;
  }
  if (!isSuperuser(result.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

export function authLookupToResponse(
  result: AdminAuthLookupResult
): NextResponse | null {
  if (result.ok) return null;

  if (result.reason === "blocked") {
    return NextResponse.json(
      { success: false, error: loginBlockedMessage(result.status) },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { success: false, error: "Invalid email or password" },
    { status: 401 }
  );
}
