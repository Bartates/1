export type AgentId = "satis" | "stok" | "cari" | "kasa" | "fatura" | "rapor";

export type AgentSettings = Record<AgentId, boolean>;

const STORAGE_KEY = "sobaYonetim";

const defaultAgentSettings: AgentSettings = {
  satis: true,
  stok: true,
  cari: true,
  kasa: true,
  fatura: true,
  rapor: true,
};

type StoredShape = {
  agentSettings?: Partial<AgentSettings>;
};

export function loadAgentSettings(): AgentSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultAgentSettings };

    const parsed = JSON.parse(raw) as StoredShape;
    const partial = parsed.agentSettings || {};

    return {
      ...defaultAgentSettings,
      ...partial,
    };
  } catch {
    return { ...defaultAgentSettings };
  }
}

export function saveAgentSettings(next: AgentSettings) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredShape) : ({} as StoredShape);
    parsed.agentSettings = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // localStorage hatası: sessiz geç
  }
}

export function setAgentEnabled(agentId: AgentId, enabled: boolean) {
  const current = loadAgentSettings();
  const next: AgentSettings = { ...current, [agentId]: enabled };
  saveAgentSettings(next);
  return next;
}
