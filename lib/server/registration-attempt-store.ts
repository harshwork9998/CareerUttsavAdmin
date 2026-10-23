import fs from "fs";
import path from "path";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";
import {
  attemptsMatchForAbandon,
  normalizeAttemptEmail,
  normalizeAttemptPhone,
  phoneIdentityFromWaId,
  type RegistrationAttemptRecord,
  type RegistrationAttemptSource,
  type RegistrationAttemptStatus,
  type RegistrationAttemptStep,
} from "@/lib/registration-attempt";
import { isPrismaRegistrationPersistence } from "@/lib/server/registration-persistence-mode";
import { generateId } from "@/lib/utils";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "registration-attempts.json");

let memoryStore: RegistrationAttemptRecord[] | null = null;
let memoryStoreEnabled = false;
let writeQueue: Promise<void> = Promise.resolve();

export function __setRegistrationAttemptStoreForTests(
  attempts: RegistrationAttemptRecord[] | null
): void {
  if (attempts === null) {
    memoryStoreEnabled = false;
    memoryStore = null;
    return;
  }
  memoryStoreEnabled = true;
  memoryStore = attempts.map(cloneAttempt);
}

export function __resetRegistrationAttemptStoreForTests(): void {
  memoryStoreEnabled = false;
  memoryStore = null;
}

function cloneAttempt(attempt: RegistrationAttemptRecord): RegistrationAttemptRecord {
  return {
    ...attempt,
    seminarInterests: [...attempt.seminarInterests],
  };
}

function withAttemptLock<T>(work: () => Promise<T> | T): Promise<T> {
  const run = writeQueue.then(work, work);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function readJsonAttempts(): RegistrationAttemptRecord[] {
  if (memoryStoreEnabled) {
    return (memoryStore ?? []).map(cloneAttempt);
  }
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as RegistrationAttemptRecord[];
  } catch {
    return [];
  }
}

function writeJsonAttempts(attempts: RegistrationAttemptRecord[]): void {
  if (memoryStoreEnabled) {
    memoryStore = attempts.map(cloneAttempt);
    return;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporary = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(attempts, null, 2), "utf-8");
  fs.renameSync(temporary, STORE_PATH);
}

type AttemptClient = Prisma.TransactionClient | typeof prisma;

