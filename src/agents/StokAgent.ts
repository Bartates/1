import { BaseAgent } from "@/agents/BaseAgent";
import type { AgentRequest, AgentResponse } from "@/agents/types";

export class StokAgent extends BaseAgent {
  readonly id = "stok" as const;
  readonly yetkiler = ["stok.read", "stok.write", "rapor.read"] as const;

  async islemYap(talep: AgentRequest): Promise<AgentResponse> {
    this.yayinla("stok.islem", { action: talep.action });
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
