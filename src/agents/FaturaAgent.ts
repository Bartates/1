import { BaseAgent } from "@/agents/BaseAgent";
import type { AgentRequest, AgentResponse } from "@/agents/types";

export class FaturaAgent extends BaseAgent {
  readonly id = "fatura" as const;
  readonly yetkiler = ["fatura.read", "fatura.write", "rapor.read"] as const;

  async islemYap(talep: AgentRequest): Promise<AgentResponse> {
    this.yayinla("fatura.islem", { action: talep.action });
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
