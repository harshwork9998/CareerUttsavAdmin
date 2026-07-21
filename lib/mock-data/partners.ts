import { buildDeliverablesForTier } from "@/constants";
import type { Partner, PartnerPortalDocument } from "@/types";

let deliverableSeq = 0;
function mockDeliverableId() {
  deliverableSeq += 1;
  return `deliv-mock-${deliverableSeq}`;
}

function svgDataUri(label: string, w: number, h: number, bg: string, fg: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="50%" fill="${fg}" font-family="Georgia,serif" font-size="${Math.min(w, h) / 8}" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function mockDocs(
  partnerKey: string,
  items: Array<Omit<PartnerPortalDocument, "id" | "url"> & { w?: number; h?: number }>
): PartnerPortalDocument[] {
  return items.map((item, i) => {
    const isImage = item.mimeType.startsWith("image/");
    const url = isImage
      ? svgDataUri(
          item.label,
          item.w ?? 800,
          item.h ?? 400,
          "#1F3864",
          "#F3F6FA"
        )
      : `data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPD4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKFNhbXBsZSBkb2MpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNjQgMDAwMDAgbiAKMDAwMDAwMDEyMSAwMDAwMCBuIAowMDAwMDAwMjE4IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNQovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMjkxCiUlRU9G`;
    return {
      id: `pdoc-${partnerKey}-${i + 1}`,
      kind: item.kind,
      label: item.label,
      fileName: item.fileName,
      mimeType: item.mimeType,
      url,
      fileSizeBytes: item.fileSizeBytes,
      uploadedAt: item.uploadedAt,
    };
  });
}

export const mockPartners: Partner[] = [
  {
    id: "partner-001",
    name: "Christ University",
    city: "Bangalore",
    state: "Karnataka",
    primaryContact: {
      name: "Dr. Anitha Rao",
      designation: "Dean — Admissions",
      phone: "+91 98450 11001",
      email: "anitha.rao@christuniversity.in",
    },
    secondaryContact: {
      name: "Rahul Menon",
      designation: "Manager — Outreach",
      phone: "+91 98450 11002",
      email: "rahul.menon@christuniversity.in",
    },
    eventIds: ["evt-001"],
    relationshipOwner: {
      organization: "K2",
      managerName: "Suresh Kulkarni",
      managerPhone: "+91 98860 20001",
      managerEmail: "suresh.kulkarni@k2group.in",
    },
    stage: "Negotiation",
    contactedAt: "2026-06-10",
    contactedNotes: "WhatsApp intro to Dean — admissions.",
    meetingAt: "2026-06-18",
    meetingNotes: "Walked through Gold vs University Partner packages.",
    meetings: [
      {
        id: "mtg-001-1",
        meetingAt: "2026-06-18T15:00:00",
        notes: "Walked through Gold vs University Partner packages.",
        outcome: "in_discussion",
        followUpNotes: "Share panel slot options for Day 1 seminars.",
        followUpAt: "2026-07-20T14:00:00",
        createdAt: "2026-06-18T16:00:00+05:30",
        updatedAt: "2026-06-18T16:00:00+05:30",
      },
    ],
    sponsorshipNotes: "Leaning Knowledge Partner (Gold); want panel slot on Day 1.",
    stageRemarks: [
      {
        id: "psr-001",
        fromStage: "Negotiation",
        toStage: "Negotiation",
        remark: "Reviewing Gold vs University Partner deliverables.",
        createdAt: "2026-07-02T11:00:00+05:30",
      },
    ],
    sponsorshipTier: "Knowledge Partner (Gold)",
    eventPartnerships: [
      {
        eventId: "evt-001",
        sponsorshipTier: "Knowledge Partner (Gold)",
        deliverables: buildDeliverablesForTier(
          "Knowledge Partner (Gold)",
          mockDeliverableId
        ),
        seminarSlotCount: 2,
      },
    ],
    deliverables: buildDeliverablesForTier(
      "Knowledge Partner (Gold)",
      mockDeliverableId
    ),
    deliverablesConfirmedAt: "2026-07-02T11:30:00+05:30",
    seminarSlotAssignments: [
      { eventId: "evt-001", seminarId: "sem-001-a", slots: 1 },
      { eventId: "evt-001", seminarId: "sem-001-b", slots: 1 },
    ],
    portalDocuments: mockDocs("001", [
      {
        kind: "logo",
        label: "Primary logo",
        fileName: "christ-logo.svg",
        mimeType: "image/svg+xml",
        fileSizeBytes: 15200,
        uploadedAt: "2026-07-05T14:10:00+05:30",
        w: 640,
        h: 640,
      },
      {
        kind: "banner",
        label: "Stall / venue banner",
        fileName: "christ-banner.svg",
        mimeType: "image/svg+xml",
        fileSizeBytes: 88000,
        uploadedAt: "2026-07-05T14:12:00+05:30",
        w: 1600,
        h: 500,
      },
    ]),
    createdAt: "2026-06-01T10:00:00+05:30",
    updatedAt: "2026-07-05T14:12:00+05:30",
  },
  {
    id: "partner-002",
    name: "PES University",
    city: "Bangalore",
    state: "Karnataka",
    primaryContact: {
      name: "Prof. Kavitha Nair",
      designation: "Director — Admissions",
      phone: "+91 98451 22001",
      email: "kavitha.nair@pes.edu",
    },
    secondaryContact: {
      name: "Arjun Shetty",
      designation: "Coordinator",
      phone: "+91 98451 22002",
      email: "arjun.shetty@pes.edu",
    },
    eventIds: ["evt-001"],
    relationshipOwner: {
      organization: "IES",
      managerName: "Meera Joshi",
      managerPhone: "+91 98861 30001",
      managerEmail: "meera.joshi@iesedu.in",
    },
    stage: "Confirmed",
    contactedAt: "2026-05-22",
    contactedNotes: "Email + call to Director — Admissions.",
    meetingAt: "2026-06-05",
    meetingNotes: "Agreed Stall Partner footprint near entrance.",
    sponsorshipNotes: "Stall Partner confirmed with branding on aisle banners.",
    stageRemarks: [
      {
        id: "psr-002",
        fromStage: "Negotiation",
        toStage: "Confirmed",
        remark: "Verbal confirmation for Stall Partner package.",
        createdAt: "2026-06-28T16:30:00+05:30",
      },
    ],
    sponsorshipTier: "Stall Partner",
    deliverables: buildDeliverablesForTier("Stall Partner", mockDeliverableId),
    deliverablesConfirmedAt: "2026-06-28T16:30:00+05:30",
    seminarSlotAssignments: [
      { eventId: "evt-001", seminarId: "sem-001-a", slots: 1 },
      { eventId: "evt-001", seminarId: "sem-001-c", slots: 2 },
    ],
    seminarSlotsConfirmedAt: "2026-06-28T16:45:00+05:30",
    portalInviteEmail: "kavitha.nair@pes.edu",
    portalLogin: "kavitha.nair@pes.edu",
    portalTempPassword: "PesPortal9x",
    portalInviteSentAt: "2026-06-29T10:00:00+05:30",
    portalFasciaName: "PES UNIVERSITY",
    portalWebsiteUrl: "https://www.pes.edu",
    portalSmsContent:
      "Visit PES University at Career Uttsav Bengaluru 2026 — explore engineering, design & management programs. Register: careeruttsav.in",
    portalDocuments: mockDocs("002", [
      {
        kind: "logo",
        label: "University logo",
        fileName: "pes-logo.svg",
        mimeType: "image/svg+xml",
        fileSizeBytes: 18420,
        uploadedAt: "2026-07-01T11:20:00+05:30",
        w: 640,
        h: 640,
      },
      {
        kind: "souvenir_writeup",
        label: "Souvenir write-up",
        fileName: "pes-souvenir-writeup.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 245760,
        uploadedAt: "2026-07-02T09:15:00+05:30",
      },
    ]),
    portalSeminarSpeakers: [
      {
        eventId: "evt-001",
        seminarId: "sem-001-a",
        speakers: [
          {
            name: "Prof. Kavitha Nair",
            designation: "Director — Admissions",
            contact: "kavitha.nair@pes.edu",
          },
        ],
        updatedAt: "2026-07-03T10:00:00+05:30",
      },
    ],
    createdAt: "2026-05-20T09:00:00+05:30",
    updatedAt: "2026-07-02T09:18:00+05:30",
  },
  {
    id: "partner-003",
    name: "University of Mysore",
    city: "Mysore",
    state: "Karnataka",
    primaryContact: {
      name: "Dr. Ramesh Gowda",
      designation: "Registrar",
      phone: "+91 821 241 9001",
      email: "registrar@uni-mysore.ac.in",
    },
    secondaryContact: {
      name: "Lakshmi Devi",
      designation: "PRO",
      phone: "+91 821 241 9002",
      email: "pro@uni-mysore.ac.in",
    },
    eventIds: ["evt-002"],
    relationshipOwner: {
      organization: "K2",
      managerName: "Priya Natarajan",
      managerPhone: "+91 98862 40001",
      managerEmail: "priya.natarajan@k2group.in",
    },
    stage: "Negotiation",
    contactedAt: "2026-06-12",
    contactedNotes: "Call with Registrar.",
    meetingAt: "2026-06-18",
    meetingNotes: "Shared draft University Partner terms.",
    sponsorshipNotes: "University Partner package under review.",
    stageRemarks: [],
    sponsorshipTier: "University Partner",
    deliverables: buildDeliverablesForTier(
      "University Partner",
      mockDeliverableId
    ),
    deliverablesConfirmedAt: "2026-06-22T10:30:00+05:30",
    seminarSlotAssignments: [
      { eventId: "evt-002", seminarId: "sem-002-a", slots: 1 },
      { eventId: "evt-002", seminarId: "sem-002-b", slots: 1 },
    ],
    createdAt: "2026-06-10T12:00:00+05:30",
    updatedAt: "2026-06-22T10:00:00+05:30",
  },
  {
    id: "partner-004",
    name: "KLE Technological University",
    city: "Hubli",
    state: "Karnataka",
    primaryContact: {
      name: "Dr. Ashok Patil",
      designation: "Dean — Student Affairs",
      phone: "+91 836 237 8001",
      email: "ashok.patil@kletech.ac.in",
    },
    secondaryContact: {
      name: "Sneha Desai",
      designation: "Admissions Lead",
      phone: "+91 836 237 8002",
      email: "sneha.desai@kletech.ac.in",
    },
    eventIds: [],
    relationshipOwner: {
      organization: "",
      managerName: "",
      managerPhone: "",
      managerEmail: "",
    },
    stage: "New",
    stageRemarks: [],
    createdAt: "2026-07-08T08:00:00+05:30",
    updatedAt: "2026-07-08T08:00:00+05:30",
  },
  {
    id: "partner-005",
    name: "Jain University",
    city: "Bangalore",
    state: "Karnataka",
    primaryContact: {
      name: "Ms. Divya Krishnan",
      designation: "Head — Branding",
      phone: "+91 98452 33001",
      email: "divya.krishnan@jainuniversity.ac.in",
    },
    secondaryContact: {
      name: "Nikhil Bhat",
      designation: "Associate",
      phone: "+91 98452 33002",
      email: "nikhil.bhat@jainuniversity.ac.in",
    },
    eventIds: [],
    relationshipOwner: {
      organization: "",
      managerName: "",
      managerPhone: "",
      managerEmail: "",
    },
    stage: "Contacted",
    contactedAt: "2026-07-05",
    contactedNotes: "Intro email and WhatsApp sent to branding head.",
    stageRemarks: [
      {
        id: "psr-003",
        fromStage: "New",
        toStage: "Contacted",
        remark: "Intro email and WhatsApp sent to branding head.",
        createdAt: "2026-07-05T14:00:00+05:30",
      },
    ],
    createdAt: "2026-07-04T11:00:00+05:30",
    updatedAt: "2026-07-05T14:00:00+05:30",
  },
  {
    id: "partner-006",
    name: "RV University",
    city: "Bangalore",
    state: "Karnataka",
    primaryContact: {
      name: "Prof. Shalini Iyer",
      designation: "Vice Chancellor Office",
      phone: "+91 98453 44001",
      email: "shalini.iyer@rvu.edu.in",
    },
    secondaryContact: {
      name: "Karthik Hegde",
      designation: "Events Manager",
      phone: "+91 98453 44002",
      email: "karthik.hegde@rvu.edu.in",
    },
    eventIds: [],
    relationshipOwner: {
      organization: "",
      managerName: "",
      managerPhone: "",
      managerEmail: "",
    },
    stage: "Meeting Scheduled",
    contactedAt: "2026-06-20",
    contactedNotes: "Reached VC office — interested in exploring.",
    meetingAt: "2026-07-01",
    meetingNotes: "Campus walkthrough scheduled; proposal pending.",
    meetings: [
      {
        id: "mtg-006-1",
        meetingAt: "2026-07-01T11:00:00",
        notes: "Campus walkthrough scheduled; proposal pending.",
        outcome: "in_discussion",
        followUpNotes:
          "Send revised Knowledge Partner (Gold) deck and confirm VC join on call.",
        followUpAt: "2026-07-20T10:30:00",
        createdAt: "2026-07-01T11:30:00+05:30",
        updatedAt: "2026-07-01T11:30:00+05:30",
      },
    ],
    stageRemarks: [],
    createdAt: "2026-06-18T09:30:00+05:30",
    updatedAt: "2026-07-01T09:30:00+05:30",
  },
  {
    id: "partner-007",
    name: "JSS Science and Technology University",
    city: "Mysore",
    state: "Karnataka",
    primaryContact: {
      name: "Dr. Sunil Prasad",
      designation: "Principal",
      phone: "+91 821 254 8001",
      email: "sunil.prasad@jssstuniv.in",
    },
    secondaryContact: {
      name: "Anusha Murthy",
      designation: "Placement Officer",
      phone: "+91 821 254 8002",
      email: "anusha.murthy@jssstuniv.in",
    },
    eventIds: ["evt-002"],
    relationshipOwner: {
      organization: "K2",
      managerName: "Priya Natarajan",
      managerPhone: "+91 98862 40001",
      managerEmail: "priya.natarajan@k2group.in",
    },
    stage: "Not Proceeding",
    contactedAt: "2026-06-08",
    contactedNotes: "Initial email.",
    meetingAt: "2026-06-20",
    meetingNotes: "Budget discussion.",
    sponsorshipNotes: "Paused for FY.",
    stageRemarks: [
      {
        id: "psr-004",
        fromStage: "Negotiation",
        toStage: "Not Proceeding",
        remark: "Budget freeze for FY — may revisit next edition.",
        createdAt: "2026-06-30T17:00:00+05:30",
      },
    ],
    createdAt: "2026-06-05T10:00:00+05:30",
    updatedAt: "2026-06-30T17:00:00+05:30",
  },
];
