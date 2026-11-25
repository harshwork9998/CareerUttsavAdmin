import { prisma } from "@/lib/server/prisma";

/**
 * Persists verified Meta acceptance of the registration entry-pass QR.
 * Recovery uses this timestamp — not COMPLETED status alone.
 */
export async function markPostRegistrationEntryPassDelivered(
  waId: string,
  deliveredAt: Date
): Promise<boolean> {
  const updated = await prisma.whatsAppRegistrationConversation.updateMany({
    where: {
      waId,
      postRegistrationEntryPassDeliveredAt: null,
    },
    data: {
      postRegistrationEntryPassDeliveredAt: deliveredAt,
    },
  });
  return updated.count > 0;
}