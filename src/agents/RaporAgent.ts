import { BaseAgent } from "@/agents/BaseAgent";
import type { AgentRequest, AgentResponse } from "@/agents/types";

export class RaporAgent extends BaseAgent {
  readonly id = "rapor" as const;
  readonly yetkiler = [
    "stok.read",
    "kasa.read",
    "cari.read",
    "satis.read",
    "fatura.read",
    "rapor.read",
  ] as const;

  async islemYap(talep: AgentRequest): Promise<AgentResponse> {
    this.yayinla("rapor.islem", { action: talep.action });
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
