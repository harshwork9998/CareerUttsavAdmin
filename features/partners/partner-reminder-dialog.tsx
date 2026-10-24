"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PartnerManualReminderType } from "@/lib/partner-communication-policy";

type ReminderOption = {
  type: PartnerManualReminderType;
  label: string;
  pendingItems?: Array<{ key: string; label: string }>;
};

type ReminderOptionsResponse = {
  institutionName: string;
  recipient: string;
  options: ReminderOption[];
};

export function PartnerReminderDialog({
  partnerId,
  open,
  onOpenChange,
  onSent,
}: {
  partnerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [options, setOptions] = useState<ReminderOptionsResponse | null>(null);
  const [selected, setSelected] = useState<PartnerManualReminderType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOptions(null);
    setSelected(null);
    void fetch(`/api/partners/${partnerId}/communications`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | (ReminderOptionsResponse & { error?: string })
          | null;
        if (!response.ok) {
          throw new Error(body?.error || "Could not load reminders.");
        }
        return body as ReminderOptionsResponse;
      })
      .then((body) => {
        if (cancelled) return;
        setOptions(body);
        setSelected(body.options[0]?.type ?? null);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error ? loadError.message : "Could not load reminders."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, partnerId]);

  const current = options?.options.find((option) => option.type === selected);

  const send = async () => {
    if (!selected) return;
    setSending(true);
    try {
      const response = await fetch(`/api/partners/${partnerId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selected }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error("Reminder not sent", {
          description: body?.error || "The reminder could not be sent.",
        });
        return;
      }
      toast.success("Reminder sent", {
        description: options?.recipient
          ? `Sent to ${options.recipient}.`
          : "The partner reminder was accepted.",
      });
      onSent?.();
      onOpenChange(false);
    } catch {
      toast.error("Reminder not sent", {
        description: "The reminder could not be sent.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="text-lg">Send reminder</DialogTitle>
          {options ? (
            <p className="text-sm text-muted-foreground">
              {options.institutionName}
              {options.recipient ? ` · ${options.recipient}` : ""}
            </p>
          ) : null}
        </DialogHeader>
        <div className="space-y-4 px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking what can be sent
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!loading && options && options.options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reminders apply to this partner right now.
            </p>
          ) : null}
          <div className="space-y-3">
            {options?.options.map((option) => (
              <label
                key={option.type}
                className="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3"
              >
                <input
                  type="radio"
                  name="partner-reminder"
                  className="mt-1"
                  checked={selected === option.type}
                  onChange={() => setSelected(option.type)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{option.label}</span>
                  {option.pendingItems && option.pendingItems.length > 0 ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {option.pendingItems.map((item) => item.label).join(" · ")}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
          {current?.pendingItems && current.pendingItems.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {current.pendingItems.map((item) => (
                <li key={item.key}>{item.label}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selected || sending || loading}
            onClick={() => void send()}
          >
            {sending ? "Sending" : "SEND REMINDER"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
