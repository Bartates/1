import { BaseAgent } from "@/agents/BaseAgent";
import type { AgentRequest, AgentResponse } from "@/agents/types";

export class SatisAgent extends BaseAgent {
  readonly id = "satis" as const;
  readonly yetkiler = ["satis.read", "satis.write", "rapor.read"] as const;

  async islemYap(talep: AgentRequest): Promise<AgentResponse> {
    this.yayinla("satis.islem", { action: talep.action });
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