function mapPrismaAttempt(record: {
  id: string;
  eventId: string;
  source: RegistrationAttemptSource;
  status: RegistrationAttemptStatus;
  phone: string;
  phoneLast10: string | null;
  email: string | null;
  emailNormalized: string | null;
  name: string | null;
  classLabel: string | null;
  gender: RegistrationAttemptRecord["gender"];
  board: string | null;
  interestedStream: string | null;
  college: string | null;
  city: string | null;
  seminarInterests: string[];
  lastStep: RegistrationAttemptStep;
  startedAt: Date;
  lastActivityAt: Date;
  completedAt: Date | null;
  completedRegistrationId: string | null;
  whatsappWaId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): RegistrationAttemptRecord {
  return {
    id: record.id,
    eventId: record.eventId,
    source: record.source,
    status: record.status,
    phone: record.phone,
    phoneLast10: record.phoneLast10,
    email: record.email,
    emailNormalized: record.emailNormalized,
    name: record.name,
    classLabel: record.classLabel,
    gender: record.gender,
    board: record.board,
    interestedStream: record.interestedStream,
    college: record.college,
    city: record.city,
    seminarInterests: record.seminarInterests,
    lastStep: record.lastStep,
    startedAt: record.startedAt.toISOString(),
    lastActivityAt: record.lastActivityAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    completedRegistrationId: record.completedRegistrationId,
    whatsappWaId: record.whatsappWaId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function blankProgress() {
  return {
    name: null,
    email: null,
    emailNormalized: null,
    classLabel: null,
    gender: null,
    board: null,
    interestedStream: null,
    college: null,
    city: null,
    seminarInterests: [] as string[],
  };
}

export async function getRegistrationAttempt(
  id: string
): Promise<RegistrationAttemptRecord | null> {
  if (!isPrismaRegistrationPersistence()) {
    return withAttemptLock(() => readJsonAttempts().find((row) => row.id === id) ?? null);
  }
  const record = await prisma.registrationAttempt.findUnique({ where: { id } });
  return record ? mapPrismaAttempt(record) : null;
}

export async function listRegistrationAttempts(input?: {
  statuses?: RegistrationAttemptStatus[];
}): Promise<RegistrationAttemptRecord[]> {
  const statuses = input?.statuses;
  if (!isPrismaRegistrationPersistence()) {
    return withAttemptLock(() =>
      readJsonAttempts()
        .filter((row) => !statuses || statuses.includes(row.status))
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
    );
  }
  const records = await prisma.registrationAttempt.findMany({
    where: statuses ? { status: { in: statuses } } : undefined,
    orderBy: { lastActivityAt: "desc" },
  });
  return records.map(mapPrismaAttempt);
}

async function findInProgressWhatsApp(
  client: AttemptClient,
  input: { eventId: string; waId: string; phoneLast10: string | null }
): Promise<RegistrationAttemptRecord | null> {
  if (!isPrismaRegistrationPersistence()) {
    return (
      readJsonAttempts().find(
        (row) =>
          row.status === "IN_PROGRESS" &&
          row.source === "WHATSAPP" &&
          row.eventId === input.eventId &&
          (row.whatsappWaId === input.waId ||
            (input.phoneLast10 !== null && row.phoneLast10 === input.phoneLast10))
      ) ?? null
    );
  }
  const record = await client.registrationAttempt.findFirst({
    where: {
      status: "IN_PROGRESS",
      source: "WHATSAPP",
      eventId: input.eventId,
      OR: [
        { whatsappWaId: input.waId },
        ...(input.phoneLast10 ? [{ phoneLast10: input.phoneLast10 }] : []),
      ],
    },
  });
  return record ? mapPrismaAttempt(record) : null;
}

export async function ensureWhatsAppRegistrationAttempt(input: {
  eventId: string;
  waId: string;
  attemptId?: string | null;
  now?: Date;
}): Promise<RegistrationAttemptRecord> {
  const now = input.now ?? new Date();
  const identity = phoneIdentityFromWaId(input.waId);
  const run = async (client: AttemptClient) => {
    if (input.attemptId) {
      const linked = isPrismaRegistrationPersistence()
        ? await client.registrationAttempt
            .findUnique({ where: { id: input.attemptId } })
            .then((row) => (row ? mapPrismaAttempt(row) : null))
        : readJsonAttempts().find((row) => row.id === input.attemptId) ?? null;
      if (
        linked &&
        linked.status === "IN_PROGRESS" &&
        linked.source === "WHATSAPP" &&
        linked.eventId === input.eventId
      ) {
        return linked;
      }
    }

    const existing = await findInProgressWhatsApp(client, {
      eventId: input.eventId,
      waId: input.waId,
      phoneLast10: identity.phoneLast10,
    });
    if (existing) return existing;

    const created: RegistrationAttemptRecord = {
      id: `rat-${generateId()}`,
      eventId: input.eventId,
      source: "WHATSAPP",
      status: "IN_PROGRESS",
      phone: identity.phone,
      phoneLast10: identity.phoneLast10,
      email: null,
      emailNormalized: null,
      name: null,
      classLabel: null,
      gender: null,
      board: null,
      interestedStream: null,
      college: null,
      city: null,
      seminarInterests: [],
      lastStep: "WELCOME",
      startedAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      completedAt: null,
      completedRegistrationId: null,
      whatsappWaId: input.waId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    if (!isPrismaRegistrationPersistence()) {
      writeJsonAttempts([created, ...readJsonAttempts()]);
      return created;
    }

    try {
      const record = await client.registrationAttempt.create({
        data: {
          id: created.id,
          eventId: created.eventId,
          source: "WHATSAPP",
          status: "IN_PROGRESS",
          phone: created.phone,
          phoneLast10: created.phoneLast10,
          lastStep: "WELCOME",
          startedAt: now,
          lastActivityAt: now,
          whatsappWaId: input.waId,
          seminarInterests: [],
        },
      });
      return mapPrismaAttempt(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await findInProgressWhatsApp(client, {
          eventId: input.eventId,
          waId: input.waId,
          phoneLast10: identity.phoneLast10,
        });
        if (raced) return raced;
      }
      throw error;
    }
  };

  if (!isPrismaRegistrationPersistence()) {
    return withAttemptLock(() => run(prisma));
  }
  return prisma.$transaction((tx) => run(tx));
}

export async function syncWhatsAppRegistrationAttempt(input: {
  attemptId: string;
  currentStep: string;
  name: string | null;
  email: string | null;
  classLabel: string | null;
  gender: RegistrationAttemptRecord["gender"];
  board: string | null;
  interestedStream: string | null;
  college: string | null;
  city: string | null;
  seminarInterests: string[];
  lastStep: RegistrationAttemptStep | null;
  clearProgress?: boolean;
  now?: Date;
}): Promise<RegistrationAttemptRecord | null> {
  const now = input.now ?? new Date();
  const apply = (attempt: RegistrationAttemptRecord): RegistrationAttemptRecord => {
    if (attempt.status !== "IN_PROGRESS") return attempt;
    const cleared = input.clearProgress ? blankProgress() : null;
    const email = cleared ? null : input.email;
    return {
      ...attempt,
      name: cleared ? null : input.name,
      email,
      emailNormalized: cleared ? null : normalizeAttemptEmail(email),
      classLabel: cleared ? null : input.classLabel,
      gender: cleared ? null : input.gender,
      board: cleared ? null : input.board,
      interestedStream: cleared ? null : input.interestedStream,
      college: cleared ? null : input.college,
      city: cleared ? null : input.city,
      seminarInterests: cleared ? [] : input.seminarInterests,
      lastStep: input.lastStep ?? attempt.lastStep,
      lastActivityAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  };

  if (!isPrismaRegistrationPersistence()) {
    return withAttemptLock(() => {
      const attempts = readJsonAttempts();
      const index = attempts.findIndex((row) => row.id === input.attemptId);
      if (index < 0) return null;
      const next = apply(attempts[index]);
      attempts[index] = next;
      writeJsonAttempts(attempts);
      return next;
    });
  }

  const existing = await prisma.registrationAttempt.findUnique({
    where: { id: input.attemptId },
  });
  if (!existing || existing.status !== "IN_PROGRESS") {
    return existing ? mapPrismaAttempt(existing) : null;
  }
  const next = apply(mapPrismaAttempt(existing));
  const record = await prisma.registrationAttempt.update({
    where: { id: input.attemptId },
    data: {
      name: next.name,
      email: next.email,
      emailNormalized: next.emailNormalized,
      classLabel: next.classLabel,
      gender: next.gender,
      board: next.board,
      interestedStream: next.interestedStream,
      college: next.college,
      city: next.city,
      seminarInterests: next.seminarInterests,
      lastStep: next.lastStep,
      lastActivityAt: now,
    },
  });
  return mapPrismaAttempt(record);
}

export async function abandonWhatsAppRegistrationAttempt(input: {
  attemptId?: string | null;
  waId: string;
  eventId: string;
}): Promise<RegistrationAttemptRecord | null> {
  const abandon = (attempt: RegistrationAttemptRecord): RegistrationAttemptRecord => ({
    ...attempt,
    status: "ABANDONED",
    updatedAt: new Date().toISOString(),
  });

  if (!isPrismaRegistrationPersistence()) {
    return withAttemptLock(() => {
      const attempts = readJsonAttempts();
      const index = attempts.findIndex(
        (row) =>
          row.status === "IN_PROGRESS" &&
          row.source === "WHATSAPP" &&
          row.eventId === input.eventId &&
          (row.id === input.attemptId || row.whatsappWaId === input.waId)
      );
      if (index < 0) return null;
      const next = abandon(attempts[index]);
      attempts[index] = next;
      writeJsonAttempts(attempts);
      return next;
    });
  }

  const existing = await prisma.registrationAttempt.findFirst({
    where: {
      status: "IN_PROGRESS",
      source: "WHATSAPP",
      eventId: input.eventId,
      OR: [
        ...(input.attemptId ? [{ id: input.attemptId }] : []),
        { whatsappWaId: input.waId },
      ],
    },
  });
  if (!existing) return null;
  const record = await prisma.registrationAttempt.update({
    where: { id: existing.id },
    data: { status: "ABANDONED" },
  });
  return mapPrismaAttempt(record);
}

export async function createWebsiteRegistrationAttempt(input: {
  eventId: string;
  phone: string;
  name: string;
  email: string;
  now?: Date;
}): Promise<RegistrationAttemptRecord> {
  const now = input.now ?? new Date();
  const phone = normalizeAttemptPhone(input.phone);
  const email = input.email.trim();
  const emailNormalized = normalizeAttemptEmail(email);

  const reuseOrCreate = (attempts: RegistrationAttemptRecord[]) => {
    const existing = attempts.find(
      (row) =>
        row.status === "IN_PROGRESS" &&
        row.source === "WEBSITE" &&
        row.eventId === input.eventId &&
        phone.phoneLast10 !== null &&
        row.phoneLast10 === phone.phoneLast10
    );
    if (existing) {
      const next: RegistrationAttemptRecord = {
        ...existing,
        phone: phone.phone,
        phoneLast10: phone.phoneLast10,
        name: input.name.trim(),
        email,
        emailNormalized,
        lastActivityAt: now.toISOString(),
        updatedAt: now.toISOString(),
        lastStep: existing.lastStep === "YOU" ? "YOU" : existing.lastStep,
      };
      return { attempts: attempts.map((row) => (row.id === existing.id ? next : row)), result: next };
    }
    const created: RegistrationAttemptRecord = {
      id: `rat-${generateId()}`,
      eventId: input.eventId,
      source: "WEBSITE",
      status: "IN_PROGRESS",
      phone: phone.phone,
      phoneLast10: phone.phoneLast10,
      email,
      emailNormalized,
      name: input.name.trim(),
      classLabel: null,
      gender: null,
      board: null,
      interestedStream: null,
      college: null,
      city: null,
      seminarInterests: [],
      lastStep: "YOU",
      startedAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      completedAt: null,
      completedRegistrationId: null,
      whatsappWaId: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    return { attempts: [created, ...attempts], result: created };
  };

  if (!isPrismaRegistrationPersistence()) {
    return withAttemptLock(() => {
      const current = readJsonAttempts();
      const next = reuseOrCreate(current);
      writeJsonAttempts(next.attempts);
      return next.result;
    });
  }

  return prisma.$transaction(async (tx) => {
    const existing = phone.phoneLast10
      ? await tx.registrationAttempt.findFirst({
          where: {
            status: "IN_PROGRESS",
            source: "WEBSITE",
            eventId: input.eventId,
            phoneLast10: phone.phoneLast10,
          },
        })
      : null;
    if (existing) {
      const record = await tx.registrationAttempt.update({
        where: { id: existing.id },
        data: {
          phone: phone.phone,
          phoneLast10: phone.phoneLast10,
          name: input.name.trim(),
          email,
          emailNormalized,
          lastActivityAt: now,
          ...(existing.lastStep === "YOU" ? { lastStep: "YOU" as const } : {}),
        },
      });
      return mapPrismaAttempt(record);
    }
    const record = await tx.registrationAttempt.create({
      data: {
        id: `rat-${generateId()}`,
        eventId: input.eventId,
        source: "WEBSITE",
        status: "IN_PROGRESS",
        phone: phone.phone,
        phoneLast10: phone.phoneLast10,
        email,
        emailNormalized,
        name: input.name.trim(),
        lastStep: "YOU",
        startedAt: now,
        lastActivityAt: now,
        seminarInterests: [],
      },
    });
    return mapPrismaAttempt(record);
  });
}

export async function updateWebsiteRegistrationAttemptAcademics(input: {
  attemptId: string;
  phoneLast10: string;
  college: string;
  classLabel: string;
  board: string;
  interestedStream: string;
  city: string;
  gender: RegistrationAttemptRecord["gender"];
  now?: Date;
}): Promise<RegistrationAttemptRecord | null> {
  const now = input.now ?? new Date();
  const apply = (attempt: RegistrationAttemptRecord): RegistrationAttemptRecord | null => {
    if (
      attempt.status !== "IN_PROGRESS" ||
      attempt.source !== "WEBSITE" ||
      attempt.phoneLast10 !== input.phoneLast10
    ) {
      return null;
    }
    return {
      ...attempt,
      college: input.college,
      classLabel: input.classLabel,
      board: input.board,
      interestedStream: input.interestedStream,
      city: input.city,
      gender: input.gender,
      lastStep: "ACADEMICS",
      lastActivityAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  };

  if (!isPrismaRegistrationPersistence()) {
    return withAttemptLock(() => {
      const attempts = readJsonAttempts();
      const index = attempts.findIndex((row) => row.id === input.attemptId);
      if (index < 0) return null;
      const next = apply(attempts[index]);
      if (!next) return null;
      attempts[index] = next;
      writeJsonAttempts(attempts);
      return next;
    });
  }

  const existing = await prisma.registrationAttempt.findUnique({
    where: { id: input.attemptId },
  });
  if (!existing) return null;
  const next = apply(mapPrismaAttempt(existing));
  if (!next) return null;
  const record = await prisma.registrationAttempt.update({
    where: { id: input.attemptId },
    data: {
      college: next.college,
      classLabel: next.classLabel,
      board: next.board,
      interestedStream: next.interestedStream,
      city: next.city,
      gender: next.gender,
      lastStep: "ACADEMICS",
      lastActivityAt: now,
    },
  });
  return mapPrismaAttempt(record);
}

export async function finalizeRegistrationAttemptsWithClient(
  client: AttemptClient,
  input: {
    attemptId?: string | null;
    eventId: string;
    registrationId: string;
    phone?: string | null;
    email?: string | null;
    lastStep?: RegistrationAttemptStep;
    seminarInterests?: string[];
    completedAt: Date;
  }
): Promise<void> {
  const phoneLast10 = normalizeAttemptPhone(input.phone ?? "").phoneLast10;
  const emailNormalized = normalizeAttemptEmail(input.email);
  const jsonMode = client === prisma && !isPrismaRegistrationPersistence();

  const applyJson = () => {
    const attempts = readJsonAttempts();
    let completingId = input.attemptId ?? null;
    const next = attempts.map((attempt) => {
      if (
        completingId &&
        attempt.id === completingId &&
        attempt.status === "IN_PROGRESS" &&
        attempt.eventId === input.eventId
      ) {
        return {
          ...attempt,
          status: "COMPLETED" as const,
          completedAt: input.completedAt.toISOString(),
          lastActivityAt: input.completedAt.toISOString(),
          completedRegistrationId: input.registrationId,
          lastStep: input.lastStep ?? attempt.lastStep,
          seminarInterests: input.seminarInterests ?? attempt.seminarInterests,
          updatedAt: input.completedAt.toISOString(),
        };
      }
      if (
        attemptsMatchForAbandon({
          attempt,
          eventId: input.eventId,
          phoneLast10,
          emailNormalized,
          excludeAttemptId: completingId,
        })
      ) {
        return {
          ...attempt,
          status: "ABANDONED" as const,
          updatedAt: input.completedAt.toISOString(),
        };
      }
      return attempt;
    });
    if (completingId && !next.some((row) => row.id === completingId && row.status === "COMPLETED")) {
      throw new Error("Registration attempt could not be completed");
    }
    writeJsonAttempts(next);
  };

  if (jsonMode) {
    applyJson();
    return;
  }

  if (input.attemptId) {
    const updated = await client.registrationAttempt.updateMany({
      where: {
        id: input.attemptId,
        eventId: input.eventId,
        status: "IN_PROGRESS",
      },
      data: {
        status: "COMPLETED",
        completedAt: input.completedAt,
        lastActivityAt: input.completedAt,
        completedRegistrationId: input.registrationId,
        ...(input.lastStep ? { lastStep: input.lastStep } : {}),
        ...(input.seminarInterests ? { seminarInterests: input.seminarInterests } : {}),
      },
    });
    if (updated.count !== 1) {
      throw new Error("Registration attempt could not be completed");
    }
  }

  const orFilters = [
    ...(phoneLast10 ? [{ phoneLast10 }] : []),
    ...(emailNormalized ? [{ emailNormalized }] : []),
  ];
  if (orFilters.length === 0) return;
  await client.registrationAttempt.updateMany({
    where: {
      eventId: input.eventId,
      status: "IN_PROGRESS",
      ...(input.attemptId ? { id: { not: input.attemptId } } : {}),
      OR: orFilters,
    },
    data: { status: "ABANDONED" },
  });
}

export async function finalizeRegistrationAttempts(input: {
  attemptId?: string | null;
  eventId: string;
  registrationId: string;
  phone?: string | null;
  email?: string | null;
  lastStep?: RegistrationAttemptStep;
  seminarInterests?: string[];
  completedAt?: Date;
}): Promise<void> {
  const completedAt = input.completedAt ?? new Date();
  if (!isPrismaRegistrationPersistence()) {
    await withAttemptLock(() =>
      finalizeRegistrationAttemptsWithClient(prisma, { ...input, completedAt })
    );
    return;
  }
  await prisma.$transaction((tx) =>
    finalizeRegistrationAttemptsWithClient(tx, { ...input, completedAt })
  );
}

export async function findInProgressWhatsAppRegistrationAttempt(input: {
  eventId: string;
  waId: string;
}): Promise<RegistrationAttemptRecord | null> {
  const identity = phoneIdentityFromWaId(input.waId);
  if (!isPrismaRegistrationPersistence()) {
    return withAttemptLock(() =>
      findInProgressWhatsApp(prisma, {
        eventId: input.eventId,
        waId: input.waId,
        phoneLast10: identity.phoneLast10,
      })
    );
  }
  return findInProgressWhatsApp(prisma, {
    eventId: input.eventId,
    waId: input.waId,
    phoneLast10: identity.phoneLast10,
  });
}

export function registrationAttemptStorePath(): string {
  return STORE_PATH;
}

export type { RegistrationAttemptSource };
