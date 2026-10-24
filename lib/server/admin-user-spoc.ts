import { isPrismaAdminUserPersistence } from "@/lib/server/admin-user-persistence-mode";
import { findPrismaAdminUserRecordById } from "@/lib/server/admin-user-prisma-store";
import { findUserById } from "@/lib/server/users-persistence";

export async function findAdminUserRelationshipSpocId(
  adminUserId: string
): Promise<string | null> {
  if (isPrismaAdminUserPersistence()) {
    const record = await findPrismaAdminUserRecordById(adminUserId);
    return record?.relationshipSpocId ?? null;
  }

  const user = findUserById(adminUserId);
  return user?.relationshipSpocId ?? null;
}
