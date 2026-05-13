import { dispatchAgentFlow } from "@/agents/orchestrator";
import { useSpeechRecognition, useSpeechSynthesis } from "@/hooks/useSpeech";
import { loadConnConfig } from "@/lib/connConfig";
import { getUserSession } from "@/lib/userManager";
import { formatMoney, genId } from "@/lib/utils-tr";
import type { DB } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SaveFn = (updater: (prev: DB) => DB) => void;

interface Props {
  db: DB;
  save?: SaveFn;
  embedded?: boolean;
}

// â”€â”€ DB İşlem Tipleri â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface DBAction {
  type:
    | "sale"
    | "kasa_gelir"
    | "kasa_gider"
    | "stok_guncelle"
    | "cari_tahsilat"
    | "urun_ekle"
    | "cari_ekle";
  label: string; // kullanıcıya gösterilecek özet
  payload: Record<string, unknown>;
}

// AI yanıtından ACTION bloğunu parse et
function parseActions(text: string): DBAction[] {
  const actions: DBAction[] = [];
  const regex = /```action\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      if (obj.type && obj.label) actions.push(obj as DBAction);
    } catch {
      /* ignore malformed */
    }
  }
  return actions;
}

// AI yanıtından ACTION bloklarını temizle (chat'te gösterme)
function stripActions(text: string): string {
  return text.replace(/```action\n[\s\S]*?```/g, "").trim();
}

function validateAction(prev: DB, action: DBAction): string | null {
  const p = action.payload;

  if (action.type === "sale") {
    const product = prev.products.find(
      (pr) => pr.id === p.productId || pr.name === p.productName,
    );
    if (!product)
      return `Ürün bulunamadı: ${String(p.productName || p.productId || "")}`;
    const qty = Number(p.quantity);
    const unitPrice = Number(p.unitPrice);
    if (!Number.isFinite(qty) || qty <= 0)
      return "Satış miktarı 0 dan büyük olmalı";
    if (!Number.isFinite(unitPrice) || unitPrice < 0)
      return "Birim fiyat negatif olamaz";
    if (qty > product.stock)
      return `${product.name} için yetersiz stok (${product.stock})`;
    return null;
  }

  if (action.type === "kasa_gelir" || action.type === "kasa_gider") {
    const amount = Number(p.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return "Kasa tutarı 0 dan büyük olmalı";
    return null;
  }

  if (action.type === "stok_guncelle") {
    const product = prev.products.find(
      (pr) => pr.id === p.productId || pr.name === p.productName,
    );
    if (!product)
      return `Ürün bulunamadı: ${String(p.productName || p.productId || "")}`;
    const stock = Number(p.stock);
    if (!Number.isFinite(stock) || stock < 0) return "Yeni stok negatif olamaz";
    return null;
  }

  if (action.type === "cari_tahsilat") {
    const cari = prev.cari.find(
      (c) => c.id === p.cariId || c.name === p.cariName,
    );
    if (!cari)
      return `Cari bulunamadı: ${String(p.cariName || p.cariId || "")}`;
    const amount = Number(p.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return "Tahsilat tutarı 0 dan büyük olmalı";
    if (amount > cari.balance)
      return `Tahsilat müşteri bakiyesini aşıyor (${formatMoney(cari.balance)})`;
    return null;
  }

  if (action.type === "urun_ekle") {
    const name = String(p.name || "").trim();
    if (!name) return "Ürün adı zorunlu";
    const exists = prev.products.some(
      (pr) => !pr.deleted && pr.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) return `Aynı isimde ürün zaten var: ${name}`;
    const cost = Number(p.cost);
    const price = Number(p.price);
    const stock = Number(p.stock);
    if (Number.isFinite(cost) && cost < 0) return "Alış fiyatı negatif olamaz";
    if (Number.isFinite(price) && price < 0)
      return "Satış fiyatı negatif olamaz";
    if (Number.isFinite(stock) && stock < 0) return "Stok negatif olamaz";
    return null;
  }

  if (action.type === "cari_ekle") {
    const name = String(p.name || "").trim();
    if (!name) return "Cari adı zorunlu";
    const exists = prev.cari.some(
      (c) => !c.deleted && c.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) return `Aynı isimde cari zaten var: ${name}`;
    const balance = Number(p.balance);
    if (Number.isFinite(balance) && balance < 0)
      return "Başlangıç bakiyesi negatif olamaz";
    return null;
  }

  return null;
}

function findProductByRef(db: DB, payload: Record<string, unknown>) {
  const idRef = String(payload.productId || "").trim();
  const nameRef = String(payload.productName || "").trim();
  if (idRef) {
    const byId = db.products.find((p) => !p.deleted && p.id === idRef);
    if (byId) return byId;
  }
  if (nameRef) {
    const lowered = nameRef.toLowerCase();
    const exact = db.products.find(
      (p) => !p.deleted && p.name.toLowerCase() === lowered,
    );
    if (exact) return exact;
    const candidates = db.products.filter(
      (p) => !p.deleted && p.name.toLowerCase().includes(lowered),
    );
    if (candidates.length === 1) return candidates[0];
  }
  return null;
}

function findCariByRef(db: DB, payload: Record<string, unknown>) {
  const idRef = String(payload.cariId || "").trim();
  const nameRef = String(payload.cariName || "").trim();
  if (idRef) {
    const byId = db.cari.find((c) => !c.deleted && c.id === idRef);
    if (byId) return byId;
  }
  if (nameRef) {
    const lowered = nameRef.toLowerCase();
    const exact = db.cari.find(
      (c) => !c.deleted && c.name.toLowerCase() === lowered,
    );
    if (exact) return exact;
    const candidates = db.cari.filter(
      (c) => !c.deleted && c.name.toLowerCase().includes(lowered),
    );
    if (candidates.length === 1) return candidates[0];
  }
  return null;
}

function buildFallbackActions(
  prev: DB,
  action: DBAction,
  reason: string,
): DBAction[] {
  const p = action.payload;

  if (action.type === "sale") {
    const product = findProductByRef(prev, p);
    if (!product) return [];
    const qty = Number(p.quantity);
    const unitPrice = Number(p.unitPrice);
    const candidates: DBAction[] = [];

    if (String(p.productId || "") !== product.id) {
      candidates.push({
        ...action,
        label: `${action.label} (fallback: ürün eşleştirildi)`,
        payload: { ...p, productId: product.id, productName: product.name },
      });
    }

    if (
      (reason.includes("yetersiz stok") ||
        (Number.isFinite(qty) && qty > product.stock)) &&
      product.stock > 0
    ) {
      candidates.push({
        ...action,
        label: `${action.label} (fallback: stok kadar)`,
        payload: {
          ...p,
          productId: product.id,
          productName: product.name,
          quantity: product.stock,
        },
      });
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      candidates.push({
        ...action,
        label: `${action.label} (fallback: miktar=1)`,
        payload: {
          ...p,
          productId: product.id,
          productName: product.name,
          quantity: Math.min(Math.max(1, product.stock), 1),
        },
      });
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      candidates.push({
        ...action,
        label: `${action.label} (fallback: birim fiyat düzeltildi)`,
        payload: {
          ...p,
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
        },
      });
    }
    return candidates;
  }

  if (action.type === "stok_guncelle") {
    const product = findProductByRef(prev, p);
    if (!product) return [];
    const stock = Number(p.stock);
    return [
      {
        ...action,
        label: `${action.label} (fallback: ürün/stok düzeltildi)`,
        payload: {
          ...p,
          productId: product.id,
          productName: product.name,
          stock: Number.isFinite(stock) ? Math.max(0, stock) : product.stock,
        },
      },
    ];
  }

  if (action.type === "cari_tahsilat") {
    const cari = findCariByRef(prev, p);
    if (!cari) return [];
    const amount = Number(p.amount);
    if (cari.balance <= 0) return [];
    const safeAmount =
      !Number.isFinite(amount) || amount <= 0
        ? Math.min(1, cari.balance)
        : Math.min(amount, cari.balance);
    return [
      {
        ...action,
        label: `${action.label} (fallback: cari/tutar düzeltildi)`,
        payload: {
          ...p,
          cariId: cari.id,
          cariName: cari.name,
          amount: safeAmount,
        },
      },
    ];
  }

  if (action.type === "kasa_gelir" || action.type === "kasa_gider") {
    const amount = Number(p.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return [
        {
          ...action,
          label: `${action.label} (fallback: tutar düzeltildi)`,
          payload: { ...p, amount: Math.abs(amount) || 1 },
        },
      ];
    }
  }

  return [];
}

type ActionAttemptResult = {
  next: DB;
  applied: boolean;
  appliedAction?: DBAction;
  notes: string[];
};

function applyActionWithFallback(
  prev: DB,
  action: DBAction,
): ActionAttemptResult {
  const queue: DBAction[] = [action];
  const seen = new Set<string>();
  const notes: string[] = [];

  while (queue.length > 0 && seen.size < 12) {
    const candidate = queue.shift()!;
    const key = JSON.stringify({
      type: candidate.type,
      payload: candidate.payload,
    });
    if (seen.has(key)) continue;
    seen.add(key);

    const violation = validateAction(prev, candidate);
    if (violation) {
      notes.push(`${candidate.label}: ${violation}`);
      const fallbacks = buildFallbackActions(prev, candidate, violation);
      for (const alt of fallbacks) queue.push(alt);
      continue;
    }

    try {
      const next = applyAction(prev, candidate);
      if (candidate !== action) {
        notes.push(`Fallback uygulandı: ${candidate.label}`);
      }
      return { next, applied: true, appliedAction: candidate, notes };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const reason = String(err?.message || "İşlem hatası");
      notes.push(`${candidate.label}: ${reason}`);
      const fallbacks = buildFallbackActions(prev, candidate, reason);
      for (const alt of fallbacks) queue.push(alt);
    }
  }

  return { next: prev, applied: false, notes };
}

// DB'ye işlemi uygula
function applyAction(prev: DB, action: DBAction): DB {
  const now = new Date().toISOString();
  const p = action.payload;

  if (action.type === "sale") {
    const product = prev.products.find(
      (pr) => pr.id === p.productId || pr.name === p.productName,
    );
    if (!product) throw new Error(`Ürün bulunamadı: ${p.productName}`);
    const qty = Number(p.quantity) || 1;
    const unitPrice = Number(p.unitPrice) || product.price;
    const discount = Number(p.discount) || 0;
    const total = unitPrice * qty - discount;
    const profit = (unitPrice - product.cost) * qty - discount;
    const payment = (p.payment as string) || "nakit";
    const cari = prev.cari.find(
      (c) => c.id === p.cariId || c.name === p.cariName,
    );

    const sale = {
      id: genId(),
      productId: product.id,
      productName: product.name,
      productCategory: product.category,
      customerId: cari?.id,
      cariId: cari?.id,
      cariName: cari?.name,
      quantity: qty,
      unitPrice,
      cost: product.cost,
      discount,
      discountAmount: discount,
      subtotal: unitPrice * qty,
      total,
      profit,
      payment,
      status: "tamamlandi" as const,
      items: [
        {
          productId: product.id,
          productName: product.name,
          quantity: qty,
          unitPrice,
          cost: product.cost,
          total,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const kasaEntry =
      payment !== "cari"
        ? {
            id: genId(),
            type: "gelir" as const,
            category: "satis",
            amount: total,
            kasa: payment === "nakit" ? "nakit" : "banka",
            description: `AI Satış: ${product.name} x${qty}`,
            relatedId: sale.id,
            createdAt: now,
            updatedAt: now,
          }
        : null;

    const stockMovement = {
      id: genId(),
      productId: product.id,
      productName: product.name,
      type: "satis" as const,
      amount: -qty,
      before: product.stock,
      after: product.stock - qty,
      note: "AI Asistan",
      date: now,
    };

    let updatedCari = prev.cari;
    if (payment === "cari" && cari) {
      updatedCari = prev.cari.map((c) =>
        c.id === cari.id
          ? {
              ...c,
              balance: c.balance + total,
              lastTransaction: now,
              updatedAt: now,
            }
          : c,
      );
    }

    return {
      ...prev,
      sales: [...prev.sales, sale],
      products: prev.products.map((pr) =>
        pr.id === product.id
          ? { ...pr, stock: pr.stock - qty, updatedAt: now }
          : pr,
      ),
      kasa: kasaEntry ? [...prev.kasa, kasaEntry] : prev.kasa,
      stockMovements: [...(prev.stockMovements || []), stockMovement],
      cari: updatedCari,
    };
  }

  if (action.type === "kasa_gelir" || action.type === "kasa_gider") {
    const entry = {
      id: genId(),
      type:
        action.type === "kasa_gelir" ? ("gelir" as const) : ("gider" as const),
      category:
        (p.category as string) ||
        (action.type === "kasa_gelir" ? "diger_gelir" : "diger_gider"),
      amount: Number(p.amount),
      kasa: (p.kasa as string) || "nakit",
      description: (p.description as string) || "",
      createdAt: now,
      updatedAt: now,
    };
    return { ...prev, kasa: [...prev.kasa, entry] };
  }

  if (action.type === "stok_guncelle") {
    const product = prev.products.find(
      (pr) => pr.id === p.productId || pr.name === p.productName,
    );
    if (!product) throw new Error(`Ürün bulunamadı: ${p.productName}`);
    const newStock = Number(p.stock);
    const movement = {
      id: genId(),
      productId: product.id,
      productName: product.name,
      type: "duzeltme" as const,
      amount: newStock - product.stock,
      before: product.stock,
      after: newStock,
      note: (p.note as string) || "AI Asistan düzeltme",
      date: now,
    };
    return {
      ...prev,
      products: prev.products.map((pr) =>
        pr.id === product.id ? { ...pr, stock: newStock, updatedAt: now } : pr,
      ),
      stockMovements: [...(prev.stockMovements || []), movement],
    };
  }

  if (action.type === "cari_tahsilat") {
    const cari = prev.cari.find(
      (c) => c.id === p.cariId || c.name === p.cariName,
    );
    if (!cari) throw new Error(`Cari bulunamadı: ${p.cariName}`);
    const amount = Number(p.amount);
    const kasaEntry = {
      id: genId(),
      type: "gelir" as const,
      category: "tahsilat",
      amount,
      kasa: (p.kasa as string) || "nakit",
      description: `Tahsilat: ${cari.name}`,
      cariId: cari.id,
      createdAt: now,
      updatedAt: now,
    };
    return {
      ...prev,
      kasa: [...prev.kasa, kasaEntry],
      cari: prev.cari.map((c) =>
        c.id === cari.id
          ? {
              ...c,
              balance: c.balance - amount,
              lastTransaction: now,
              updatedAt: now,
            }
          : c,
      ),
    };
  }

  if (action.type === "urun_ekle") {
    const name = String(p.name || "").trim();
    if (!name) throw new Error("Ürün adı zorunlu");
    const exists = prev.products.some(
      (pr) => !pr.deleted && pr.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) throw new Error(`Aynı isimde ürün zaten var: ${name}`);
    const product = {
      id: genId(),
      name,
      category: String(p.category || "soba"),
      brand: String(p.brand || ""),
      cost: Number(p.cost) || 0,
      price: Number(p.price) || 0,
      stock: Number(p.stock) || 0,
      minStock: Number(p.minStock) || 5,
      createdAt: now,
      updatedAt: now,
    };
    return { ...prev, products: [...prev.products, product] };
  }

  if (action.type === "cari_ekle") {
    const name = String(p.name || "").trim();
    if (!name) throw new Error("Cari adı zorunlu");
    const exists = prev.cari.some(
      (c) => !c.deleted && c.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) throw new Error(`Aynı isimde cari zaten var: ${name}`);
    const cari = {
      id: genId(),
      name,
      type: (p.type === "tedarikci" ? "tedarikci" : "musteri") as
        | "musteri"
        | "tedarikci",
      taxNo: String(p.taxNo || ""),
      phone: String(p.phone || ""),
      email: String(p.email || ""),
      address: String(p.address || ""),
      balance: Number(p.balance) || 0,
      createdAt: now,
      updatedAt: now,
    };
    return { ...prev, cari: [...prev.cari, cari] };
  }

  return prev;
}
interface Message {
  role: "user" | "assistant";
  content: string;
  source?: "claude" | "gemini" | "offline";
}

// â”€â”€ Firebase AI Key Yönetimi â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getAiKeysUrl(): string {
  const cfg = loadConnConfig();
  const apiKey =
    cfg.firebase.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "";
  const projectId =
    cfg.firebase.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "";
  if (!projectId || !apiKey) return "";
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/aikeys?key=${apiKey}`;
}

