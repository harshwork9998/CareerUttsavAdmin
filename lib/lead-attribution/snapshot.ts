export type RegistrationAttributionSnapshot = {
  leadSource: string;
  leadSubSource: string;
  attributionTrackingCode: string;
};

export type LeadAttributionSnapshot = {
  trackingCode: string;
  leadSource: string;
  leadSubSource: string;
};

export function registrationAttributionFromResolved(
  resolved: LeadAttributionSnapshot
): RegistrationAttributionSnapshot {
  return {
    leadSource: resolved.leadSource,
    leadSubSource: resolved.leadSubSource,
    attributionTrackingCode: resolved.trackingCode,
  };
}