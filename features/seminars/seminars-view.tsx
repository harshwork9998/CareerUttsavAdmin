"use client";

import { useEffect, useMemo, useState } from "react";
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

import { eventsService, seminarsService } from "@/services/api";
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

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsService.getAll(),
  });
  const rostersQuery = useQuery({
    queryKey: ["seminar-rosters"],
    queryFn: () => seminarsService.getRosters(),
  });

  const events = eventsQuery.data ?? [];
  const rosters = rostersQuery.data ?? [];

  const rows = useMemo(() => {
    const rosterBySeminar = new Map(rosters.map((r) => [r.seminarId, r]));
    const list: SeminarRow[] = [];
    for (const event of events) {
      for (const seminar of event.seminars ?? []) {
        list.push({
          key: `${event.id}:${seminar.id}`,
          event,
          seminar,
          roster: rosterBySeminar.get(seminar.id) ?? null,
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

  useEffect(() => {
    if (!active) {
      setDraft(null);
      setSelectedSpeakerId(null);
      return;
    }
    setDraft(
      active.roster
        ? structuredClone(active.roster)
        : emptyRoster(active.event.id, active.seminar.id)
    );
    setSelectedSpeakerId(null);
  }, [active?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: (roster: SeminarSessionRoster) =>
      seminarsService.upsertRoster(roster),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seminar-rosters"] });
      toast.success("Seminar roster saved");
    },
    onError: () => toast.error("Could not save roster"),
  });

  const selectedSpeaker: SeminarSpeaker | null = useMemo(() => {
    if (!draft || !selectedSpeakerId) return null;
    if (draft.moderator?.id === selectedSpeakerId) return draft.moderator;
    return draft.panelists.find((p) => p.id === selectedSpeakerId) ?? null;
  }, [draft, selectedSpeakerId]);

  const isModeratorSelected =
    Boolean(draft?.moderator) && draft?.moderator?.id === selectedSpeakerId;

  const updateSpeaker = (patch: Partial<SeminarSpeaker>) => {
    if (!draft || !selectedSpeakerId) return;
    if (draft.moderator?.id === selectedSpeakerId) {
      setDraft({
        ...draft,
        moderator: { ...draft.moderator, ...patch },
      });
      return;
    }
    setDraft({
      ...draft,
      panelists: draft.panelists.map((p) =>
        p.id === selectedSpeakerId ? { ...p, ...patch } : p
      ),
    });
  };

  const addPanelist = () => {
    if (!draft || !active) return;
    if (draft.panelists.length >= active.seminar.panelistSlots) {
      toast.error("All panelist seats are filled");
      return;
    }
    const speaker: SeminarSpeaker = {
      id: generateId(),
      name: "New panelist",
      organization: "",
      designation: "",
      status: "Invited",
    };
    setDraft({ ...draft, panelists: [...draft.panelists, speaker] });
    setSelectedSpeakerId(speaker.id);
  };

  /** Open an existing panelist, or create one in the next empty seat. */
  const openPanelistSeat = (speaker: SeminarSpeaker | null) => {
    if (speaker) {
      setSelectedSpeakerId(speaker.id);
      return;
    }
    addPanelist();
  };

  const ensureModerator = () => {
    if (!draft) return;
    if (draft.moderator) {
      setSelectedSpeakerId(draft.moderator.id);
      return;
    }
    const speaker: SeminarSpeaker = {
      id: generateId(),
      name: "New moderator",
      organization: "Career Uttsav",
      designation: "Moderator",
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
    openPanelistSeat(seat.speaker);
  };

  const removeSelected = () => {
    if (!draft || !selectedSpeakerId) return;
    if (draft.moderator?.id === selectedSpeakerId) {
      setDraft({ ...draft, moderator: null });
    } else {
      setDraft({
        ...draft,
        panelists: draft.panelists.filter((p) => p.id !== selectedSpeakerId),
      });
    }
    setSelectedSpeakerId(null);
  };

  const isLoading = eventsQuery.isLoading || rostersQuery.isLoading;
  const isError = eventsQuery.isError || rostersQuery.isError;

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
                label={event.city}
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
                          onClick={() => draft && saveMutation.mutate(draft)}
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
                              Tap a person to view or edit their details
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
                          panelists={draft.panelists}
                          totalSlots={active.seminar.panelistSlots}
                          selectedId={selectedSpeakerId}
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
                        className="max-w-[340px] gap-0 overflow-visible rounded-[28px] border-0 p-0 shadow-xl sm:rounded-[28px]"
                        overlayClassName="bg-black/25 backdrop-blur-sm"
                        style={{
                          background: PAPER.surface,
                          boxShadow:
                            "0 8px 30px rgba(18,35,63,0.14), 0 2px 8px rgba(18,35,63,0.06)",
                        }}
                      >
                        {/* Bubble tail */}
                        <div
                          className="pointer-events-none absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45"
                          style={{
                            background: PAPER.surface,
                            boxShadow: "2px 2px 4px rgba(18,35,63,0.06)",
                          }}
                          aria-hidden
                        />

                        <div className="relative px-5 pb-5 pt-5">
                          <DialogHeader className="space-y-1 pr-6 text-left">
                            <DialogTitle
                              className="text-base font-semibold"
                              style={{ color: INK.primary }}
                            >
                              {selectedSpeaker?.name || "Seat"}
                            </DialogTitle>
                            <DialogDescription
                              className="text-xs font-medium"
                              style={{ color: INK.muted }}
                            >
                              {isModeratorSelected ? "Moderator" : "Panelist"}
                              {selectedSpeaker?.organization
                                ? ` · ${selectedSpeaker.organization}`
                                : ""}
                            </DialogDescription>
                          </DialogHeader>

                          {selectedSpeaker ? (
                            <div className="mt-4 space-y-3">
                              <div className="space-y-1.5">
                                <Label>Name</Label>
                                <Input
                                  value={selectedSpeaker.name}
                                  onChange={(e) =>
                                    updateSpeaker({ name: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Institution</Label>
                                <Input
                                  value={selectedSpeaker.organization}
                                  onChange={(e) =>
                                    updateSpeaker({
                                      organization: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Designation</Label>
                                <Input
                                  value={selectedSpeaker.designation ?? ""}
                                  onChange={(e) =>
                                    updateSpeaker({
                                      designation: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Status</Label>
                                <Select
                                  value={selectedSpeaker.status}
                                  onValueChange={(v) =>
                                    updateSpeaker({
                                      status: v as SeminarSpeakerStatus,
                                    })
                                  }
                                >
                                  <SelectTrigger>
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
                                className="w-full text-destructive hover:text-destructive"
                                onClick={removeSelected}
                              >
                                Remove from stage
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
