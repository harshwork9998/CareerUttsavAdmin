"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Check,
  Download,
  ExternalLink,
  File,
  FileText,
  ImageIcon,
  Link2,
  MessageSquare,
  Mic2,
  Type,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  BRAND,
  INK,
  LINE,
  PAPER,
  STATUS,
  displayClass,
} from "@/features/dashboard/dashboard-ui";
import {
  formatDaysSinceUploadChip,
  getPartnerPortalUploadStatus,
  normalizePortalRepresentatives,
  type PortalSubmissionChecklistItem,
} from "@/lib/partner-portal-docs";
import { enrichSeminarSlotAssignments } from "@/lib/partner-event-config";
import { cn } from "@/lib/utils";
import { eventsService, partnersService } from "@/services/api";
import type { Event, Partner, PartnerPortalDocument } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isImageDoc(doc: PartnerPortalDocument) {
  return doc.mimeType.startsWith("image/");
}

async function downloadDoc(doc: PartnerPortalDocument) {
  try {
    const res = await fetch(doc.url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = doc.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    toast.success(`Downloaded ${doc.fileName}`);
  } catch {
    window.open(doc.url, "_blank", "noopener,noreferrer");
    toast.message("Opened file in a new tab");
  }
}

function checklistIcon(item: PortalSubmissionChecklistItem) {
  if (item.kind === "logo" || item.kind === "file") return FileText;
  if (item.kind === "url") return Link2;
  if (item.kind === "textarea") return MessageSquare;
  if (item.kind === "speakers") return Mic2;
  if (item.kind === "representatives") return Users;
  return Type;
}

function eventLabel(events: Event[], eventId: string) {
  const event = events.find((e) => e.id === eventId);
  if (!event) return "Event";
  return event.city ? `${event.title} - ${event.city}` : event.title;
}

function SubmissionPreview({
  partner,
  item,
  events = [],
}: {
  partner: Partner;
  item: PortalSubmissionChecklistItem;
  events?: Event[];
}) {
  if ((item.kind === "file" || item.kind === "logo") && item.file) {
    const selected = item.file;
    return (
      <>
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3"
          style={{ borderColor: LINE.subtle }}
        >
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold"
              style={{ color: INK.primary }}
            >
              {selected.fileName}
            </p>
            <p className="text-xs" style={{ color: INK.muted }}>
              Uploaded {formatUploadedAt(selected.uploadedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                window.open(selected.url, "_blank", "noopener,noreferrer")
              }
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 text-white hover:opacity-90"
              style={{ backgroundColor: BRAND[700] }}
              onClick={() => void downloadDoc(selected)}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {isImageDoc(selected) ? (
            <div
              className="flex min-h-full items-center justify-center rounded-2xl border p-4"
              style={{
                borderColor: LINE.subtle,
                background: PAPER.surface,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.url}
                alt={selected.label}
                className="max-h-[min(52vh,560px)] max-w-full rounded-lg object-contain"
              />
            </div>
          ) : (
            <div
              className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border px-6 text-center"
              style={{
                borderColor: LINE.subtle,
                background: PAPER.surface,
              }}
            >
              <FileText
                className="h-12 w-12"
                style={{ color: BRAND[700] }}
              />
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: INK.primary }}
                >
                  {selected.fileName}
                </p>
                <p className="mt-1 text-xs" style={{ color: INK.muted }}>
                  Preview isn’t available for this file type. Download or open
                  it instead.
                </p>
              </div>
              <Button
                type="button"
                className="gap-1.5 text-white hover:opacity-90"
                style={{ backgroundColor: BRAND[700] }}
                onClick={() => void downloadDoc(selected)}
              >
                <Download className="h-4 w-4" />
                Download file
              </Button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (item.kind === "text") {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: LINE.subtle, background: PAPER.surface }}
        >
          <p
            className="text-[11px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: INK.muted }}
          >
            {item.label}
          </p>
          <p
            className="mt-3 text-lg font-semibold"
            style={{ color: INK.primary }}
          >
            {partner.portalFasciaName?.trim() || "—"}
          </p>
        </div>
      </div>
    );
  }

  if (item.kind === "url") {
    const url = partner.portalWebsiteUrl?.trim();
    return (
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: LINE.subtle, background: PAPER.surface }}
        >
          <p
            className="text-[11px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: INK.muted }}
          >
            {item.label}
          </p>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-brand-700 hover:underline"
            >
              {url}
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <p className="mt-3 text-base" style={{ color: INK.muted }}>
              —
            </p>
          )}
        </div>
      </div>
    );
  }

  if (item.kind === "textarea") {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: LINE.subtle, background: PAPER.surface }}
        >
          <p
            className="text-[11px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: INK.muted }}
          >
            {item.label}
          </p>
          <p
            className="mt-3 whitespace-pre-wrap text-sm leading-relaxed"
            style={{ color: INK.primary }}
          >
            {partner.portalSmsContent?.trim() || "—"}
          </p>
        </div>
      </div>
    );
  }

  if (item.kind === "speakers") {
    const rows = partner.portalSeminarSpeakers ?? [];
    const assignments = (partner.seminarSlotAssignments ?? []).filter(
      (slot) => slot.slots > 0
    );

    return (
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div className="space-y-4">
          {assignments.length === 0 ? (
            <p className="text-sm" style={{ color: INK.muted }}>
              No seminar seats allotted yet.
            </p>
          ) : (
            assignments.map((slot) => {
              const submission = rows.find(
                (row) =>
                  row.eventId === slot.eventId &&
                  row.seminarId === slot.seminarId
              );
              const title =
                slot.seminarTitle?.trim() || slot.seminarId || "Seminar";
              const speakers = submission?.speakers ?? [];

              return (
                <div
                  key={`${slot.eventId}-${slot.seminarId}`}
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: LINE.subtle,
                    background: PAPER.surface,
                  }}
                >
                  <p
                    className="text-sm font-semibold"
                    style={{ color: INK.primary }}
                  >
                    {title}
                  </p>
                  <p className="text-xs" style={{ color: INK.muted }}>
                    {slot.slots} speaker slot{slot.slots === 1 ? "" : "s"}
                  </p>
                  {speakers.length === 0 ? (
                    <p className="mt-3 text-sm" style={{ color: INK.muted }}>
                      Not submitted yet
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {speakers.map((speaker, index) => (
                        <li
                          key={`${speaker.name}-${index}`}
                          className="rounded-xl border px-3 py-2.5"
                          style={{ borderColor: LINE.subtle }}
                        >
                          <div className="flex items-start gap-3">
                            {speaker.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={speaker.photoUrl}
                                alt={speaker.name}
                                className="h-10 w-10 shrink-0 rounded-full object-cover"
                                style={{ border: `1px solid ${LINE.subtle}` }}
                              />
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <p
                                className="text-sm font-semibold"
                                style={{ color: INK.primary }}
                              >
                                {speaker.name}
                              </p>
                              {speaker.designation ? (
                                <p
                                  className="text-xs"
                                  style={{ color: INK.secondary }}
                                >
                                  {speaker.designation}
                                </p>
                              ) : null}
                              {speaker.contact ||
                              speaker.phone ||
                              speaker.email ? (
                                <p
                                  className="mt-1 text-xs"
                                  style={{ color: INK.muted }}
                                >
                                  {speaker.contact ??
                                    speaker.phone ??
                                    speaker.email}
                                </p>
                              ) : null}
                              {speaker.introduction ? (
                                <p
                                  className="mt-2 whitespace-pre-wrap text-xs leading-relaxed"
                                  style={{ color: INK.secondary }}
                                >
                                  {speaker.introduction}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (item.kind === "representatives") {
    const repRows = normalizePortalRepresentatives(
      partner.portalRepresentatives,
      partner.eventIds ?? []
    );
    const totalPeople = repRows.reduce(
      (sum, row) => sum + row.representatives.length,
      0
    );

    return (
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div className="space-y-4">
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: LINE.subtle, background: PAPER.surface }}
          >
            <p
              className="text-[11px] font-semibold tracking-[0.14em] uppercase"
              style={{ color: INK.muted }}
            >
              {item.label}
            </p>
            <p
              className="mt-3 text-lg font-semibold"
              style={{ color: INK.primary }}
            >
              {totalPeople > 0
                ? `${totalPeople} representative${totalPeople === 1 ? "" : "s"} across ${repRows.length} event${repRows.length === 1 ? "" : "s"}`
                : "Not submitted yet"}
            </p>
          </div>

          {repRows.length === 0 ? (
            <p className="px-1 text-sm" style={{ color: INK.muted }}>
              No contact details yet.
            </p>
          ) : (
            repRows.map((row) => (
              <div
                key={row.eventId}
                className="rounded-2xl border p-5"
                style={{ borderColor: LINE.subtle, background: PAPER.surface }}
              >
                <p
                  className="text-[11px] font-semibold tracking-[0.14em] uppercase"
                  style={{ color: BRAND[700] }}
                >
                  {eventLabel(events, row.eventId)}
                </p>
                <p className="mt-1 text-sm" style={{ color: INK.secondary }}>
                  {row.count} representative{row.count === 1 ? "" : "s"} submitted
                </p>
                {row.representatives.length === 0 ? (
                  <p className="mt-3 text-sm" style={{ color: INK.muted }}>
                    No contact details for this event.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {row.representatives.map((person, index) => (
                      <li
                        key={`${row.eventId}-${person.name}-${person.phone}-${index}`}
                        className="rounded-xl border px-3 py-2.5"
                        style={{ borderColor: LINE.subtle }}
                      >
                        <p
                          className="text-[11px] font-extrabold uppercase tracking-wide"
                          style={{ color: BRAND[700] }}
                        >
                          Representative {index + 1}
                        </p>
                        <p
                          className="mt-1.5 text-sm font-semibold"
                          style={{ color: INK.primary }}
                        >
                          {person.name || "—"}
                        </p>
                        <p className="text-xs" style={{ color: INK.secondary }}>
                          {person.phone || "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return null;
}

export function PartnerDocsDialog({
  partner: initialPartner,
  open,
  onOpenChange,
}: {
  partner: Partner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const partnerQuery = useQuery({
    queryKey: ["partner-docs", initialPartner?.id],
    queryFn: () => partnersService.getById(initialPartner!.id),
    enabled: open && Boolean(initialPartner?.id),
  });

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsService.getAll(),
    enabled: open,
  });

  const partner = partnerQuery.data ?? initialPartner;

  const partnerWithSeminarTitles = useMemo(() => {
    if (!partner) return null;
    const events = eventsQuery.data ?? [];
    if (events.length === 0) return partner;
    return {
      ...partner,
      seminarSlotAssignments: enrichSeminarSlotAssignments(
        partner.seminarSlotAssignments ?? [],
        events
      ),
    };
  }, [partner, eventsQuery.data]);

  const previewPartner = partnerWithSeminarTitles ?? partner;

  const uploadStatus = useMemo(
    () => (partner ? getPartnerPortalUploadStatus(partner) : null),
    [partner]
  );

  const selectedItem = useMemo(() => {
    if (!uploadStatus) return null;
    const key =
      selectedKey &&
      uploadStatus.checklist.some((item) => item.key === selectedKey)
        ? selectedKey
        : uploadStatus.checklist.find((item) => item.complete)?.key ??
          uploadStatus.checklist[0]?.key ??
          null;
    return uploadStatus.checklist.find((item) => item.key === key) ?? null;
  }, [uploadStatus, selectedKey]);

  useEffect(() => {
    if (!open) setSelectedKey(null);
  }, [open]);

  const sendReminder = () => {
    if (!partner || !uploadStatus || uploadStatus.missing.length === 0) return;
    const missingLabels = uploadStatus.missing.map((m) => m.label).join(", ");
    const to =
      partner.portalInviteEmail ||
      partner.primaryContact?.email ||
      "partner contact";
    toast.success("Reminder sent", {
      description: `Asked ${to} to upload: ${missingLabels}`,
    });
  };

  const reminderChip = uploadStatus
    ? formatDaysSinceUploadChip(uploadStatus)
    : null;

  const extraDocs =
    partner?.portalDocuments?.filter((doc) => doc.kind === "other") ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelectedKey(null);
        onOpenChange(next);
      }}
    >
      <DialogContent
        hideClose={false}
        className="flex max-h-[75vh] w-[75vw] max-w-[75vw] flex-col gap-0 overflow-hidden rounded-2xl border p-0 shadow-2xl"
        style={{
          background: `linear-gradient(165deg, ${PAPER.surface} 0%, ${PAPER.muted} 100%)`,
          borderColor: LINE.subtle,
        }}
      >
        <DialogHeader
          className="shrink-0 border-b px-6 py-5 text-left"
          style={{ borderColor: LINE.subtle }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle
                className={cn(displayClass, "text-2xl font-bold")}
                style={{ color: INK.primary }}
              >
                Partner documents
              </DialogTitle>
              {partner ? (
                <p className="mt-1 text-sm" style={{ color: INK.secondary }}>
                  Submitted via partner portal · {partner.name}
                </p>
              ) : null}
            </div>
            {reminderChip ? (
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  background: "rgba(176,125,42,0.16)",
                  color: "#B07D2A",
                }}
              >
                {reminderChip}
              </span>
            ) : uploadStatus?.allUploaded ? (
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  background: STATUS.successSoft,
                  color: STATUS.success,
                }}
              >
                All documents uploaded
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr]">
          <aside
            className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r"
            style={{ borderColor: LINE.subtle, background: PAPER.surface }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <p
                className="mb-2 px-1 text-[11px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: INK.muted }}
              >
                Portal submissions
              </p>
              <ul className="space-y-1">
                {uploadStatus?.checklist.map((item) => {
                  const active = selectedItem?.key === item.key;
                  const Icon = checklistIcon(item);
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(String(item.key))}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                          !active && "hover:bg-black/[0.03]"
                        )}
                        style={{
                          background: active ? BRAND[50] : undefined,
                        }}
                      >
                        <span
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: item.uploaded
                              ? STATUS.successSoft
                              : "rgba(163,59,59,0.12)",
                            color: item.uploaded ? STATUS.success : "#A33B3B",
                          }}
                        >
                          {item.uploaded ? (
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          ) : (
                            <X className="h-3.5 w-3.5" strokeWidth={3} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="flex items-center gap-1.5 truncate text-sm font-semibold"
                            style={{ color: INK.primary }}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0 text-brand-700" />
                            {item.label}
                          </span>
                          <span
                            className="mt-0.5 block truncate text-xs"
                            style={{
                              color: item.uploaded ? STATUS.success : INK.muted,
                            }}
                          >
                            {item.uploaded
                              ? item.file
                                ? `${item.file.fileName} · ${formatBytes(item.file.fileSizeBytes)}`
                                : "Submitted"
                              : "Not submitted"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {extraDocs.length > 0 ? (
                <div className="mt-4">
                  <p
                    className="mb-2 px-1 text-[11px] font-semibold tracking-[0.14em] uppercase"
                    style={{ color: INK.muted }}
                  >
                    Extra files
                  </p>
                  <ul className="space-y-1">
                    {extraDocs.map((doc) => {
                      const active = selectedItem?.file?.id === doc.id;
                      const Icon = isImageDoc(doc) ? ImageIcon : FileText;
                      return (
                        <li key={doc.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedKey(`extra:${doc.id}`)}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                              !active && "hover:bg-black/[0.03]"
                            )}
                            style={{
                              background: active ? BRAND[50] : undefined,
                            }}
                          >
                            <span
                              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                              style={{
                                background: active ? BRAND[700] : PAPER.muted,
                                color: active ? "#fff" : BRAND[700],
                              }}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className="block truncate text-sm font-semibold"
                                style={{ color: INK.primary }}
                              >
                                {doc.label}
                              </span>
                              <span
                                className="mt-0.5 block truncate text-xs"
                                style={{ color: INK.muted }}
                              >
                                {formatBytes(doc.fileSizeBytes)}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>

            {uploadStatus && !uploadStatus.allUploaded ? (
              <div
                className="shrink-0 border-t p-3"
                style={{ borderColor: LINE.subtle }}
              >
                <p className="mb-2 px-1 text-xs" style={{ color: INK.secondary }}>
                  Missing:{" "}
                  {uploadStatus.missing.map((m) => m.label).join(", ")}
                </p>
                <Button
                  type="button"
                  className="h-10 w-full gap-2 text-white hover:opacity-90"
                  style={{ backgroundColor: BRAND[700] }}
                  onClick={sendReminder}
                >
                  <Bell className="h-4 w-4" />
                  Send reminder
                </Button>
              </div>
            ) : null}
          </aside>

          <div className="flex min-h-0 flex-col">
            {previewPartner && selectedItem ? (
              selectedKey?.startsWith("extra:") ? (
                (() => {
                  const docId = selectedKey.replace("extra:", "");
                  const doc = extraDocs.find((row) => row.id === docId);
                  if (!doc) return null;
                  return (
                    <SubmissionPreview
                      partner={previewPartner}
                      item={{
                        key: "logo",
                        label: doc.label,
                        complete: true,
                        uploaded: true,
                        kind: "logo",
                        file: doc,
                      }}
                      events={eventsQuery.data ?? []}
                    />
                  );
                })()
              ) : (
                <SubmissionPreview
                  partner={previewPartner}
                  item={selectedItem}
                  events={eventsQuery.data ?? []}
                />
              )
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <File className="h-10 w-10" style={{ color: INK.muted }} />
                <p
                  className="text-sm font-semibold"
                  style={{ color: INK.primary }}
                >
                  {partnerQuery.isLoading
                    ? "Loading portal submissions…"
                    : uploadStatus?.allUploaded
                      ? "Select an item to preview"
                      : "No portal submissions yet"}
                </p>
                <p
                  className="max-w-sm text-sm"
                  style={{ color: INK.secondary }}
                >
                  {uploadStatus && !uploadStatus.allUploaded
                    ? "Tick marks show what’s in. Send a reminder for anything still missing."
                    : "Choose a submission from the list."}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
