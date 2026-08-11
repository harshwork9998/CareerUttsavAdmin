import fs from "fs";
import path from "path";

import { ROLE_ID_BY_NAME } from "@/constants";
import { mockUsers } from "@/lib/mock-data/users";
import { generateId } from "@/lib/utils";
import type { RegisterPayload } from "@/types/auth";
import type { RoleName, User, UserStatus } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "users-store.json");

export interface UserAuthRecord {
  password: string;
  user: User;
}

interface SeedPasswords {
  [email: string]: string;
}

const SEED_PASSWORDS: SeedPasswords = {
  "admin@careeruttsav.in": "admin123",
  "admin@careeruttsav.com": "admin123",
  "user@careeruttsav.com": "user123",
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function seedStore(): UserAuthRecord[] {
  const seed: UserAuthRecord[] = mockUsers.map((user) => ({
    user,
    password:
      SEED_PASSWORDS[normalizeEmail(user.email)] ?? "changeme",
  }));

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), "utf-8");
  return seed;
}

/** Ensure known seed logins exist even if an older users-store.json is already present. */
function ensureSeedAccounts(records: UserAuthRecord[]): UserAuthRecord[] {
  const byEmail = new Map(
    records.map((record) => [normalizeEmail(record.user.email), record])
  );
  let changed = false;

  for (const user of mockUsers) {
    const email = normalizeEmail(user.email);
    if (byEmail.has(email)) continue;
    byEmail.set(email, {
      user,
      password: SEED_PASSWORDS[email] ?? "changeme",
    });
    changed = true;
  }

  if (!changed) return records;

  const next = Array.from(byEmail.values());
  saveUserAuthRecords(next);
  return next;
}

export function loadUserAuthRecords(): UserAuthRecord[] {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return seedStore();
    }

    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as UserAuthRecord[];
    if (!Array.isArray(parsed)) {
      return seedStore();
    }

    return ensureSeedAccounts(parsed);
  } catch {
    return seedStore();
  }
}

export function saveUserAuthRecords(records: UserAuthRecord[]): UserAuthRecord[] {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2), "utf-8");
  return records;
}

export function loadUsers(): User[] {
  return loadUserAuthRecords().map((record) => record.user);
}

export function findUserById(id: string): User | null {
  return loadUsers().find((user) => user.id === id) ?? null;
}

export function isEmailRegistered(email: string): boolean {
  const normalized = normalizeEmail(email);
  return loadUserAuthRecords().some(
    (record) => normalizeEmail(record.user.email) === normalized
  );
}

export type AuthLookupResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "blocked"; status: UserStatus; user: User };

export function authenticateUser(
  email: string,
  password: string
): AuthLookupResult {
  const normalized = normalizeEmail(email);
  const record = loadUserAuthRecords().find(
    (candidate) =>
      normalizeEmail(candidate.user.email) === normalized &&
      candidate.password === password
  );

  if (!record) {
    return { ok: false, reason: "invalid" };
  }

  if (record.user.status !== "Active") {
    return {
      ok: false,
      reason: "blocked",
      status: record.user.status,
      user: record.user,
    };
  }

  const now = new Date().toISOString();
  const updatedUser: User = {
    ...record.user,
    lastLogin: now,
    updatedAt: now,
  };

  saveUserAuthRecords(
    loadUserAuthRecords().map((candidate) =>
      candidate.user.id === record.user.id
        ? { ...candidate, user: updatedUser }
        : candidate
    )
  );

  return { ok: true, user: updatedUser };
}

/** @deprecated Use authenticateUser — kept for internal compatibility. */
export function findUserByCredentials(
  email: string,
  password: string
): User | null {
  const result = authenticateUser(email, password);
  return result.ok ? result.user : null;
}

export function createRegisteredUser(payload: RegisterPayload): User {
  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(payload.email);

  const user: User = {
    id: `usr-${generateId()}`,
    name: payload.fullName.trim(),
    email: normalizedEmail,
    phone: payload.mobile,
    role: "user",
    roleId: ROLE_ID_BY_NAME.user,
    status: "Pending Approval",
    department: "Pending Review",
    createdAt: now,
    updatedAt: now,
  };

  const records = loadUserAuthRecords().filter(
    (record) => normalizeEmail(record.user.email) !== normalizedEmail
  );

  records.unshift({
    password: payload.password,
    user,
  });

  saveUserAuthRecords(records);
  return user;
}

export function createUserRecord(
  user: Omit<User, "id" | "createdAt" | "updatedAt">,
  password = "changeme"
): User {
  const now = new Date().toISOString();
  const created: User = {
    ...user,
    id: `usr-${generateId()}`,
    createdAt: now,
    updatedAt: now,
  };

  saveUserAuthRecords([
    { password, user: created },
    ...loadUserAuthRecords(),
  ]);

  return created;
}

export function updateUserRecord(id: string, patch: Partial<User>): User | null {
  const records = loadUserAuthRecords();
  const index = records.findIndex((record) => record.user.id === id);
  if (index === -1) return null;

  const updated: User = {
    ...records[index].user,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  records[index] = { ...records[index], user: updated };
  saveUserAuthRecords(records);
  return updated;
}

export function reviewUserAccount(
  id: string,
  action: "approve" | "reject",
  role?: RoleName
): User | null {
  const records = loadUserAuthRecords();
  const index = records.findIndex((record) => record.user.id === id);
  if (index === -1) return null;

  const current = records[index].user;
  if (current.status !== "Pending Approval") {
    return null;
  }

  const now = new Date().toISOString();

  if (action === "reject") {
    const rejected: User = {
      ...current,
      status: "Rejected",
      updatedAt: now,
    };
    records[index] = { ...records[index], user: rejected };
    saveUserAuthRecords(records);
    return rejected;
  }

  const assignedRole = role ?? "user";
  const approved: User = {
    ...current,
    status: "Active",
    role: assignedRole,
    roleId: ROLE_ID_BY_NAME[assignedRole],
    department: current.department === "Pending Review" ? undefined : current.department,
    updatedAt: now,
  };

  records[index] = { ...records[index], user: approved };
  saveUserAuthRecords(records);
  return approved;
}

export function updateStoredPassword(email: string, password: string): boolean {
  const normalized = normalizeEmail(email);
  const records = loadUserAuthRecords();
  const index = records.findIndex(
    (record) => normalizeEmail(record.user.email) === normalized
  );

  if (index === -1) return false;

  records[index] = { ...records[index], password };
  saveUserAuthRecords(records);
  return true;
}

export function getUsersStorePath() {
  return STORE_PATH;
}
