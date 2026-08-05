/**
 * Pluggable SMS sender for OTP delivery.
 * Swap providers via SMS_PROVIDER without changing OTP business logic.
 */

export type SendSmsInput = {
  to: string;
  message: string;
};

export type SendSmsResult =
  | { ok: true; provider: string; id?: string }
  | { ok: false; provider: string; error: string };

async function sendViaConsole(input: SendSmsInput): Promise<SendSmsResult> {
  console.info(
    `[sms:console] to=+91${input.to} message=${JSON.stringify(input.message)}`
  );
  return { ok: true, provider: "console", id: `console-${Date.now()}` };
}

async function sendViaTwilio(input: SendSmsInput): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      provider: "twilio",
      error: "Twilio credentials are not configured",
    };
  }

  const body = new URLSearchParams({
    To: `+91${input.to}`,
    From: from,
    Body: input.message,
  });

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const data = (await response.json()) as { sid?: string; message?: string };
  if (!response.ok) {
    return {
      ok: false,
      provider: "twilio",
      error: data.message || `Twilio error (${response.status})`,
    };
  }

  return { ok: true, provider: "twilio", id: data.sid };
}

/**
 * Send an SMS. Defaults to console logging when SMS_PROVIDER is unset or "console".
 * Future: login / password-reset can reuse this without changes.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const provider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();

  try {
    if (provider === "twilio") {
      return await sendViaTwilio(input);
    }
    return await sendViaConsole(input);
  } catch (error) {
    return {
      ok: false,
      provider,
      error: error instanceof Error ? error.message : "SMS send failed",
    };
  }
}

export function buildOtpSmsMessage(code: string, purpose: string): string {
  const minutes = 5;
  if (purpose === "student_registration") {
    return `Your Career Uttsav verification code is ${code}. Valid for ${minutes} minutes. Do not share this code.`;
  }
  if (purpose === "login") {
    return `Your Career Uttsav login code is ${code}. Valid for ${minutes} minutes.`;
  }
  if (purpose === "password_reset") {
    return `Your Career Uttsav password reset code is ${code}. Valid for ${minutes} minutes.`;
  }
  return `Your Career Uttsav code is ${code}. Valid for ${minutes} minutes.`;
}
