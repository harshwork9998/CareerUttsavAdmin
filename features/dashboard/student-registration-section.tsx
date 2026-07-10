"use client";

import { useMemo } from "react";
import { formatDistanceToNowStrict } from "date-fns";

import type { StudentRegistrationAnalytics } from "@/types";
import { SeminarProgram } from "@/features/dashboard/seminar-program";
import { ShareDonutCard } from "@/features/dashboard/share-donut-card";
import {
  ActivityFeed,
  SchoolLeaderboard,
} from "@/features/dashboard/visualizations";

export function StudentRegistrationSection({
  data,
  isAllCities,
}: {
  data: StudentRegistrationAnalytics;
  cityLabel?: string;
  isAllCities?: boolean;
}) {
  const streamData = useMemo(
    () =>
      data.byStream.map((item) => ({
        name: String(item.name),
        value: Number(item.value),
      })),
    [data.byStream]
  );

  const boardData = useMemo(
    () =>
      data.byBoard.map((item) => ({
        name: String(item.name),
        value: Number(item.value),
      })),
    [data.byBoard]
  );

  const classData = useMemo(
    () =>
      data.byClass.map((item) => ({
        name: String(item.name),
        value: Number(item.value),
      })),
    [data.byClass]
  );

  const seminarData = useMemo(
    () =>
      data.bySeminar
        .map((item) => ({
          name: String(item.name),
          value: Number(item.value),
        }))
        .sort((a, b) => b.value - a.value),
    [data.bySeminar]
  );

  const feedItems = useMemo(
    () =>
      data.liveFeed.slice(0, 5).map((item) => ({
        id: item.id,
        primary: item.studentName,
        secondary: [
          item.school,
          item.classLabel,
          item.seminar,
          isAllCities ? item.city : null,
        ]
          .filter(Boolean)
          .join(" · "),
        time: formatDistanceToNowStrict(new Date(item.timestamp), {
          addSuffix: false,
        }),
      })),
    [data.liveFeed, isAllCities]
  );

  return (
    <section className="space-y-6">
      <SeminarProgram items={seminarData} />

      <div className="grid gap-5 md:grid-cols-3">
        <ShareDonutCard title="Streams they chose" items={streamData} />
        <ShareDonutCard title="Boards they study under" items={boardData} />
        <ShareDonutCard title="Students by class" items={classData} />
      </div>

      <div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Schools bringing the most students
        </p>
        <SchoolLeaderboard schools={data.topSchools} />
      </div>

      <div>
        <p className="mb-3 text-[11px] text-muted-foreground">Just joined</p>
        <ActivityFeed items={feedItems} />
      </div>
    </section>
  );
}
