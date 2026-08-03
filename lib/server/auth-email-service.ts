import type { User } from "@/types";

/** Mock email delivery — replace with SendGrid/SES when backend mail is wired up. */
export async function sendAccountApprovedEmail(user: User): Promise<void> {
  // TODO: Integrate transactional email provider.
  console.info(
    `[auth-email] Account approved — to: ${user.email}, name: ${user.name}, role: ${user.role}`
  );
}

export async function sendAccountRejectedEmail(user: User): Promise<void> {
  console.info(
    `[auth-email] Account rejected — to: ${user.email}, name: ${user.name}`
  );
}
