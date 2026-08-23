"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from "@/services/auth-service";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
  hydrated: boolean;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      rememberMe: false,
      hydrated: false,
      login: async (email, password, rememberMe = false) => {
        const result = await loginRequest({ email, password, rememberMe });

        if (result.success && result.user) {
          set({
            user: result.user,
            isAuthenticated: true,
            rememberMe,
            hydrated: true,
          });
          return { success: true };
        }

        return {
          success: false,
          error: result.error ?? "Invalid email or password",
        };
      },
      logout: async () => {
        await logoutRequest();
        set({ user: null, isAuthenticated: false, rememberMe: false });
      },
      restoreSession: async () => {
        const user = await fetchCurrentUser();
        if (user) {
          set({ user, isAuthenticated: true, hydrated: true });
        } else {
          set({ user: null, isAuthenticated: false, hydrated: true });
        }
      },
    }),
    {
      name: "cu-auth",
      partialize: (s) =>
        s.rememberMe
          ? {
              user: s.user,
              isAuthenticated: s.isAuthenticated,
              rememberMe: s.rememberMe,
            }
          : {},
    }
  )
);
