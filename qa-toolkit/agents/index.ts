import { CariAgent } from "@/agents/CariAgent";
import { FaturaAgent } from "@/agents/FaturaAgent";
import { KasaAgent } from "@/agents/KasaAgent";
import { RaporAgent } from "@/agents/RaporAgent";
import { SatisAgent } from "@/agents/SatisAgent";
import { StokAgent } from "@/agents/StokAgent";
import type { AgentId } from "@/agents/types";

export { BaseAgent } from "@/agents/BaseAgent";
export { CariAgent } from "@/agents/CariAgent";
export { FaturaAgent } from "@/agents/FaturaAgent";
export { KasaAgent } from "@/agents/KasaAgent";
export { RaporAgent } from "@/agents/RaporAgent";
export { SatisAgent } from "@/agents/SatisAgent";
export { StokAgent } from "@/agents/StokAgent";

const agents = {
  stok: new StokAgent(),
  kasa: new KasaAgent(),
  satis: new SatisAgent(),
  cari: new CariAgent(),
  fatura: new FaturaAgent(),
  rapor: new RaporAgent(),
};

export function getAgent(id: AgentId) {
  return agents[id];
}

export function getAllAgents() {
  return Object.values(agents);
}
