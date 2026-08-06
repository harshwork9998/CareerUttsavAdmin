"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  RELATIONSHIP_OWNER_ORGS,
  SPONSORSHIP_TIERS,
  PARTNER_DELIVERABLE_DEFINITIONS,
  applyTierDefaultsPreservingCustom,
  normalizeDeliverableOptions,
} from "@/constants";
import { isIndianStateOrUt } from "@/lib/indian-states-uts";
import { eventsService, partnersService, spocsService } from "@/services/api";
import { DateField } from "@/features/events/event-datetime-fields";
import {
  BRAND,
  INK,
  LINE,
  PAPER,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import { cn, generateId } from "@/lib/utils";
import type {
  Partner,
  PartnerContact,
  PartnerDeliverable,
  PartnerLifecycleStage,
  PartnerMeetingLog,
  PartnerMeetingOutcome,
  PartnerEventPartnership,
  PartnerSeminarSlotAssignment,
  RelationshipOwner,
  Spoc,
  SponsorshipTier,
} from "@/types";
import { ChapterSeminarSlots } from "@/features/partners/chapter-seminar-slots";
import {
  ChapterCommercials,
  parseAmount,
} from "@/features/partners/chapter-commercials";
import { ChapterPartnerInvite } from "@/features/partners/chapter-partner-invite";
import { ChapterMeetings } from "@/features/partners/chapter-meetings";
import { ChapterEventDeliverables } from "@/features/partners/chapter-event-deliverables";
import {
  CUSTOM_TIER_OPTION,
  isCustomPartnership,
  isStandardSponsorshipTier,
  tierSelectValue,
} from "@/lib/partner-tier";
import {
  allEventsHaveTier,
  assignedSlotsForEvent,
  buildEventPackageSummaries,
  enrichSeminarSlotAssignments,
  hasPartnershipTier,
  partnerHasEventPackages,
  partnerNeedsEventLinkPrune,
  prunePartnerEventLinks,
  removeEventPartnership,
  resolveEventPartnerships,
  seminarSlotBudgetByEvent,
  syncLegacyPartnerFields,
  upsertEventPartnership,
} from "@/lib/partner-event-config";
import {
  generateTempPassword,
  buildPartnerWelcomeEmail,
  isPartnerPortalEmail,
  openPartnerWelcomeGmailCompose,
  resolvePortalLogin,
} from "@/lib/partner-invite";
import {
  getPartnerMeetings,
  hasLoggedMeeting,
  hasWonMeeting,
  syncLegacyMeetingFields,
} from "@/lib/partner-meetings";
import { Button } from "@/components/ui/button";
import { StateUtCombobox } from "@/components/shared/state-ut-combobox";
import {
  FieldError,
  fieldErrorClass,
  fieldErrorSurfaceClass,
  applyFormErrors,
} from "@/components/shared/form-field-error";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CUSTOM_ORG = "__custom__";
const NEW_SPOC = "__new__";
const AUTO_SAVE_DELAY_MS = 1500;

type DraftSaveStatus = "idle" | "pending" | "saved" | "error";

type ChapterId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const CHAPTERS: Array<{
  id: ChapterId;
  title: string;
}> = [
  { id: 1, title: "Partner details" },
  { id: 2, title: "First contact" },
  { id: 3, title: "Meeting scheduled" },
  { id: 4, title: "Partnership details" },
  { id: 5, title: "Deliverables" },
  { id: 6, title: "Seminar slots" },
  { id: 7, title: "Commercials" },
  { id: 8, title: "Partner access" },
];

const emptyContact = (): PartnerContact => ({
  name: "",
  designation: "",
  phone: "",
  email: "",
});

const emptyOwner = (): RelationshipOwner => ({
  organization: "",
  spocId: undefined,
  managerName: "",
  managerPhone: "",
  managerEmail: "",
});

function resolveSpocChoice(
  owner: RelationshipOwner | undefined,
  spocs: Spoc[]
): string {
  if (owner?.spocId && spocs.some((s) => s.id === owner.spocId)) {
    return owner.spocId;
  }
  const email = owner?.managerEmail?.trim().toLowerCase() ?? "";
  if (email) {
    const match = spocs.find((s) => s.email.trim().toLowerCase() === email);
    if (match) return match.id;
  }
  return NEW_SPOC;
}

function canPersistNewPartner(name: string, city: string, state: string) {
  return (
    name.trim().length >= 2 &&
    city.trim().length >= 2 &&
    isIndianStateOrUt(state.trim())
  );
}

function isChapter1Complete(partner: Partner): boolean {
  return Boolean(
    partner.name?.trim() &&
      partner.city?.trim() &&
      partner.state?.trim() &&
      partner.primaryContact?.name?.trim() &&
      partner.primaryContact?.phone?.trim() &&
      partner.primaryContact?.email?.trim() &&
      partner.secondaryContact?.name?.trim() &&
      partner.secondaryContact?.phone?.trim() &&
      partner.secondaryContact?.email?.trim()
  );
}

function maxUnlockedChapter(partner: Partner | null): ChapterId {
  if (!partner) return 1;
  if (!isChapter1Complete(partner)) return 1;
  if (!partner.contactedAt) return 2;
  if (!hasLoggedMeeting(partner)) return 3;
  if (
    !hasWonMeeting(partner) &&
    partner.stage !== "Negotiation" &&
    partner.stage !== "Confirmed"
  ) {
    return 3;
  }
  if (!partnerHasEventPackages(partner)) return 4;
  if (!partner.deliverablesConfirmedAt) return 5;
  if (!partner.seminarSlotsConfirmedAt) return 6;
  if (!partner.commercialsConfirmedAt) return 7;
  return 8;
}

function startingChapter(partner: Partner | null): ChapterId {
  if (!partner) return 1;
  if (!isChapter1Complete(partner)) return 1;
  if (!partner.contactedAt) return 2;
  if (!hasLoggedMeeting(partner)) return 3;
  if (
    !hasWonMeeting(partner) &&
    partner.stage !== "Negotiation" &&
    partner.stage !== "Confirmed"
  ) {
    return 3;
  }
  const eps = resolveEventPartnerships(partner);
  const ownerReady = Boolean(partner.relationshipOwner?.managerName);
  const eventsReady = partner.eventIds.length > 0;
  if (
    !ownerReady ||
    !eventsReady ||
    !eps.every((ep) => hasPartnershipTier(ep))
  ) {
    return 4;
  }
  if (!partner.deliverablesConfirmedAt) return 5;
  if (!partner.seminarSlotsConfirmedAt) return 6;
  if (!partner.commercialsConfirmedAt) return 7;
  return 8;
}

export function PartnerJourney({ partnerId }: { partnerId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isNew = !partnerId;

  const partnerQuery = useQuery({
    queryKey: ["partners", partnerId],
    queryFn: () => partnersService.getById(partnerId!),
    enabled: Boolean(partnerId),
  });

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsService.getAll(),
  });

  const allPartnersQuery = useQuery({
    queryKey: ["partners"],
    queryFn: () => partnersService.getAll(),
  });

  const spocsQuery = useQuery({
    queryKey: ["spocs"],
    queryFn: () => spocsService.getAll(),
  });

  const partner = partnerQuery.data ?? null;
  const spocs = spocsQuery.data ?? [];
  const unlocked = maxUnlockedChapter(isNew ? null : partner);
  const [chapter, setChapter] = useState<ChapterId>(1);

  const formHydratedForRef = useRef<string | null>(null);
  const chapterBootstrappedForRef = useRef<string | null>(null);

  useEffect(() => {
    formHydratedForRef.current = null;
    chapterBootstrappedForRef.current = null;
  }, [partnerId]);

  useEffect(() => {
    if (isNew && !partnerId) {
      setChapter(1);
      return;
    }
    if (!partner) return;
    if (chapterBootstrappedForRef.current === partner.id) return;
    chapterBootstrappedForRef.current = partner.id;
    setChapter(startingChapter(partner));
  }, [isNew, partnerId, partner?.id]);

  const catalogEvents = eventsQuery.data ?? [];

  const partnershipEvents = useMemo(
    () =>
      [...catalogEvents]
        .sort(
          (a, b) =>
            a.city.localeCompare(b.city) || a.title.localeCompare(b.title)
        )
        .map((event) => ({
          id: event.id,
          title: event.title,
          city: event.city,
          venue: event.venue,
        })),
    [catalogEvents]
  );

  const validEventIdsKey = useMemo(
    () => catalogEvents.map((event) => event.id).sort().join(","),
    [catalogEvents]
  );

  const canAdvanceFromMeetings = useMemo(() => {
    if (!partner) return false;
    if (partner.stage === "Negotiation" || partner.stage === "Confirmed") {
      return true;
    }
    return hasWonMeeting(partner);
  }, [partner]);

  const chapter3GateMessage = useMemo(() => {
    if (!partner || chapter !== 3 || canAdvanceFromMeetings) return null;
    if (!hasLoggedMeeting(partner)) {
      return "Log at least one meeting below. Then mark it as Deal won to unlock the next step.";
    }
    return "Mark a meeting as Deal won to unlock partnership details.";
  }, [partner, chapter, canAdvanceFromMeetings]);

  const allPartners = allPartnersQuery.data ?? [];

  // Chapter 1
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [primary, setPrimary] = useState<PartnerContact>(emptyContact());
  const [secondary, setSecondary] = useState<PartnerContact>(emptyContact());

  // Chapter 2
  const [contactedAt, setContactedAt] = useState("");
  const [contactedNotes, setContactedNotes] = useState("");

  // Chapter 3 — meetings managed via ChapterMeetings component

  // Chapter 4
  const [orgChoice, setOrgChoice] = useState<string>("K2");
  const [customOrg, setCustomOrg] = useState("");
  const [spocChoice, setSpocChoice] = useState<string>(NEW_SPOC);
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [eventPartnerships, setEventPartnerships] = useState<
    PartnerEventPartnership[]
  >([]);
  const [sponsorshipNotes, setSponsorshipNotes] = useState("");
  const [slotAssignments, setSlotAssignments] = useState<
    PartnerSeminarSlotAssignment[]
  >([]);
  const [totalAmount, setTotalAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [portalLogin, setPortalLogin] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [notProceedingOpen, setNotProceedingOpen] = useState(false);
  const [notProceedingReason, setNotProceedingReason] = useState("");
  const [notProceedingError, setNotProceedingError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [seminarSlotsUiKey, setSeminarSlotsUiKey] = useState(0);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftStatus, setDraftStatus] = useState<DraftSaveStatus>("idle");

  const lastSavedSnapshotRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExplicitSaveRef = useRef(false);

  useEffect(() => {
    if (!partner) return;
    if (formHydratedForRef.current === partner.id) return;
    formHydratedForRef.current = partner.id;
    setName(partner.name);
    setCity(partner.city);
    setState(partner.state);
    setPrimary({ ...partner.primaryContact });
    setSecondary({ ...partner.secondaryContact });
    setContactedAt(partner.contactedAt ?? "");
    setContactedNotes(partner.contactedNotes ?? "");
    const org = partner.relationshipOwner?.organization ?? "";
    if (
      RELATIONSHIP_OWNER_ORGS.includes(
        org as (typeof RELATIONSHIP_OWNER_ORGS)[number]
      )
    ) {
      setOrgChoice(org);
      setCustomOrg("");
    } else if (org) {
      setOrgChoice(CUSTOM_ORG);
      setCustomOrg(org);
    } else {
      setOrgChoice("K2");
      setCustomOrg("");
    }
    setManagerName(partner.relationshipOwner?.managerName ?? "");
    setManagerPhone(partner.relationshipOwner?.managerPhone ?? "");
    setManagerEmail(partner.relationshipOwner?.managerEmail ?? "");
    setSpocChoice(
      resolveSpocChoice(partner.relationshipOwner, spocsQuery.data ?? [])
    );
    setEventIds([...partner.eventIds]);
    setEventPartnerships(resolveEventPartnerships(partner, generateId));
    setSponsorshipNotes(partner.sponsorshipNotes ?? "");
    setSlotAssignments(
      (partner.seminarSlotAssignments ?? []).map((a) => ({ ...a }))
    );
    setTotalAmount(
      partner.totalAmount != null && partner.totalAmount > 0
        ? String(partner.totalAmount)
        : ""
    );
    setDiscountAmount(
      partner.discountAmount != null && partner.discountAmount > 0
        ? String(partner.discountAmount)
        : ""
    );
    setInviteEmail(
      partner.portalInviteEmail || partner.primaryContact.email || ""
    );
    setPortalLogin(resolvePortalLogin(partner));
    setTempPassword((prev) => partner.portalTempPassword || prev || generateTempPassword());
  }, [partner?.id, partnerQuery.isSuccess, spocsQuery.isSuccess, spocsQuery.data]);

  // Once SPOCs load, resolve dropdown for an already-hydrated partner.
  useEffect(() => {
    if (!partner || !spocsQuery.isSuccess) return;
    if (formHydratedForRef.current !== partner.id) return;
    setSpocChoice((current) => {
      if (current !== NEW_SPOC && spocs.some((s) => s.id === current)) {
        return current;
      }
      return resolveSpocChoice(partner.relationshipOwner, spocs);
    });
  }, [partner, spocs, spocsQuery.isSuccess]);

  const persistCache = (saved: Partner) => {
    queryClient.setQueryData(["partners", saved.id], saved);
    queryClient.setQueryData<Partner[]>(["partners"], (old) => {
      if (!old) return [saved];
      const exists = old.some((p) => p.id === saved.id);
      return exists
        ? old.map((p) => (p.id === saved.id ? saved : p))
        : [saved, ...old];
    });
  };

  useEffect(() => {
    const validIds = new Set(validEventIdsKey.split(",").filter(Boolean));
    if (validIds.size === 0) return;

    setEventIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
    setEventPartnerships((prev) => {
      const next = prev.filter((ep) => validIds.has(ep.eventId));
      return next.length === prev.length ? prev : next;
    });
    setSlotAssignments((prev) => {
      const next = prev.filter((assignment) => validIds.has(assignment.eventId));
      return next.length === prev.length ? prev : next;
    });
  }, [validEventIdsKey]);

  useEffect(() => {
    if (!partner || catalogEvents.length === 0) return;
    const validIds = new Set(catalogEvents.map((event) => event.id));
    if (!partnerNeedsEventLinkPrune(partner, validIds)) return;

    const pruned = prunePartnerEventLinks(partner, validIds);
    void partnersService
      .update(partner.id, {
        eventIds: pruned.eventIds,
        eventPartnerships: pruned.eventPartnerships,
        seminarSlotAssignments: pruned.seminarSlotAssignments,
        sponsorshipTier: pruned.sponsorshipTier,
        deliverables: pruned.deliverables,
      })
      .then((saved) => {
        if (saved) persistCache(saved);
      });
  }, [partner, catalogEvents, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      data: Partial<Partner> &
        Pick<
          Partner,
          | "name"
          | "city"
          | "state"
          | "primaryContact"
          | "secondaryContact"
          | "eventIds"
          | "relationshipOwner"
          | "stage"
          | "stageRemarks"
        >;
      create: boolean;
      advance: boolean;
      isFinal?: boolean;
      markNotProceeding?: boolean;
    }) => {
      if (payload.create) {
        return partnersService.create(payload.data);
      }
      return partnersService.update(partnerId!, payload.data);
    },
    onMutate: () => {
      isExplicitSaveRef.current = true;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    },
    onSuccess: (saved, vars) => {
      if (!saved) {
        toast.error("Could not save this step");
        return;
      }
      persistCache(saved);
      void queryClient.invalidateQueries({ queryKey: ["partners"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (vars.markNotProceeding) {
        toast.success("Marked as not proceeding");
        router.push("/partners");
        return;
      }
      if (vars.create) {
        router.replace(`/partners/${saved.id}`);
        return;
      }
      if (vars.isFinal) {
        toast.success("Welcome email sent with partner login");
        router.push("/partners");
        return;
      }
      if (vars.advance && chapter < 8) {
        setChapter((Math.min(8, chapter + 1) as ChapterId));
      }
    },
    onError: () => toast.error("Could not save this step"),
    onSettled: () => {
      isExplicitSaveRef.current = false;
      const data = buildDraftData();
      if (data) lastSavedSnapshotRef.current = JSON.stringify(data);
    },
  });

  const selectSpoc = (value: string) => {
    setSpocChoice(value);
    if (value === NEW_SPOC) {
      setManagerName("");
      setManagerPhone("");
      setManagerEmail("");
      return;
    }
    const selected = spocs.find((s) => s.id === value);
    if (!selected) return;
    setManagerName(selected.name);
    setManagerPhone(selected.phone);
    setManagerEmail(selected.email);
  };

  const ensureSpocLinked = async (options?: {
    requireComplete?: boolean;
  }): Promise<{ ok: true; spocId?: string } | { ok: false; error: string }> => {
    const name = managerName.trim();
    const phone = managerPhone.trim();
    const email = managerEmail.trim();
    const requireComplete = options?.requireComplete ?? false;
    const complete = Boolean(name && phone && email);

    if (!complete) {
      if (requireComplete) {
        return { ok: false, error: "SPOC name, phone, and email are required" };
      }
      return {
        ok: true,
        spocId: spocChoice !== NEW_SPOC ? spocChoice : undefined,
      };
    }

    try {
      let saved: Spoc;
      if (spocChoice !== NEW_SPOC && spocs.some((s) => s.id === spocChoice)) {
        saved = await spocsService.update(spocChoice, { name, phone, email });
      } else {
        saved = await spocsService.create({ name, phone, email });
        setSpocChoice(saved.id);
      }
      queryClient.setQueryData<Spoc[]>(["spocs"], (old) => {
        const list = old ?? [];
        const exists = list.some((s) => s.id === saved.id);
        const next = exists
          ? list.map((s) => (s.id === saved.id ? saved : s))
          : [saved, ...list];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      void queryClient.invalidateQueries({ queryKey: ["spocs"] });
      return { ok: true, spocId: saved.id };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save SPOC",
      };
    }
  };

  const buildDraftData = ():
    | (Partial<Partner> &
        Pick<
          Partner,
          | "name"
          | "city"
          | "state"
          | "primaryContact"
          | "secondaryContact"
          | "eventIds"
          | "relationshipOwner"
          | "stage"
          | "stageRemarks"
        >)
    | null => {
    if (chapter === 1) {
      const trimmedName = name.trim();
      if (!trimmedName) return null;
      if (isNew && !partnerId && !canPersistNewPartner(trimmedName, city, state)) {
        return null;
      }
      return {
        name: trimmedName,
        city: city.trim(),
        state: state.trim(),
        primaryContact: { ...primary },
        secondaryContact: { ...secondary },
        eventIds: partner?.eventIds ?? [],
        relationshipOwner: partner?.relationshipOwner ?? emptyOwner(),
        stage: partner?.stage ?? "New",
        stageRemarks: partner?.stageRemarks ?? [],
        contactedAt: partner?.contactedAt,
        contactedNotes: partner?.contactedNotes,
        meetingAt: partner?.meetingAt,
        meetingNotes: partner?.meetingNotes,
        meetings: partner?.meetings,
        sponsorshipTier: partner?.sponsorshipTier,
        sponsorshipNotes: partner?.sponsorshipNotes,
        deliverables: partner?.deliverables,
        deliverablesConfirmedAt: partner?.deliverablesConfirmedAt,
        eventPartnerships: partner?.eventPartnerships,
        seminarSlotAssignments: partner?.seminarSlotAssignments,
        seminarSlotsConfirmedAt: partner?.seminarSlotsConfirmedAt,
        totalAmount: partner?.totalAmount,
        discountAmount: partner?.discountAmount,
        netAmount: partner?.netAmount,
        commercialsConfirmedAt: partner?.commercialsConfirmedAt,
        portalLogin: partner?.portalLogin,
        portalTempPassword: partner?.portalTempPassword,
        portalInviteEmail: partner?.portalInviteEmail,
        portalInviteSentAt: partner?.portalInviteSentAt,
      };
    }
    if (!partner) return null;

    if (chapter === 2) {
      return {
        ...partner,
        contactedAt: contactedAt || partner.contactedAt,
        contactedNotes: contactedNotes.trim(),
      };
    }
    if (chapter === 4) {
      const organization =
        orgChoice === CUSTOM_ORG ? customOrg.trim() : orgChoice;
      const activePartnerships = eventPartnerships.filter((ep) =>
        eventIds.includes(ep.eventId)
      );
      const legacy = syncLegacyPartnerFields(activePartnerships);
      return {
        ...partner,
        ...legacy,
        eventPartnerships: activePartnerships,
        relationshipOwner: {
          organization,
          spocId: spocChoice !== NEW_SPOC ? spocChoice : undefined,
          managerName: managerName.trim(),
          managerPhone: managerPhone.trim(),
          managerEmail: managerEmail.trim(),
        },
        sponsorshipNotes: sponsorshipNotes.trim(),
      };
    }
    if (chapter === 5) {
      const activePartnerships = eventPartnerships.filter((ep) =>
        eventIds.includes(ep.eventId)
      );
      const legacy = syncLegacyPartnerFields(activePartnerships);
      return {
        ...partner,
        ...legacy,
        eventPartnerships: activePartnerships,
      };
    }
    if (chapter === 6) {
      const events = eventsQuery.data ?? [];
      return {
        ...partner,
        seminarSlotAssignments: enrichSeminarSlotAssignments(
          slotAssignments.filter((a) => eventIds.includes(a.eventId)),
          events
        ),
      };
    }
    if (chapter === 7) {
      const total = parseAmount(totalAmount);
      const discount = parseAmount(discountAmount);
      const net =
        total > 0 ? Math.max(0, total - discount) : partner.netAmount;
      return {
        ...partner,
        totalAmount: total > 0 ? total : partner.totalAmount,
        discountAmount: discountAmount.trim() ? discount : partner.discountAmount,
        netAmount: net,
      };
    }
    if (chapter === 8) {
      const login = portalLogin.trim().toLowerCase();
      const hasCredentials = Boolean(login && tempPassword.trim());
      return {
        ...partner,
        portalLogin: login || partner.portalLogin,
        portalTempPassword: tempPassword || partner.portalTempPassword,
        portalInviteEmail: inviteEmail.trim() || partner.portalInviteEmail,
        // Activate portal access as soon as credentials exist (email send is separate).
        portalInviteSentAt:
          partner.portalInviteSentAt ??
          (hasCredentials ? new Date().toISOString() : undefined),
      };
    }
    return null;
  };

  type DraftPayload = NonNullable<ReturnType<typeof buildDraftData>>;

  const setDraftStatusBrief = (status: DraftSaveStatus) => {
    if (draftStatusTimerRef.current) clearTimeout(draftStatusTimerRef.current);
    setDraftStatus(status);
    if (status === "saved") {
      draftStatusTimerRef.current = setTimeout(() => {
        setDraftStatus((current) => (current === "saved" ? "idle" : current));
      }, 2000);
    }
  };

  const persistDraft = async (
    data: DraftPayload,
    options?: { create?: boolean }
  ): Promise<Partner | null> => {
    const shouldCreate =
      options?.create ??
      (isNew && chapter === 1 && !partnerId && canPersistNewPartner(data.name, data.city, data.state));
    if (shouldCreate) {
      const saved = await partnersService.create(data);
      if (saved) {
        persistCache(saved);
        // Auto-save create: keep local form state and current chapter
        formHydratedForRef.current = saved.id;
        chapterBootstrappedForRef.current = saved.id;
        lastSavedSnapshotRef.current = JSON.stringify(data);
        router.replace(`/partners/${saved.id}`);
      }
      return saved;
    }
    if (!partnerId) return null;
    const saved = await partnersService.update(partnerId, data);
    if (saved) persistCache(saved);
    return saved;
  };

  const flushDraft = async (then?: () => void) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const data = buildDraftData();
    if (!data) {
      then?.();
      return;
    }

    let payload: DraftPayload = data;
    if (chapter === 4) {
      const linked = await ensureSpocLinked({ requireComplete: false });
      if (!linked.ok) {
        setDraftStatus("error");
        then?.();
        return;
      }
      if (linked.spocId) {
        payload = {
          ...data,
          relationshipOwner: {
            ...data.relationshipOwner!,
            spocId: linked.spocId,
          },
        };
      }
    }

    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSavedSnapshotRef.current) {
      then?.();
      return;
    }

    try {
      setDraftStatusBrief("pending");
      const saved = await persistDraft(payload, {
        create: isNew && chapter === 1 && !partnerId,
      });
      if (saved) {
        lastSavedSnapshotRef.current = snapshot;
        setDraftStatusBrief("saved");
      } else {
        setDraftStatus("error");
      }
    } catch {
      setDraftStatus("error");
    } finally {
      then?.();
    }
  };

  const draftFormSnapshot = useMemo(
    () =>
      JSON.stringify({
        chapter,
        name,
        city,
        state,
        primary,
        secondary,
        contactedAt,
        contactedNotes,
        orgChoice,
        customOrg,
        spocChoice,
        managerName,
        managerPhone,
        managerEmail,
        eventIds,
        eventPartnerships,
        sponsorshipNotes,
        slotAssignments,
        totalAmount,
        discountAmount,
        inviteEmail,
        portalLogin,
        tempPassword,
      }),
    [
      chapter,
      name,
      city,
      state,
      primary,
      secondary,
      contactedAt,
      contactedNotes,
      orgChoice,
      customOrg,
      spocChoice,
      managerName,
      managerPhone,
      managerEmail,
      eventIds,
      eventPartnerships,
      sponsorshipNotes,
      slotAssignments,
      totalAmount,
      discountAmount,
      inviteEmail,
      portalLogin,
      tempPassword,
    ]
  );

  useEffect(() => {
    if (isExplicitSaveRef.current) return;

    const data = buildDraftData();
    if (!data) {
      setDraftStatus("idle");
      return;
    }

    const snapshot = JSON.stringify(data);
    if (snapshot === lastSavedSnapshotRef.current) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setDraftStatus("pending");

    autoSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const saved = await persistDraft(data, {
            create:
              isNew &&
              chapter === 1 &&
              !partnerId &&
              canPersistNewPartner(data.name, data.city, data.state),
          });
          if (saved) {
            lastSavedSnapshotRef.current = snapshot;
            setDraftStatusBrief("saved");
          } else {
            setDraftStatus("error");
          }
        } catch {
          setDraftStatus("error");
        }
      })();
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [draftFormSnapshot, partnerId, isNew, partner?.id]);

  useEffect(() => {
    const baselineTimer = setTimeout(() => {
      const data = buildDraftData();
      if (data) lastSavedSnapshotRef.current = JSON.stringify(data);
    }, 0);
    return () => clearTimeout(baselineTimer);
  }, [partner?.id, chapter]);

  useEffect(() => {
    const canPersist =
      Boolean(partnerId) ||
      (isNew && canPersistNewPartner(name, city, state));
    if (!canPersist) return;

    const flushOnLeave = () => {
      const data = buildDraftData();
      if (!data) return;
      const snapshot = JSON.stringify(data);
      if (snapshot === lastSavedSnapshotRef.current) return;

      const url = partnerId ? `/api/partners/${partnerId}` : "/api/partners";
      const body = JSON.stringify(data);
      if (partnerId) {
        void fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      } else if (
        isNew &&
        chapter === 1 &&
        canPersistNewPartner(data.name, data.city, data.state)
      ) {
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushOnLeave();
    };

    window.addEventListener("pagehide", flushOnLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushOnLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    partnerId,
    isNew,
    chapter,
    draftFormSnapshot,
    name,
  ]);

  const goChapter = (id: ChapterId) => {
    if (id > unlocked) return;
    if (id === chapter) return;
    setErrors({});
    void flushDraft(() => setChapter(id));
  };

  const pushRemark = (
    from: PartnerLifecycleStage,
    to: PartnerLifecycleStage,
    remark: string
  ) => {
    const existing = partner?.stageRemarks ?? [];
    return [
      {
        id: generateId(),
        fromStage: from,
        toStage: to,
        remark,
        createdAt: new Date().toISOString(),
      },
      ...existing,
    ];
  };

  const submitChapter1 = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Required";
    if (!city.trim()) next.city = "Required";
    else if (city.trim().length < 2) next.city = "Enter at least 2 characters";
    if (!state.trim()) next.state = "Required";
    else if (!isIndianStateOrUt(state.trim())) next.state = "Select a state or UT";
    if (!primary.name.trim() || !primary.phone.trim() || !primary.email.trim()) {
      next.primary = "Primary contact needs name, phone & email";
    } else if (!isPartnerPortalEmail(primary.email)) {
      next.primary = "Enter a valid primary contact email";
    }
    if (
      !secondary.name.trim() ||
      !secondary.phone.trim() ||
      !secondary.email.trim()
    ) {
      next.secondary = "Secondary contact needs name, phone & email";
    } else if (!isPartnerPortalEmail(secondary.email)) {
      next.secondary = "Enter a valid secondary contact email";
    }
    if (applyFormErrors(setErrors, next)) return;

    const base = {
      name: name.trim(),
      city: city.trim(),
      state: state.trim(),
      primaryContact: { ...primary },
      secondaryContact: { ...secondary },
      eventIds: partner?.eventIds ?? [],
      relationshipOwner: partner?.relationshipOwner ?? emptyOwner(),
      stage: "New" as const,
      stageRemarks: partner?.stageRemarks ?? [],
      contactedAt: partner?.contactedAt,
      contactedNotes: partner?.contactedNotes,
      meetingAt: partner?.meetingAt,
      meetingNotes: partner?.meetingNotes,
      sponsorshipTier: partner?.sponsorshipTier,
      sponsorshipNotes: partner?.sponsorshipNotes,
      deliverables: partner?.deliverables,
      deliverablesConfirmedAt: partner?.deliverablesConfirmedAt,
      seminarSlotAssignments: partner?.seminarSlotAssignments,
      seminarSlotsConfirmedAt: partner?.seminarSlotsConfirmedAt,
      totalAmount: partner?.totalAmount,
      discountAmount: partner?.discountAmount,
      netAmount: partner?.netAmount,
      commercialsConfirmedAt: partner?.commercialsConfirmedAt,
      portalLogin: partner?.portalLogin,
      portalTempPassword: partner?.portalTempPassword,
      portalInviteEmail: partner?.portalInviteEmail,
      portalInviteSentAt: partner?.portalInviteSentAt,
    };

    saveMutation.mutate({ create: isNew, data: base, advance: true });
  };

  const submitChapter2 = () => {
    if (!partner) return;
    if (!contactedAt) {
      applyFormErrors(setErrors, {
        contactedAt: "Contact date is required",
      });
      return;
    }
    setErrors({});
    saveMutation.mutate({
      create: false,
      advance: true,
      data: {
        ...partner,
        contactedAt,
        contactedNotes: contactedNotes.trim(),
        stage: "Contacted",
        stageRemarks: pushRemark(
          partner.stage,
          "Contacted",
          contactedNotes.trim() || "Marked as contacted"
        ),
      },
    });
  };

  const handleMeetingsPersist = (
    meetings: PartnerMeetingLog[],
    meta: {
      outcome?: PartnerMeetingOutcome;
      lostReason?: string;
      editingMeetingId?: string | null;
    }
  ) => {
    if (!partner) return;

    const legacy = syncLegacyMeetingFields(partner, meetings);
    let stage = partner.stage;
    let stageRemarks = partner.stageRemarks;
    let notProceedingAt = partner.notProceedingAt;
    let notProceedingReason = partner.notProceedingReason;

    const previousMeeting = meta.editingMeetingId
      ? getPartnerMeetings(partner).find((m) => m.id === meta.editingMeetingId)
      : undefined;
    const previousOutcome = previousMeeting?.outcome;
    const isNewMeeting = !meta.editingMeetingId;
    const outcomeChanged = Boolean(
      meta.outcome && meta.outcome !== previousOutcome
    );
    const shouldApplyOutcome = isNewMeeting || outcomeChanged;

    if (meta.outcome === "won" && shouldApplyOutcome) {
      stage = "Negotiation";
      stageRemarks = pushRemark(
        partner.stage,
        "Negotiation",
        "Deal won from meeting"
      );
    } else if (meta.outcome === "lost" && shouldApplyOutcome) {
      stage = "Not Proceeding";
      notProceedingAt = new Date().toISOString();
      notProceedingReason = meta.lostReason;
      stageRemarks = pushRemark(
        partner.stage,
        "Not Proceeding",
        meta.lostReason || "Deal lost"
      );
    } else if (
      isNewMeeting &&
      meetings.length > 0 &&
      (partner.stage === "Contacted" || partner.stage === "New")
    ) {
      stage = "Meeting Scheduled";
      stageRemarks = pushRemark(
        partner.stage,
        "Meeting Scheduled",
        "Meeting logged"
      );
    } else if (meta.outcome === "in_discussion" && shouldApplyOutcome) {
      stage = "Meeting Scheduled";
    }

    saveMutation.mutate({
      create: false,
      advance: meta.outcome === "won" && shouldApplyOutcome,
      data: {
        ...partner,
        ...legacy,
        meetings,
        stage,
        stageRemarks,
        notProceedingAt,
        notProceedingReason,
      },
    });
  };

  const submitChapter3 = () => {
    if (!partner) return;
    if (canAdvanceFromMeetings) {
      setErrors({});
      setChapter(4);
      return;
    }
    if (!hasLoggedMeeting(partner)) {
      toast.error("Log at least one meeting first");
      return;
    }
    toast.error("Mark a meeting as Deal won to continue");
  };

  const submitChapter4 = async () => {
    if (!partner) return;
    const organization =
      orgChoice === CUSTOM_ORG ? customOrg.trim() : orgChoice;
    const next: Record<string, string> = {};
    if (!organization) next.org = "Required";
    if (!managerName.trim()) next.mName = "Required";
    if (!managerPhone.trim()) next.mPhone = "Required";
    if (!managerEmail.trim()) next.mEmail = "Required";
    if (eventIds.length === 0) next.events = "Select at least one event";
    if (!allEventsHaveTier(eventPartnerships, eventIds)) {
      next.tier = "Select a tier for each selected event";
    }
    for (const eventId of eventIds) {
      const ep = eventPartnerships.find((p) => p.eventId === eventId);
      if (ep && isCustomPartnership(ep) && !ep.customTierLabel?.trim()) {
        next[`tierName-${eventId}`] = "Enter the custom tier name";
      }
    }
    if (applyFormErrors(setErrors, next)) return;

    const linked = await ensureSpocLinked({ requireComplete: true });
    if (!linked.ok) {
      toast.error(linked.error);
      return;
    }

    const activePartnerships = eventPartnerships.filter((ep) =>
      eventIds.includes(ep.eventId)
    );
    const legacy = syncLegacyPartnerFields(activePartnerships);

    saveMutation.mutate({
      create: false,
      advance: true,
      data: {
        ...partner,
        ...legacy,
        eventPartnerships: activePartnerships,
        seminarSlotAssignments: (partner.seminarSlotAssignments ?? []).filter(
          (a) => eventIds.includes(a.eventId)
        ),
        relationshipOwner: {
          organization,
          spocId: linked.spocId,
          managerName: managerName.trim(),
          managerPhone: managerPhone.trim(),
          managerEmail: managerEmail.trim(),
        },
        sponsorshipNotes: sponsorshipNotes.trim(),
        stage: "Negotiation",
        stageRemarks: pushRemark(
          partner.stage,
          "Negotiation",
          sponsorshipNotes.trim() || "Partnership terms captured"
        ),
      },
    });
  };

  const submitChapter5 = () => {
    if (!partner) return;
    const next: Record<string, string> = {};
    const activePartnerships = eventPartnerships
      .filter((ep) => eventIds.includes(ep.eventId))
      .map((ep) => ({
        ...ep,
        deliverables: normalizeDeliverableOptions(
          ep.deliverables,
          ep.sponsorshipTier
        ),
      }));

    for (const ep of activePartnerships) {
      const customPackage = isCustomPartnership(ep);
      for (const item of ep.deliverables) {
        if (!item.included) continue;
        if (customPackage) {
          if (item.isCustom && !item.label.trim()) {
            next[`${ep.eventId}-${item.id}`] = "Label required";
          } else if (!item.isCustom) {
            const def = PARTNER_DELIVERABLE_DEFINITIONS.find(
              (d) => d.key === item.key
            );
            if (def?.options?.length && !item.option) {
              next[`${ep.eventId}-${item.id}`] = "Select an option";
            }
          }
          continue;
        }
        const def = PARTNER_DELIVERABLE_DEFINITIONS.find(
          (d) => d.key === item.key
        );
        if (def?.options?.length && !item.option) {
          next[`${ep.eventId}-${item.id}`] = "Select an option";
        }
        if (item.isCustom && !item.label.trim()) {
          next[`${ep.eventId}-${item.id}`] = "Label required";
        }
      }
      if (customPackage) {
        const hasDeliverable = ep.deliverables.some(
          (d) => d.included && d.label.trim()
        );
        if (!hasDeliverable && (ep.seminarSlotCount ?? 0) <= 0) {
          next[`custom-package-${ep.eventId}`] =
            "Add at least one deliverable or seminar slot";
        }
      }
      if (ep.seminarSlotCount < 0) {
        next[`seminar-slots-${ep.eventId}`] = "Invalid slot count";
      }
    }

    if (applyFormErrors(setErrors, next)) return;

    setEventPartnerships((prev) => {
      const activeIds = new Set(eventIds);
      const normalizedByEvent = new Map(
        activePartnerships.map((ep) => [ep.eventId, ep])
      );
      return prev.map((ep) =>
        activeIds.has(ep.eventId)
          ? normalizedByEvent.get(ep.eventId) ?? ep
          : ep
      );
    });

    const legacy = syncLegacyPartnerFields(activePartnerships);

    saveMutation.mutate({
      create: false,
      advance: true,
      data: {
        ...partner,
        ...legacy,
        eventPartnerships: activePartnerships,
        deliverablesConfirmedAt: new Date().toISOString(),
      },
    });
  };

  const submitChapter6 = () => {
    if (!partner) return;
    const next: Record<string, string> = {};
    const activePartnerships = eventPartnerships.filter((ep) =>
      eventIds.includes(ep.eventId)
    );

    for (const ep of activePartnerships) {
      const assigned = assignedSlotsForEvent(slotAssignments, ep.eventId);
      if (assigned > ep.seminarSlotCount) {
        next[`event-${ep.eventId}`] =
          `Pick at most ${ep.seminarSlotCount} seminar seat${ep.seminarSlotCount === 1 ? "" : "s"}`;
      }
    }

    if (applyFormErrors(setErrors, next)) return;

    saveMutation.mutate({
      create: false,
      advance: true,
      data: {
        ...partner,
        seminarSlotAssignments: enrichSeminarSlotAssignments(
          slotAssignments,
          eventsQuery.data ?? []
        ),
        seminarSlotsConfirmedAt: new Date().toISOString(),
      },
    });
  };

  const submitChapter7 = () => {
    if (!partner) return;
    const total = parseAmount(totalAmount);
    const discount = parseAmount(discountAmount);
    const next: Record<string, string> = {};
    if (total <= 0) next.totalAmount = "Enter total amount";
    if (discount < 0) next.discountAmount = "Invalid discount";
    if (discount > total) next.discountAmount = "Discount cannot exceed total";
    if (applyFormErrors(setErrors, next)) return;

    const net = Math.max(0, total - discount);
    saveMutation.mutate({
      create: false,
      advance: true,
      data: {
        ...partner,
        totalAmount: total,
        discountAmount: discount,
        netAmount: net,
        commercialsConfirmedAt: new Date().toISOString(),
      },
    });
  };

  const submitChapter8 = () => {
    if (!partner) return;
    const email = inviteEmail.trim();
    const login = portalLogin.trim().toLowerCase();
    const next: Record<string, string> = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.inviteEmail = "Enter a valid email";
    }
    if (!login || !isPartnerPortalEmail(login)) {
      next.login = "Login must be a valid email";
    }
    if (!tempPassword.trim()) next.password = "Password required";
    if (applyFormErrors(setErrors, next)) return;

    void (async () => {
      try {
        const welcomeEmail = await buildPartnerWelcomeEmail({
          partnerName: partner.name,
          login,
          temporaryPassword: tempPassword,
        });

        const pasteMode = await openPartnerWelcomeGmailCompose({
          to: email,
          subject: welcomeEmail.subject,
          html: welcomeEmail.html,
          plainText: welcomeEmail.plainText,
        });

        toast.success(
          pasteMode === "html"
            ? "Gmail opened — press Ctrl+V in the message body to paste the formatted email"
            : "Gmail opened — formatted email copied as plain text; paste into the message body"
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not prepare the welcome email"
        );
        return;
      }

      saveMutation.mutate({
        create: false,
        advance: false,
        isFinal: true,
        data: {
          ...partner,
          portalLogin: login,
          portalTempPassword: tempPassword,
          portalInviteEmail: email,
          portalInviteSentAt: new Date().toISOString(),
          stage: partner.stage === "Not Proceeding" ? partner.stage : "Confirmed",
          stageRemarks: pushRemark(
            partner.stage,
            partner.stage === "Not Proceeding" ? "Not Proceeding" : "Confirmed",
            `Partner access email prepared for ${email}`
          ),
        },
      });
    })();
  };

  const confirmNotProceeding = () => {
    if (!partner) return;
    const reason = notProceedingReason.trim();
    if (!reason) {
      setNotProceedingError("Reason is required");
      return;
    }
    setNotProceedingError("");
    saveMutation.mutate({
      create: false,
      advance: false,
      markNotProceeding: true,
      data: {
        ...partner,
        stage: "Not Proceeding",
        notProceedingAt: new Date().toISOString(),
        notProceedingReason: reason,
        stageRemarks: pushRemark(partner.stage, "Not Proceeding", reason),
      },
    });
  };

  const canMarkNotProceeding =
    Boolean(partner) &&
    chapter >= 2 &&
    partner?.stage !== "Not Proceeding";

  const canResetPage = Boolean(partner) && chapter >= 2;

  const resetCurrentPage = () => {
    if (!partner) return;
    setErrors({});

    if (chapter === 2) {
      setContactedAt(partner.contactedAt ?? "");
      setContactedNotes(partner.contactedNotes ?? "");
    } else if (chapter === 3) {
      // Meetings reset handled in ChapterMeetings composer
    } else if (chapter === 4) {
      const org = partner.relationshipOwner?.organization ?? "";
      if (
        RELATIONSHIP_OWNER_ORGS.includes(
          org as (typeof RELATIONSHIP_OWNER_ORGS)[number]
        )
      ) {
        setOrgChoice(org);
        setCustomOrg("");
      } else if (org) {
        setOrgChoice(CUSTOM_ORG);
        setCustomOrg(org);
      } else {
        setOrgChoice("K2");
        setCustomOrg("");
      }
      setManagerName(partner.relationshipOwner?.managerName ?? "");
      setManagerPhone(partner.relationshipOwner?.managerPhone ?? "");
      setManagerEmail(partner.relationshipOwner?.managerEmail ?? "");
      setSpocChoice(resolveSpocChoice(partner.relationshipOwner, spocs));
      setEventIds([...partner.eventIds]);
      setEventPartnerships(resolveEventPartnerships(partner, generateId));
      setSponsorshipNotes(partner.sponsorshipNotes ?? "");
    } else if (chapter === 5) {
      setEventPartnerships(resolveEventPartnerships(partner, generateId));
    } else if (chapter === 6) {
      setSlotAssignments([]);
      setSeminarSlotsUiKey((key) => key + 1);
    } else if (chapter === 7) {
      setTotalAmount("");
      setDiscountAmount("");
    } else if (chapter === 8) {
      if (!partner) return;
      setInviteEmail(
        partner.portalInviteEmail ||
          (isPartnerPortalEmail(partner.primaryContact.email)
            ? partner.primaryContact.email
            : "")
      );
      setPortalLogin(resolvePortalLogin(partner));
      setTempPassword(generateTempPassword());
    }

    setResetOpen(false);
    toast.success("Page reset");
  };

  if (partnerId && partnerQuery.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Skeleton className="h-[420px] rounded-2xl" />
        <Skeleton className="h-[520px] rounded-2xl" />
      </div>
    );
  }

  if (partnerId && (partnerQuery.isError || !partner)) {
    return (
      <div className="rounded-2xl border p-10 text-center" style={{ borderColor: LINE.subtle }}>
        <p className="text-lg font-semibold" style={{ color: INK.primary }}>
          Journey not found
        </p>
        <Button className="mt-4" variant="outline" onClick={() => router.push("/partners")}>
          Back to partners
        </Button>
      </div>
    );
  }

  const goToPartnersOverview = () => {
    void flushDraft(() => router.push("/partners"));
  };

  const meta = CHAPTERS.find((c) => c.id === chapter)!;

  return (
    <div className="pb-12">
      <div className="mb-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={goToPartnersOverview}
          className="h-9 gap-1.5 rounded-full border-brand-900/15 bg-white px-3 font-medium text-brand-950 shadow-sm hover:bg-brand-50/80"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to partners</span>
          <span className="sm:hidden">Back</span>
        </Button>
      </div>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: BRAND[700] }}
          >
            Step {chapter} of 8
          </p>
          <h1
            className={cn(displayClass, "mt-1 text-3xl font-bold tracking-tight sm:text-4xl")}
            style={{ color: INK.primary }}
          >
            {partner?.name || name.trim() || "New partner"}
          </h1>
          <p className="mt-1 text-sm" style={{ color: INK.muted }}>
            {meta.title}
          </p>
        </div>
        {draftStatus !== "idle" ? (
          <p
            className="text-sm tabular-nums"
            style={{
              color:
                draftStatus === "error"
                  ? "#b91c1c"
                  : draftStatus === "saved"
                    ? INK.muted
                    : INK.secondary,
            }}
            aria-live="polite"
          >
            {draftStatus === "pending"
              ? "Saving…"
              : draftStatus === "saved"
                ? "Draft saved"
                : "Couldn't save draft"}
          </p>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          className="h-fit rounded-2xl border p-5 lg:sticky lg:top-6"
          style={{
            borderColor: LINE.subtle,
            background: `linear-gradient(180deg, ${PAPER.surface} 0%, ${PAPER.muted} 100%)`,
          }}
          aria-label="Journey steps"
        >
          <div className="relative isolate">
            {CHAPTERS.length > 1 ? (
              <span
                className="pointer-events-none absolute bottom-4 left-4 top-4 -z-10 w-px -translate-x-1/2"
                style={{ background: LINE.strong }}
                aria-hidden
              />
            ) : null}
            <ol className="space-y-5">
            {CHAPTERS.map((c) => {
              const isLocked = c.id > unlocked;
              const isDone =
                c.id < unlocked ||
                (c.id === 8 && Boolean(partner?.portalInviteSentAt));
              const isActive = c.id === chapter;
              return (
                <li
                  key={c.id}
                  className={cn(
                    "grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3",
                    isLocked && "cursor-not-allowed"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => goChapter(c.id)}
                    disabled={isLocked}
                    title={
                      isLocked
                        ? c.id === 4 && partner && !canAdvanceFromMeetings
                          ? "Mark a meeting as Deal won first"
                          : "Complete earlier steps to unlock"
                        : undefined
                    }
                    className="contents"
                  >
                    <span
                      className="relative z-[1] flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                      style={{
                        background: isActive || isDone ? BRAND[700] : PAPER.surface,
                        color: isActive || isDone ? "#fff" : INK.muted,
                        border: `2px solid ${isActive ? BRAND[700] : isDone ? BRAND[700] : LINE.strong}`,
                        boxShadow: isActive
                          ? `0 0 0 3px ${BRAND[50]}`
                          : undefined,
                      }}
                    >
                      {isLocked ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : isDone && !isActive ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        c.id
                      )}
                    </span>
                    <span
                      className={cn(
                        "flex min-h-8 items-center text-sm font-semibold leading-tight",
                        isLocked && "opacity-45"
                      )}
                      style={{ color: isActive ? INK.primary : INK.secondary }}
                    >
                      {c.title}
                    </span>
                  </button>
                </li>
              );
            })}
            </ol>
          </div>
        </nav>

        <div
          className="overflow-hidden rounded-3xl border"
          style={{
            borderColor: LINE.subtle,
            background: PAPER.surface,
            boxShadow: "0 24px 60px -36px rgba(18, 35, 63, 0.35)",
          }}
        >
          <div className="relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={chapter}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      background: BRAND[700],
                      color: "#fff",
                      boxShadow: `0 0 0 4px ${BRAND[50]}`,
                    }}
                  >
                    {chapter}
                  </span>
                  <h2
                    className={cn(displayClass, "text-2xl font-bold sm:text-3xl")}
                    style={{ color: INK.primary }}
                  >
                    {meta.title}
                  </h2>
                </div>

                {chapter === 1 && (
                  <ChapterPartnerDetails
                    name={name}
                    setName={setName}
                    city={city}
                    setCity={setCity}
                    state={state}
                    setState={setState}
                    primary={primary}
                    setPrimary={setPrimary}
                    secondary={secondary}
                    setSecondary={setSecondary}
                    errors={errors}
                  />
                )}

                {chapter === 2 && (
                  <ChapterContacted
                    contactedAt={contactedAt}
                    setContactedAt={setContactedAt}
                    contactedNotes={contactedNotes}
                    setContactedNotes={setContactedNotes}
                    errors={errors}
                  />
                )}

                {chapter === 3 && partner && (
                  <>
                    {chapter3GateMessage ? (
                      <div
                        className="mb-5 rounded-xl border px-4 py-3 text-sm"
                        style={{
                          borderColor: "rgba(176,125,42,0.28)",
                          background: "rgba(176,125,42,0.08)",
                          color: "#8A6A2F",
                        }}
                      >
                        {chapter3GateMessage}
                      </div>
                    ) : null}
                    <ChapterMeetings
                      partner={partner}
                      onPersist={handleMeetingsPersist}
                      saving={saveMutation.isPending}
                    />
                  </>
                )}

                {chapter === 4 && (
                  <ChapterPartnership
                    orgChoice={orgChoice}
                    setOrgChoice={setOrgChoice}
                    customOrg={customOrg}
                    setCustomOrg={setCustomOrg}
                    spocChoice={spocChoice}
                    spocs={spocs}
                    onSpocChoiceChange={selectSpoc}
                    managerName={managerName}
                    setManagerName={setManagerName}
                    managerPhone={managerPhone}
                    setManagerPhone={setManagerPhone}
                    managerEmail={managerEmail}
                    setManagerEmail={setManagerEmail}
                    eventIds={eventIds}
                    setEventIds={setEventIds}
                    eventPartnerships={eventPartnerships}
                    setEventPartnerships={setEventPartnerships}
                    events={partnershipEvents}
                    sponsorshipNotes={sponsorshipNotes}
                    setSponsorshipNotes={setSponsorshipNotes}
                    errors={errors}
                  />
                )}

                {chapter === 5 && (
                  <ChapterEventDeliverables
                    events={eventsQuery.data ?? []}
                    eventPartnerships={eventPartnerships.filter((ep) =>
                      eventIds.includes(ep.eventId)
                    )}
                    setEventPartnerships={setEventPartnerships}
                    errors={errors}
                  />
                )}

                {chapter === 6 && partner && (
                  <ChapterSeminarSlots
                    key={seminarSlotsUiKey}
                    partnerId={partner.id}
                    eventIds={eventIds}
                    events={eventsQuery.data ?? []}
                    allPartners={allPartners}
                    assignments={slotAssignments}
                    setAssignments={setSlotAssignments}
                    slotBudgetByEvent={seminarSlotBudgetByEvent(
                      eventPartnerships.filter((ep) =>
                        eventIds.includes(ep.eventId)
                      )
                    )}
                    seatPickMode
                    errors={errors}
                  />
                )}

                {chapter === 7 && (
                  <ChapterCommercials
                    totalAmount={totalAmount}
                    setTotalAmount={setTotalAmount}
                    discountAmount={discountAmount}
                    setDiscountAmount={setDiscountAmount}
                    eventPartnerships={eventPartnerships.filter((ep) =>
                      eventIds.includes(ep.eventId)
                    )}
                    slotAssignments={slotAssignments}
                    events={eventsQuery.data ?? []}
                    errors={errors}
                  />
                )}

                {chapter === 8 && partner && (
                  <ChapterPartnerInvite
                    inviteEmail={inviteEmail}
                    setInviteEmail={setInviteEmail}
                    login={portalLogin}
                    setLogin={setPortalLogin}
                    temporaryPassword={tempPassword}
                    onRegeneratePassword={() =>
                      setTempPassword(generateTempPassword())
                    }
                    errors={errors}
                  />
                )}

                <div
                  className="flex flex-wrap items-center justify-between gap-3 border-t pt-6"
                  style={{ borderColor: LINE.subtle }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saveMutation.isPending}
                      onClick={() => {
                        if (chapter === 1) {
                          if (isNew && name.trim()) {
                            void flushDraft(() => router.push("/partners"));
                            return;
                          }
                          router.push("/partners");
                          return;
                        }
                        setErrors({});
                        void flushDraft(() =>
                          setChapter((chapter - 1) as ChapterId)
                        );
                      }}
                    >
                      {chapter === 1 ? "Back to partners" : "Back"}
                    </Button>
                    {canResetPage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setResetOpen(true)}
                      >
                        Reset
                      </Button>
                    ) : null}
                    {canMarkNotProceeding ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          setNotProceedingReason("");
                          setNotProceedingError("");
                          setNotProceedingOpen(true);
                        }}
                      >
                        Not proceeding
                      </Button>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    disabled={
                      saveMutation.isPending ||
                      (chapter === 3 && !canAdvanceFromMeetings)
                    }
                    onClick={() => {
                      if (chapter === 1) submitChapter1();
                      else if (chapter === 2) submitChapter2();
                      else if (chapter === 3) submitChapter3();
                      else if (chapter === 4) submitChapter4();
                      else if (chapter === 5) submitChapter5();
                      else if (chapter === 6) submitChapter6();
                      else if (chapter === 7) submitChapter7();
                      else submitChapter8();
                    }}
                    className="gap-2 rounded-full px-6 text-white"
                    style={{ backgroundColor: BRAND[700] }}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {chapter === 8
                      ? "Send email & finish"
                      : chapter === 3 && canAdvanceFromMeetings
                        ? "Continue to partnership details"
                        : "Save & next"}
                    {!saveMutation.isPending && chapter < 8 ? (
                      <ArrowRight className="h-4 w-4" />
                    ) : null}
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Dialog
        open={resetOpen}
        onOpenChange={(open) => {
          if (saveMutation.isPending) return;
          setResetOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={cn(displayClass, "text-2xl")}>
              Reset changes
            </DialogTitle>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => setResetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saveMutation.isPending}
              onClick={resetCurrentPage}
              className="gap-2"
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={notProceedingOpen}
        onOpenChange={(open) => {
          if (saveMutation.isPending) return;
          setNotProceedingOpen(open);
          if (!open) {
            setNotProceedingReason("");
            setNotProceedingError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={cn(displayClass, "text-2xl")}>
              Not proceeding
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="not-proceeding-reason">Reason</Label>
            <Textarea
              id="not-proceeding-reason"
              rows={4}
              value={notProceedingReason}
              onChange={(e) => {
                setNotProceedingReason(e.target.value);
                if (notProceedingError) setNotProceedingError("");
              }}
              aria-invalid={Boolean(notProceedingError)}
            />
            {notProceedingError ? (
              <p className="text-xs text-destructive">{notProceedingError}</p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => setNotProceedingOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saveMutation.isPending}
              onClick={confirmNotProceeding}
              className="gap-2"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Mark as not proceeding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function contactFieldHasError(
  error: string | undefined,
  key: keyof PartnerContact,
  value: PartnerContact
): boolean {
  if (!error || key === "designation") return false;
  if (key === "email" && error.toLowerCase().includes("valid")) {
    return !value.email.trim() || !isPartnerPortalEmail(value.email);
  }
  return !value[key]?.trim();
}

function ContactFields({
  title,
  value,
  onChange,
  error,
}: {
  title: string;
  value: PartnerContact;
  onChange: (v: PartnerContact) => void;
  error?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold" style={{ color: INK.primary }}>
        {title}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["name", "Name"],
            ["designation", "Designation"],
            ["phone", "Phone"],
            ["email", "Email"],
          ] as const
        ).map(([key, label]) => {
          const fieldError = contactFieldHasError(error, key, value);
          return (
          <div
            key={key}
            className="space-y-1.5"
            data-field-error={fieldError ? "true" : undefined}
          >
            <Label>{label}</Label>
            <Input
              type={key === "email" ? "email" : "text"}
              className={fieldErrorClass(fieldError)}
              aria-invalid={fieldError}
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          </div>
        );
        })}
      </div>
    </div>
  );
}

function ChapterPartnerDetails(props: {
  name: string;
  setName: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  primary: PartnerContact;
  setPrimary: (v: PartnerContact) => void;
  secondary: PartnerContact;
  setSecondary: (v: PartnerContact) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2" data-field-error={props.errors.name ? "true" : undefined}>
          <Label>Partner name</Label>
          <Input
            className={fieldErrorClass(props.errors.name)}
            aria-invalid={Boolean(props.errors.name)}
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
          />
          <FieldError message={props.errors.name} />
        </div>
        <div className="space-y-1.5" data-field-error={props.errors.city ? "true" : undefined}>
          <Label>City</Label>
          <Input
            className={fieldErrorClass(props.errors.city)}
            aria-invalid={Boolean(props.errors.city)}
            value={props.city}
            onChange={(e) => props.setCity(e.target.value)}
            placeholder="e.g. Bengaluru"
          />
          <FieldError message={props.errors.city} />
        </div>
        <div className="space-y-1.5" data-field-error={props.errors.state ? "true" : undefined}>
          <Label>State / UT</Label>
          <StateUtCombobox
            value={props.state}
            onChange={props.setState}
            error={props.errors.state}
          />
          <FieldError message={props.errors.state} />
        </div>
      </div>
      <div className="border-t pt-6" style={{ borderColor: LINE.subtle }}>
        <ContactFields
          title="Primary contact"
          value={props.primary}
          onChange={props.setPrimary}
          error={props.errors.primary}
        />
        <FieldError message={props.errors.primary} />
      </div>
      <div className="border-t pt-6" style={{ borderColor: LINE.subtle }}>
        <ContactFields
          title="Secondary contact"
          value={props.secondary}
          onChange={props.setSecondary}
          error={props.errors.secondary}
        />
        <FieldError message={props.errors.secondary} />
      </div>
    </div>
  );
}

function ChapterContacted(props: {
  contactedAt: string;
  setContactedAt: (v: string) => void;
  contactedNotes: string;
  setContactedNotes: (v: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="space-y-1.5" data-field-error={props.errors.contactedAt ? "true" : undefined}>
        <Label>Contact date</Label>
        <DateField
          value={props.contactedAt}
          onChange={props.setContactedAt}
          error={props.errors.contactedAt}
        />
        <FieldError message={props.errors.contactedAt} />
      </div>
      <div className="space-y-1.5">
        <Label>
          Notes{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          rows={4}
          value={props.contactedNotes}
          onChange={(e) => props.setContactedNotes(e.target.value)}
        />
      </div>
    </div>
  );
}

function ChapterPartnership(props: {
  orgChoice: string;
  setOrgChoice: (v: string) => void;
  customOrg: string;
  setCustomOrg: (v: string) => void;
  spocChoice: string;
  spocs: Spoc[];
  onSpocChoiceChange: (v: string) => void;
  managerName: string;
  setManagerName: (v: string) => void;
  managerPhone: string;
  setManagerPhone: (v: string) => void;
  managerEmail: string;
  setManagerEmail: (v: string) => void;
  eventIds: string[];
  setEventIds: (v: string[] | ((p: string[]) => string[])) => void;
  eventPartnerships: PartnerEventPartnership[];
  setEventPartnerships: (
    v:
      | PartnerEventPartnership[]
      | ((p: PartnerEventPartnership[]) => PartnerEventPartnership[])
  ) => void;
  events: Array<{ id: string; title: string; city: string; venue?: string }>;
  sponsorshipNotes: string;
  setSponsorshipNotes: (v: string) => void;
  errors: Record<string, string>;
}) {
  const partnershipForEvent = (eventId: string) =>
    props.eventPartnerships.find((ep) => ep.eventId === eventId);

  const setTierForEvent = (eventId: string, value: string) => {
    props.setEventPartnerships((prev) => {
      const existing = partnershipForEvent(eventId);
      if (value === CUSTOM_TIER_OPTION) {
        return upsertEventPartnership(
          prev,
          eventId,
          {
            sponsorshipTier: undefined,
            customTierLabel: existing?.customTierLabel ?? "",
            deliverables: (existing?.deliverables ?? []).filter((d) => d.isCustom),
            seminarSlotCount: existing?.seminarSlotCount ?? 0,
          },
          generateId
        );
      }
      if (!isStandardSponsorshipTier(value)) return prev;
      const nextDeliverables = applyTierDefaultsPreservingCustom(
        value,
        existing?.deliverables,
        generateId
      );
      return upsertEventPartnership(
        prev,
        eventId,
        {
          sponsorshipTier: value,
          customTierLabel: undefined,
          deliverables: nextDeliverables,
          seminarSlotCount: existing?.seminarSlotCount ?? 0,
        },
        generateId
      );
    });
  };

  const setCustomTierLabel = (eventId: string, label: string) => {
    props.setEventPartnerships((prev) =>
      upsertEventPartnership(
        prev,
        eventId,
        {
          sponsorshipTier: undefined,
          customTierLabel: label,
          deliverables: (prev.find((ep) => ep.eventId === eventId)?.deliverables ?? []).filter(
            (d) => d.isCustom
          ),
          seminarSlotCount:
            prev.find((ep) => ep.eventId === eventId)?.seminarSlotCount ?? 0,
        },
        generateId
      )
    );
  };

  const toggleEvent = (id: string, checked: boolean) => {
    if (checked) {
      props.setEventIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      props.setEventPartnerships((eps) => {
        if (eps.some((ep) => ep.eventId === id)) return eps;
        return upsertEventPartnership(
          eps,
          id,
          {
            deliverables: [],
            seminarSlotCount: 0,
          },
          generateId
        );
      });
      return;
    }
    props.setEventIds((prev) => prev.filter((x) => x !== id));
    props.setEventPartnerships((eps) => removeEventPartnership(eps, id));
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: BRAND[700] }}>
          Relationship owner
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2" data-field-error={props.errors.org ? "true" : undefined}>
            <Label>Closing organization</Label>
            <Select value={props.orgChoice} onValueChange={props.setOrgChoice}>
              <SelectTrigger className={fieldErrorClass(props.errors.org)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_OWNER_ORGS.map((org) => (
                  <SelectItem key={org} value={org}>
                    {org}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_ORG}>Create / enter company…</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={props.errors.org} />
          </div>
          {props.orgChoice === CUSTOM_ORG && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Company name</Label>
              <Input
                value={props.customOrg}
                onChange={(e) => props.setCustomOrg(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>SPOC</Label>
            <Select
              value={props.spocChoice}
              onValueChange={props.onSpocChoiceChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select or create a SPOC" />
              </SelectTrigger>
              <SelectContent>
                {props.spocs.map((spoc) => (
                  <SelectItem key={spoc.id} value={spoc.id}>
                    {spoc.name}
                    {spoc.email ? ` · ${spoc.email}` : ""}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_SPOC}>Create new SPOC…</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pick a saved SPOC for this partner, or create one to reuse later.
            </p>
          </div>
          <div className="space-y-1.5" data-field-error={props.errors.mName ? "true" : undefined}>
            <Label>SPOC name</Label>
            <Input
              className={fieldErrorClass(props.errors.mName)}
              aria-invalid={Boolean(props.errors.mName)}
              value={props.managerName}
              onChange={(e) => props.setManagerName(e.target.value)}
            />
            <FieldError message={props.errors.mName} />
          </div>
          <div className="space-y-1.5" data-field-error={props.errors.mPhone ? "true" : undefined}>
            <Label>Contact number</Label>
            <Input
              className={fieldErrorClass(props.errors.mPhone)}
              aria-invalid={Boolean(props.errors.mPhone)}
              value={props.managerPhone}
              onChange={(e) => props.setManagerPhone(e.target.value)}
            />
            <FieldError message={props.errors.mPhone} />
          </div>
          <div className="space-y-1.5 sm:col-span-2" data-field-error={props.errors.mEmail ? "true" : undefined}>
            <Label>Official email</Label>
            <Input
              type="email"
              className={fieldErrorClass(props.errors.mEmail)}
              aria-invalid={Boolean(props.errors.mEmail)}
              value={props.managerEmail}
              onChange={(e) => props.setManagerEmail(e.target.value)}
            />
            <FieldError message={props.errors.mEmail} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: BRAND[700] }}>
          Events they will sponsor
        </h3>
        <div
          className={fieldErrorSurfaceClass(
            props.errors.events || props.errors.tier,
            "space-y-1 rounded-xl border p-3"
          )}
          style={!(props.errors.events || props.errors.tier) ? { borderColor: LINE.subtle, background: PAPER.muted } : undefined}
          data-field-error={props.errors.events || props.errors.tier ? "true" : undefined}
        >
          {props.events.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No events yet.</p>
          ) : (
            props.events.map((event) => {
              const selected = props.eventIds.includes(event.id);
              return (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/70 sm:flex-nowrap"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(v) => toggleEvent(event.id, v === true)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {event.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {event.city}
                        {event.venue ? ` · ${event.venue}` : ""}
                      </span>
                    </span>
                  </label>
                  {selected ? (
                    <div
                      className="w-full space-y-2 sm:w-[min(100%,280px)] sm:shrink-0"
                      data-field-error={
                        props.errors[`tierName-${event.id}`] ||
                        props.errors.tier
                          ? "true"
                          : undefined
                      }
                    >
                      <Select
                        value={tierSelectValue(partnershipForEvent(event.id)) || undefined}
                        onValueChange={(v) => setTierForEvent(event.id, v)}
                      >
                        <SelectTrigger
                          className={fieldErrorClass(
                            props.errors[`tierName-${event.id}`] || props.errors.tier
                          )}
                        >
                          <SelectValue placeholder="Sponsorship tier" />
                        </SelectTrigger>
                        <SelectContent>
                          {SPONSORSHIP_TIERS.map((tier) => (
                            <SelectItem key={tier} value={tier}>
                              {tier}
                            </SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_TIER_OPTION}>
                            Custom / other partnership…
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {partnershipForEvent(event.id) &&
                      isCustomPartnership(partnershipForEvent(event.id)!) ? (
                        <Input
                          className={fieldErrorClass(
                            props.errors[`tierName-${event.id}`],
                            "h-9"
                          )}
                          aria-invalid={Boolean(
                            props.errors[`tierName-${event.id}`]
                          )}
                          placeholder="e.g. Title Sponsor, Bronze Partner"
                          value={
                            partnershipForEvent(event.id)?.customTierLabel ?? ""
                          }
                          onChange={(e) =>
                            setCustomTierLabel(event.id, e.target.value)
                          }
                        />
                      ) : null}
                      <FieldError message={props.errors[`tierName-${event.id}`]} />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <FieldError message={props.errors.events} />
        <FieldError message={props.errors.tier} />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: BRAND[700] }}>
          Discussion notes
        </h3>
        <div className="space-y-1.5">
          <Label>
            Notes{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            rows={4}
            value={props.sponsorshipNotes}
            onChange={(e) => props.setSponsorshipNotes(e.target.value)}
          />
        </div>
      </section>
    </div>
  );
}

