"use client";

import { useMemo } from "react";

import type { StudentRegistrationAnalytics } from "@/types";
import { SeminarProgram } from "@/features/dashboard/seminar-program";
import { ShareDonutCard } from "@/features/dashboard/share-donut-card";

export function StudentRegistrationSection({
  data,
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

  return (
    <section className="space-y-6">
      <div className="grid gap-5 md:grid-cols-3">
        <ShareDonutCard
          title="Streams they chose"
          items={streamData}
          delay={0}
        />
        <ShareDonutCard
          title="Boards they study under"
          items={boardData}
          delay={0.08}
        />
        <ShareDonutCard
          title="Students by class"
          items={classData}
          delay={0.16}
        />
      </div>

      <SeminarProgram items={seminarData} />
    </section>
  );
}
