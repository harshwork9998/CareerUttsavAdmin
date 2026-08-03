import { NextResponse } from "next/server";

import { ROLE_ID_BY_NAME } from "@/constants";
import {
  createUserRecord,
  loadUsers,
  updateUserRecord,
} from "@/lib/server/users-persistence";
import { generateId } from "@/lib/utils";
import type { RoleName, User } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(loadUsers());
}

export async function POST(request: Request) {
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

  const created = createUserRecord({
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
}