async function loadKeysFromFirebase(): Promise<{
  claude: string;
  gemini: string;
  state: "ok" | "forbidden" | "unavailable" | "missing-config";
}> {
  const url = getAiKeysUrl();
  if (!url) return { claude: "", gemini: "", state: "missing-config" };
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403)
        return { claude: "", gemini: "", state: "forbidden" };
      return { claude: "", gemini: "", state: "unavailable" };
    }
    const json = await res.json();
    return {
      claude: json?.fields?.claude?.stringValue || "",
      gemini: json?.fields?.gemini?.stringValue || "",
      state: "ok",
    };
  } catch {
    return { claude: "", gemini: "", state: "unavailable" };
  }
}

async function saveKeysToFirebase(
  claude: string,
  gemini: string,
): Promise<boolean> {
  const url = getAiKeysUrl();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          claude: { stringValue: claude },
          gemini: { stringValue: gemini },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Oturum cache â€” sekme kapanınca silinir, localStorage'a yazılmaz
const _keyCache: { claude: string; gemini: string; loaded: boolean } = {
  claude: "",
  gemini: "",
  loaded: false,
};

async function getKeys(): Promise<{
  claude: string;
  gemini: string;
  state: "ok" | "forbidden" | "unavailable" | "missing-config" | "env";
}> {
  // .env'de key varsa her zaman önce onu kullan, cache'e gerek yok
  const envClaude = import.meta.env.VITE_CLAUDE_API_KEY || "";
  const envGemini = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (envClaude || envGemini) {
    return { claude: envClaude, gemini: envGemini, state: "env" };
  }
  // .env'de yoksa Firebase'den al (cache ile)
  if (_keyCache.loaded && !_keyCache.claude && !_keyCache.gemini) {
    _keyCache.loaded = false;
  }
  if (_keyCache.loaded)
    return { claude: _keyCache.claude, gemini: _keyCache.gemini, state: "ok" };
  const keys = await loadKeysFromFirebase();
  _keyCache.claude = keys.claude;
  _keyCache.gemini = keys.gemini;
  _keyCache.loaded = true;
  return {
    claude: _keyCache.claude,
    gemini: _keyCache.gemini,
    state: keys.state,
  };
}

function invalidateKeyCache() {
  _keyCache.loaded = false;
  _keyCache.claude = "";
  _keyCache.gemini = "";
}

// â”€â”€ Offline kural tabanlı sistem â”€â”€
function offlineReply(db: DB, query: string): string {
  const q = query.toLowerCase();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthSales = db.sales.filter(
    (s) =>
      !s.deleted &&
      s.status === "tamamlandi" &&
      new Date(s.createdAt) >= monthStart,
  );
  const ciro = monthSales.reduce((s, x) => s + x.total, 0);
  const kar = monthSales.reduce((s, x) => s + x.profit, 0);
  const activeKasa = db.kasa.filter((k) => !k.deleted);
  const kasaToplam = activeKasa.reduce(
    (s, k) => s + (k.type === "gelir" ? k.amount : -k.amount),
    0,
  );
  const nakit = activeKasa
    .filter((k) => k.kasa === "nakit")
    .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
  const banka = activeKasa
    .filter((k) => k.kasa === "banka")
    .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);

  if (q.includes("stok") || q.includes("ürün") || q.includes("sipariş")) {
    const activeProducts = db.products.filter((p) => !p.deleted);
    const out = activeProducts.filter((p) => p.stock === 0);
    const low = activeProducts.filter(
      (p) => p.stock > 0 && p.stock <= p.minStock,
    );
    const stokDeger = activeProducts.reduce((s, p) => s + p.cost * p.stock, 0);
    return `📦 **Stok Ozeti**\n- Toplam urun: ${activeProducts.length} | Stok degeri: ${formatMoney(stokDeger)}\n- Stok biten: ${out.length}${
      out.length
        ? "\n  " +
          out
            .slice(0, 5)
            .map((p) => `â€¢ ${p.name}`)
            .join("\n  ")
        : ""
    }\n- Az stoklu: ${low.length}${
      low.length
        ? "\n  " +
          low
            .slice(0, 5)
            .map((p) => `â€¢ ${p.name} (${p.stock}/${p.minStock})`)
            .join("\n  ")
        : ""
    }\n\n⚠️ *Cevrimdisi mod - derin analiz icin internet gerekli*`;
  }
  if (
    q.includes("kasa") ||
    q.includes("nakit") ||
    q.includes("para") ||
    q.includes("sermaye")
  ) {
    const alacak = db.cari
      .filter((c) => !c.deleted && c.type === "musteri" && c.balance > 0)
      .reduce((s, c) => s + c.balance, 0);
    const borc = db.cari
      .filter((c) => !c.deleted && c.type === "tedarikci" && c.balance > 0)
      .reduce((s, c) => s + c.balance, 0);
    const netSermaye = kasaToplam + alacak - borc;
    return `💰 **Kasa ve Sermaye**\n- Nakit: ${formatMoney(nakit)}\n- Banka: ${formatMoney(banka)}\n- Toplam Kasa: ${formatMoney(kasaToplam)}\n- Musteri Alacagi: ${formatMoney(alacak)}\n- Tedarikci Borcu: ${formatMoney(borc)}\n- **Net Sermaye: ${formatMoney(netSermaye)}**\n\n⚠️ *Cevrimdisi mod*`;
  }
  if (
    q.includes("alacak") ||
    q.includes("borç") ||
    q.includes("cari") ||
    q.includes("müşteri") ||
    q.includes("tahsilat")
  ) {
    const activeCari = db.cari.filter((c) => !c.deleted);
    const alacak = activeCari
      .filter((c) => c.type === "musteri" && c.balance > 0)
      .reduce((s, c) => s + c.balance, 0);
    const topBorclu = [...activeCari]
      .filter((c) => c.type === "musteri" && c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
    // Gecikmiş alacaklar
    const overdue = activeCari
      .filter((c) => c.type === "musteri" && c.balance > 0)
      .map((c) => {
        const lastPay = db.kasa
          .filter((k) => !k.deleted && k.cariId === c.id && k.type === "gelir")
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0];
        const refDate = lastPay
          ? new Date(lastPay.createdAt)
          : c.lastTransaction
            ? new Date(c.lastTransaction)
            : null;
        const days = refDate
          ? Math.floor((Date.now() - refDate.getTime()) / 86400000)
          : null;
        return { ...c, days };
      })
      .filter((c) => c.days !== null && c.days >= 30)
      .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
    return `👤 **Cari ve Alacak Ozeti**\n- Toplam alacak: ${formatMoney(alacak)}\n- Alacakli musteri: ${topBorclu.length}\n\n**En Yuksek 5 Alacak:**\n${topBorclu.map((c) => `- ${c.name}: ${formatMoney(c.balance)}`).join("\n") || "Yok"}${
      overdue.length > 0
        ? `\n\n⚠️ **Gecikmis Alacaklar (30+ gun):**\n${overdue
            .slice(0, 5)
            .map(
              (c) =>
                `- ${c.name}: ${formatMoney(c.balance)} - ${c.days} gun`,
            )
            .join("\n")}`
        : ""
    }`;
  }
  if (
    q.includes("satış") ||
    q.includes("analiz") ||
    q.includes("performans") ||
    q.includes("bu ay") ||
    q.includes("kâr")
  ) {
    const marj = ciro > 0 ? ((kar / ciro) * 100).toFixed(1) : "0";
    const topProducts = Object.entries(
      db.sales
        .filter(
          (s) =>
            !s.deleted &&
            s.status === "tamamlandi" &&
            new Date(s.createdAt) >= monthStart,
        )
        .reduce(
          (acc, s) => {
            acc[s.productName] = (acc[s.productName] || 0) + s.total;
            return acc;
          },
          {} as Record<string, number>,
        ),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return `📊 **Bu Ay Satis Ozeti**\n- ${monthSales.length} satis\n- Ciro: ${formatMoney(ciro)}\n- Kar: ${formatMoney(kar)} (%${marj} marj)\n\n**Bu Ay Top 3 Urun:**\n${topProducts.map(([n, v], i) => `${i + 1}. ${n}: ${formatMoney(v)}`).join("\n") || "Veri yok"}\n\n⚠️ *Cevrimdisi mod - karsilastirmali analiz icin internet gerekli*`;
  }
  if (
    q.includes("risk") ||
    q.includes("kritik") ||
    q.includes("öneri") ||
    q.includes("ipucu")
  ) {
    const out = db.products.filter((p) => !p.deleted && p.stock === 0).length;
    const low = db.products.filter(
      (p) => !p.deleted && p.stock > 0 && p.stock <= p.minStock,
    ).length;
    const alacak = db.cari
      .filter((c) => !c.deleted && c.type === "musteri" && c.balance > 0)
      .reduce((s, c) => s + c.balance, 0);
    const riskler: string[] = [];
    if (kasaToplam < 5000)
      riskler.push(`💸 Kasa dusuk: ${formatMoney(kasaToplam)}`);
    if (out > 0) riskler.push(`📦 ${out} urunde stok bitti`);
    if (low > 0) riskler.push(`⚠️ ${low} urunde az stok`);
    if (alacak > 50000)
      riskler.push(`💳 Yuksek alacak: ${formatMoney(alacak)}`);
    if (db.orders.filter((o) => o.status === "bekliyor").length > 3)
      riskler.push(
        `🚚 ${db.orders.filter((o) => o.status === "bekliyor").length} bekleyen siparis`,
      );
    return `🔴 **Kritik Durumlar**\n${riskler.length > 0 ? riskler.map((r, i) => `${i + 1}. ${r}`).join("\n") : "✅ Kritik durum tespit edilmedi"}\n\n⚠️ *Cevrimdisi mod - detayli analiz icin internet gerekli*`;
  }
  return `🔌 **Cevrimdisi Mod**\n\nInternet baglantisi olmadigindan AI analizi yapilamiyor.\n\nSorabileceginiz konular:\n- Stok durumu\n- Kasa ve sermaye ozeti\n- Musteri alacaklari\n- Bu ay satislar\n- Kritik riskler`;
}

// â”€â”€ Claude API (Anthropic direkt) â”€â”€
async function askClaude(
  messages: Message[],
  context: string,
  key: string,
  onChunk: (t: string) => void,
): Promise<void> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-3-5",
      max_tokens: 1024,
      system: `Sen Soba işletmesi için AI analistsin. Kısa, net, Türkçe yanıt ver.\n\n${context}`,
      messages: messages
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });
  if (res.status === 429) throw new Error("429 Too many requests");
  if (!res.ok) throw new Error(`Claude API: ${res.status}`);
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const d = JSON.parse(line.slice(6));
        if (d.type === "content_block_delta") onChunk(d.delta?.text || "");
      } catch {
        /* ignore */
      }
    }
  }
}

