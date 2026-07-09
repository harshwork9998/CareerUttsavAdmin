"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import { mockUsers } from "@/lib/mock-data";
import { MOCK_ADMIN } from "@/constants";

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
        await new Promise((r) => setTimeout(r, 800));
        if (email === MOCK_ADMIN.email && password === MOCK_ADMIN.password) {
          const user = mockUsers.find((u) => u.email === email) ?? mockUsers[0];
          set({ user, isAuthenticated: true, rememberMe });
          return { success: true };
        }
        return { success: false, error: "Invalid email or password" };
      },
      logout: () => set({ user: null, isAuthenticated: false, rememberMe: false }),
    }),
    { name: "cu-auth", partialize: (s) => (s.rememberMe ? { user: s.user, isAuthenticated: s.isAuthenticated, rememberMe: s.rememberMe } : {}) }
  )
);
