import type {
  ActivityLog,
  Cari,
  Invoice,
  KasaEntry,
  Product,
  Sale,
  StockMovement,
} from "@/types";
import Dexie, { type Table } from "dexie";

export interface AgentAuditRecord {
  id: string;
  agent: string;
  islem: string;
  detail?: string;
  timestamp: string;
}

export interface DbSnapshot {
  id: string;
  data: string;
  updatedAt: string;
}

export class ParspelDB extends Dexie {
  urunler!: Table<Product, string>;
  satislar!: Table<Sale, string>;
  stokHareketleri!: Table<StockMovement, string>;
  kasaHareketleri!: Table<KasaEntry, string>;
  cariler!: Table<Cari, string>;
  faturalar!: Table<Invoice, string>;
  activityLog!: Table<ActivityLog, string>;
  auditLog!: Table<AgentAuditRecord, string>;
  snapshots!: Table<DbSnapshot, string>;

  constructor() {
    super("ParspelDB");

    this.version(1).stores({
      urunler: "id, name, category, stock, updatedAt",
      satislar: "id, createdAt, total, payment, cariId, productId",
      stokHareketleri: "id, productId, type, date",
      kasaHareketleri: "id, kasa, type, amount, createdAt",
      cariler: "id, name, type, balance, updatedAt",
      faturalar: "id, invoiceNo, cariId, total, status, createdAt",
      activityLog: "id, action, time",
      auditLog: "id, agent, islem, timestamp",
      snapshots: "id, updatedAt",
    });
  }
}

export const indexedDb = new ParspelDB();
