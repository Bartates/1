import { BaseAgent } from "@/agents/BaseAgent";
import type { AgentRequest, AgentResponse } from "@/agents/types";

export class CariAgent extends BaseAgent {
  readonly id = "cari" as const;
  readonly yetkiler = ["cari.read", "cari.write", "rapor.read"] as const;

  async islemYap(talep: AgentRequest): Promise<AgentResponse> {
    this.yayinla("cari.islem", { action: talep.action });
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