// â”€â”€ Gemini API (yedek) â”€â”€
async function askGemini(
  messages: Message[],
  context: string,
  key: string,
  onChunk: (t: string) => void,
): Promise<void> {
  const contents = [
    { role: "user", parts: [{ text: `İşletme verilerim:\n${context}` }] },
    {
      role: "model",
      parts: [
        { text: "Anladım, verilerinizi inceledim. Nasıl yardımcı olabilirim?" },
      ],
    },
    ...messages
      .filter((m) => m.content)
      .map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
  ];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [
            {
              text: "Türkçe, kısa ve net yanıt ver. Soba işletmesi analistisin.",
            },
          ],
        },
      }),
    },
  );
  if (res.status === 429) throw new Error("429 Too many requests");
  if (!res.ok) throw new Error(`Gemini API: ${res.status}`);
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const d = JSON.parse(line.slice(6));
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onChunk(text);
      } catch {
        /* ignore */
      }
    }
  }
}

function buildContext(
  db: DB,
  actionMode: "read-only" | "manual" | "auto",
  maxAutoActions: number,
  stopOnViolation: boolean,
): string {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const monthSales = db.sales.filter(
    (s) =>
      !s.deleted &&
      s.status === "tamamlandi" &&
      new Date(s.createdAt) >= monthStart,
  );
  const lastMonthSales = db.sales.filter(
    (s) =>
      !s.deleted &&
      s.status === "tamamlandi" &&
      new Date(s.createdAt) >= lastMonthStart &&
      new Date(s.createdAt) <= lastMonthEnd,
  );
  const totalKasa = db.kasa
    .filter((k) => !k.deleted)
    .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
  const nakit = db.kasa
    .filter((k) => !k.deleted && k.kasa === "nakit")
    .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
  const banka = db.kasa
    .filter((k) => !k.deleted && k.kasa === "banka")
    .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
  const outStock = db.products.filter((p) => !p.deleted && p.stock === 0);
  const lowStock = db.products.filter(
    (p) => !p.deleted && p.stock > 0 && p.stock <= p.minStock,
  );
  const stokDeger = db.products
    .filter((p) => !p.deleted)
    .reduce((s, p) => s + p.cost * p.stock, 0);

  // Top ürünler â€” satış adedi ve ciro bazlı
  const productSales: Record<
    string,
    { ciro: number; adet: number; kar: number }
  > = {};
  db.sales
    .filter((s) => !s.deleted && s.status === "tamamlandi")
    .forEach((s) => {
      const id = s.productId || s.productName;
      if (!productSales[id]) productSales[id] = { ciro: 0, adet: 0, kar: 0 };
      productSales[id].ciro += s.total;
      productSales[id].adet += s.quantity;
      productSales[id].kar += s.profit;
    });
  const topProducts = db.products
    .filter((p) => !p.deleted)
    .map((p) => ({
      ...p,
      ...(productSales[p.id] || { ciro: 0, adet: 0, kar: 0 }),
    }))
    .sort((a, b) => b.ciro - a.ciro)
    .slice(0, 5);

  // Gecikmiş alacaklar
  const overdueMusteri = db.cari
    .filter((c) => !c.deleted && c.type === "musteri" && c.balance > 0)
    .map((c) => {
      const lastPay = db.kasa
        .filter((k) => !k.deleted && k.cariId === c.id && k.type === "gelir")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];
      const lastPayDate = lastPay ? new Date(lastPay.createdAt) : null;
      const unpaidSale = db.sales
        .filter(
          (s) =>
            !s.deleted &&
            s.status === "tamamlandi" &&
            (s.cariId === c.id || s.customerId === c.id),
        )
        .filter((s) => !lastPayDate || new Date(s.createdAt) > lastPayDate)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )[0];
      const refDate = unpaidSale
        ? new Date(unpaidSale.createdAt)
        : c.lastTransaction
          ? new Date(c.lastTransaction)
          : null;
      const days = refDate
        ? Math.floor((Date.now() - refDate.getTime()) / 86400000)
        : null;
      return { name: c.name, balance: c.balance, days, phone: c.phone };
    })
    .filter((c) => c.days !== null && c.days >= 30)
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  const alacak = db.cari
    .filter((c) => !c.deleted && c.type === "musteri" && c.balance > 0)
    .reduce((s, c) => s + c.balance, 0);
  const borc = db.cari
    .filter((c) => !c.deleted && c.type === "tedarikci" && c.balance > 0)
    .reduce((s, c) => s + c.balance, 0);
  const topBorclu = [...db.cari]
    .filter((c) => !c.deleted && c.type === "musteri" && c.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  const catSales: Record<string, { ciro: number; kar: number }> = {};
  db.sales
    .filter((s) => !s.deleted && s.status === "tamamlandi")
    .forEach((s) => {
      const c = s.productCategory || "Diğer";
      if (!catSales[c]) catSales[c] = { ciro: 0, kar: 0 };
      catSales[c].ciro += s.total;
      catSales[c].kar += s.profit;
    });

  // Aylık trend (son 6 ay)
  const monthlyTrend: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = d.toLocaleDateString("tr-TR", {
      month: "short",
      year: "2-digit",
    });
    monthlyTrend[key] = 0;
  }
  db.sales
    .filter((s) => !s.deleted && s.status === "tamamlandi")
    .forEach((s) => {
      const d = new Date(s.createdAt);
      const key = d.toLocaleDateString("tr-TR", {
        month: "short",
        year: "2-digit",
      });
      if (monthlyTrend[key] !== undefined) monthlyTrend[key] += s.total;
    });

  const monthCiro = monthSales.reduce((s, x) => s + x.total, 0);
  const monthKar = monthSales.reduce((s, x) => s + x.profit, 0);
  const lastMonthCiro = lastMonthSales.reduce((s, x) => s + x.total, 0);
  const buyumePct =
    lastMonthCiro > 0
      ? (((monthCiro - lastMonthCiro) / lastMonthCiro) * 100).toFixed(1)
      : "N/A";

  return `## İşletme Özeti â€” ${today.toLocaleDateString("tr-TR")}

### ğŸ“Š Satış Performansı
- Bu ay: ${monthSales.length} satış | Ciro: ${formatMoney(monthCiro)} | Kâr: ${formatMoney(monthKar)} | Marj: %${monthCiro > 0 ? ((monthKar / monthCiro) * 100).toFixed(1) : 0}
- Geçen ay: ${lastMonthSales.length} satış | Ciro: ${formatMoney(lastMonthCiro)}
- Büyüme: ${buyumePct}%
- Tüm zamanlar: ${db.sales.filter((s) => !s.deleted && s.status === "tamamlandi").length} satış

### ğŸ’° Kasa Durumu
- Toplam: ${formatMoney(totalKasa)} | Nakit: ${formatMoney(nakit)} | Banka: ${formatMoney(banka)}
- Diğer kasalar: ${formatMoney(totalKasa - nakit - banka)}

### ğŸ“¦ Stok
- Toplam: ${db.products.filter((p) => !p.deleted).length} ürün | Stok değeri: ${formatMoney(stokDeger)}
- Biten: ${outStock.length}${
    outStock.length
      ? ` (${outStock
          .slice(0, 3)
          .map((p) => p.name)
          .join(", ")})`
      : ""
  } | Az stoklu: ${lowStock.length}

### ğŸ† Top 5 Ürün (Ciro)
${topProducts.map((p, i) => `${i + 1}. ${p.name}: ${formatMoney(p.ciro)} ciro, ${p.adet} adet, ${formatMoney(p.kar)} kâr`).join("\n")}

### ğŸ‘¤ Cari & Alacak
- Toplam alacak: ${formatMoney(alacak)} | Toplam borç: ${formatMoney(borc)}
- En yüksek 5 alacak: ${topBorclu.map((c) => `${c.name}(${formatMoney(c.balance)})`).join(", ") || "Yok"}
${
  overdueMusteri.length > 0
    ? `- ⚠️ GECIKMIS ALACAKLAR (30+ gun): ${overdueMusteri
        .slice(0, 5)
        .map((c) => `${c.name} ${c.days}gün ${formatMoney(c.balance)}`)
        .join(", ")}`
    : "- ✅ Gecikmis alacak yok"
}

### ğŸ­ Tedarik
- Tedarikçi: ${db.suppliers.length} | Bekleyen sipariş: ${db.orders.filter((o) => o.status === "bekliyor").length} | Yolda: ${db.orders.filter((o) => o.status === "yolda").length}

### ğŸ·ï¸ Kategori Performansı
${
  Object.entries(catSales)
    .sort((a, b) => b[1].ciro - a[1].ciro)
    .map(
      ([c, v]) =>
        `${c}: ${formatMoney(v.ciro)} ciro, %${v.ciro > 0 ? ((v.kar / v.ciro) * 100).toFixed(1) : 0} marj`,
    )
    .join("\n") || "Veri yok"
}

### ğŸ“… Aylık Trend (Son 6 Ay)
${Object.entries(monthlyTrend)
  .map(([m, v]) => `${m}: ${formatMoney(v)}`)
  .join(" | ")}

---
## 🛠️ DB ISLEM TALIMATLARI
Aktif işlem modu: ${actionMode === "read-only" ? "READ_ONLY (sadece analiz)" : actionMode === "auto" ? "AUTO_EXECUTE (otomatik)" : "MANUAL_APPROVAL (onaylı)"}
${actionMode === "read-only" ? "READ_ONLY modundasın. Kesinlikle action bloğu üretme, sadece analiz ve öneri ver." : "İşlem gerekiyorsa action bloğu üretebilirsin."}
AUTO mod aktifse tek yanıtta en fazla ${maxAutoActions} action üret.
Kural ihlali davranışı: ${stopOnViolation ? "İhlalde durdur" : "İhlalli actionı atla ve devam et"}.
Kullanıcı bir işlem yapmak istediğinde (satış, kasa, stok, tahsilat), yanıtının SONUNA aşağıdaki formatta bir action bloğu ekle.
Sadece kullanici acikca bir islem yapmak istediginde ekle - analiz/soru sorularinda EKLEME.

### Satış kaydı:
\`\`\`action
{"type":"sale","label":"[ürün adı] x[adet] â€” [tutar] TL satış","payload":{"productName":"[ürün adı]","quantity":[adet],"unitPrice":[birim fiyat],"discount":0,"payment":"nakit","cariName":"[müşteri adı veya boş string]"}}
\`\`\`

### Kasa gelir:
\`\`\`action
{"type":"kasa_gelir","label":"[açıklama] â€” [tutar] TL gelir","payload":{"amount":[tutar],"kasa":"nakit","category":"diger_gelir","description":"[açıklama]"}}
\`\`\`

### Kasa gider:
\`\`\`action
{"type":"kasa_gider","label":"[açıklama] â€” [tutar] TL gider","payload":{"amount":[tutar],"kasa":"nakit","category":"diger_gider","description":"[açıklama]"}}
\`\`\`

### Stok güncelleme:
\`\`\`action
{"type":"stok_guncelle","label":"[ürün adı] stok â†’ [yeni miktar]","payload":{"productName":"[ürün adı]","stock":[yeni miktar],"note":"[açıklama]"}}
\`\`\`

### Cari tahsilat:
\`\`\`action
{"type":"cari_tahsilat","label":"[müşteri adı] â€” [tutar] TL tahsilat","payload":{"cariName":"[müşteri adı]","amount":[tutar],"kasa":"nakit"}}
\`\`\`

### Yeni ürün ekleme:
\`\`\`action
{"type":"urun_ekle","label":"[ürün adı] eklenecek","payload":{"name":"[ürün adı]","category":"soba","cost":[alış],"price":[satış],"stock":[stok],"minStock":[min stok]}}
\`\`\`

### Yeni cari ekleme:
\`\`\`action
{"type":"cari_ekle","label":"[cari adı] eklenecek","payload":{"name":"[cari adı]","type":"musteri","phone":"[telefon]","balance":0}}
\`\`\`

### Mevcut ürünler (satış için kullan):
${db.products
  .filter((p) => !p.deleted)
  .map((p) => `- ${p.name} (stok:${p.stock}, fiyat:${p.price}TL)`)
  .join("\n")}

### Mevcut müşteriler (cari için kullan):
${db.cari
  .filter((c) => !c.deleted && c.type === "musteri")
  .slice(0, 20)
  .map((c) => `- ${c.name} (bakiye:${c.balance}TL)`)
  .join("\n")}`;
}

