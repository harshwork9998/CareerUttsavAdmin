export const SMS_CONTENT_MAX_LENGTH = 300;

export const SMS_CONTENT_TOO_LONG_MESSAGE =
  "SMS content must be 300 characters or fewer.";

export function validateSmsContent(value: string): string | null {
  if (value.length > SMS_CONTENT_MAX_LENGTH) {
    return SMS_CONTENT_TOO_LONG_MESSAGE;
  }
  return null;
}
