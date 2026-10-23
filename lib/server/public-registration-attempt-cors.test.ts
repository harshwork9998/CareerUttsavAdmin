import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { config, middleware } from "@/middleware";

vi.mock("@/lib/server/event-service", () => ({
  listEventsForApi: vi.fn(async () => [{ id: CURRENT_EVENT_ID }]),
}));

vi.mock("@/lib/server/registration-service", () => ({
  checkStudentRegistrationDuplicate: vi.fn(async () => ({ duplicate: false })),
}));

vi.mock("@/lib/server/registration-persistence-mode", () => ({
  isPrismaRegistrationPersistence: vi.fn(() => false),
}));

vi.mock("@/lib/server/admin-auth", () => ({
  requireAdminUser: vi.fn(async () => ({ id: "admin" })),
}));

import { POST as createAttempt } from "@/app/api/registration-attempts/route";
import { PATCH as updateAttempt } from "@/app/api/registration-attempts/[id]/route";
import { GET as registrationCheckGet } from "@/app/api/registrations/check/route";
import { POST as sendOtpPost } from "@/app/api/send-otp/route";
import { POST as verifyOtpPost } from "@/app/api/verify-otp/route";
import { sendOtp, verifyOtp } from "@/lib/otp";
import { __resetOtpStoreForTests, __setOtpStoreForTests } from "@/lib/otp/persistence";
import { MOCK_OTP_CODE } from "@/lib/otp/types";
import {
  __resetRegistrationAttemptStoreForTests,
  __setRegistrationAttemptStoreForTests,
  listRegistrationAttempts,
} from "@/lib/server/registration-attempt-store";

const ALLOWED_ORIGIN = "https://careeruttsav.in";
const BLOCKED_ORIGIN = "https://not-careeruttsav.example";
const PHONE = "9876543210";
const WEBSITE_HTML = path.resolve(process.cwd(), "../CareerUttsav2026/index.html");

