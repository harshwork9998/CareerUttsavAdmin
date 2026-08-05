import type { StudentRegistration } from "@/types";

const FEMALE_FIRST_NAMES = new Set([
  "ishita",
  "priya",
  "ananya",
  "meera",
  "kavya",
  "sneha",
  "divya",
  "neha",
  "pooja",
  "shruti",
  "tanvi",
  "lakshmi",
  "anjali",
  "swathi",
  "anusha",
]);

function inferStream(course?: string): string {
  const c = (course || "").toLowerCase();
  if (
    c.includes("commerce") ||
    c.includes("bba") ||
    c.includes("b.com") ||
    c.includes("bcom")
  ) {
    return "Commerce";
  }
  if (
    c.includes("humanities") ||
    c.includes("arts") ||
    c.includes("b.a") ||
    c.includes("psychology") ||
    c.includes("economics")
  ) {
    return "Arts";
  }
  return "Science";
}

const SCHOOL_CLASSES = [
  "Grade 9",
  "Grade 10",
  "Grade 11 (I PUC)",
  "Grade 12 (II PUC)",
  "Others",
] as const;

function inferClass(r: StudentRegistration): string {
  if (SCHOOL_CLASSES.includes(r.classLabel as (typeof SCHOOL_CLASSES)[number])) {
    return r.classLabel as (typeof SCHOOL_CLASSES)[number];
  }
  // School fair — grades 4–12 only (no university years)
  return SCHOOL_CLASSES[(r.college?.length || 0) % SCHOOL_CLASSES.length];
}

function inferGender(r: StudentRegistration): "Male" | "Female" | "Other" {
  if (r.gender) return r.gender;
  const first = (r.studentName.split(" ")[0] || "").toLowerCase();
  return FEMALE_FIRST_NAMES.has(first) ? "Female" : "Male";
}

function inferBoard(r: StudentRegistration): string {
  if (r.board) return r.board;
  const boards = ["CBSE", "State Board", "ICSE", "PUC", "IB / IGCSE"];
  let h = 0;
  for (const ch of r.college) h = (h + ch.charCodeAt(0)) % boards.length;
  return boards[h];
}

function inferParentPhone(r: StudentRegistration): string {
  if (r.parentPhone) return r.parentPhone;
  const digits = r.phone.replace(/\D/g, "").slice(-10) || "9876500000";
  const n = (Number(digits) + 13579) % 10000000000;
  const s = String(n).padStart(10, "0");
  return `+91 ${s.slice(0, 5)} ${s.slice(5)}`;
}

/** Fills school-fair fields used by the registrations table. */
export function normalizeRegistration(r: StudentRegistration): StudentRegistration {
  return {
    ...r,
    classLabel: inferClass(r),
    interestedStream: r.interestedStream || inferStream(r.course),
    board: inferBoard(r),
    gender: inferGender(r),
    parentPhone: inferParentPhone(r),
  };
}
