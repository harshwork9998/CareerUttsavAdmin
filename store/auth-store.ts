"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import { login as loginRequest } from "@/services/auth-service";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      rememberMe: false,
      login: async (email, password, rememberMe = false) => {
        const result = await loginRequest({ email, password, rememberMe });

        if (result.success && result.user) {
          set({ user: result.user, isAuthenticated: true, rememberMe });
          return { success: true };
        }

        return {
          success: false,
          error: result.error ?? "Invalid email or password",
        };
      },
      logout: () => set({ user: null, isAuthenticated: false, rememberMe: false }),
    }),
    { name: "cu-auth", partialize: (s) => (s.rememberMe ? { user: s.user, isAuthenticated: s.isAuthenticated, rememberMe: s.rememberMe } : {}) }
  )
);
