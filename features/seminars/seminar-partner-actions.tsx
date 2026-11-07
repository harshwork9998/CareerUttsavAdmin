"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  INK,
  LINE,
  PAPER,
  STATUS,
} from "@/features/dashboard/dashboard-ui";
import {
  movePartnerSeminarApi,
  removePartnerSeminarApi,
} from "@/lib/partners-api-client";
import {
  assignmentConfirmationLabel,
  eligibleReassignmentDestinations,
  LEGACY_STACKED_ASSIGNMENT_MOVE,
  seminarAssignmentCanBeReassigned,
} from "@/lib/seminar-admin";
import type { Event, EventSeminar, Partner } from "@/types";

type AssignmentRow = {
  partner: Partner;
  seminarId: string;
  slots: number;
  confirmedAt?: string | null;
};

export function SeminarPartnerActions({
  event,
  seminar,
  events,
  partners,
  onChanged,
}: {
  event: Event;
  seminar: EventSeminar;
  events: Event[];
  partners: Partner[];
  onChanged: () => void;
}) {
  const [moveRow, setMoveRow] = useState<AssignmentRow | null>(null);
  const [destinationId, setDestinationId] = useState("");
  const [removeRow, setRemoveRow] = useState<AssignmentRow | null>(null);

  const rows = useMemo(() => {
    const list: AssignmentRow[] = [];
    for (const partner of partners) {
      const assignment = partner.seminarSlotAssignments?.find(
        (row) =>
          row.eventId === event.id &&
          row.seminarId === seminar.id &&
          row.slots > 0
      );
      if (!assignment) continue;
      list.push({
        partner,
        seminarId: assignment.seminarId,
        slots: assignment.slots,
        confirmedAt: assignment.confirmedAt,
      });
    }
    return list.sort((left, right) =>
      left.partner.name.localeCompare(right.partner.name)
    );
  }, [event.id, partners, seminar.id]);

  const destinations = useMemo(() => {
    if (!moveRow) return [];
    return eligibleReassignmentDestinations({
      partner: moveRow.partner,
      events,
      partners,
      eventId: event.id,
      seminarId: seminar.id,
    });
  }, [event.id, events, moveRow, partners, seminar.id]);

  const moveMutation = useMutation({
    mutationFn: (input: { partnerId: string; destinationSeminarId: string }) =>
      movePartnerSeminarApi(input.partnerId, {
        eventId: event.id,
        seminarId: seminar.id,
        destinationSeminarId: input.destinationSeminarId,
      }),
    onSuccess: () => {
      toast.success("Partner moved to the selected seminar");
      setMoveRow(null);
      setDestinationId("");
      onChanged();
    },
    onError: (error: Error) => {
      toast.error(error.message || "This seminar is full.");
      onChanged();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (partnerId: string) =>
      removePartnerSeminarApi(partnerId, {
        eventId: event.id,
        seminarId: seminar.id,
      }),
    onSuccess: () => {
      toast.success("Partner removed from this seminar");
      setRemoveRow(null);
      onChanged();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not remove this partner");
      onChanged();
    },
  });

  if (rows.length === 0) return null;

  return (
    <div
      className="mt-4 rounded-2xl border px-4 py-3"
      style={{ borderColor: LINE.subtle, background: PAPER.muted }}
    >
      <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: INK.muted }}>
        Partner topics
      </p>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => {
          const label = assignmentConfirmationLabel(row.confirmedAt);
          const canReassign = seminarAssignmentCanBeReassigned(row.slots);
          return (
            <li
              key={row.partner.id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: INK.primary }}>
                  {row.partner.name}
                </p>
                <span
                  className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    color: label === "Confirmed" ? STATUS.success : STATUS.warning,
                    background:
                      label === "Confirmed" ? STATUS.successSoft : STATUS.warningSoft,
                  }}
                >
                  {label}
                </span>
                {canReassign ? null : (
                  <p className="mt-1 max-w-sm text-xs" style={{ color: INK.muted }}>
                    {LEGACY_STACKED_ASSIGNMENT_MOVE}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canReassign}
                  title={canReassign ? undefined : LEGACY_STACKED_ASSIGNMENT_MOVE}
                  onClick={() => {
                    if (!canReassign) return;
                    setDestinationId("");
                    setMoveRow(row);
                  }}
                >
                  Reassign
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setRemoveRow(row)}
                >
                  Remove from seminar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={Boolean(moveRow)}
        onOpenChange={(open) => {
          if (!open) {
            setMoveRow(null);
            setDestinationId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign partner</DialogTitle>
            <DialogDescription>
              {moveRow?.partner.name} is on {seminar.title?.trim() || seminar.id}. Choose
              another topic in {event.title?.trim() || event.city}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm" style={{ color: INK.secondary }}>
              Current topic: {seminar.title?.trim() || seminar.id}
            </p>
            {destinations.length === 0 ? (
              <p className="text-sm" style={{ color: INK.muted }}>
                No other seminar in this event has room.
              </p>
            ) : (
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Destination topic" />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((destination) => (
                    <SelectItem key={destination.seminarId} value={destination.seminarId}>
                      {destination.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              disabled={!destinationId || moveMutation.isPending || !moveRow}
              onClick={() => {
                if (!moveRow || !destinationId) return;
                moveMutation.mutate({
                  partnerId: moveRow.partner.id,
                  destinationSeminarId: destinationId,
                });
              }}
            >
              Confirm move
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removeRow)} onOpenChange={(open) => !open && setRemoveRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from seminar</DialogTitle>
            <DialogDescription>
              Remove {removeRow?.partner.name} from {seminar.title?.trim() || seminar.id}.
              This frees the seat and does not choose a replacement. Saved speaker details
              stay on file.
            </DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={removeMutation.isPending || !removeRow}
            onClick={() => {
              if (!removeRow) return;
              removeMutation.mutate(removeRow.partner.id);
            }}
          >
            Remove from seminar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
