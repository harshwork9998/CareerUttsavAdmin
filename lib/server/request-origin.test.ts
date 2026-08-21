import { describe, expect, it } from "vitest";

import {
  resolveAllowedOriginFromList,
  resolveApiOrigin,
  resolveExternalRequestHost,
  resolveProxyAwareSameOrigin,
  resolveRegistrationApiOrigin,
} from "@/lib/server/request-origin";

function headersFrom(
  values: Record<string, string>
): Headers {
  return new Headers(values);
}

describe("request origin resolution", () => {
  const publicOrigins = [
    "https://careeruttsav.in",
    "https://www.careeruttsav.in",
    "https://new.careeruttsav.in",
  ];

  it("allows Admin production same-origin behind reverse proxy", () => {
    const headers = headersFrom({
      origin: "https://admin.careeruttsav.in",
      "x-forwarded-host": "admin.careeruttsav.in",
      "x-forwarded-proto": "https",
      host: "127.0.0.1:3002",
    });

    expect(resolveExternalRequestHost(headers)).toBe("admin.careeruttsav.in");
    expect(
      resolveProxyAwareSameOrigin(
        "https://admin.careeruttsav.in",
        "admin.careeruttsav.in"
      )
    ).toBe("https://admin.careeruttsav.in");
    expect(resolveRegistrationApiOrigin(headers, publicOrigins)).toBe(
      "https://admin.careeruttsav.in"
    );
  });

  it("allows approved public website origins", () => {
    const headers = headersFrom({
      origin: "https://www.careeruttsav.in",
      host: "127.0.0.1:3002",
    });

    expect(resolveRegistrationApiOrigin(headers, publicOrigins)).toBe(
      "https://www.careeruttsav.in"
    );
  });

  it("rejects unapproved external origins", () => {
    const headers = headersFrom({
      origin: "https://evil.example.com",
      "x-forwarded-host": "admin.careeruttsav.in",
      host: "127.0.0.1:3002",
    });

    expect(resolveRegistrationApiOrigin(headers, publicOrigins)).toBeNull();
  });

  it("does not allow arbitrary forwarded host without matching Origin host", () => {
    expect(
      resolveProxyAwareSameOrigin(
        "https://evil.example.com",
        "admin.careeruttsav.in"
      )
    ).toBeNull();
  });

  it("behaves the same regardless of persistence mode env", () => {
    const original = process.env.REGISTRATION_PERSISTENCE;
    const headers = headersFrom({
      origin: "https://admin.careeruttsav.in",
      "x-forwarded-host": "admin.careeruttsav.in",
    });

    delete process.env.REGISTRATION_PERSISTENCE;
    expect(resolveRegistrationApiOrigin(headers, publicOrigins)).toBe(
      "https://admin.careeruttsav.in"
    );

    process.env.REGISTRATION_PERSISTENCE = "prisma";
    expect(resolveRegistrationApiOrigin(headers, publicOrigins)).toBe(
      "https://admin.careeruttsav.in"
    );

    if (original === undefined) {
      delete process.env.REGISTRATION_PERSISTENCE;
    } else {
      process.env.REGISTRATION_PERSISTENCE = original;
    }
  });

  it("falls back to host when forwarded host is absent", () => {
    const headers = headersFrom({
      origin: "http://localhost:3002",
      host: "localhost:3002",
    });

    expect(resolveApiOrigin(headers, publicOrigins)).toBe(
      "http://localhost:3002"
    );
    expect(resolveAllowedOriginFromList("http://localhost:3002", [])).toBe(
      "http://localhost:3002"
    );
  });
});
