import type { RegistrationStatus } from "@/types";

export type RegistrationCheckInPayload = {
  eventId: string;
  qrPayload?: string;
  registrationNumber?: string;
  registrationId?: string;
};

export type RegistrationCheckInView = {
  id: string;
  registrationNumber: string;
  studentName: string;
  classLabel?: string;
  phoneMasked?: string;
  status: RegistrationStatus;
  checkInTime?: string;
  eventId: string;
  eventTitle: string;
  alreadyCheckedIn: boolean;
};

export type RegistrationCheckInErrorCode =
  | "invalid_request"
  | "invalid_registration"
  | "event_mismatch";

export type RegistrationCheckInServiceResult =
  | { ok: true; data: RegistrationCheckInView }
  | {
      ok: false;
      code: RegistrationCheckInErrorCode;
      message: string;
      status: number;
    };
