import {
  getMetaAppSecret,
  handleMetaWebhookVerification,
  verifyMetaWebhookSignature,
} from "@/lib/server/whatsapp/meta-webhook";
import { processVerifiedWhatsAppWebhook } from "@/lib/server/whatsapp/whatsapp-webhook-processor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = handleMetaWebhookVerification({
    mode: searchParams.get("hub.mode"),
    verifyToken: searchParams.get("hub.verify_token"),
    challenge: searchParams.get("hub.challenge"),
  });

  if (result.ok) {
    return new Response(result.challenge, { status: 200 });
  }

  return new Response(null, { status: 403 });
}

export async function POST(request: Request) {
  const appSecret = getMetaAppSecret();
  if (!appSecret) {
    return new Response(null, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaWebhookSignature(rawBody, signature, appSecret)) {
    return new Response(null, { status: 403 });
  }

  await processVerifiedWhatsAppWebhook(rawBody);
  return new Response(null, { status: 200 });
}