const QUICK_PROMPTS = [
  {
    label: "ğŸ“Š Bu Ay Analiz",
    prompt:
      "Bu ayın satış performansını detaylı analiz et. Geçen aya göre büyüme/düşüş var mı? Kâr marjı nasıl?",
  },
  {
    label: "ğŸ“¦ Stok Durumu",
    prompt:
      "Stoklarımın durumunu değerlendir. Hangi ürünleri acil sipariş etmeliyim? Stok değerim ne kadar?",
  },
  {
    label: "ğŸ’° Kâr Analizi",
    prompt:
      "En kârlı ürünlerim hangileri? Hangi kategoride kâr marjı düşük? İyileştirme önerileri ver.",
  },
  {
    label: "ğŸ”® Satış Tahmini",
    prompt:
      "Aylık trend verilerime göre önümüzdeki ay için satış tahmini yap. Hangi ürünlere odaklanmalıyım?",
  },
  {
    label: "ğŸ‘¤ Alacak Takibi",
    prompt:
      "Gecikmiş alacaklarım var mı? Hangi müşterilerden tahsilat yapmalıyım? Öncelik sırası ver.",
  },
  {
    label: "ğŸ­ Tedarik Analizi",
    prompt:
      "Tedarikçilerimle ilgili durum nedir? Bekleyen siparişler var mı? Maliyet optimizasyonu için ne yapabilirim?",
  },
  {
    label: "ğŸ’¡ Kritik Öneriler",
    prompt:
      "İşletmem için şu an en kritik 5 aksiyon nedir? Öncelik sırasıyla listele.",
  },
  {
    label: "ğŸ“ˆ Büyüme Stratejisi",
    prompt:
      "Verilerime göre satışları artırmak için hangi stratejileri izlemeliyim? Hangi ürün/kategori potansiyeli var?",
  },
  {
    label: "âš–ï¸ Net Sermaye",
    prompt:
      "Net sermayem ne durumda? Kasa, alacak ve borçlarımı değerlendirerek finansal sağlığımı analiz et.",
  },
  {
    label: "ğŸ”´ Risk Analizi",
    prompt:
      "İşletmemde şu an en büyük finansal riskler neler? Stok, alacak ve kasa açısından değerlendir.",
  },
];

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function MarkdownText({ text }: { text: string }) {
  const html = escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /^### (.+)$/gm,
      '<h4 style="color:#ff7043;font-size:0.9rem;margin:10px 0 4px;font-weight:700">$1</h4>',
    )
    .replace(
      /^## (.+)$/gm,
      '<h3 style="color:#f1f5f9;font-size:1rem;margin:12px 0 6px;font-weight:800">$1</h3>',
    )
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
    .replace(
      /(<li[^>]*>.*<\/li>\n?)+/gs,
      '<ul style="list-style:none;padding:0;margin:6px 0">$&</ul>',
    )
    .replace(/\n\n/g, "<br/>")
    .replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// â”€â”€ API Ayarları Paneli â”€â”€
