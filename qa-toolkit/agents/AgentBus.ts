import type { AgentEvent, AgentId } from "@/agents/types";
import mitt, { type Emitter } from "mitt";

type BusEvents = {
  event: AgentEvent;
};

class AgentBus {
  private emitter: Emitter<BusEvents>;

  constructor() {
    this.emitter = mitt<BusEvents>();
  }

  emit(from: AgentId, type: string, payload?: Record<string, unknown>) {
    this.emitter.emit("event", {
      from,
      type,
      payload,
      createdAt: new Date().toISOString(),
    });
  }

  onEvent(handler: (event: AgentEvent) => void): () => void {
    this.emitter.on("event", handler);
    return () => this.emitter.off("event", handler);
  }
}

export const agentBus = new AgentBus();
