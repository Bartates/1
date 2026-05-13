/**
 * Bağlantı Konfigürasyonu
 * Firebase ve Supabase ayarları — önce Firebase'den, fallback localStorage
 */

export interface FirebaseConfig {
  enabled: boolean;
  projectId: string;
  apiKey: string;
  docPath: string;
}

export interface SupabaseConfig {
  enabled: boolean;
  url: string;
  anonKey: string;
  tableName: string;
}

export interface ConnConfig {
  firebase: FirebaseConfig;
  supabase: SupabaseConfig;
  activeProvider: "firebase" | "supabase" | "none";
}

const CONN_KEY = "sobaConnConfig";
const ENV_FB_PROJECT_ID = (
  import.meta.env.VITE_FIREBASE_PROJECT_ID ?? ""
).trim();
const ENV_FB_API_KEY = (import.meta.env.VITE_FIREBASE_API_KEY ?? "").trim();
const ENV_FB_DOC_PATH = (
  import.meta.env.VITE_FIREBASE_DOC_PATH ?? "sync/main"
).trim();
const HAS_FIREBASE_ENV = Boolean(ENV_FB_PROJECT_ID && ENV_FB_API_KEY);

export const DEFAULT_CONN: ConnConfig = {
  firebase: {
    enabled: HAS_FIREBASE_ENV,
    projectId: ENV_FB_PROJECT_ID,
    apiKey: ENV_FB_API_KEY,
    docPath: ENV_FB_DOC_PATH || "sync/main",
  },
  supabase: { enabled: false, url: "", anonKey: "", tableName: "soba_sync" },
  activeProvider: HAS_FIREBASE_ENV ? "firebase" : "none",
};

// ── Yardımcı: default config'den Firebase URL oluştur ──────────────────────
function getDefaultFirebaseUrl(path: string): string | null {
  const { projectId, apiKey } = DEFAULT_CONN.firebase;
  if (!projectId || !apiKey) return null;
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?key=${apiKey}`;
}

function normalizeConnConfig(cfg: ConnConfig): ConnConfig {
  const hasCreds = Boolean(
    cfg.firebase?.projectId?.trim() && cfg.firebase?.apiKey?.trim(),
  );
  const safeCfg: ConnConfig = {
    ...DEFAULT_CONN,
    ...cfg,
    firebase: {
      ...DEFAULT_CONN.firebase,
      ...(cfg.firebase || {}),
      enabled: cfg.firebase?.enabled === true && hasCreds,
    },
    supabase: {
      ...DEFAULT_CONN.supabase,
      ...(cfg.supabase || {}),
    },
    activeProvider: cfg.activeProvider,
  };

  if (safeCfg.activeProvider === "firebase" && !safeCfg.firebase.enabled) {
    safeCfg.activeProvider = "none";
  }

  if (
    safeCfg.activeProvider !== "firebase" &&
    safeCfg.activeProvider !== "supabase"
  ) {
    safeCfg.activeProvider = "none";
  }

  return safeCfg;
}

// ── localStorage fallback (hızlı senkron okuma) ────────────────────────────
export function loadConnConfig(): ConnConfig {
  try {
    const raw = localStorage.getItem(CONN_KEY);
    if (raw) return normalizeConnConfig(JSON.parse(raw));
  } catch {
    /* localStorage okuma hatası */
  }
  return normalizeConnConfig({ ...DEFAULT_CONN });
}

export function saveConnConfig(cfg: ConnConfig): void {
  const safeCfg = normalizeConnConfig(cfg);
  localStorage.setItem(CONN_KEY, JSON.stringify(safeCfg));
  // Arka planda Firebase'e de yaz
  if (safeCfg.activeProvider === "firebase" && safeCfg.firebase.enabled) {
    saveConnConfigToFirebase(safeCfg).catch(() => {});
  }
}

// ── Firebase sync ──────────────────────────────────────────────────────────
const CONN_FB_URL = getDefaultFirebaseUrl("config/connConfig");

export async function loadConnConfigFromFirebase(): Promise<ConnConfig | null> {
  if (!CONN_FB_URL) return null;
  try {
    const res = await fetch(CONN_FB_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json?.fields?.data?.stringValue;
    if (!raw) return null;
    return normalizeConnConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveConnConfigToFirebase(
  cfg: ConnConfig,
): Promise<boolean> {
  if (!CONN_FB_URL) return false;
  try {
    const res = await fetch(CONN_FB_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          data: { stringValue: JSON.stringify(cfg) },
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

/** Firebase Firestore REST URL'ini oluştur */
export function getFirebaseDocUrl(cfg: FirebaseConfig): string {
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/${cfg.docPath}?key=${cfg.apiKey}`;
}

/** Firebase bağlantısını test et */
export async function testFirebase(
  cfg: FirebaseConfig,
): Promise<{ ok: boolean; msg: string }> {
  if (!cfg.projectId || !cfg.apiKey)
    return { ok: false, msg: "Project ID ve API Key gerekli" };
  try {
    const url = getFirebaseDocUrl(cfg);
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok || res.status === 404)
      return { ok: true, msg: `Bağlantı başarılı (HTTP ${res.status})` };
    return {
      ok: false,
      msg: `HTTP ${res.status} — API Key veya Project ID hatalı olabilir`,
    };
  } catch (e) {
    return { ok: false, msg: `Bağlantı hatası: ${String(e).slice(0, 80)}` };
  }
}

/** Supabase bağlantısını test et */
export async function testSupabase(
  cfg: SupabaseConfig,
): Promise<{ ok: boolean; msg: string }> {
  if (!cfg.url || !cfg.anonKey)
    return { ok: false, msg: "URL ve Anon Key gerekli" };
  try {
    const url = `${cfg.url.replace(/\/$/, "")}/rest/v1/${cfg.tableName}?select=id&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true, msg: "Bağlantı başarılı" };
    if (res.status === 404)
      return { ok: false, msg: `"${cfg.tableName}" tablosu bulunamadı` };
    if (res.status === 401) return { ok: false, msg: "Anon Key hatalı" };
    return { ok: false, msg: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, msg: `Bağlantı hatası: ${String(e).slice(0, 80)}` };
  }
}
