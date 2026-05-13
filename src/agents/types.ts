export type AgentId = "stok" | "kasa" | "cari" | "satis" | "fatura" | "rapor";

export type AgentPermission =
  | "stok.read"
  | "stok.write"
  | "kasa.read"
  | "kasa.write"
  | "cari.read"
  | "cari.write"
  | "satis.read"
  | "satis.write"
  | "fatura.read"
  | "fatura.write"
  | "rapor.read";

export interface AgentRequest {
  action: string;
  payload?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface AgentResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface AgentEvent {
  from: AgentId;
  type: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}
