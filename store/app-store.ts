"use client";

import { create } from "zustand";
import { mockEvents } from "@/lib/mock-data";

interface AppState {
  currentEventId: string;
  setCurrentEventId: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentEventId: mockEvents[0]?.id ?? "evt-001",
  setCurrentEventId: (currentEventId) => set({ currentEventId }),
}));
