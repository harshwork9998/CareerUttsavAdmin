export type FollowUpApiItem = {
  partnerId: string;
  partnerName: string;
  city: string;
  state: string;
  stage: string;
  urgency: "overdue" | "due_today" | "re_engage";
  followUpAt: string;
  followUpNotes?: string;
  meetingNotes?: string;
  lostReason?: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
  meetingId: string;
  relationshipOwnerName?: string;
};
