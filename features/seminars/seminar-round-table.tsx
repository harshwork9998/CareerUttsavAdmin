"use client";

import { User } from "lucide-react";

import { BRASS, INK, LINE, TEAL } from "@/features/dashboard/dashboard-ui";
import type { SeminarSpeaker } from "@/types";

const MOD = {
  bg: BRASS[100],
  border: BRASS[500],
  icon: BRASS[700],
  ring: BRASS[700],
} as const;

const PANEL = {
  bg: TEAL[100],
  border: "#7BB8B7",
  icon: TEAL[500],
  ring: TEAL[700],
} as const;

type Seat =
  | { kind: "moderator"; speaker: SeminarSpeaker | null }
  | { kind: "panelist"; speaker: SeminarSpeaker | null; index: number };

function semiXY(index: number, total: number, rx: number, ry: number) {
  const from = (200 * Math.PI) / 180;
  const to = (340 * Math.PI) / 180;
  const t = total <= 1 ? 0.5 : index / (total - 1);
  const angle = from + (to - from) * t;
  return {
    x: Math.cos(angle) * rx,
    y: Math.sin(angle) * ry,
  };
}

function arrangeSeats(
  moderator: SeminarSpeaker | null,
  panelists: (SeminarSpeaker | null)[]
): Seat[] {
  const panelSeats: Seat[] = panelists.map((speaker, index) => ({
    kind: "panelist" as const,
    speaker,
    index,
  }));

  const left: Seat[] = [];
  const right: Seat[] = [];
  panelSeats.forEach((seat, i) => {
    if (i % 2 === 0) left.push(seat);
    else right.push(seat);
  });
  left.reverse();

  return [...left, { kind: "moderator", speaker: moderator }, ...right];
}

export function SeminarRoundTable({
  moderator,
  panelists,
  totalSlots,
  selectedId,
  onSeatClick,
}: {
  moderator: SeminarSpeaker | null;
  panelists: SeminarSpeaker[];
  totalSlots: number;
  selectedId: string | null;
  onSeatClick: (
    seat:
      | { kind: "moderator"; speaker: SeminarSpeaker | null }
      | { kind: "panelist"; index: number; speaker: SeminarSpeaker | null }
  ) => void;
}) {
  const slots = Math.max(totalSlots, 1);
  const panelSlots = Array.from(
    { length: slots },
    (_, i) => panelists[i] ?? null
  );
  const seats = arrangeSeats(moderator, panelSlots);
  const total = seats.length;

  const stageH = 280;
  // Rounder arc: vertical radius closer to horizontal
  const rx = 38;
  const ry = 34;

  const audienceRows = 5;
  const audienceCols = 16;

  return (
    <div className="w-full">
      <div
        className="mb-3 flex flex-wrap items-center gap-4 text-xs"
        style={{ color: INK.muted }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full"
            style={{
              background: MOD.bg,
              color: MOD.icon,
              border: `1px solid ${MOD.border}`,
            }}
          >
            <User className="h-2.5 w-2.5" />
          </span>
          Moderator
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full"
            style={{
              background: PANEL.bg,
              color: PANEL.icon,
              border: `1px solid ${PANEL.border}`,
            }}
          >
            <User className="h-2.5 w-2.5" />
          </span>
          Panelist
        </span>
      </div>

      {/* Stage */}
      <div
        className="relative w-full overflow-visible rounded-lg border"
        style={{
          height: stageH,
          borderColor: LINE.subtle,
          background: "#FAFBFC",
        }}
      >
        <p
          className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 text-xs font-semibold tracking-[0.22em] uppercase"
          style={{ color: INK.muted }}
        >
          Stage
        </p>

        {seats.map((seat, i) => {
          const { x, y } = semiXY(i, total, rx, ry);
          // Anchored lower so Stage label has breathing room above the arc
          const left = 50 + x;
          const top = 68 + y * 0.85;

          const isMod = seat.kind === "moderator";
          const palette = isMod ? MOD : PANEL;
          const speaker = seat.speaker;
          const empty = !speaker;
          const selected = Boolean(speaker && selectedId === speaker.id);
          const name = speaker
            ? speaker.name.split(" ").slice(0, 2).join(" ")
            : isMod
              ? "Moderator"
              : `Seat ${seat.index + 1}`;

          return (
            <button
              key={isMod ? "moderator" : `panel-${seat.index}`}
              type="button"
              onClick={() =>
                onSeatClick(
                  isMod
                    ? { kind: "moderator", speaker }
                    : { kind: "panelist", index: seat.index, speaker }
                )
              }
              className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center gap-0.5 outline-none"
              style={{
                left: `${left}%`,
                top: `${top}%`,
              }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{
                  background: empty ? "#fff" : palette.bg,
                  color: empty ? INK.muted : palette.icon,
                  border: empty
                    ? `1.5px dashed ${LINE.strong}`
                    : selected
                      ? `2px solid ${palette.ring}`
                      : `1.5px solid ${palette.border}`,
                }}
              >
                <User className="h-4 w-4" strokeWidth={2} />
              </span>
              <span
                className="max-w-[72px] truncate text-center text-[10px] font-medium leading-tight"
                style={{ color: empty ? INK.muted : INK.secondary }}
              >
                {name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Audience — label over seats */}
      <div className="relative mt-3 w-full">
        <div
          className="w-full space-y-1.5"
          style={{
            maskImage:
              "linear-gradient(180deg, black 0%, black 30%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, black 0%, black 30%, transparent 100%)",
          }}
        >
          {Array.from({ length: audienceRows }, (_, row) => (
            <div key={row} className="flex w-full gap-1.5">
              {Array.from({ length: audienceCols }, (_, col) => (
                <span
                  key={col}
                  className="aspect-square min-w-0 flex-1 rounded-[3px]"
                  style={{
                    background: "#E8EBEF",
                    border: `1px solid ${LINE.subtle}`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <p
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-bold tracking-[0.28em] uppercase sm:text-3xl"
          style={{ color: INK.primary, opacity: 0.28 }}
        >
          Audience
        </p>
      </div>
    </div>
  );
}

