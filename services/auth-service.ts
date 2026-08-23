import type {
  AuthApiResponse,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
} from "@/types/auth";
import type { User } from "@/types";

/** Base URL for auth API — wire to env when backend is ready. */
export const AUTH_API_BASE =
  process.env.NEXT_PUBLIC_AUTH_API_URL ?? "/api/auth";

async function postAuth<TBody extends object>(
  path: string,
  body: TBody
): Promise<AuthApiResponse & { user?: User }> {
  const response = await fetch(`${AUTH_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as
    | (AuthApiResponse & { user?: User })
    | null;

  if (!response.ok || !data) {
    return {
      success: false,
      error: data?.error ?? "Request failed",
    };
  }

  return data;
}

export interface LoginResult extends AuthApiResponse {
  user?: User;
}

/** Sign in with email and password. */
export async function login(payload: LoginPayload): Promise<LoginResult> {
  return postAuth("/login", {
    email: payload.email.trim(),
    password: payload.password,
    rememberMe: payload.rememberMe,
  });
}

/** Register a new admin account. */
export async function register(payload: RegisterPayload): Promise<AuthApiResponse> {
  return postAuth("/register", {
    fullName: payload.fullName.trim(),
    email: payload.email.trim(),
    mobile: payload.mobile,
    password: payload.password,
  });
}

/** Restore session from HttpOnly cookie. */
export async function fetchCurrentUser(): Promise<User | null> {
  const response = await fetch(`${AUTH_API_BASE}/me`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as { user?: User } | null;
  return data?.user ?? null;
}

/** Clear server session cookie. */
export async function logout(): Promise<void> {
  await fetch(`${AUTH_API_BASE}/logout`, {
    method: "POST",
    credentials: "include",
  });
}

/** Request a password reset link for the given email. */
export async function forgotPassword(
  payload: ForgotPasswordPayload
): Promise<AuthApiResponse> {
  return postAuth("/forgot-password", {
    email: payload.email.trim(),
  });
}

/** Reset password using a token from the reset email. */
export async function resetPassword(
  payload: ResetPasswordPayload
): Promise<AuthApiResponse> {
  return postAuth("/reset-password", {
    token: payload.token,
    password: payload.password,
  });
}