function ApiSettings({ onClose }: { onClose: () => void }) {
  const [ck, setCk] = useState("");
  const [gk, setGk] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadKeysFromFirebase().then((keys) => {
      setCk(keys.claude);
      setGk(keys.gemini);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const ok = await saveKeysToFirebase(ck.trim(), gk.trim());
    if (ok) {
      invalidateKeyCache();
      setMsg("âœ… Firebase'e kaydedildi");
      setTimeout(() => {
        setMsg("");
        onClose();
      }, 1200);
    } else {
      setMsg("âŒ Kayıt başarısız â€” Firebase bağlantısını kontrol edin");
    }
    setSaving(false);
  };

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#f1f5f9",
    fontSize: "0.85rem",
    boxSizing: "border-box",
    fontFamily: "monospace",
  };
  return (
    <div style={{ padding: "16px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
          padding: "8px 12px",
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 8,
        }}
      >
        <span>â˜ï¸</span>
        <p style={{ color: "#10b981", fontSize: "0.82rem", margin: 0 }}>
          API anahtarları Firebase'de şifreli saklanır â€” tüm cihazlarda
          geçerlidir.
        </p>
      </div>
      {loading ? (
        <div
          style={{
            color: "#64748b",
            fontSize: "0.85rem",
            textAlign: "center",
            padding: "20px 0",
          }}
        >
          Firebase'den yükleniyor...
        </div>
      ) : (
        <>
          <label
            style={{
              display: "block",
              color: "#94a3b8",
              fontSize: "0.82rem",
              marginBottom: 4,
            }}
          >
            ğŸ¤– Claude API Key (Anthropic â€” birincil)
          </label>
          <input
            value={ck}
            onChange={(e) => setCk(e.target.value)}
            placeholder="sk-ant-..."
            style={{ ...inp, marginBottom: 14 }}
            type="password"
          />
          <label
            style={{
              display: "block",
              color: "#94a3b8",
              fontSize: "0.82rem",
              marginBottom: 4,
            }}
          >
            âœ¨ Gemini API Key (Google â€” yedek)
          </label>
          <input
            value={gk}
            onChange={(e) => setGk(e.target.value)}
            placeholder="AIza..."
            style={{ ...inp, marginBottom: 18 }}
            type="password"
          />
          {msg && (
            <div
              style={{
                marginBottom: 12,
                fontSize: "0.82rem",
                color: msg.startsWith("âœ…") ? "#10b981" : "#ef4444",
                fontWeight: 600,
              }}
            >
              {msg}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                flex: 1,
                background: "#10b981",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                padding: "10px 0",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {saving ? "Kaydediliyor..." : "â˜ï¸ Firebase'e Kaydet"}
            </button>
            <button
              onClick={onClose}
              style={{
                background: "#273548",
                border: "1px solid #334155",
                borderRadius: 8,
                color: "#94a3b8",
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              İptal
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AIAsistan({ db, save, embedded = false }: Props) {
  const session = getUserSession();
  const isAdminUser = session?.role === "admin";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<
    "idle" | "claude" | "gemini" | "offline"
  >("idle");
  const [showSettings, setShowSettings] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [autoApplyActions, setAutoApplyActions] = useState(false);
  const [maxAutoActions, setMaxAutoActions] = useState(3);
  const [stopOnViolation, setStopOnViolation] = useState(true);
  // Onay bekleyen DB işlemleri
  const [pendingActions, setPendingActions] = useState<{
    msgIdx: number;
    actions: DBAction[];
  } | null>(null);
  const [actionResult, setActionResult] = useState<{
    msgIdx: number;
    success: boolean;
    msg: string;
  } | null>(null);
  const actionMode: "read-only" | "manual" | "auto" =
    !isAdminUser || !adminMode
      ? "read-only"
      : autoApplyActions
        ? "auto"
        : "manual";
  const context = useMemo(
    () => buildContext(db, actionMode, maxAutoActions, stopOnViolation),
    [db, actionMode, maxAutoActions, stopOnViolation],
  );
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAdminUser) {
      setAdminMode(false);
      setAutoApplyActions(false);
      setStopOnViolation(true);
    }
  }, [isAdminUser]);

  const runActions = useCallback(
    (msgIdx: number, actions: DBAction[]) => {
      if (!save) return;
      try {
        let summary = "";
        save((prev) => {
          let next = prev;
          let appliedCount = 0;
          const violations: string[] = [];
          const fallbackNotes: string[] = [];
          const actionLimit = autoApplyActions
            ? Math.max(1, maxAutoActions)
            : Number.MAX_SAFE_INTEGER;

          for (let i = 0; i < actions.length; i++) {
            if (appliedCount >= actionLimit) {
              violations.push(`Limit aşıldı: maksimum ${actionLimit} işlem`);
              break;
            }
            const action = actions[i];
            const attempted = applyActionWithFallback(next, action);
            if (attempted.applied) {
              next = attempted.next;
              appliedCount += 1;
              const flow = dispatchAgentFlow(
                (attempted.appliedAction || action) as Parameters<
                  typeof dispatchAgentFlow
                >[0],
              );
              fallbackNotes.push(
                `AgentAkisi:${flow.join(" -> ")} (${action.label})`,
              );
              if (
                attempted.appliedAction &&
                attempted.appliedAction !== action
              ) {
                fallbackNotes.push(
                  `${action.label} => ${attempted.appliedAction.label}`,
                );
              }
            } else {
              violations.push(
                attempted.notes[0] || `${action.label}: İşlem uygulanamadı`,
              );
              if (attempted.notes.length > 1) {
                fallbackNotes.push(...attempted.notes.slice(1));
              }
              if (stopOnViolation) break;
            }
          }

          const aiLog = {
            id: genId(),
            action: autoApplyActions ? "ai_auto_action" : "ai_manual_action",
            detail: [
              `Uygulanan:${appliedCount}`,
              `Toplam:${actions.length}`,
              actions.map((a) => a.label).join(" | "),
              violations.length ? `İhlal:${violations.join(" ; ")}` : "",
              fallbackNotes.length
                ? `Fallback:${fallbackNotes.join(" ; ")}`
                : "",
            ]
              .filter(Boolean)
              .join(" || "),
            time: new Date().toISOString(),
          };
          summary = violations.length
            ? `${appliedCount}/${actions.length} işlendi. ${violations.length} kural ihlali var.`
            : autoApplyActions
              ? `${appliedCount} işlem otomatik işlendi`
              : "Kaydedildi!";
          return {
            ...next,
            _activityLog: [...(next._activityLog || []), aiLog],
          };
        });
        setActionResult({
          msgIdx,
          success: true,
          msg: summary || "Kaydedildi!",
        });
        setTimeout(() => {
          setPendingActions(null);
          setActionResult(null);
        }, 1200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setActionResult({
          msgIdx,
          success: false,
          msg: err.message || "Hata oluştu",
        });
      }
    },
    [save, autoApplyActions, maxAutoActions, stopOnViolation],
  );

  // Sesli özellikler
  const { speaking, speak, stop: stopSpeak } = useSpeechSynthesis();
  const {
    listening,
    supported: micSupported,
    error: micError,
    start: startListen,
    stop: stopListen,
  } = useSpeechRecognition((text) => {
    setInput(text);
    // Sesli girişten gelen metni otomatik gönder
    setTimeout(() => sendText(text), 100);
  });

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [keyLoadError, setKeyLoadError] = useState(false);
  const [keyAccessForbidden, setKeyAccessForbidden] = useState(false);
  const keysRef = useRef({ claude: "", gemini: "" });

  useEffect(() => {
    getKeys()
      .then((keys) => {
        keysRef.current = keys;
        const loaded = !!(keys.claude || keys.gemini);
        setHasKeys(loaded);
        setKeyAccessForbidden(keys.state === "forbidden");
        setKeyLoadError(keys.state === "unavailable");
        setKeysLoaded(true);
      })
      .catch(() => {
        setKeyLoadError(true);
        setKeyAccessForbidden(false);
        setKeysLoaded(true);
      });
  }, []);

  const [isOnline, setIsOnline] = useState(true); // başlangıçta online kabul et

  useEffect(() => {
    // Capacitor Network plugin (Android WebView'da navigator.onLine güvenilmez)
    const initNetwork = async () => {
      try {
        const { Network } = await import("@capacitor/network");
        const status = await Network.getStatus();
        setIsOnline(status.connected);
        Network.addListener("networkStatusChange", (s) =>
          setIsOnline(s.connected),
        );
      } catch {
        // Web fallback
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
      }
    };
    initNetwork();
  }, []);

  const copyMsg = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  const send = useCallback(
    async (text?: string) => {
      const userMsg = (text || input).trim();
      if (!userMsg || loading) return;

      // Rate limit koruması: son istekten en az 3 saniye geçmeli
      const now = Date.now();
      const lastReq = parseInt(sessionStorage.getItem("ai_last_req") || "0");
      const elapsed = now - lastReq;
      if (elapsed < 3000 && lastReq > 0) {
        const wait = Math.ceil((3000 - elapsed) / 1000);
        setMessages((prev) => [
          ...prev,
          { role: "user", content: userMsg },
          {
            role: "assistant",
            content: `â³ Çok hızlı istek gönderiyorsunuz. Lütfen ${wait} saniye bekleyin.`,
            source: "offline",
          },
        ]);
        return;
      }
      sessionStorage.setItem("ai_last_req", String(now));

      setInput("");
      setLoading(true);
      const newMessages: Message[] = [
        ...messages,
        { role: "user", content: userMsg },
      ];
      setMessages(newMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (!isOnline) {
        const reply = offlineReply(db, userMsg);
        setMessages((prev) => {
          const u = [...prev];
          u[u.length - 1] = {
            role: "assistant",
            content: reply,
            source: "offline",
          };
          return u;
        });
        if (autoSpeak) speak(reply);
        // offline modda da action parse et
        const actions = parseActions(reply);
        if (actions.length > 0 && save) {
          if (!isAdminUser || !adminMode) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  "⚠️ Action uretildi ancak Yonetici Modu kapali oldugu icin DB yazma yapilmadi.",
                source: "offline",
              },
            ]);
          } else if (autoApplyActions) {
            runActions(newMessages.length, actions);
          } else {
            setPendingActions({ msgIdx: newMessages.length, actions });
          }
        }
        setApiStatus("offline");
        setLoading(false);
        return;
      }

      // Key'leri her seferinde cache'den al (kaydet sonrası invalidate edilir)
      const keys = await getKeys();
      keysRef.current = keys;
      const claudeKey = keys.claude;
      const geminiKey = keys.gemini;

      const appendChunk = (chunk: string) => {
        setMessages((prev) => {
          const u = [...prev];
          u[u.length - 1] = {
            ...u[u.length - 1],
            content: u[u.length - 1].content + chunk,
          };
          return u;
        });
      };

      // Yanıt tamamlandığında action bloklarını parse et
      const finalizeResponse = (msgIndex: number) => {
        setMessages((prev) => {
          const msg = prev[msgIndex];
          if (!msg) return prev;
          const actions = parseActions(msg.content);
          const cleaned = stripActions(msg.content);
          const updated = [...prev];
          updated[msgIndex] = { ...msg, content: cleaned };
          if (actions.length > 0 && save) {
            if (!isAdminUser || !adminMode) {
              updated.push({
                role: "assistant",
                content:
                  "⚠️ Action uretildi ancak Yonetici Modu kapali oldugu icin DB yazma yapilmadi.",
                source: "offline",
              });
            } else if (autoApplyActions) {
              setTimeout(() => runActions(msgIndex, actions), 0);
            } else {
              setPendingActions({ msgIdx: msgIndex, actions });
            }
          }
          return updated;
        });
      };

      // Rate limit hata mesajı oluştur
      const rateLimitMsg = (api: string) =>
        `⚠️ **${api} rate limit asildi** - cok fazla istek gonderildi.\n\nBirkac dakika bekleyip tekrar deneyin. Bu surede cevrimdisi mod aktif.`;

      // Token tasarrufu: yalnizca son 10 mesaji API'ye gonder (bagiam sistem prompt'ta var)
      const apiMessages = newMessages.slice(-10);
      if (claudeKey) {
        try {
          setApiStatus("claude");
          setMessages((prev) => {
            const u = [...prev];
            u[u.length - 1] = { ...u[u.length - 1], source: "claude" };
            return u;
          });
          await askClaude(apiMessages, context, claudeKey, appendChunk);
          if (autoSpeak) {
            setMessages((prev) => {
              if (prev[prev.length - 1]?.content)
                speak(prev[prev.length - 1].content);
              return prev;
            });
          }
          finalizeResponse(newMessages.length);
          setLoading(false);
          return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          const msg = String(e?.message || e || "");
          if (
            msg.includes("429") ||
            msg.toLowerCase().includes("too many") ||
            msg.toLowerCase().includes("rate")
          ) {
            setMessages((prev) => {
              const u = [...prev];
              u[u.length - 1] = {
                role: "assistant",
                content: rateLimitMsg("Claude"),
                source: "offline",
              };
              return u;
            });
            setLoading(false);
            return;
          }
          console.warn("Claude başarısız, Gemini deneniyor:", e);
          setMessages((prev) => {
            const u = [...prev];
            u[u.length - 1] = { ...u[u.length - 1], content: "" };
            return u;
          });
        }
      }

      if (geminiKey) {
        try {
          setApiStatus("gemini");
          setMessages((prev) => {
            const u = [...prev];
            u[u.length - 1] = { ...u[u.length - 1], source: "gemini" };
            return u;
          });
          await askGemini(apiMessages, context, geminiKey, appendChunk);
          if (autoSpeak) {
            setMessages((prev) => {
              if (prev[prev.length - 1]?.content)
                speak(prev[prev.length - 1].content);
              return prev;
            });
          }
          finalizeResponse(newMessages.length);
          setLoading(false);
          return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          const msg = String(e?.message || e || "");
          if (
            msg.includes("429") ||
            msg.toLowerCase().includes("too many") ||
            msg.toLowerCase().includes("rate")
          ) {
            setMessages((prev) => {
              const u = [...prev];
              u[u.length - 1] = {
                role: "assistant",
                content: rateLimitMsg("Gemini"),
                source: "offline",
              };
              return u;
            });
            setLoading(false);
            return;
          }
          console.warn("Gemini de başarısız:", e);
        }
      }

      const reply = !(claudeKey || geminiKey)
        ? "ğŸ”‘ API anahtarı girilmemiş. Sağ üstteki âš™ï¸ ikonuna tıklayarak Claude veya Gemini anahtarınızı ekleyin."
        : offlineReply(db, userMsg);
      setMessages((prev) => {
        const u = [...prev];
        u[u.length - 1] = {
          role: "assistant",
          content: reply,
          source: "offline",
        };
        return u;
      });
      if (autoSpeak) speak(reply);
      setApiStatus("offline");
      setLoading(false);
    },
    [
      input,
      loading,
      messages,
      context,
      db,
      autoSpeak,
      speak,
      isOnline,
      isAdminUser,
      adminMode,
      autoApplyActions,
      runActions,
      save,
    ],
  );

  // Sesli girişten çağrılabilmesi için ayrı ref
  const sendText = useCallback(
    (text: string) => {
      if (!text.trim() || loading) return;
      setInput("");
      // send fonksiyonunu text parametresiyle çağır
      send(text);
    },
    [send, loading],
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const sourceLabel: Record<
    string,
    { label: string; color: string; bg: string }
  > = {
    claude: {
      label: "ğŸ¤– Claude",
      color: "#818cf8",
      bg: "rgba(99,102,241,0.12)",
    },
    gemini: {
      label: "âœ¨ Gemini",
      color: "#a78bfa",
      bg: "rgba(139,92,246,0.12)",
    },
    offline: {
      label: "ğŸ”Œ Çevrimdışı",
      color: "#64748b",
      bg: "rgba(100,116,139,0.1)",
    },
  };

  // Anlık işletme özeti
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthSales = db.sales.filter(
    (s) =>
      !s.deleted &&
      s.status === "tamamlandi" &&
      new Date(s.createdAt) >= monthStart,
  );
  const kasaToplam = db.kasa
    .filter((k) => !k.deleted)
    .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
  const alacakToplam = db.cari
    .filter((c) => !c.deleted && c.type === "musteri" && c.balance > 0)
    .reduce((s, c) => s + c.balance, 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: embedded ? "100%" : "calc(100vh - 140px)",
      }}
    >
      {/* Header â€” sadece standalone modda */}
      {!embedded && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
            padding: "16px 20px",
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))",
            borderRadius: 16,
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.4rem",
              flexShrink: 0,
              boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
            }}
          >
            ğŸ¤–
          </div>
          <div style={{ flex: 1 }}>
            <h2
              style={{
                fontWeight: 800,
                color: "#f1f5f9",
                fontSize: "1.1rem",
                margin: 0,
              }}
            >
              Soba AI Asistan
            </h2>
            <p
              style={{
                color: "#475569",
                fontSize: "0.78rem",
                margin: "3px 0 0",
              }}
            >
              {!isOnline
                ? "ğŸ”Œ Çevrimdışı â€” temel sorulara yanıt verir"
                : hasKeys
                  ? `âœ… ${keysRef.current.claude ? "Claude" : ""}${keysRef.current.claude && keysRef.current.gemini ? " + " : ""}${keysRef.current.gemini ? "Gemini" : ""} hazır`
                  : keyAccessForbidden
                    ? "ℹ️ Firebase anahtar erişimi kısıtlı (403) — yerel/env anahtar kullanın"
                    : keyLoadError
                      ? "⚠️ Anahtarlar yuklenemedi - Ayarlar'a girin"
                      : "⚠️ API anahtari girilmemis - Ayarlar'a girin"}
            </p>
          </div>
          {/* Anlık özet */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {[
              {
                label: "Bu Ay",
                value: formatMoney(monthSales.reduce((s, x) => s + x.total, 0)),
                color: "#10b981",
              },
              {
                label: "Kasa",
                value: formatMoney(kasaToplam),
                color: "#06b6d4",
              },
              {
                label: "Alacak",
                value: formatMoney(alacakToplam),
                color: "#f59e0b",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{ textAlign: "center", display: "none" }}
                className="ai-stat"
              >
                <div
                  style={{
                    color: s.color,
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  {s.value}
                </div>
                <div style={{ color: "#475569", fontSize: "0.65rem" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            {isAdminUser && (
              <button
                onClick={() => setAdminMode((v) => !v)}
                title="Yönetici DB Yazma Modu"
                style={{
                  background: adminMode
                    ? "rgba(16,185,129,0.2)"
                    : "rgba(255,255,255,0.05)",
                  border: `1px solid ${adminMode ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 8,
                  color: adminMode ? "#10b981" : "#475569",
                  padding: "7px 10px",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                }}
              >
                {adminMode ? "ADMIN ON" : "ADMIN OFF"}
              </button>
            )}
            {isAdminUser && adminMode && (
              <button
                onClick={() => setAutoApplyActions((v) => !v)}
                title="Actionları otomatik uygula"
                style={{
                  background: autoApplyActions
                    ? "rgba(245,158,11,0.2)"
                    : "rgba(255,255,255,0.05)",
                  border: `1px solid ${autoApplyActions ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 8,
                  color: autoApplyActions ? "#f59e0b" : "#475569",
                  padding: "7px 10px",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                }}
              >
                {autoApplyActions ? "AUTO APPLY" : "MANUAL APPLY"}
              </button>
            )}
            {isAdminUser && adminMode && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(15,23,42,0.35)",
                }}
              >
                <span
                  style={{
                    color: "#94a3b8",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  MAX
                </span>
                <button
                  onClick={() => setMaxAutoActions((v) => Math.max(1, v - 1))}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "none",
                    borderRadius: 6,
                    color: "#cbd5e1",
                    width: 20,
                    height: 20,
                    cursor: "pointer",
                    fontWeight: 700,
                    lineHeight: "20px",
                  }}
                >
                  -
                </button>
                <span
                  style={{
                    minWidth: 16,
                    textAlign: "center",
                    color: "#f1f5f9",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                  }}
                >
                  {maxAutoActions}
                </span>
                <button
                  onClick={() => setMaxAutoActions((v) => Math.min(20, v + 1))}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "none",
                    borderRadius: 6,
                    color: "#cbd5e1",
                    width: 20,
                    height: 20,
                    cursor: "pointer",
                    fontWeight: 700,
                    lineHeight: "20px",
                  }}
                >
                  +
                </button>
              </div>
            )}
            {isAdminUser && adminMode && (
              <button
                onClick={() => setStopOnViolation((v) => !v)}
                title="Kural ihlalinde davranış"
                style={{
                  background: stopOnViolation
                    ? "rgba(239,68,68,0.16)"
                    : "rgba(16,185,129,0.14)",
                  border: `1px solid ${stopOnViolation ? "rgba(239,68,68,0.45)" : "rgba(16,185,129,0.45)"}`,
                  borderRadius: 8,
                  color: stopOnViolation ? "#f87171" : "#34d399",
                  padding: "7px 8px",
                  cursor: "pointer",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                {stopOnViolation ? "VIOLATION STOP" : "VIOLATION SKIP"}
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                title="Sohbeti Temizle"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8,
                  color: "#475569",
                  padding: "7px 12px",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                }}
              >
                ğŸ—‘ï¸
              </button>
            )}
            <button
              onClick={() => setShowSettings((s) => !s)}
              title="API Ayarları"
              style={{
                background: showSettings
                  ? "rgba(99,102,241,0.2)"
                  : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(99,102,241,0.3)",
                borderRadius: 8,
                color: "#818cf8",
                padding: "7px 12px",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              âš™ï¸
            </button>
          </div>
        </div>
      )}

      {/* Embedded header */}
      {embedded && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 12,
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1, display: "flex", gap: 8 }}>
            {[
              {
                label: "Bu Ay Ciro",
                value: formatMoney(monthSales.reduce((s, x) => s + x.total, 0)),
                color: "#10b981",
              },
              {
                label: "Kasa",
                value: formatMoney(kasaToplam),
                color: "#06b6d4",
              },
              {
                label: "Alacak",
                value: formatMoney(alacakToplam),
                color: "#f59e0b",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  flex: 1,
                  background: `${s.color}10`,
                  border: `1px solid ${s.color}20`,
                  borderRadius: 8,
                  padding: "6px 10px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    color: s.color,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    color: "#475569",
                    fontSize: "0.62rem",
                    marginTop: 1,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          {isAdminUser && (
            <button
              onClick={() => setAdminMode((v) => !v)}
              title="Yönetici DB Yazma Modu"
              style={{
                background: adminMode
                  ? "rgba(16,185,129,0.18)"
                  : "rgba(99,102,241,0.1)",
                border: `1px solid ${adminMode ? "rgba(16,185,129,0.45)" : "rgba(99,102,241,0.2)"}`,
                borderRadius: 8,
                color: adminMode ? "#10b981" : "#818cf8",
                padding: "6px 8px",
                cursor: "pointer",
                fontSize: "0.72rem",
                fontWeight: 700,
              }}
            >
              {adminMode ? "ADMIN" : "READ"}
            </button>
          )}
          {isAdminUser && adminMode && (
            <button
              onClick={() => setAutoApplyActions((v) => !v)}
              title="Actionları otomatik uygula"
              style={{
                background: autoApplyActions
                  ? "rgba(245,158,11,0.18)"
                  : "rgba(99,102,241,0.1)",
                border: `1px solid ${autoApplyActions ? "rgba(245,158,11,0.45)" : "rgba(99,102,241,0.2)"}`,
                borderRadius: 8,
                color: autoApplyActions ? "#f59e0b" : "#818cf8",
                padding: "6px 8px",
                cursor: "pointer",
                fontSize: "0.72rem",
                fontWeight: 700,
              }}
            >
              {autoApplyActions ? "AUTO" : "MANUAL"}
            </button>
          )}
          {isAdminUser && adminMode && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 6px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.2)",
                background: "rgba(15,23,42,0.3)",
              }}
            >
              <button
                onClick={() => setMaxAutoActions((v) => Math.max(1, v - 1))}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  borderRadius: 5,
                  color: "#cbd5e1",
                  width: 16,
                  height: 16,
                  cursor: "pointer",
                  fontWeight: 700,
                  lineHeight: "16px",
                  fontSize: "0.65rem",
                }}
              >
                -
              </button>
              <span
                style={{
                  color: "#f1f5f9",
                  fontSize: "0.65rem",
                  minWidth: 12,
                  textAlign: "center",
                }}
              >
                {maxAutoActions}
              </span>
              <button
                onClick={() => setMaxAutoActions((v) => Math.min(20, v + 1))}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  borderRadius: 5,
                  color: "#cbd5e1",
                  width: 16,
                  height: 16,
                  cursor: "pointer",
                  fontWeight: 700,
                  lineHeight: "16px",
                  fontSize: "0.65rem",
                }}
              >
                +
              </button>
            </div>
          )}
          {isAdminUser && adminMode && (
            <button
              onClick={() => setStopOnViolation((v) => !v)}
              title="Kural ihlalinde davranış"
              style={{
                background: stopOnViolation
                  ? "rgba(239,68,68,0.16)"
                  : "rgba(16,185,129,0.14)",
                border: `1px solid ${stopOnViolation ? "rgba(239,68,68,0.45)" : "rgba(16,185,129,0.45)"}`,
                borderRadius: 8,
                color: stopOnViolation ? "#f87171" : "#34d399",
                padding: "6px 8px",
                cursor: "pointer",
                fontSize: "0.62rem",
                fontWeight: 700,
              }}
            >
              {stopOnViolation ? "STOP" : "SKIP"}
            </button>
          )}
          <button
            onClick={() => setShowSettings((s) => !s)}
            style={{
              background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: 8,
              color: "#818cf8",
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            âš™ï¸
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "none",
                borderRadius: 8,
                color: "#475569",
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              ğŸ—‘ï¸
            </button>
          )}
        </div>
      )}

      {/* API Ayarları */}
      {showSettings && (
        <div
          style={{
            background: "rgba(15,23,42,0.8)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <h3
              style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "0.95rem" }}
            >
              âš™ï¸ API Ayarları
            </h3>
            <button
              onClick={() => {
                invalidateKeyCache();
                setShowSettings(false);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "1.1rem",
              }}
            >
              âœ•
            </button>
          </div>
          <ApiSettings
            onClose={() => {
              invalidateKeyCache();
              setShowSettings(false);
            }}
          />
        </div>
      )}

      {/* Quick prompts â€” boş ekranda büyük grid */}
      {messages.length === 0 && !showSettings && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "20px 0 16px",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: 10, opacity: 0.5 }}>
              ğŸ¤–
            </div>
            <h3
              style={{
                color: "#475569",
                fontWeight: 700,
                marginBottom: 6,
                fontSize: "0.95rem",
              }}
            >
              İşletmenizle ilgili her şeyi sorabilirsiniz
            </h3>
            <p
              style={{
                color: "#334155",
                fontSize: "0.8rem",
                maxWidth: 360,
                lineHeight: 1.6,
              }}
            >
              {hasKeys
                ? "Gerçek verilerinizi analiz ederek yanıt verir."
                : "⚠️ Ayarlar'dan API anahtarini girin. Internetsiz de temel sorulara yanit verir."}
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
            }}
          >
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => send(p.prompt)}
                disabled={loading}
                style={{
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.15)",
                  borderRadius: 10,
                  color: "#818cf8",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  textAlign: "left",
                  transition: "all 0.15s",
                  opacity: loading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(99,102,241,0.14)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "rgba(99,102,241,0.35)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(99,102,241,0.06)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "rgba(99,102,241,0.15)";
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      <div
        ref={chatRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "2px 4px",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 10,
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background:
                  msg.role === "user"
                    ? "linear-gradient(135deg,#ff5722,#ff7043)"
                    : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.9rem",
                flexShrink: 0,
                boxShadow:
                  msg.role === "user"
                    ? "0 2px 10px rgba(255,87,34,0.3)"
                    : "0 2px 10px rgba(99,102,241,0.3)",
              }}
            >
              {msg.role === "user" ? "ğŸ‘¤" : "ğŸ¤–"}
            </div>
            <div style={{ maxWidth: "80%", minWidth: 0 }}>
              <div
                style={{
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg,rgba(255,87,34,0.12),rgba(255,87,34,0.06))"
                      : "linear-gradient(135deg,rgba(99,102,241,0.1),rgba(99,102,241,0.04))",
                  border: `1px solid ${msg.role === "user" ? "rgba(255,87,34,0.2)" : "rgba(99,102,241,0.15)"}`,
                  borderRadius: 14,
                  padding: "12px 15px",
                }}
              >
                <div
                  style={{
                    color: "#e2e8f0",
                    fontSize: "0.87rem",
                    lineHeight: 1.7,
                  }}
                >
                  {msg.role === "assistant" ? (
                    <MarkdownText text={msg.content || "..."} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
              {msg.role === "assistant" && msg.content && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  {msg.source && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: sourceLabel[msg.source]?.color || "#64748b",
                        fontWeight: 600,
                        background: sourceLabel[msg.source]?.bg,
                        borderRadius: 5,
                        padding: "2px 7px",
                      }}
                    >
                      {sourceLabel[msg.source]?.label}
                    </span>
                  )}
                  <button
                    onClick={() => copyMsg(msg.content, i)}
                    style={{
                      background: "none",
                      border: "none",
                      color: copiedIdx === i ? "#10b981" : "#334155",
                      cursor: "pointer",
                      fontSize: "0.72rem",
                      padding: "2px 6px",
                      borderRadius: 5,
                      transition: "color 0.2s",
                    }}
                  >
                    {copiedIdx === i ? "âœ“ Kopyalandı" : "ğŸ“‹ Kopyala"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {/* Onay Kartı â€” DB işlemi bekliyor */}
        {pendingActions && !loading && (
          <div
            style={{
              background:
                "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.04))",
              border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.1rem" }}>âš¡</span>
              <span
                style={{
                  color: "#10b981",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                }}
              >
                İşlem Onayı
              </span>
              <span
                style={{
                  color: "#475569",
                  fontSize: "0.78rem",
                  marginLeft: "auto",
                }}
              >
                Kaydetmek istiyor musunuz?
              </span>
            </div>
            {pendingActions.actions.map((a, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: "0.85rem" }}>
                  {a.type === "sale"
                    ? "ğŸ›’"
                    : a.type === "kasa_gelir"
                      ? "ğŸ’š"
                      : a.type === "kasa_gider"
                        ? "ğŸ”´"
                        : a.type === "stok_guncelle"
                          ? "ğŸ“¦"
                          : a.type === "urun_ekle"
                            ? "➕"
                            : a.type === "cari_ekle"
                              ? "👤"
                              : "ğŸ’³"}
                </span>
                <span
                  style={{ color: "#e2e8f0", fontSize: "0.83rem", flex: 1 }}
                >
                  {a.label}
                </span>
              </div>
            ))}
            {actionResult && actionResult.msgIdx === pendingActions.msgIdx && (
              <div
                style={{
                  color: actionResult.success ? "#10b981" : "#ef4444",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {actionResult.success ? "âœ… " : "âŒ "}
                {actionResult.msg}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() =>
                  runActions(pendingActions.msgIdx, pendingActions.actions)
                }
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg,#059669,#10b981)",
                  border: "none",
                  borderRadius: 9,
                  color: "#fff",
                  padding: "9px 0",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                âœ… Onayla & Kaydet
              </button>
              <button
                onClick={() => {
                  setPendingActions(null);
                  setActionResult(null);
                }}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 9,
                  color: "#64748b",
                  padding: "9px 16px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                İptal
              </button>
            </div>
          </div>
        )}
        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ğŸ¤–
            </div>
            <div
              style={{
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.15)",
                borderRadius: 14,
                padding: "12px 18px",
              }}
            >
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#6366f1",
                      animation: `pulse 1.2s ease ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
                <span
                  style={{
                    color: "#475569",
                    fontSize: "0.75rem",
                    marginLeft: 6,
                  }}
                >
                  {apiStatus === "claude"
                    ? "Claude düşünüyor..."
                    : apiStatus === "gemini"
                      ? "Gemini yanıtlıyor..."
                      : "Yanıt hazırlanıyor..."}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: 1, position: "relative" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              listening
                ? "ğŸ¤ Dinleniyor..."
                : "Sorunuzu yazın veya ğŸ¤ mikrofona basın..."
            }
            rows={2}
            disabled={loading || listening}
            style={{
              width: "100%",
              padding: "11px 15px",
              background: listening
                ? "rgba(239,68,68,0.08)"
                : "rgba(99,102,241,0.06)",
              border: `1px solid ${listening ? "rgba(239,68,68,0.4)" : "rgba(99,102,241,0.2)"}`,
              borderRadius: 12,
              color: "#f1f5f9",
              fontSize: "0.88rem",
              resize: "none",
              boxSizing: "border-box",
              outline: "none",
              lineHeight: 1.5,
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = "rgba(99,102,241,0.5)")
            }
            onBlur={(e) => {
              if (!listening)
                e.target.style.borderColor = "rgba(99,102,241,0.2)";
            }}
          />
          {micError && (
            <div
              style={{
                position: "absolute",
                bottom: -20,
                left: 0,
                fontSize: "0.72rem",
                color: "#f87171",
              }}
            >
              {micError}
            </div>
          )}
        </div>

        {/* Mikrofon butonu */}
        {micSupported && (
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              startListen();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              stopListen();
            }}
            onPointerLeave={() => stopListen()}
            disabled={loading}
            title="Basılı tut ve konuş"
            style={{
              width: 46,
              height: 46,
              flexShrink: 0,
              background: listening
                ? "linear-gradient(135deg,#ef4444,#dc2626)"
                : "rgba(239,68,68,0.1)",
              border: `1px solid ${listening ? "rgba(239,68,68,0.6)" : "rgba(239,68,68,0.2)"}`,
              borderRadius: 12,
              color: listening ? "#fff" : "#f87171",
              cursor: "pointer",
              fontSize: "1.2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: listening ? "0 0 20px rgba(239,68,68,0.5)" : "none",
              animation: listening
                ? "micPulse 1s ease-in-out infinite"
                : "none",
              transition: "all 0.2s",
            }}
          >
            ğŸ¤
          </button>
        )}

        {/* Gönder butonu */}
        <button
          onClick={() => send()}
          disabled={loading || !input.trim() || listening}
          style={{
            width: 46,
            height: 46,
            flexShrink: 0,
            background:
              loading || !input.trim()
                ? "rgba(99,102,241,0.1)"
                : "linear-gradient(135deg,#6366f1,#8b5cf6)",
            border: "none",
            borderRadius: 12,
            color: loading || !input.trim() ? "#334155" : "#fff",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            fontSize: "1.1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              loading || !input.trim()
                ? "none"
                : "0 4px 16px rgba(99,102,241,0.4)",
            transition: "all 0.2s",
          }}
        >
          {loading ? "â³" : "â†‘"}
        </button>
      </div>

      {/* Sesli okuma & ayar çubuğu */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}
      >
        {/* Otomatik sesli okuma toggle */}
        <button
          onClick={() => {
            if (speaking) stopSpeak();
            setAutoSpeak((a) => !a);
          }}
          title={
            autoSpeak
              ? "Sesli okuma açık â€” kapat"
              : "Sesli okuma kapalı â€” aç"
          }
          style={{
            padding: "5px 12px",
            borderRadius: 8,
            border: `1px solid ${autoSpeak ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
            background: autoSpeak
              ? "rgba(16,185,129,0.1)"
              : "rgba(255,255,255,0.03)",
            color: autoSpeak ? "#10b981" : "#475569",
            cursor: "pointer",
            fontSize: "0.78rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 5,
            transition: "all 0.2s",
          }}
        >
          {speaking ? "ğŸ”Š" : autoSpeak ? "ğŸ”ˆ" : "ğŸ”‡"}
          <span>{autoSpeak ? "Sesli Açık" : "Sesli Kapalı"}</span>
        </button>

        {/* Son cevabı sesli oku */}
        {messages.length > 0 &&
          messages[messages.length - 1]?.role === "assistant" &&
          messages[messages.length - 1]?.content && (
            <button
              onClick={() => {
                if (speaking) stopSpeak();
                else speak(messages[messages.length - 1].content);
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 8,
                border: "1px solid rgba(99,102,241,0.2)",
                background: "rgba(99,102,241,0.06)",
                color: speaking ? "#818cf8" : "#475569",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.2s",
              }}
            >
              {speaking ? "â¹ Durdur" : "â–¶ Son Cevabı Oku"}
            </button>
          )}

        {micSupported && (
          <span
            style={{ color: "#1e3a5f", fontSize: "0.7rem", marginLeft: "auto" }}
          >
            ğŸ¤ Basılı tut â†’ konuş â†’ bırak
          </span>
        )}
      </div>

      {/* Konuşma devam ederken mini quick prompts */}
      {messages.length > 0 && !loading && (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}
        >
          {QUICK_PROMPTS.slice(0, 5).map((p) => (
            <button
              key={p.label}
              onClick={() => send(p.prompt)}
              disabled={loading}
              style={{
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.12)",
                borderRadius: 7,
                color: "#475569",
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 600,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#818cf8";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(99,102,241,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#475569";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(99,102,241,0.12)";
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
