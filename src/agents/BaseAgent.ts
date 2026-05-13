import { agentBus } from "@/agents/AgentBus";
import type {
  AgentEvent,
  AgentId,
  AgentPermission,
  AgentRequest,
  AgentResponse,
} from "@/agents/types";

export abstract class BaseAgent {
  abstract readonly id: AgentId;
  abstract readonly yetkiler: readonly AgentPermission[];

  yetkiKontrolu(izin: AgentPermission): boolean {
    return this.yetkiler.includes(izin);
  }

  protected yayinla(type: string, payload?: Record<string, unknown>) {
    agentBus.emit(this.id, type, payload);
  }

  onEvent(handler: (event: AgentEvent) => void): () => void {
    return agentBus.onEvent(handler);
  }

  abstract islemYap(talep: AgentRequest): Promise<AgentResponse>;
}
