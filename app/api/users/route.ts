import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import {
  createAdminUser,
  listAdminUsers,
} from "@/lib/server/admin-user-service";
import { isAdminUserError } from "@/lib/server/admin-user-errors";
import { ROLE_ID_BY_NAME } from "@/constants";
import type { RoleName, User } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(await listAdminUsers());
}

export async function POST(request: Request) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as Omit<
    User,
    "id" | "createdAt" | "updatedAt"
  >;

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = body.role as RoleName | undefined;

  if (!name || !email) {
    return NextResponse.json(
      { error: "Name and email are required" },
      { status: 400 }
    );
  }

  if (!role || !(role in ROLE_ID_BY_NAME)) {
    return NextResponse.json({ error: "A valid role is required" }, { status: 400 });
  }

  try {
    const created = await createAdminUser({
      name,
      email,
      phone: body.phone,
      avatar: body.avatar,
      role,
      roleId: ROLE_ID_BY_NAME[role],
      status: body.status ?? "Active",
      department: body.department,
      lastLogin: body.lastLogin,
    });
    return NextResponse.json(created);
  } catch (error) {
    if (isAdminUserError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
