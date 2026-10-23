import type { Event } from "@/types";
import {
  CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS,
  CAREER_UTTSAV_2026_EVENT_END_DATE,
  CAREER_UTTSAV_2026_EVENT_START_DATE,
} from "@/lib/server/career-uttsav-2026-artwork-event-seminars";

export const mockEvents: Event[] = [
  {
    id: "evt-001",
    title: "Career Uttsav Bengaluru 2026",
    slug: "career-uttsav-bengaluru-2026",
    description:
      "India's largest career fair in Bengaluru featuring 150+ universities, industry leaders, and career counselling sessions. Connect with top institutions from Karnataka and across India.",
    shortDescription: "150+ universities, career counselling & industry sessions in Bengaluru.",
    status: "Published",
    venue: "Palace Grounds",
    address: "Bellary Road, Vasanth Nagar",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560052",
    startDate: CAREER_UTTSAV_2026_EVENT_START_DATE,
    endDate: CAREER_UTTSAV_2026_EVENT_END_DATE,
    startTime: "09:00",
    endTime: "18:00",
    hallCount: 3,
    seminars: [...CAREER_UTTSAV_2026_ARTWORK_EVENT_SEMINARS],
    registrationDeadline: "2026-12-10T23:59:59+05:30",
    maxCapacity: 15000,
    registrationCount: 8420,
    checkInCount: 0,
    bannerImage: "/images/events/bengaluru-2026.jpg",
    isFeatured: true,
    tags: ["Engineering", "MBA", "Study Abroad", "Career Counselling"],
    createdBy: "usr-001",
    createdAt: "2025-11-01T10:00:00+05:30",
    updatedAt: "2026-06-20T14:30:00+05:30",
  },
];
