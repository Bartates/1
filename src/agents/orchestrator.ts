import { getAgent } from "@/agents";
import { loadAgentSettings, type AgentId } from "@/lib/agentConfig";

export type OrchestratorAction = {
  type:
    | "sale"
    | "kasa_gelir"
    | "kasa_gider"
    | "stok_guncelle"
    | "cari_tahsilat"
    | "urun_ekle"
    | "cari_ekle";
  label: string;
  payload: Record<string, unknown>;
};

export function planAgentFlow(action: OrchestratorAction): string[] {
  if (action.type === "sale") {
    const payment = String(action.payload.payment || "nakit");
    const steps = ["satis", "stok"];
    if (payment !== "cari") steps.push("kasa");
    if (payment === "cari" || action.payload.cariId || action.payload.cariName) {
      steps.push("cari");
    }
    steps.push("fatura", "rapor");
    return steps;
  }

  if (action.type === "kasa_gelir" || action.type === "kasa_gider") {
    return ["kasa", "rapor"];
  }
  if (action.type === "stok_guncelle" || action.type === "urun_ekle") {
    return ["stok", "rapor"];
  }
  if (action.type === "cari_tahsilat" || action.type === "cari_ekle") {
    return ["cari", "rapor"];
  }
  return ["rapor"];
}

function filterDisabledAgents(flow: string[]) {
  const settings = loadAgentSettings();
  return flow.filter((id) => {
    // sadece bilinen agent'lar disable edilebilir
    const agentId = id as AgentId;
    return typeof settings[agentId] === "boolean" ? settings[agentId] : true;
  });
}

export function dispatchAgentFlow(action: OrchestratorAction) {
  const flow = filterDisabledAgents(planAgentFlow(action));
  for (const id of flow) {
    const agent = getAgent(id as Parameters<typeof getAgent>[0]);
    void agent.islemYap({
      action: action.type,
      payload: action.payload,
      meta: { label: action.label, source: "ai-assistant" },
    });
  }
  return flow;
}
