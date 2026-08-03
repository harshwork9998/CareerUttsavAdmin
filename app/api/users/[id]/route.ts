import { NextResponse } from "next/server";

import { ROLE_ID_BY_NAME } from "@/constants";
import { findUserById, updateUserRecord } from "@/lib/server/users-persistence";
import type { RoleName, User } from "@/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as Partial<User>;

  if (!findUserById(id)) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const patch = { ...body };
  if (patch.role && patch.role in ROLE_ID_BY_NAME) {
    patch.roleId = ROLE_ID_BY_NAME[patch.role as RoleName];
  }

  const updated = updateUserRecord(id, patch);
  return NextResponse.json(updated);
}
