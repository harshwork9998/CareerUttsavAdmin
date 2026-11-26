import type { WhatsAppBotAction } from "@/lib/server/whatsapp/registration-conversation";
import { STUDENT_REGISTRATION_VENUE } from "@/lib/server/student-registration-email-template";

/**
 * Single place to update the WhatsApp native location pin.
 * Set operatorConfirmed to true only after ops verifies lat/lng against Gate No. 9.
 */
export const WHATSAPP_EVENT_VENUE_CONFIG = {
  mapsUrl: "https://maps.app.goo.gl/hYWT87vrq2h1qCeH7",
  latitude: 13.004975665714735,
  longitude: 77.5881406,
  name: "Career Uttsav 2026",
  address: STUDENT_REGISTRATION_VENUE,
  /** Block production LOCATION sends until ops confirms the pin. */
  operatorConfirmed: false,
} as const;

export const WHATSAPP_EVENT_LOCATION_MAPS_URL = WHATSAPP_EVENT_VENUE_CONFIG.mapsUrl;
export const WHATSAPP_EVENT_VENUE_LATITUDE = WHATSAPP_EVENT_VENUE_CONFIG.latitude;
export const WHATSAPP_EVENT_VENUE_LONGITUDE = WHATSAPP_EVENT_VENUE_CONFIG.longitude;
export const WHATSAPP_EVENT_VENUE_NAME = WHATSAPP_EVENT_VENUE_CONFIG.name;
export const WHATSAPP_EVENT_VENUE_ADDRESS = WHATSAPP_EVENT_VENUE_CONFIG.address;

export function isWhatsAppEventVenueLocationEnabled(): boolean {
  if (process.env.WHATSAPP_EVENT_VENUE_OPERATOR_CONFIRMED === "true") {
    return true;
  }
  return WHATSAPP_EVENT_VENUE_CONFIG.operatorConfirmed;
}

export const WHATSAPP_EVENT_LOCATION_EXPLANATION_BODY = `📍 Your Way to Career Uttsav!

We've shared the event location above.
Simply tap the location pin for directions
to the venue.

We look forward to welcoming you! 🎓`;

export function buildWhatsAppEventVenueLocationAction(
  locationPurpose: "registration_follow_up" | "venue_faq" = "registration_follow_up"
): WhatsAppBotAction {
  return {
    type: "LOCATION",
    latitude: WHATSAPP_EVENT_VENUE_LATITUDE,
    longitude: WHATSAPP_EVENT_VENUE_LONGITUDE,
    name: WHATSAPP_EVENT_VENUE_NAME,
    address: WHATSAPP_EVENT_VENUE_ADDRESS,
    locationPurpose,
  };
}