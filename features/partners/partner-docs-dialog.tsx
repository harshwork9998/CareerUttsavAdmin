"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  Download,
  ExternalLink,
  File,
  FileText,
  ImageIcon,
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
  REQUIRED_PORTAL_DOCUMENTS,
} from "@/lib/partner-portal-docs";
import { cn } from "@/lib/utils";
import type { Partner, PartnerPortalDocument } from "@/types";
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

function kindLabel(kind: PartnerPortalDocument["kind"]) {
  const required = REQUIRED_PORTAL_DOCUMENTS.find((doc) => doc.kind === kind);
  if (required) return required.label;
  if (kind === "other") return "Other";
  return "Document";
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

export function PartnerDocsDialog({
  partner,
  open,
  onOpenChange,
}: {
  partner: Partner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const docs = partner?.portalDocuments ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const uploadStatus = useMemo(
    () =>
      partner
        ? getPartnerPortalUploadStatus(partner)
        : null,
    [partner]
  );

  const selected = useMemo(() => {
    if (!docs.length) return null;
    const id =
      selectedId && docs.some((d) => d.id === selectedId)
        ? selectedId
        : docs[0].id;
    return docs.find((d) => d.id === id) ?? null;
  }, [docs, selectedId]);

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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelectedId(null);
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
                Required uploads
              </p>
              <ul className="space-y-1">
                {uploadStatus?.checklist.map((item) => {
                  const active =
                    item.uploaded &&
                    selected?.id === item.file?.id;
                  return (
                    <li key={item.kind}>
                      <button
                        type="button"
                        disabled={!item.uploaded}
                        onClick={() => {
                          if (item.file) setSelectedId(item.file.id);
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                          item.uploaded && !active && "hover:bg-black/[0.03]",
                          !item.uploaded && "cursor-default opacity-90"
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
                            color: item.uploaded
                              ? STATUS.success
                              : "#A33B3B",
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
                            className="block truncate text-sm font-semibold"
                            style={{ color: INK.primary }}
                          >
                            {item.label}
                          </span>
                          <span
                            className="mt-0.5 block truncate text-xs"
                            style={{
                              color: item.uploaded
                                ? STATUS.success
                                : INK.muted,
                            }}
                          >
                            {item.uploaded
                              ? item.file
                                ? `${item.file.fileName} · ${formatBytes(item.file.fileSizeBytes)}`
                                : "Uploaded"
                              : "Not uploaded"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {docs.some((d) => d.kind === "other") ? (
                <div className="mt-4">
                  <p
                    className="mb-2 px-1 text-[11px] font-semibold tracking-[0.14em] uppercase"
                    style={{ color: INK.muted }}
                  >
                    Extra files
                  </p>
                  <ul className="space-y-1">
                    {docs
                      .filter((d) => d.kind === "other")
                      .map((doc) => {
                        const active = selected?.id === doc.id;
                        const Icon = isImageDoc(doc) ? ImageIcon : FileText;
                        return (
                          <li key={doc.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(doc.id)}
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
                                  {kindLabel(doc.kind)} ·{" "}
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
            {selected ? (
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
                        window.open(
                          selected.url,
                          "_blank",
                          "noopener,noreferrer"
                        )
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
                        <p
                          className="mt-1 text-xs"
                          style={{ color: INK.muted }}
                        >
                          Preview isn’t available for this file type. Download
                          or open it instead.
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
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <File className="h-10 w-10" style={{ color: INK.muted }} />
                <p
                  className="text-sm font-semibold"
                  style={{ color: INK.primary }}
                >
                  {uploadStatus?.allUploaded
                    ? "Select a file to preview"
                    : "No files uploaded yet"}
                </p>
                <p
                  className="max-w-sm text-sm"
                  style={{ color: INK.secondary }}
                >
                  {uploadStatus && !uploadStatus.allUploaded
                    ? "Tick marks show what’s in. Send a reminder for anything still missing."
                    : "Choose an uploaded document from the list."}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
