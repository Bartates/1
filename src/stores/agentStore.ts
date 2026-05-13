import type { AgentId } from "@/agents/types";
import { create } from "zustand";

interface AgentState {
  activeAgent: AgentId | null;
  busy: boolean;
  lastEvent: string | null;
  setActiveAgent: (id: AgentId | null) => void;
  setBusy: (busy: boolean) => void;
  setLastEvent: (event: string | null) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  activeAgent: null,
  busy: false,
  lastEvent: null,
  setActiveAgent: (id) => set({ activeAgent: id }),
  setBusy: (busy) => set({ busy }),
  setLastEvent: (event) => set({ lastEvent: event }),
}));
