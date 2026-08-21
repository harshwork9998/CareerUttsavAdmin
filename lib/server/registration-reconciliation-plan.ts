import { Prisma } from "@/lib/generated/prisma/client";
import type { Registration } from "@/types";
import { TARGET_EVENT_ID } from "../../scripts/lib/registration-import-shared";
import {
  buildSeminarRows,
  mapRegistration,
  seminarTitlesFromJson,
  type MappedRegistration,
  type MappedRegistrationSeminar,
} from "../../scripts/lib/registration-prisma-import-map";
import {
  compareExistingRegistration,
  computeRequiredCounterValues,
  reconcileCounters,
  reconcileEventCounters,
  assertOnlyEvt001,
  type DbRegistrationRecord,
  type ReconciliationConflict,
  type ReconciliationPlan,
  validateFinalSnapshotDuplicates,
} from "./registration-reconciliation";

export type BuildPlanInput = {
  finalRegistrations: Registration[];
  dbRecordsById: Map<string, DbRegistrationRecord>;
  dbRecordsByNumber: Map<string, DbRegistrationRecord>;
  dbRegistrationIds: Set<string>;
  seminarTitleToId: Map<string, string>;
  currentCounters: Map<string, number>;
  currentEventRegistrationCount: number;
  currentEventCheckInCount: number;
  finalEventRegistrationCount: number;
  finalEventCheckInCount: number;
};

export function buildReconciliationPlan(input: BuildPlanInput): ReconciliationPlan {
  const conflicts: ReconciliationConflict[] = [
    ...validateFinalSnapshotDuplicates(input.finalRegistrations),
  ];

  const exactMatches: string[] = [];
  const newRegistrationIds: string[] = [];
  const newRegistrations: MappedRegistration[] = [];
  const newRegistrationSeminars: MappedRegistrationSeminar[] = [];

  const jsonIds = new Set(input.finalRegistrations.map((registration) => registration.id));

  for (const dbId of input.dbRegistrationIds) {
    if (!jsonIds.has(dbId)) {
      conflicts.push({
        code: "registration_absent_from_final_json",
        registrationId: dbId,
        message: `Database registration ${dbId} is absent from final production JSON`,
      });
    }
  }

  for (const registration of input.finalRegistrations) {
    const jsonMapped = mapRegistration(registration);
    const jsonSeminarTitles = seminarTitlesFromJson(registration);

    const byId = input.dbRecordsById.get(registration.id);
    const byNumber = input.dbRecordsByNumber.get(registration.registrationNumber);

    if (byId && byNumber && byId.registration.id !== byNumber.registration.id) {
      conflicts.push({
        code: "registration_number_id_mismatch",
        registrationId: registration.id,
        fields: ["id", "registrationNumber"],
        message: `Registration number ${registration.registrationNumber} maps to a different database id`,
      });
      continue;
    }

    if (byId && byId.registration.registrationNumber !== registration.registrationNumber) {
      conflicts.push({
        code: "id_registration_number_conflict",
        registrationId: registration.id,
        fields: ["registrationNumber"],
        message: `Same id with different registrationNumber in database`,
      });
      continue;
    }

    if (
      byNumber &&
      !byId &&
      byNumber.registration.id !== registration.id
    ) {
      conflicts.push({
        code: "registration_number_id_conflict",
        registrationId: registration.id,
        fields: ["id", "registrationNumber"],
        message: `Same registrationNumber with different id in database`,
      });
      continue;
    }

    const dbRecord = byId ?? byNumber;

    if (!dbRecord) {
      newRegistrationIds.push(registration.id);
      newRegistrations.push(jsonMapped);
      if (registration.kind === "student") {
        newRegistrationSeminars.push(
          ...buildSeminarRows(registration, input.seminarTitleToId)
        );
      }
      continue;
    }

    const fieldMismatches = compareExistingRegistration(
      jsonMapped,
      dbRecord,
      jsonSeminarTitles
    );

    if (fieldMismatches.length > 0) {
      conflicts.push({
        code: "existing_registration_material_mismatch",
        registrationId: registration.id,
        fields: fieldMismatches,
        message: `Existing registration data differs from final production JSON`,
      });
      continue;
    }

    exactMatches.push(registration.id);
  }

  const requiredCounters = computeRequiredCounterValues(input.finalRegistrations);
  const counterRows = reconcileCounters(
    requiredCounters,
    input.currentCounters
  );

  const eventCounters = reconcileEventCounters(
    input.currentEventRegistrationCount,
    input.currentEventCheckInCount,
    input.finalEventRegistrationCount,
    input.finalEventCheckInCount
  );

  return {
    exactMatches,
    newRegistrationIds,
    conflicts,
    newRegistrations,
    newRegistrationSeminars,
    counterRows,
    eventCounters,
  };
}
