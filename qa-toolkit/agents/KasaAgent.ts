import { BaseAgent } from "@/agents/BaseAgent";
import type { AgentRequest, AgentResponse } from "@/agents/types";

export class KasaAgent extends BaseAgent {
  readonly id = "kasa" as const;
  readonly yetkiler = ["kasa.read", "kasa.write", "rapor.read"] as const;

  async islemYap(talep: AgentRequest): Promise<AgentResponse> {
    this.yayinla("kasa.islem", { action: talep.action });
    return {
      ok: true,
      data: {
        agent: this.id,
        action: talep.action,
        status: "queued",
      },
    };
  }
}
