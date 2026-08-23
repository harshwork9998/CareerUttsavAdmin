import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import {
  deleteAdminUser,
  findAdminUserById,
  updateAdminUser,
} from "@/lib/server/admin-user-service";
import { isAdminUserError } from "@/lib/server/admin-user-errors";
import type { User } from "@/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json()) as Partial<User>;

  const existing = await findAdminUserById(id);
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const updated = await updateAdminUser(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    if (isAdminUserError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    await deleteAdminUser(id, { actorUserId: auth.user.id });
    return NextResponse.json({
      success: true,
      message: "User deleted successfully.",
    });
  } catch (error) {
    if (isAdminUserError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
