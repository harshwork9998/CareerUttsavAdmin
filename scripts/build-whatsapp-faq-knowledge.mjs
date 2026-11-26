/**
 * One-off builder: Excel FAQ master → versioned JSON.
 * Production runtime must not parse Excel.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const SOURCE = "Career_Uttsav_WhatsApp_Bot_FAQ_Master_v3.xlsx";
const OUT = "lib/server/whatsapp/faq/knowledge.v3.json";

function clean(value) {
  return String(value ?? "")
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const wb = XLSX.readFile(SOURCE);
const faqs = XLSX.utils.sheet_to_json(wb.Sheets["FAQ Master"], { defval: "" });
const seminars = XLSX.utils.sheet_to_json(wb.Sheets["2026 Seminars"], { defval: "" });
const rules = XLSX.utils.sheet_to_json(wb.Sheets["Bot Rules & Routing"], { defval: "" });
const pending = XLSX.utils.sheet_to_json(wb.Sheets["Pending Confirmations"], { defval: "" });

const SUPPORT_CHIRAG =
  "Please contact Chirag Jain on 6364224321 for help with this.";
const SUPPORT_NEHA =
  "For partner, stall, sponsorship or exhibitor enquiries, please contact Mrs. Neha on 9113064877.";

const excluded = [];
const conditional = [];
const included = [];

function keywordsFrom(question, alts) {
  const raw = `${question}; ${alts}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
  const words = raw.split(/\s+/).filter((word) => word.length > 3);
  return [...new Set(words)];
}

function actionFor(routing) {
  const text = String(routing);
  if (text.includes("SEND_SEMINAR_POSTER")) return ["SEND_SEMINAR_POSTER"];
  if (text.includes("pass API") || text.includes("resend") || text.includes("fetch registration") || text.includes("registration status")) {
    return ["RESEND_ENTRY_PASS"];
  }
  if (text.includes("Start existing registration")) return ["HINT_START_REGISTRATION"];
  if (text.includes("map link") || text.includes("Maps")) return ["SEND_VENUE_LOCATION"];
  if (text.includes("opt-out") || text.includes("Record opt-out")) return ["RECORD_OPT_OUT"];
  return [];
}

const entries = [];

for (const row of faqs) {
  const id = clean(row.ID);
  const status = clean(row["Approval status"]);
  const question = clean(row["Visitor question"]);
  const answer = clean(row["Recommended warm answer"]);
  const routing = clean(row["Bot action / routing"]);
  const category = clean(row.Category);
  const alts = clean(row["Alternate phrasings / keywords"]);

  if (id === "CU-139") {
    excluded.push({ id, reason: "Existing STOP opt-out handler owns this. FAQ copy conflicts with campaign unsubscribe." });
    continue;
  }
  if (id === "CU-004") {
    excluded.push({ id, reason: "Timings are 'Verify before launch' and Pending Confirmations still list published timings as unconfirmed." });
    continue;
  }
  if (id === "CU-038") {
    excluded.push({ id, reason: "Question asks if the bus is free. Organiser answer starts with Yes, which can be read as a price promise. Transport rule: do not invent cost; direct to Chirag." });
    continue;
  }
  if (status === "Approved draft" || status === "Human confirmation" || status === "Privacy policy needed" || status === "Language implementation needed") {
    excluded.push({ id, status, reason: "Not organiser-confirmed. Drafts, privacy, language-mode and callback promises are not served as facts." });
    continue;
  }
  if (status === "Verify venue wording" || status === "Link needed") {
    conditional.push({ id, status, reason: "Workbook venue/map copy is not organiser-confirmed. Runtime uses the existing code venue address and maps URL, and sends a native pin only when the venue flag is on." });
    entries.push({
      id,
      category,
      status: "conditional_code_venue",
      question,
      alternatePhrasings: alts ? alts.split(";").map((part) => part.trim()).filter(Boolean) : [],
      keywords: keywordsFrom(question, alts),
      answer:
        "Career Uttsav 2026 is at Gate No. 9, Princess Golf, Palace Grounds, Bengaluru.",
      actions: ["SEND_VENUE_LOCATION"],
      source: "existing_registration_venue_constant",
    });
    continue;
  }
  if (status === "Poster supplied") {
    conditional.push({ id, status, reason: "Poster supplied, not a separate organiser FAQ approval. Included because the 2026 Seminars sheet confirms the day split and the poster file already exists." });
  }
  if (status !== "Organiser confirmed" && status !== "Live integration" && status !== "Poster supplied") {
    excluded.push({ id, status, reason: "Unrecognised approval status." });
    continue;
  }

  let safeAnswer = answer;
  if (id === "CU-026" || routing.toLowerCase().includes("update permitted")) {
    safeAnswer = `Registration changes and cancellations are handled by our support team. ${SUPPORT_CHIRAG}`;
    conditional.push({ id, reason: "Workbook asked to update fields. Stricter rule: changes go to Chirag. No in-chat edits." });
  }

  const actions = actionFor(routing).filter((action) => action !== "RECORD_OPT_OUT");
  entries.push({
    id,
    category,
    status: status === "Organiser confirmed" ? "organiser_confirmed" : status === "Poster supplied" ? "poster_supplied" : "live_integration",
    question,
    alternatePhrasings: alts ? alts.split(";").map((part) => part.trim()).filter(Boolean) : [],
    keywords: keywordsFrom(question, alts),
    answer: safeAnswer,
    actions,
    source: "faq_master",
  });
  included.push({ id, status });
}

entries.push({
  id: "RULE-PARENTS",
  category: "Event",
  status: "bot_rule",
  question: "Can parents attend?",
  alternatePhrasings: ["are parents allowed", "can my mom come", "parent entry"],
  keywords: ["parents", "parent", "mom", "dad", "guardian", "attend"],
  answer: "Yes. Parents are welcome. They are important decision-makers, and they can explore the event with you.",
  actions: [],
  source: "bot_rules",
});
conditional.push({ id: "RULE-PARENTS", reason: "CU-006 answer is only an approved draft. Short answer taken from the stricter Bot Rules row, not the draft copy." });

entries.push({
  id: "RULE-SUPPORT",
  category: "Support",
  status: "bot_rule",
  question: "I want to speak to a person",
  alternatePhrasings: ["human", "agent", "call me", "speak to team", "complaint"],
  keywords: ["person", "human", "agent", "complaint", "callback", "call"],
  answer: `There isn't a live agent transfer on this chat. ${SUPPORT_CHIRAG}`,
  actions: [],
  source: "bot_rules",
});
conditional.push({ id: "RULE-SUPPORT", reason: "Drafts promised human handover or callbacks. No agent inbox exists, so the bot shares Chirag's number instead." });

entries.push({
  id: "RULE-BUS-COST",
  category: "Transport",
  status: "bot_rule",
  question: "Is the bus free?",
  alternatePhrasings: ["bus charges", "transport cost", "shuttle price"],
  keywords: ["bus", "free", "charge", "charges", "cost", "price", "shuttle"],
  answer: `We can help with a bus facility, but I can't confirm charges here. ${SUPPORT_CHIRAG}`,
  actions: [],
  source: "bot_rules",
});

entries.push({
  id: "RULE-TIMINGS",
  category: "Event",
  status: "safe_fallback",
  question: "What are the event timings?",
  alternatePhrasings: ["what time does it start", "opening hours"],
  keywords: ["timings", "timing", "hours", "opening"],
  answer: `Session times and daily opening hours are not confirmed in the organiser FAQ yet. ${SUPPORT_CHIRAG}`,
  actions: [],
  source: "pending_confirmations",
});

entries.push({
  id: "RULE-DATES",
  category: "Event",
  status: "organiser_confirmed",
  question: "When is Career Uttsav?",
  alternatePhrasings: ["when is the event", "event dates", "kab hai"],
  keywords: ["when", "date", "dates", "december"],
  answer: "Career Uttsav is on 19 and 20 December 2026. Opening hours are not confirmed yet.",
  actions: [],
  source: "confirmed_event_dates",
});
conditional.push({
  id: "RULE-DATES",
  reason: "CU-002 stays excluded as an approved draft. This entry uses the confirmed 19 and 20 December 2026 dates and does not publish opening hours.",
});

const seminarRows = seminars.map((row) => ({
  number: Number(row["Session #"]),
  date: clean(row.Date),
  day: clean(row.Day),
  title: clean(row["Seminar / panel discussion"]),
  sessionTime: null,
  speaker: null,
  notes: "Times and speakers are not confirmed. Do not invent them.",
}));

const knowledge = {
  version: "3.0.0",
  sourceWorkbook: SOURCE,
  generatedBy: "scripts/build-whatsapp-faq-knowledge.mjs",
  support: {
    registrationAndTransport: { name: "Chirag Jain", phone: "6364224321" },
    partners: { name: "Mrs. Neha", phone: "9113064877" },
    website: "https://careeruttsav.in/",
  },
  rules: rules.map((row) => ({
    topic: clean(row.Topic),
    requirement: clean(row["Developer requirement"]),
  })),
  pendingConfirmations: pending.map((row) => ({
    priority: clean(row.Priority),
    item: clean(row["Information to confirm"]),
  })),
  seminars: seminarRows,
  entries,
  report: {
    included: entries.map((entry) => entry.id),
    excluded,
    conditional,
  },
};

writeFileSync(OUT, `${JSON.stringify(knowledge, null, 2)}\n`);
console.log(`wrote ${entries.length} entries, excluded ${excluded.length}`);