function publicRequest(
  pathname: string,
  method: string,
  origin: string | null,
  init?: { body?: string; requestMethod?: string }
) {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  headers.set("x-cu-client", "public");
  if (method === "OPTIONS") {
    headers.set("access-control-request-method", init?.requestMethod ?? "POST");
    headers.set("access-control-request-headers", "content-type, x-cu-client");
  } else if (init?.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  return new NextRequest(`http://admin.careeruttsav.in${pathname}`, {
    method,
    headers,
    body: method === "GET" || method === "OPTIONS" ? undefined : init?.body,
  });
}

function corsOf(response: Response) {
  return {
    origin: response.headers.get("access-control-allow-origin"),
    methods: response.headers.get("access-control-allow-methods"),
    headers: response.headers.get("access-control-allow-headers"),
    vary: response.headers.get("vary"),
  };
}

async function applyMiddlewareCors(request: NextRequest, routeResponse: Response) {
  const gated = await middleware(request);
  expect(gated.headers.get("x-middleware-next")).toBe("1");
  const headers = new Headers(routeResponse.headers);
  for (const name of [
    "access-control-allow-origin",
    "access-control-allow-methods",
    "access-control-allow-headers",
    "vary",
  ]) {
    const value = gated.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(routeResponse.body, {
    status: routeResponse.status,
    headers,
  });
}

async function verificationToken() {
  const sent = await sendOtp({ phone: PHONE, purpose: "student_registration" });
  expect(sent.ok).toBe(true);
  const verified = await verifyOtp({
    phone: PHONE,
    purpose: "student_registration",
    code: MOCK_OTP_CODE,
  });
  expect(verified.ok).toBe(true);
  if (!verified.ok) throw new Error("otp");
  return verified.verificationToken;
}

function attemptBody(token: string) {
  return JSON.stringify({
    eventId: CURRENT_EVENT_ID,
    phone: PHONE,
    name: "Website Student",
    email: "web@example.com",
    phoneVerificationToken: token,
  });
}

function extractFunction(source: string, name: string) {
  const start = source.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unclosed ${name}`);
}

describe("public registration attempt CORS", () => {
  const originalOtpProvider = process.env.OTP_PROVIDER;

  beforeEach(() => {
    process.env.OTP_PROVIDER = "mock";
    __setOtpStoreForTests([]);
    __setRegistrationAttemptStoreForTests([]);
  });

  afterEach(() => {
    if (originalOtpProvider === undefined) delete process.env.OTP_PROVIDER;
    else process.env.OTP_PROVIDER = originalOtpProvider;
    __resetOtpStoreForTests();
    __resetRegistrationAttemptStoreForTests();
  });

  it("answers OPTIONS for the website origin and allows the POST preflight", async () => {
    const preflight = await middleware(
      publicRequest("/api/registration-attempts", "OPTIONS", ALLOWED_ORIGIN, {
        requestMethod: "POST",
      })
    );
    expect(preflight.status).toBe(204);
    const cors = corsOf(preflight);
    expect(cors.origin).toBe(ALLOWED_ORIGIN);
    expect(cors.origin).not.toBe("*");
    expect(cors.methods).toContain("POST");
    expect(cors.methods).toContain("OPTIONS");
    expect(cors.headers?.toLowerCase()).toContain("content-type");
    expect(cors.headers?.toLowerCase()).toContain("x-cu-client");
    expect(cors.vary).toBe("Origin");

    const postGate = await middleware(
      publicRequest("/api/registration-attempts", "POST", ALLOWED_ORIGIN, {
        body: "{}",
      })
    );
    expect(postGate.headers.get("x-middleware-next")).toBe("1");
    expect(corsOf(postGate).origin).toBe(ALLOWED_ORIGIN);
    expect(config.matcher).toContain("/api/registration-attempts");
  });

  it("creates one attempt from POST and repeats the same id on retry", async () => {
    const token = await verificationToken();
    const body = attemptBody(token);
    const created = await applyMiddlewareCors(
      publicRequest("/api/registration-attempts", "POST", ALLOWED_ORIGIN, { body }),
      await createAttempt(
        new Request("http://admin.careeruttsav.in/api/registration-attempts", {
          method: "POST",
          headers: { "content-type": "application/json", origin: ALLOWED_ORIGIN },
          body,
        })
      )
    );
    expect(created.status).toBe(200);
    expect(corsOf(created).origin).toBe(ALLOWED_ORIGIN);
    const first = (await created.json()) as { attemptId: string };
    expect(first.attemptId).toMatch(/^rat-/);

    const retried = await applyMiddlewareCors(
      publicRequest("/api/registration-attempts", "POST", ALLOWED_ORIGIN, { body }),
      await createAttempt(
        new Request("http://admin.careeruttsav.in/api/registration-attempts", {
          method: "POST",
          headers: { "content-type": "application/json", origin: ALLOWED_ORIGIN },
          body,
        })
      )
    );
    expect(corsOf(retried).origin).toBe(ALLOWED_ORIGIN);
    const second = (await retried.json()) as { attemptId: string };
    expect(second.attemptId).toBe(first.attemptId);
    const rows = await listRegistrationAttempts();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("WEBSITE");
  });

  it("allows PATCH after preflight and keeps CORS on success and validation errors", async () => {
    const token = await verificationToken();
    const created = await createAttempt(
      new Request("http://admin.careeruttsav.in/api/registration-attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: attemptBody(token),
      })
    );
    const { attemptId } = (await created.json()) as { attemptId: string };
    const patchPath = `/api/registration-attempts/${attemptId}`;

    const preflight = await middleware(
      publicRequest(patchPath, "OPTIONS", ALLOWED_ORIGIN, { requestMethod: "PATCH" })
    );
    expect(preflight.status).toBe(204);
    expect(corsOf(preflight).origin).toBe(ALLOWED_ORIGIN);
    expect(corsOf(preflight).methods).toContain("PATCH");
    expect(config.matcher).toContain("/api/registration-attempts/:path*");

    const invalid = await applyMiddlewareCors(
      publicRequest(patchPath, "PATCH", ALLOWED_ORIGIN, { body: "{" }),
      await updateAttempt(
        new Request(`http://admin.careeruttsav.in${patchPath}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
        { params: Promise.resolve({ id: attemptId }) }
      )
    );
    expect(invalid.status).toBe(400);
    expect(corsOf(invalid).origin).toBe(ALLOWED_ORIGIN);
    expect(corsOf(invalid).headers?.toLowerCase()).toContain("content-type");

    const postError = await applyMiddlewareCors(
      publicRequest("/api/registration-attempts", "POST", ALLOWED_ORIGIN, { body: "{" }),
      await createAttempt(
        new Request("http://admin.careeruttsav.in/api/registration-attempts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        })
      )
    );
    expect(postError.status).toBe(400);
    expect(corsOf(postError).origin).toBe(ALLOWED_ORIGIN);

    const academics = JSON.stringify({
      phone: PHONE,
      phoneVerificationToken: token,
      college: "Website College",
      classLabel: "Class 10",
      board: "CBSE",
      interestedStream: "Science",
      city: "Bengaluru",
      gender: "Female",
    });
    const patched = await applyMiddlewareCors(
      publicRequest(patchPath, "PATCH", ALLOWED_ORIGIN, { body: academics }),
      await updateAttempt(
        new Request(`http://admin.careeruttsav.in${patchPath}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: academics,
        }),
        { params: Promise.resolve({ id: attemptId }) }
      )
    );
    expect(patched.status).toBe(200);
    expect(corsOf(patched).origin).toBe(ALLOWED_ORIGIN);
    expect(corsOf(patched).methods).toContain("PATCH");
    expect(((await patched.json()) as { attemptId: string }).attemptId).toBe(attemptId);
  });

  it("does not open a disallowed origin", async () => {
    for (const pathname of [
      "/api/registration-attempts",
      "/api/registration-attempts/rat-existing",
    ]) {
      const preflight = await middleware(
        publicRequest(pathname, "OPTIONS", BLOCKED_ORIGIN)
      );
      expect(preflight.status).toBe(403);
      expect(preflight.headers.get("access-control-allow-origin")).not.toBe(BLOCKED_ORIGIN);
      expect(preflight.headers.get("access-control-allow-origin")).not.toBe("*");

      const post = await middleware(
        publicRequest(pathname, "POST", BLOCKED_ORIGIN, { body: "{}" })
      );
      expect(post.status).toBe(403);
      expect(post.headers.get("x-middleware-next")).toBeNull();
      expect(post.headers.get("access-control-allow-origin")).not.toBe(BLOCKED_ORIGIN);
    }
  });

  it("keeps the working public registration preflights on the same policy", async () => {
    const attempt = corsOf(
      await middleware(publicRequest("/api/registration-attempts", "OPTIONS", ALLOWED_ORIGIN))
    );
    for (const pathname of ["/api/send-otp", "/api/verify-otp", "/api/registrations/check"]) {
      const response = await middleware(publicRequest(pathname, "OPTIONS", ALLOWED_ORIGIN));
      expect(response.status).toBe(204);
      expect(corsOf(response)).toEqual(attempt);
    }

    const blockedOtp = await middleware(
      publicRequest("/api/send-otp", "OPTIONS", BLOCKED_ORIGIN)
    );
    expect(blockedOtp.status).toBe(403);
    expect(blockedOtp.headers.get("access-control-allow-origin")).not.toBe(BLOCKED_ORIGIN);

    expect((await sendOtpPost(new Request("http://localhost/api/send-otp", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await verifyOtpPost(new Request("http://localhost/api/verify-otp", { method: "POST", body: "{" }))).status).toBe(400);
    expect(
      (
        await registrationCheckGet(
          new Request("http://localhost/api/registrations/check")
        )
      ).status
    ).toBe(400);
  });
});

describe("website attempt failure handling", () => {
  it("clears the spinner, keeps step 1, and allows one retry after the attempt request fails", async () => {
    const source = fs.readFileSync(WEBSITE_HTML, "utf8");
    const script = [
      extractFunction(source, "postJson"),
      extractFunction(source, "startWebsiteAttempt"),
      extractFunction(source, "advanceFromVerifiedContact"),
    ].join("\n");
    const values = {
      regMobile: { value: "9876543210" },
      regName: { value: "Ada Lovelace" },
      regEmail: { value: "ada@example.com" },
    };
    const classList = {
      names: new Set<string>(),
      add(name: string) {
        this.names.add(name);
      },
      remove(name: string) {
        this.names.delete(name);
      },
    };
    const errors: string[] = [];
    let advanced = false;
    const fetchMock = vi.fn(async (): Promise<Response> => {
      throw new TypeError("Failed to fetch");
    });
    const run = new Function(
      "fetch",
      "CU_ADMIN_API",
      "CURRENT_EVENT_ID",
      "document",
      "showFormApiError",
      "clearRegSubmitError",
      "regNext",
      "regForm",
      "TOTAL_STEPS",
      "renderStep",
      `var phoneVerificationToken = "token";
      var registrationAttemptId = "";
      var regSubmitInFlight = false;
      var currentStep = 1;
      ${script}
      return {
        advanceFromVerifiedContact,
        get registrationAttemptId() { return registrationAttemptId; },
        get regSubmitInFlight() { return regSubmitInFlight; },
        get currentStep() { return currentStep; }
      };`
    ) as (...args: unknown[]) => {
      advanceFromVerifiedContact: () => Promise<void>;
      registrationAttemptId: string;
      regSubmitInFlight: boolean;
      currentStep: number;
    };
    const api = run(
      fetchMock,
      "https://admin.careeruttsav.in",
      CURRENT_EVENT_ID,
      { getElementById: (id: string) => values[id as keyof typeof values] ?? { value: "" } },
      (_form: unknown, message: string) => {
        errors.push(message);
      },
      () => undefined,
      { classList },
      { closest: () => ({ querySelector: () => ({ scrollTop: 0 }) }) },
      4,
      () => {
        advanced = true;
      }
    );

    await api.advanceFromVerifiedContact();
    expect(classList.names.has("loading")).toBe(false);
    expect(api.regSubmitInFlight).toBe(false);
    expect(api.currentStep).toBe(1);
    expect(advanced).toBe(false);
    expect(api.registrationAttemptId).toBe("");
    expect(values.regName.value).toBe("Ada Lovelace");
    expect(values.regEmail.value).toBe("ada@example.com");
    expect(values.regMobile.value).toBe("9876543210");
    expect(errors).toEqual(["Could not save your registration progress. Please try again."]);

    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ attemptId: "rat-retry" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await api.advanceFromVerifiedContact();
    expect(api.regSubmitInFlight).toBe(false);
    expect(classList.names.has("loading")).toBe(false);
    expect(api.registrationAttemptId).toBe("rat-retry");
    expect(api.currentStep).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ attemptId: "rat-retry" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    await api.advanceFromVerifiedContact();
    expect(api.registrationAttemptId).toBe("rat-retry");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
