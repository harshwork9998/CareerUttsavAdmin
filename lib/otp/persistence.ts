import fs from "fs";
import path from "path";

import type { OtpChallenge } from "@/lib/otp/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "otp-store.json");

function ensureStore(): OtpChallenge[] {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, "[]", "utf-8");
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as unknown;
    return Array.isArray(parsed) ? (parsed as OtpChallenge[]) : [];
  } catch {
    fs.writeFileSync(STORE_PATH, "[]", "utf-8");
    return [];
  }
}

export function loadOtpChallenges(): OtpChallenge[] {
  return ensureStore();
}

export function saveOtpChallenges(challenges: OtpChallenge[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(challenges, null, 2), "utf-8");
}

/** Drop expired, unverified challenges older than 24h to keep the store small. */
export function pruneOtpChallenges(challenges: OtpChallenge[]): OtpChallenge[] {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return challenges.filter((challenge) => {
    if (challenge.verifiedAt && challenge.verificationTokenExpiresAt) {
      return (
        new Date(challenge.verificationTokenExpiresAt).getTime() > Date.now()
      );
    }
    return new Date(challenge.createdAt).getTime() > cutoff;
  });
}
