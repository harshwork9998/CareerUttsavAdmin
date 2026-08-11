"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Mic2,
  Save,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { eventsService, partnersService, seminarsService } from "@/services/api";
import {
  constrainIndianMobileTyping,
  INDIAN_MOBILE_ERROR,
  isValidIndianMobile,
} from "@/lib/indian-mobile";
import { applySeminarSpeakerMobileValidation } from "@/lib/seminar-roster-mobile";
import { rosterSessionKey } from "@/lib/seminar-roster-links";
import {
  blockedPartnerForSeat,
  buildPartnerSeatBlocks,
  createSpeakerFromPartnerBlock,
  mergeRosterWithPartnerSeats,
  panelistSeatsFromRoster,
  resetBlockedSeat,
  rosterFromPanelistSeats,
  seatDisplayMetaForSeminar,
} from "@/lib/seminar-partner-seats";
import {
  BRAND,
  INK,
  LINE,
  PAPER,
  displayClass,
  sectionMotion,
  surface,
} from "@/features/dashboard/dashboard-ui";
import { SeminarRoundTable } from "@/features/seminars/seminar-round-table";
import { cn, generateId } from "@/lib/utils";
import type {
  Event,
  EventSeminar,
  SeminarSessionRoster,
  SeminarSpeaker,
  SeminarSpeakerStatus,
} from "@/types";
import {
  ErrorState,
  PageHeader,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SeminarRow = {
  key: string;
  event: Event;
  seminar: EventSeminar;
  roster: SeminarSessionRoster | null;
};

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDay(date: string) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function emptyRoster(eventId: string, seminarId: string): SeminarSessionRoster {
  return {
    seminarId,
    eventId,
    moderator: null,
    panelists: [],
    topicBrief: "",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

export function SeminarsView() {
  const queryClient = useQueryClient();
  const [eventFilter, setEventFilter] = useState("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(
    null
  );
  const [draft, setDraft] = useState<SeminarSessionRoster | null>(null);
  const [panelistSeats, setPanelistSeats] = useState<
    (SeminarSpeaker | null)[]
  >([]);

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsService.getAll(),
  });
  const partnersQuery = useQuery({
    queryKey: ["partners"],
    queryFn: () => partnersService.getAll(),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const rostersQuery = useQuery({
    queryKey: ["seminar-rosters"],
    queryFn: () => seminarsService.getRosters(),
  });

  const events = useMemo(
    () =>
      [...(eventsQuery.data ?? [])].sort(
        (a, b) =>
          a.city.localeCompare(b.city) || a.title.localeCompare(b.title)
      ),
    [eventsQuery.data]
  );
  const rosters = rostersQuery.data ?? [];
  const partners = useMemo(
    () => partnersQuery.data ?? [],
    [partnersQuery.data]
  );

  const validEventIdsKey = useMemo(
    () => events.map((event) => event.id).sort().join(","),
    [events]
  );

  useEffect(() => {
    const validIds = new Set(validEventIdsKey.split(",").filter(Boolean));
    if (validIds.size === 0) {
      setEventFilter("all");
      return;
    }
    if (eventFilter !== "all" && !validIds.has(eventFilter)) {
      setEventFilter("all");
    }
  }, [validEventIdsKey, eventFilter]);

  const rows = useMemo(() => {
    const rosterBySession = new Map(
      rosters.map((roster) => [
        rosterSessionKey(roster.eventId, roster.seminarId),
        roster,
      ])
    );
    const list: SeminarRow[] = [];
    for (const event of events) {
      for (const seminar of event.seminars ?? []) {
        list.push({
          key: rosterSessionKey(event.id, seminar.id),
          event,
          seminar,
          roster:
            rosterBySession.get(rosterSessionKey(event.id, seminar.id)) ??
            null,
        });
      }
    }
    return list;
  }, [events, rosters]);

  const filteredRows = useMemo(() => {
    if (eventFilter === "all") return rows;
    return rows.filter((r) => r.event.id === eventFilter);
  }, [rows, eventFilter]);

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !filteredRows.some((r) => r.key === selectedKey)) {
      setSelectedKey(filteredRows[0].key);
    }
  }, [filteredRows, selectedKey]);

  const active = filteredRows.find((r) => r.key === selectedKey) ?? null;

  const activeSessionKey = active?.key ?? null;
  const activeEventId = active?.event.id;
  const activeSeminarId = active?.seminar.id;
  const activePanelistSlots = active?.seminar.panelistSlots ?? 0;
  const activeRoster = active?.roster ?? null;
  const activeRosterUpdatedAt = active?.roster?.updatedAt ?? null;

  const partnersSyncKey = useMemo(
    () =>
      partners
        .map(
          (partner) =>
            `${partner.id}:${partner.updatedAt}:${partner.seminarSlotsConfirmedAt ?? ""}:${JSON.stringify(partner.seminarSlotAssignments ?? [])}:${JSON.stringify(partner.portalSeminarSpeakers ?? [])}`
        )
        .sort()
        .join("|"),
    [partners]
  );

  const lastHydratedKeyRef = useRef<string | null>(null);
  const lastSessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeSessionKey || !activeEventId || !activeSeminarId) {
      lastHydratedKeyRef.current = null;
      setDraft(null);
      setPanelistSeats([]);
      return;
    }

    const hydrationKey = `${activeSessionKey}|${activeRosterUpdatedAt ?? "none"}|${activePanelistSlots}|${partnersSyncKey}`;
    if (lastHydratedKeyRef.current === hydrationKey) {
      return;
    }
    lastHydratedKeyRef.current = hydrationKey;

    const merged = mergeRosterWithPartnerSeats(
      activeRoster,
      activeEventId,
      activeSeminarId,
      activePanelistSlots,
      partners
    );
    setDraft(merged);
    setPanelistSeats(
      panelistSeatsFromRoster(merged, activePanelistSlots)
    );

    if (lastSessionKeyRef.current !== activeSessionKey) {
      setSelectedSpeakerId(null);
      lastSessionKeyRef.current = activeSessionKey;
    }
  }, [
    activeSessionKey,
    activeEventId,
    activeSeminarId,
    activePanelistSlots,
    activeRoster,
    activeRosterUpdatedAt,
    partnersSyncKey,
    partners,
  ]);

  const partnerBlocks = useMemo(() => {
    if (!activeEventId || !activeSeminarId || !activePanelistSlots) return [];
    return buildPartnerSeatBlocks(
      partners,
      activeEventId,
      activeSeminarId,
      activePanelistSlots
    );
  }, [
    activeEventId,
    activeSeminarId,
    activePanelistSlots,
    partnersSyncKey,
    partners,
  ]);

  const seatMeta = useMemo(
    () => seatDisplayMetaForSeminar(panelistSeats, partnerBlocks),
    [panelistSeats, partnerBlocks]
  );

  const saveMutation = useMutation({
    mutationFn: (roster: SeminarSessionRoster) =>
      seminarsService.upsertRoster(roster),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seminar-rosters"] });
      toast.success("Seminar roster saved");
    },
    onError: () => toast.error("Could not save roster"),
  });

  const handleSaveRoster = () => {
    if (!draft || !active) return;
    const roster = rosterFromPanelistSeats(draft, panelistSeats);
    const checked = applySeminarSpeakerMobileValidation(
      roster,
      activeRoster ?? undefined
    );
    if (!checked.ok) {
      toast.error(checked.error);
      return;
    }
    saveMutation.mutate(checked.roster);
  };

  const selectedSpeaker: SeminarSpeaker | null = useMemo(() => {
    if (!selectedSpeakerId) return null;
    if (draft?.moderator?.id === selectedSpeakerId) return draft.moderator;
    for (const speaker of panelistSeats) {
      if (speaker?.id === selectedSpeakerId) return speaker;
    }
    return null;
  }, [draft, panelistSeats, selectedSpeakerId]);

  const selectedSeatIndex = useMemo(() => {
    if (!selectedSpeakerId) return null;
    const idx = panelistSeats.findIndex(
      (speaker) => speaker?.id === selectedSpeakerId
    );
    return idx >= 0 ? idx : null;
  }, [panelistSeats, selectedSpeakerId]);

  const selectedSeatBlock =
    selectedSeatIndex != null
      ? blockedPartnerForSeat(partnerBlocks, selectedSeatIndex)
      : undefined;

  const selectedSpeakerBaselineContact = useMemo(() => {
    if (!selectedSpeakerId || !activeRoster) return "";
    if (activeRoster.moderator?.id === selectedSpeakerId) {
      return activeRoster.moderator.contact ?? "";
    }
    return (
      activeRoster.panelists.find((p) => p.id === selectedSpeakerId)?.contact ??
      ""
    );
  }, [activeRoster, selectedSpeakerId]);

  const selectedSpeakerMobileError = useMemo(() => {
    if (!selectedSpeaker) return undefined;
    const contact = selectedSpeaker.contact?.trim() ?? "";
    if (!contact) return undefined;
    if (contact === selectedSpeakerBaselineContact.trim()) return undefined;
    if (!isValidIndianMobile(contact)) return INDIAN_MOBILE_ERROR;
    return undefined;
  }, [selectedSpeaker, selectedSpeakerBaselineContact]);

  const isModeratorSelected =
    Boolean(draft?.moderator) && draft?.moderator?.id === selectedSpeakerId;

  const updateSpeaker = (patch: Partial<SeminarSpeaker>) => {
    if (!selectedSpeakerId) return;
    if (draft?.moderator?.id === selectedSpeakerId) {
      setDraft({
        ...draft,
        moderator: { ...draft.moderator!, ...patch },
      });
      return;
    }
    setPanelistSeats((prev) =>
      prev.map((speaker) =>
        speaker?.id === selectedSpeakerId ? { ...speaker, ...patch } : speaker
      )
    );
  };

  const setPanelistAtSeat = (seatIndex: number, speaker: SeminarSpeaker) => {
    setPanelistSeats((prev) => {
      const next = [...prev];
      while (next.length <= seatIndex) next.push(null);
      next[seatIndex] = { ...speaker, seatIndex };
      return next;
    });
  };

  const addPanelist = () => {
    if (!active) return;
    const nextIndex = panelistSeats.findIndex((speaker) => !speaker);
    if (nextIndex === -1) {
      toast.error("All panelist seats are filled");
      return;
    }
    const block = blockedPartnerForSeat(partnerBlocks, nextIndex);
    const speaker: SeminarSpeaker = block
      ? createSpeakerFromPartnerBlock(block)
      : {
          id: generateId(),
          name: "",
          organization: "",
          designation: "",
          status: "Invited",
          seatIndex: nextIndex,
        };
    setPanelistAtSeat(nextIndex, speaker);
    setSelectedSpeakerId(speaker.id);
  };

  const openPanelistSeat = (
    seatIndex: number,
    speaker: SeminarSpeaker | null
  ) => {
    if (speaker) {
      setSelectedSpeakerId(speaker.id);
      return;
    }
    const block = blockedPartnerForSeat(partnerBlocks, seatIndex);
    if (block) {
      const placeholder = createSpeakerFromPartnerBlock(block);
      setPanelistAtSeat(seatIndex, placeholder);
      setSelectedSpeakerId(placeholder.id);
      return;
    }
    const newSpeaker: SeminarSpeaker = {
      id: generateId(),
      name: "",
      organization: "",
      designation: "",
      status: "Invited",
      seatIndex,
    };
    setPanelistAtSeat(seatIndex, newSpeaker);
    setSelectedSpeakerId(newSpeaker.id);
  };

  const ensureModerator = () => {
    if (!draft) return;
    if (draft.moderator) {
      setSelectedSpeakerId(draft.moderator.id);
      return;
    }
    const speaker: SeminarSpeaker = {
      id: generateId(),
      name: "",
      organization: "",
      designation: "",
      status: "Invited",
    };
    setDraft({ ...draft, moderator: speaker });
    setSelectedSpeakerId(speaker.id);
  };

  const handleSeatClick = (
    seat:
      | { kind: "moderator"; speaker: SeminarSpeaker | null }
      | { kind: "panelist"; index: number; speaker: SeminarSpeaker | null }
  ) => {
    if (seat.kind === "moderator") {
      ensureModerator();
      return;
    }
    openPanelistSeat(seat.index, seat.speaker);
  };

  const removeSelected = () => {
    if (!selectedSpeakerId) return;

    if (draft?.moderator?.id === selectedSpeakerId) {
      setDraft({ ...draft, moderator: null });
      setSelectedSpeakerId(null);
      return;
    }

    if (selectedSeatIndex == null) {
      setSelectedSpeakerId(null);
      return;
    }

    const reset = resetBlockedSeat(partnerBlocks, selectedSeatIndex);
    setPanelistSeats((prev) => {
      const next = [...prev];
      next[selectedSeatIndex] = reset;
      return next;
    });
    setSelectedSpeakerId(null);
  };

  const isLoading =
    eventsQuery.isLoading || rostersQuery.isLoading || partnersQuery.isLoading;
  const isError =
    eventsQuery.isError || rostersQuery.isError || partnersQuery.isError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seminars"
        description="Stage the conversation — moderators, panelists, and seats for every session."
      />

      {isError ? (
        <ErrorState
          title="Couldn’t load seminars"
          message="Something went wrong while fetching events and rosters."
          onRetry={() => {
            void eventsQuery.refetch();
            void rostersQuery.refetch();
            void partnersQuery.refetch();
          }}
        />
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Skeleton className="min-h-[70vh] rounded-[28px]" />
          <Skeleton className="min-h-[70vh] rounded-[28px]" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={eventFilter === "all"}
              onClick={() => setEventFilter("all")}
              label="All events"
            />
            {events.map((event) => (
              <FilterChip
                key={event.id}
                active={eventFilter === event.id}
                onClick={() => setEventFilter(event.id)}
                label={`${event.city} · ${event.title}`}
              />
            ))}
          </div>

          <div className="grid items-stretch gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside
              className={cn(
                surface.opening,
                // On lg+: match right column height; list scrolls inside
                "flex max-h-[70vh] flex-col overflow-hidden p-0 lg:h-0 lg:max-h-none lg:min-h-full"
              )}
            >
              <div
                className="shrink-0 border-b px-4 py-4"
                style={{ borderColor: LINE.subtle }}
              >
                <p
                  className="text-[11px] font-semibold tracking-[0.16em] uppercase"
                  style={{ color: BRAND[700] }}
                >
                  Sessions
                </p>
                <p className="mt-0.5 text-sm" style={{ color: INK.secondary }}>
                  {filteredRows.length} seminar
                  {filteredRows.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
                {filteredRows.map((row) => {
                  const activeRow = row.key === selectedKey;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => setSelectedKey(row.key)}
                      className={cn(
                        "w-full rounded-2xl px-3.5 py-3.5 text-left transition-colors",
                        !activeRow && "hover:bg-black/[0.03]"
                      )}
                      style={{
                        background: activeRow ? BRAND[50] : undefined,
                      }}
                    >
                      <p
                        className="line-clamp-2 text-sm font-semibold leading-snug"
                        style={{ color: INK.primary }}
                      >
                        {row.seminar.title}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: INK.muted }}>
                        {row.event.city} · {formatDay(row.seminar.date)} · Audi{" "}
                        {row.seminar.hall}
                      </p>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="min-w-0 space-y-4">
              {!active || !draft ? (
                <div
                  className={cn(
                    surface.opening,
                    "flex min-h-[60vh] items-center justify-center p-8 text-center"
                  )}
                >
                  <div>
                    <Mic2
                      className="mx-auto h-10 w-10"
                      style={{ color: INK.muted }}
                    />
                    <p
                      className="mt-3 text-sm font-semibold"
                      style={{ color: INK.primary }}
                    >
                      Select a seminar
                    </p>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active.key}
                    {...sectionMotion}
                    className="space-y-4"
                  >
                    <header
                      className="relative overflow-hidden rounded-[28px] border px-5 py-5 sm:px-7"
                      style={{
                        borderColor: LINE.subtle,
                        background: `radial-gradient(120% 90% at 0% 0%, ${BRAND[50]} 0%, ${PAPER.surface} 55%)`,
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-2xl space-y-2">
                          <p
                            className="text-[11px] font-semibold tracking-[0.16em] uppercase"
                            style={{ color: BRAND[700] }}
                          >
                            {active.event.title}
                          </p>
                          <h2
                            className={cn(
                              displayClass,
                              "text-2xl font-bold sm:text-3xl"
                            )}
                            style={{ color: INK.primary }}
                          >
                            {active.seminar.title}
                          </h2>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Meta
                              icon={CalendarDays}
                              label={formatDay(active.seminar.date)}
                            />
                            <Meta
                              icon={Clock3}
                              label={`${formatTime(active.seminar.startTime)} – ${formatTime(active.seminar.endTime)}`}
                            />
                            <Meta
                              icon={MapPin}
                              label={`Audi ${active.seminar.hall} · ${active.event.city}`}
                            />
                            <Meta
                              icon={Users}
                              label={`${active.seminar.panelistSlots} panel seats`}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="gap-2 text-white hover:opacity-90"
                          style={{ backgroundColor: BRAND[700] }}
                          disabled={saveMutation.isPending}
                          onClick={handleSaveRoster}
                        >
                          <Save className="h-4 w-4" />
                          Save roster
                        </Button>
                      </div>
                    </header>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div
                        className="rounded-[28px] border px-4 py-6 sm:px-6"
                        style={{
                          borderColor: LINE.subtle,
                          background: PAPER.surface,
                          boxShadow:
                            "0 1px 2px rgba(18,35,63,0.04), 0 12px 32px rgba(18,35,63,0.06)",
                        }}
                      >
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p
                              className="text-[11px] font-semibold tracking-[0.16em] uppercase"
                              style={{ color: INK.muted }}
                            >
                              Stage
                            </p>
                            <p
                              className="text-sm"
                              style={{ color: INK.secondary }}
                            >
                              Tap a seat to view or edit — partner seats are reserved from the partnership journey
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={ensureModerator}
                            >
                              <UserRound className="mr-1.5 h-3.5 w-3.5" />
                              {draft.moderator ? "Edit moderator" : "Add moderator"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addPanelist}
                            >
                              <Users className="mr-1.5 h-3.5 w-3.5" />
                              Add panelist
                            </Button>
                          </div>
                        </div>

                        <SeminarRoundTable
                          moderator={draft.moderator}
                          panelistSeats={panelistSeats}
                          totalSlots={active.seminar.panelistSlots}
                          selectedId={selectedSpeakerId}
                          seatMeta={seatMeta}
                          onSeatClick={handleSeatClick}
                        />
                      </div>

                      <div
                        className="rounded-[24px] border p-4"
                        style={{
                          borderColor: LINE.subtle,
                          background: PAPER.surface,
                        }}
                      >
                        <p
                          className="text-[11px] font-semibold tracking-[0.14em] uppercase"
                          style={{ color: INK.muted }}
                        >
                          Session brief
                        </p>
                        <div className="mt-3 space-y-3">
                          <div className="space-y-1.5">
                            <Label>Topic brief</Label>
                            <Textarea
                              rows={3}
                              value={draft.topicBrief ?? ""}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  topicBrief: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Internal notes</Label>
                            <Textarea
                              rows={2}
                              value={draft.notes ?? ""}
                              onChange={(e) =>
                                setDraft({ ...draft, notes: e.target.value })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Dialog
                      open={Boolean(selectedSpeaker)}
                      onOpenChange={(open) => {
                        if (!open) setSelectedSpeakerId(null);
                      }}
                    >
                      <DialogContent
                        className="w-[min(calc(100vw-2rem),320px)] max-w-[320px] gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-xl sm:rounded-2xl"
                        overlayClassName="bg-black/25 backdrop-blur-sm"
                        style={{
                          background: PAPER.surface,
                          boxShadow:
                            "0 8px 30px rgba(18,35,63,0.14), 0 2px 8px rgba(18,35,63,0.06)",
                        }}
                      >
                        <div
                          className="relative max-h-[min(72vh,440px)] overflow-y-auto px-4 pb-4 pt-4"
                        >
                          <DialogHeader className="space-y-0.5 pr-7 text-left">
                            <DialogTitle
                              className="text-sm font-semibold leading-snug"
                              style={{ color: INK.primary }}
                            >
                              {selectedSpeaker?.name?.trim() ||
                                selectedSeatBlock?.partner.name ||
                                "Seat"}
                            </DialogTitle>
                            <DialogDescription
                              className="text-[11px] font-medium leading-snug"
                              style={{ color: INK.muted }}
                            >
                              {isModeratorSelected ? "Moderator" : "Panelist"}
                              {selectedSeatBlock
                                ? ` · ${selectedSeatBlock.partner.name}`
                                : selectedSpeaker?.organization
                                  ? ` · ${selectedSpeaker.organization}`
                                  : ""}
                            </DialogDescription>
                          </DialogHeader>

                          {selectedSpeaker ? (
                            <div className="mt-3 space-y-2.5">
                              <div className="space-y-1">
                                <Label className="text-xs">Name</Label>
                                <Input
                                  className="h-9 text-sm"
                                  value={selectedSpeaker.name}
                                  onChange={(e) =>
                                    updateSpeaker({ name: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Mobile Number</Label>
                                <Input
                                  type="tel"
                                  inputMode="numeric"
                                  autoComplete="tel"
                                  className="h-9 text-sm"
                                  value={selectedSpeaker.contact ?? ""}
                                  onChange={(e) =>
                                    updateSpeaker({
                                      contact: constrainIndianMobileTyping(
                                        e.target.value
                                      ),
                                    })
                                  }
                                  placeholder="10-digit mobile number"
                                  aria-invalid={Boolean(
                                    selectedSpeakerMobileError
                                  )}
                                />
                                {selectedSpeakerMobileError ? (
                                  <p className="text-xs text-destructive">
                                    {selectedSpeakerMobileError}
                                  </p>
                                ) : null}
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Designation</Label>
                                <Input
                                  className="h-9 text-sm"
                                  value={selectedSpeaker.designation ?? ""}
                                  onChange={(e) =>
                                    updateSpeaker({
                                      designation: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Introduction</Label>
                                <Textarea
                                  rows={2}
                                  className="min-h-[56px] resize-y text-sm"
                                  value={selectedSpeaker.introduction ?? ""}
                                  onChange={(e) =>
                                    updateSpeaker({
                                      introduction: e.target.value,
                                    })
                                  }
                                  placeholder="Speaker bio from partner portal"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Institution</Label>
                                <Input
                                  className="h-9 text-sm"
                                  value={selectedSpeaker.organization}
                                  onChange={(e) =>
                                    updateSpeaker({
                                      organization: e.target.value,
                                    })
                                  }
                                  placeholder="Sponsoring partner"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Status</Label>
                                <Select
                                  value={selectedSpeaker.status}
                                  onValueChange={(v) =>
                                    updateSpeaker({
                                      status: v as SeminarSpeakerStatus,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Confirmed">
                                      Confirmed
                                    </SelectItem>
                                    <SelectItem value="Invited">
                                      Invited
                                    </SelectItem>
                                    <SelectItem value="Tentative">
                                      Tentative
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-1 w-full text-destructive hover:text-destructive"
                                onClick={removeSelected}
                              >
                                {selectedSeatBlock
                                  ? "Clear seat details"
                                  : "Remove from stage"}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </motion.div>
                </AnimatePresence>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors"
      style={{
        background: active ? BRAND[700] : PAPER.surface,
        color: active ? "#fff" : INK.secondary,
        border: `1px solid ${active ? BRAND[700] : LINE.subtle}`,
      }}
    >
      {label}
    </button>
  );
}

function Meta({
  icon: Icon,
  label,
}: {
  icon: typeof CalendarDays;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{
        background: PAPER.muted,
        color: INK.secondary,
        border: `1px solid ${LINE.subtle}`,
      }}
    >
      <Icon className="h-3 w-3" style={{ color: BRAND[700] }} />
      {label}
    </span>
  );
}
