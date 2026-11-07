"use client";

import { seminarChapterStatus } from "@/lib/seminar-admin";
import {
  seminarDayLabel,
  seminarHallLabel,
  seminarTimeLabel,
} from "@/lib/seminar-schedule";
import {
  INK,
  LINE,
  PAPER,
  STATUS,
} from "@/features/dashboard/dashboard-ui";
import type { Event, Partner } from "@/types";

export function ChapterSeminarStatus({
  partner,
  events,
}: {
  partner: Partner;
  events: Event[];
}) {
  const groups = seminarChapterStatus(partner, events);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: INK.primary }}>
          Seminar topics
        </h2>
        <p className="mt-1 text-sm" style={{ color: INK.secondary }}>
          The partner chooses these topics. This step shows what is saved so far
          and does not need to be complete before you continue.
        </p>
      </div>
      {groups.length === 0 ? (
        <p
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: LINE.subtle, background: PAPER.muted, color: INK.secondary }}
        >
          No seminar slots are allocated yet.
        </p>
      ) : (
        groups.map((group) => (
          <section
            key={group.eventId}
            className="rounded-2xl border p-4"
            style={{ borderColor: LINE.subtle, background: PAPER.surface }}
          >
            <h3 className="text-sm font-semibold" style={{ color: INK.primary }}>
              {group.title}
            </h3>
            <p className="mt-1 text-sm" style={{ color: INK.secondary }}>
              Allocated: {group.allocated} · Selected: {group.selected} · Remaining:{" "}
              {group.remaining}
            </p>
            {group.topics.length === 0 ? (
              <p className="mt-3 text-sm" style={{ color: INK.muted }}>
                The partner has not selected a topic yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {group.topics.map((topic) => (
                  <li
                    key={`${topic.eventId}:${topic.seminarId}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
                    style={{ borderColor: LINE.subtle }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: INK.primary }}>
                        {topic.title}
                      </p>
                      <p className="text-xs" style={{ color: INK.muted }}>
                        {[
                          topic.date ? seminarDayLabel(topic.date) : null,
                          topic.startTime || topic.endTime
                            ? [seminarTimeLabel(topic.startTime), seminarTimeLabel(topic.endTime)]
                                .filter((part) => part !== "TBD")
                                .join(" – ")
                            : null,
                          topic.hall != null ? seminarHallLabel(topic.hall) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Schedule not set"}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        color:
                          topic.status === "Confirmed" ? STATUS.success : STATUS.warning,
                        background:
                          topic.status === "Confirmed"
                            ? STATUS.successSoft
                            : STATUS.warningSoft,
                      }}
                    >
                      {topic.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
