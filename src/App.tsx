import { ConfirmProvider } from "@/components/ConfirmDialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LoginScreen, { useAuth } from "@/components/LoginScreen";
import { Modal } from "@/components/Modal";
import NotificationCenter from "@/components/NotificationCenter";
import SetupWizard, {
  getSetupData,
  isSetupDone,
} from "@/components/SetupWizard";
import { useToast } from "@/components/Toast";
import { onSyncStatus, useDB, type SyncStatus } from "@/hooks/useDB";
import {
  applyUIPrefs,
  loadUIPrefs,
  loadUIPrefsFromFirebase,
  saveUIPrefs,
} from "@/hooks/useUIPrefs";
import { loadConnConfigFromFirebase, saveConnConfig } from "@/lib/connConfig";
import { formatMoney, genId } from "@/lib/utils-tr";
import AIAsistan from "@/pages/AIAsistan";
import Bank from "@/pages/Bank";
import BoruTed from "@/pages/BoruTed";
import BugHunter from "@/pages/BugHunter";
import Butce from "@/pages/Butce";
import Cari from "@/pages/Cari";
import Cizelge from "@/pages/Cizelge";
import Dashboard from "@/pages/Dashboard";
import Entegrasyonlar from "@/pages/Entegrasyonlar";
import ExcelMerge from "@/pages/ExcelMerge";
import Fatura from "@/pages/Fatura";
import Kasa from "@/pages/Kasa";
import KontrolHalkasi from "@/pages/KontrolHalkasi";
import Monitor from "@/pages/Monitor";
import Notlar from "@/pages/Notlar";
import Partners from "@/pages/Partners";
import Pelet from "@/pages/Pelet";
import Products from "@/pages/Products";
import Reports from "@/pages/Reports";
import Sales from "@/pages/Sales";
import Settings from "@/pages/Settings";
import Stock from "@/pages/Stock";
import Suppliers from "@/pages/Suppliers";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Toaster } from "sonner";
import "./App.css"; // FIXED: style prop temizligi icin stiller harici CSS dosyasina tasindi

// UI tercihlerini uygulama başlangıcında localStorage'dan hızlıca yükle
applyUIPrefs(loadUIPrefs());

// Arka planda Firebase'den güncel prefs'leri çek ve uygula
Promise.all([loadUIPrefsFromFirebase(), loadConnConfigFromFirebase()])
  .then(([fbPrefs, fbConn]) => {
    if (fbPrefs) {
      saveUIPrefs(fbPrefs);
      applyUIPrefs(fbPrefs);
    }
    if (fbConn) {
      saveConnConfig(fbConn);
    }
  })
  .catch(() => {});

function useOnlineStatus() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

const TABS = [
  { id: "dashboard", label: "Özet", icon: "📊", group: "Ana" },
  { id: "products", label: "Ürünler", icon: "📦", group: "Ana" },
  { id: "sales", label: "Satış", icon: "🛒", group: "Ana" },
  { id: "fatura", label: "Fatura", icon: "🧾", group: "Ana" },
  { id: "suppliers", label: "Tedarikçi", icon: "🏭", group: "Tedarik" },
  { id: "pelet", label: "Pelet", icon: "🪵", group: "Tedarik" },
  { id: "boruTed", label: "Boru Tedarik", icon: "🔩", group: "Tedarik" },
  { id: "cari", label: "Cari", icon: "👤", group: "Finans" },
  { id: "kasa", label: "Kasa", icon: "💰", group: "Finans" },
  { id: "butce", label: "Bütçe", icon: "📊", group: "Finans" },
  { id: "bank", label: "Banka", icon: "🏦", group: "Finans" },
  { id: "reports", label: "Raporlar", icon: "📈", group: "Analiz" },
  { id: "cizelge", label: "Çizelge", icon: "📅", group: "Analiz" },
  { id: "stock", label: "Stok", icon: "🔢", group: "Analiz" },
  { id: "monitor", label: "İzleme", icon: "🔔", group: "Analiz" },
  { id: "kontrol", label: "Kontrol", icon: "⚡", group: "Analiz" },
  { id: "entegrasyon", label: "Entegrasyon", icon: "🔗", group: "Sistem" },
  { id: "excelmerge", label: "Veri Birleştir", icon: "📊", group: "Sistem" },
  { id: "notlar", label: "Not Defteri", icon: "📝", group: "Sistem" },
  { id: "partners", label: "Ortaklar", icon: "🤝", group: "Sistem" },
  { id: "settings", label: "Ayarlar", icon: "⚙️", group: "Sistem" },
  { id: "bughunter", label: "Bug Hunter", icon: "🐛", group: "Sistem" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type TabGroup = (typeof TABS)[number]["group"];

const PRIORITY_TABS: readonly TabId[] = [
  "dashboard",
  "sales",
  "products",
  "kasa",
  "cari",
];
const DEFAULT_EXPANDED_GROUPS: readonly TabGroup[] = ["Ana", "Finans"];
const FAVORITE_TABS_KEY = "sobaYonetim_favoriteTabs";

function loadFavoriteTabs(): TabId[] {
  try {
    const raw = localStorage.getItem(FAVORITE_TABS_KEY);
    if (!raw) return [...PRIORITY_TABS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...PRIORITY_TABS];
    const validTabIds = new Set<TabId>(TABS.map((tab) => tab.id));
    const favorites = parsed.filter(
      (tabId): tabId is TabId =>
        typeof tabId === "string" && validTabIds.has(tabId as TabId),
    );
    return favorites.length > 0 ? favorites.slice(0, 6) : [...PRIORITY_TABS];
  } catch {
    return [...PRIORITY_TABS];
  }
}

function saveFavoriteTabs(tabIds: readonly TabId[]) {
  try {
    localStorage.setItem(FAVORITE_TABS_KEY, JSON.stringify(tabIds.slice(0, 6)));
  } catch {
    // ignore localStorage failures
  }
}

// Quick action modal for FAB
function QuickSaleModal({
  db,
  save,
  onClose,
}: {
  db: ReturnType<typeof useDB>["db"];
  save: ReturnType<typeof useDB>["save"];
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [payment, setPayment] = useState<"nakit" | "kart" | "havale" | "cari">(
    "nakit",
  );
  const [discount, setDiscount] = useState(0);
  const [customerId, setCustomerId] = useState("");

  const product = db.products.find((p) => p.id === productId);
  const subtotal = product ? product.price * qty : 0;
  const total = Math.max(0, subtotal - discount);
  const profit = product ? (product.price - product.cost) * qty - discount : 0;

  const handleSave = () => {
    if (!product) {
      showToast("Ürün seçin!", "error");
      return;
    }
    if (product.stock < qty) {
      showToast(`Stok yetersiz! Mevcut: ${product.stock}`, "error");
      return;
    }
    if (payment === "cari" && !customerId) {
      showToast("Cari hesap seçimi zorunludur!", "error");
      return;
    }
    const nowIso = new Date().toISOString();
    const selectedCari = customerId
      ? db.cari.find((c) => c.id === customerId)
      : undefined;
    const sale = {
      id: genId(),
      productId: product.id,
      productName: product.name,
      productCategory: product.category,
      customerId: customerId || undefined,
      cariId: customerId || undefined,
      cariName: selectedCari?.name,
      quantity: qty,
      unitPrice: product.price,
      cost: product.cost,
      discount,
      discountAmount: discount,
      subtotal,
      total,
      profit,
      payment,
      status: "tamamlandi" as const,
      items: [
        {
          productId: product.id,
          productName: product.name,
          quantity: qty,
          unitPrice: product.price,
          cost: product.cost,
          total,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    save((prev) => {
      const kasaEntry =
        payment !== "cari"
          ? {
              id: genId(),
              type: "gelir" as const,
              category: "satis",
              amount: total,
              kasa:
                payment === "nakit" ? ("nakit" as const) : ("banka" as const),
              description: `Hızlı Satış: ${product.name}`,
              relatedId: sale.id,
              createdAt: nowIso,
              updatedAt: nowIso,
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
        note: "Hızlı Satış",
        date: nowIso,
      };
      // Cari ödeme ise bakiyeyi artır
      let cari = prev.cari;
      if (payment === "cari" && customerId) {
        cari = cari.map((c) =>
          c.id === customerId
            ? {
                ...c,
                balance: (c.balance || 0) + total,
                lastTransaction: nowIso,
                updatedAt: nowIso,
              }
            : c,
        );
      }
      return {
        ...prev,
        sales: [...prev.sales, sale],
        products: prev.products.map((p) =>
          p.id === productId ? { ...p, stock: p.stock - qty } : p,
        ),
        kasa: kasaEntry ? [...prev.kasa, kasaEntry] : prev.kasa,
        stockMovements: [...(prev.stockMovements || []), stockMovement],
        cari,
      };
    });
    showToast(`✅ Satış kaydedildi! ${formatMoney(total)}`, "success");
    onClose();
  };

  return (
    <div className="quick-form-grid">
      <div>
        <label className="quick-form-label">Ürün *</label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="quick-form-input"
          aria-label="Ürün seçimi"
        >
          <option value="">-- Ürün Seç --</option>
          {db.products
            .filter((p) => !p.deleted && p.stock > 0)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Stok: {p.stock}, ₺{p.price})
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className="quick-form-label">
          {payment === "cari"
            ? "Müşteri (Cari ödeme için zorunlu) *"
            : "Müşteri (opsiyonel)"}
        </label>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="quick-form-input"
          aria-label="Müşteri seçimi"
        >
          <option value="">-- Müşteri Seç --</option>
          {db.cari
            .filter((c) => !c.deleted && c.type === "musteri")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>
      <div className="quick-form-grid-two">
        <div>
          <label className="quick-form-label">Adet</label>
          <input
            type="number"
            value={qty}
            min={1}
            max={product?.stock || 999}
            onChange={(e) => setQty(parseInt(e.target.value) || 1)}
            className="quick-form-input"
            title="Satış adedi"
            placeholder="1"
          />
        </div>
        <div>
          <label className="quick-form-label">İskonto (₺)</label>
          <input
            type="number"
            value={discount}
            min={0}
            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
            className="quick-form-input"
            title="İskonto tutarı"
            placeholder="0"
          />
        </div>
      </div>
      <div>
        <label className="quick-form-label">Ödeme</label>
        <div className="quick-payment-row">
          {(["nakit", "kart", "havale", "cari"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPayment(p)}
              className={`quick-payment-btn ${payment === p ? "active" : ""}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {product && (
        <div className="quick-summary-box">
          <Row label="Ara Toplam" value={formatMoney(subtotal)} />
          {discount > 0 && (
            <Row
              label="İskonto"
              value={`-${formatMoney(discount)}`}
              color="#ef4444"
            />
          )}
          <Row label="TOPLAM" value={formatMoney(total)} color="#10b981" big />
          <Row
            label="Kâr"
            value={formatMoney(profit)}
            color={profit >= 0 ? "#10b981" : "#ef4444"}
          />
        </div>
      )}
      <button
        onClick={handleSave}
        className="quick-submit-btn quick-submit-sale"
      >
        🛒 Hızlı Satış — {formatMoney(total)}
      </button>
    </div>
  );
}

function QuickIncomeModal({
  db,
  save,
  onClose,
  type,
}: {
  db: ReturnType<typeof useDB>["db"];
  save: ReturnType<typeof useDB>["save"];
  onClose: () => void;
  type: "gelir" | "gider";
}) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [kasa, setKasa] = useState("nakit");
  const [category, setCategory] = useState("");

  const kasalar = db.kasalar || [
    { id: "nakit", name: "Nakit", icon: "💵" },
    { id: "banka", name: "Banka", icon: "🏦" },
  ];

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      showToast("Geçerli tutar girin!", "error");
      return;
    }
    const nowIso = new Date().toISOString();
    save((prev) => ({
      ...prev,
      kasa: [
        ...prev.kasa,
        {
          id: genId(),
          type,
          category:
            category || (type === "gelir" ? "diger_gelir" : "diger_gider"),
          amount: amt,
          kasa,
          description,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
    }));
    showToast(`${type === "gelir" ? "Gelir" : "Gider"} kaydedildi!`, "success");
    onClose();
  };

  return (
    <div className="quick-form-grid">
      <div>
        <label className="quick-form-label">Tutar (₺) *</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="quick-form-input"
          placeholder="0,00"
          autoFocus
        />
      </div>
      <div className="quick-form-grid-two">
        <div>
          <label className="quick-form-label">Kasa</label>
          <select
            value={kasa}
            onChange={(e) => setKasa(e.target.value)}
            className="quick-form-input"
            aria-label="Kasa seçimi"
          >
            {kasalar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.icon} {k.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="quick-form-label">Kategori</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="quick-form-input"
            placeholder="opsiyonel"
          />
        </div>
      </div>
      <div>
        <label className="quick-form-label">Açıklama</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="quick-form-input"
          placeholder="Açıklama..."
        />
      </div>
      <button
        onClick={handleSave}
        className={`quick-submit-btn ${type === "gelir" ? "quick-submit-income" : "quick-submit-expense"}`}
      >
        💾 {type === "gelir" ? "Gelir Kaydet" : "Gider Kaydet"}
      </button>
    </div>
  );
}

function QuickProductModal({
  db,
  save,
  onClose,
}: {
  db: ReturnType<typeof useDB>["db"];
  save: ReturnType<typeof useDB>["save"];
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const cats = db.productCategories || [];
  const defaultCat = cats[0]?.id || "soba";
  const [form, setForm] = useState({
    name: "",
    category: defaultCat,
    cost: "",
    price: "",
    stock: "",
    minStock: "5",
  });

  const handleSave = () => {
    if (!form.name || !form.price) {
      showToast("Ad ve fiyat zorunlu!", "error");
      return;
    }
    const nowIso = new Date().toISOString();
    save((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          id: genId(),
          name: form.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          category: form.category as any,
          cost: parseFloat(form.cost) || 0,
          price: parseFloat(form.price) || 0,
          stock: parseInt(form.stock) || 0,
          minStock: parseInt(form.minStock) || 5,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
    }));
    showToast("Ürün eklendi!", "success");
    onClose();
  };

  return (
    <div className="quick-form-grid">
      <div>
        <label className="quick-form-label">Ürün Adı *</label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="quick-form-input"
          autoFocus
        />
      </div>
      <div>
        <label className="quick-form-label">Kategori</label>
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          className="quick-form-input"
          aria-label="Ürün kategorisi seçimi"
        >
          {cats.length > 0
            ? cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))
            : [
                ["soba", "🔥 Soba"],
                ["aksesuar", "🔧 Aksesuar"],
                ["yedek", "⚙️ Yedek Parça"],
                ["boru", "🔩 Boru"],
                ["pelet", "🪵 Pelet"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
        </select>
      </div>
      <div className="quick-form-grid-two">
        <div>
          <label className="quick-form-label">Alış (₺)</label>
          <input
            type="number"
            value={form.cost}
            onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
            className="quick-form-input"
            title="Ürünün alış fiyatı"
            placeholder="0"
          />
        </div>
        <div>
          <label className="quick-form-label">Satış (₺) *</label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            className="quick-form-input"
            title="Ürünün satış fiyatı"
            placeholder="0"
          />
        </div>
        <div>
          <label className="quick-form-label">Stok</label>
          <input
            type="number"
            value={form.stock}
            onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
            className="quick-form-input"
            title="Mevcut stok miktarı"
            placeholder="0"
          />
        </div>
        <div>
          <label className="quick-form-label">Min. Stok</label>
          <input
            type="number"
            value={form.minStock}
            onChange={(e) =>
              setForm((f) => ({ ...f, minStock: e.target.value }))
            }
            className="quick-form-input"
            title="Minimum stok eşiği"
            placeholder="5"
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        className="quick-submit-btn quick-submit-product"
      >
        📦 Ürün Ekle
      </button>
    </div>
  );
}

function GlobalSearch({
  onNavigate,
  db,
  favoriteTabs,
}: {
  onNavigate: (tab: TabId) => void;
  db: ReturnType<typeof useDB>["db"];
  favoriteTabs: readonly TabId[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const res: { tab: TabId; label: string; icon: string; match: string }[] =
      [];
    const favoriteSet = new Set(favoriteTabs);
    TABS.forEach((t) => {
      if (t.label.toLowerCase().includes(q))
        res.push({
          tab: t.id,
          label: t.label,
          icon: t.icon,
          match: favoriteSet.has(t.id) ? "Favori modül" : "Modül",
        });
    });
    db.products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q),
      )
      .slice(0, 3)
      .forEach((p) =>
        res.push({
          tab: "products",
          label: p.name,
          icon: "📦",
          match: `Stok: ${p.stock} · ₺${p.price}`,
        }),
      );
    db.cari
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((c) =>
        res.push({
          tab: "cari",
          label: c.name,
          icon: "👤",
          match: c.type === "musteri" ? "Müşteri" : "Tedarikçi",
        }),
      );
    db.suppliers
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 2)
      .forEach((s) =>
        res.push({
          tab: "suppliers",
          label: s.name,
          icon: "🏭",
          match: "Tedarikçi",
        }),
      );
    return res
      .sort(
        (left, right) =>
          Number(favoriteSet.has(right.tab)) -
          Number(favoriteSet.has(left.tab)),
      )
      .slice(0, 8);
  }, [query, db, favoriteTabs]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="global-search-wrap">
      <div className="global-search-inner">
        <span className="global-search-icon">🔍</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Ürün, müşteri, modül ara..."
          className="global-search-input"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="global-search-clear"
          >
            ×
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="global-search-results">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                onNavigate(r.tab);
                setQuery("");
                setOpen(false);
              }}
              className="global-search-item"
            >
              <span className="global-search-item-icon">{r.icon}</span>
              <div className="global-search-item-main">
                <div className="global-search-item-label">{r.label}</div>
                <div className="global-search-item-match">{r.match}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu({
  username,
  onLogout,
  isMobile,
}: {
  username?: string;
  onLogout: () => void;
  isMobile: boolean;
}) {
  const [open, setOpen] = useState(false);

  const exitApp = async () => {
    try {
      const { App: CapApp } = await import("@capacitor/app");
      await CapApp.exitApp();
    } catch {
      window.close();
    }
  };

  return (
    <div className="user-menu-root">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`user-menu-toggle ${isMobile ? "mobile" : ""}`}
      >
        👤 {!isMobile && (username || "Kullanıcı")}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} className="user-menu-backdrop" />
          <div className="user-menu-panel">
            <div className="user-menu-head">
              <div className="user-menu-name">👤 {username || "Kullanıcı"}</div>
              <div className="user-menu-status">Oturum açık</div>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="user-menu-action logout"
            >
              🚪 Oturumu Kapat
            </button>
            <button
              onClick={() => {
                setOpen(false);
                exitApp();
              }}
              className="user-menu-action close"
            >
              ✕ Uygulamayı Kapat
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Hareketli Buton Hook'u ──────────────────────────────────────────────────
function useDraggableButton(
  storageKey: string,
  defaultPos: { x: number; y: number },
) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch { /* localStorage okuma hatası */ }
    return defaultPos;
  });
  const dragging = useRef(false);
  const startRef = useRef({ mx: 0, my: 0, bx: 0, by: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      startRef.current = { mx: e.clientX, my: e.clientY, bx: pos.x, by: pos.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [pos],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startRef.current.mx;
    const dy = e.clientY - startRef.current.my;
    const newX = Math.max(
      8,
      Math.min(window.innerWidth - 64, startRef.current.bx + dx),
    );
    const newY = Math.max(
      8,
      Math.min(window.innerHeight - 64, startRef.current.by + dy),
    );
    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setPos((p) => {
      localStorage.setItem(storageKey, JSON.stringify(p));
      return p;
    });
  }, [storageKey]);

  return {
    pos,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    isDragging: dragging,
  };
}

// ── Hata Bildirme Butonu ────────────────────────────────────────────────────
function ReportButton({ visible }: { visible: boolean }) {
  const { pos, onPointerDown, onPointerMove, onPointerUp, isDragging } =
    useDraggableButton("reportBtnPos", { x: 90, y: 28 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "hata", note: "", contact: "" });
  const [sent, setSent] = useState(false);
  const [pulse, setPulse] = useState(0);
  const reportBtnRef = useRef<HTMLButtonElement>(null);
  const reportPanelRef = useRef<HTMLDivElement>(null);

  // Animasyonlu ikon
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => (p + 1) % 3), 1200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (reportBtnRef.current) {
      reportBtnRef.current.style.bottom = `${pos.y}px`;
      reportBtnRef.current.style.left = `${pos.x}px`;
    }
    if (reportPanelRef.current) {
      reportPanelRef.current.style.bottom = `${pos.y + 56}px`;
      reportPanelRef.current.style.left = `${Math.min(pos.x, window.innerWidth - 320)}px`;
    }
  }, [pos, open, visible]); // FIXED: Dinamik konum JSX style prop yerine ref ile uygulanir

  if (!visible) return null;

  const icons = ["🐛", "⚠️", "💡"];
  const icon = icons[pulse];

  const handleSend = () => {
    if (!form.note.trim()) return;
    // localStorage'a kaydet
    const reports = JSON.parse(localStorage.getItem("sobaReports") || "[]");
    reports.push({
      ...form,
      time: new Date().toISOString(),
      url: window.location.href,
    });
    localStorage.setItem("sobaReports", JSON.stringify(reports.slice(-50)));
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setOpen(false);
      setForm({ type: "hata", note: "", contact: "" });
    }, 2000);
  };

  return (
    <>
      <button
        ref={reportBtnRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => {
          if (!isDragging.current) setOpen((o) => !o);
        }}
        title="Hata Bildir / Not Al"
        className="report-btn" // FIXED: Inline stil className'a tasindi
      >
        {icon}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} className="report-overlay" />
          <div ref={reportPanelRef} className="report-panel">
            <div className="report-title">📋 Bildir / Not Al</div>
            {sent ? (
              <div className="report-sent">✅ Kaydedildi!</div>
            ) : (
              <>
                <div className="report-type-row">
                  {[
                    { v: "hata", l: "🐛 Hata" },
                    { v: "oneri", l: "💡 Öneri" },
                    { v: "not", l: "📝 Not" },
                    { v: "takip", l: "👁️ Takip" },
                  ].map((t) => (
                    <button
                      key={t.v}
                      onClick={() => setForm((f) => ({ ...f, type: t.v }))}
                      className={`report-type-btn ${form.type === t.v ? "active" : ""}`}
                    >
                      {t.l}
                    </button>
                  ))}
                </div>
                <textarea
                  value={form.note}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, note: e.target.value }))
                  }
                  placeholder="Açıklama, not veya hata detayı..."
                  className="report-textarea" // FIXED: Inline stil className'a tasindi
                />
                <input
                  value={form.contact}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contact: e.target.value }))
                  }
                  placeholder="İletişim (opsiyonel)"
                  className="report-contact" // FIXED: Inline stil className'a tasindi
                />
                <button
                  onClick={handleSend}
                  disabled={!form.note.trim()}
                  className={`report-save-btn ${form.note.trim() ? "enabled" : "disabled"}`}
                >
                  💾 Kaydet
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

function FAB({
  db,
  save,
  onOpenAI,
  uiPrefs,
}: {
  db: ReturnType<typeof useDB>["db"];
  save: ReturnType<typeof useDB>["save"];
  onOpenAI: () => void;
  uiPrefs: ReturnType<typeof import("@/hooks/useUIPrefs").loadUIPrefs>;
}) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<
    "sale" | "gelir" | "gider" | "product" | null
  >(null);
  const aiBtnRef = useRef<HTMLButtonElement>(null);
  const fabWrapRef = useRef<HTMLDivElement>(null);

  // Hareketli FAB (sağ alt)
  const fab = useDraggableButton("fabBtnPos", { x: 28, y: 28 });
  // Hareketli AI butonu (sol alt)
  const ai = useDraggableButton("aiBtnPos", { x: 28, y: 28 });

  const actions = [
    { id: "sale" as const, label: "Hızlı Satış", icon: "🛒", color: "#ff5722" },
    {
      id: "product" as const,
      label: "Ürün Ekle",
      icon: "📦",
      color: "#3b82f6",
    },
    { id: "gelir" as const, label: "Gelir Ekle", icon: "💚", color: "#10b981" },
    { id: "gider" as const, label: "Gider Ekle", icon: "🔴", color: "#ef4444" },
  ];

  const titles: Record<string, string> = {
    sale: "🛒 Hızlı Satış",
    gelir: "💚 Hızlı Gelir",
    gider: "🔴 Hızlı Gider",
    product: "📦 Hızlı Ürün Ekle",
  };

  useEffect(() => {
    if (aiBtnRef.current) {
      aiBtnRef.current.style.bottom = `${ai.pos.y}px`;
      aiBtnRef.current.style.left = `${ai.pos.x}px`;
    }
    if (fabWrapRef.current) {
      fabWrapRef.current.style.bottom = `${fab.pos.y}px`;
      fabWrapRef.current.style.right = `${fab.pos.x}px`;
    }
  }, [ai.pos, fab.pos]); // FIXED: Dinamik konum JSX style prop yerine ref ile uygulanir

  return (
    <>
      {open && <div onClick={() => setOpen(false)} className="fab-overlay" />}

      {/* AI Floating Button — hareketli */}
      {uiPrefs.showAIButton && (
        <button
          ref={aiBtnRef}
          onPointerDown={ai.onPointerDown}
          onPointerMove={ai.onPointerMove}
          onPointerUp={ai.onPointerUp}
          onClick={() => {
            if (!ai.isDragging.current) onOpenAI();
          }}
          title="AI Asistan"
          className="fab-ai-btn" // FIXED: Inline stil className'a tasindi
        >
          🤖
        </button>
      )}

      {/* FAB — hareketli */}
      {uiPrefs.showFABButton && (
        <div ref={fabWrapRef} className="fab-wrap">
          {open &&
            actions.map((a) => (
              <div key={a.id} className="fab-action-row">
                <div className="fab-action-label">{a.label}</div>
                <button
                  onClick={() => {
                    setModal(a.id);
                    setOpen(false);
                  }}
                  className={`fab-action-btn fab-action-${a.id}`}
                >
                  {a.icon}
                </button>
              </div>
            ))}
          <button
            onPointerDown={fab.onPointerDown}
            onPointerMove={fab.onPointerMove}
            onPointerUp={fab.onPointerUp}
            onClick={() => {
              if (!fab.isDragging.current) setOpen((o) => !o);
            }}
            className={`fab-main-btn ${open ? "open" : ""}`}
          >
            +
          </button>
        </div>
      )}

      {modal && (
        <Modal
          open={true}
          onClose={() => setModal(null)}
          title={titles[modal] || ""}
          maxWidth={480}
        >
          {modal === "sale" && (
            <QuickSaleModal
              db={db}
              save={save}
              onClose={() => setModal(null)}
            />
          )}
          {modal === "gelir" && (
            <QuickIncomeModal
              db={db}
              save={save}
              onClose={() => setModal(null)}
              type="gelir"
            />
          )}
          {modal === "gider" && (
            <QuickIncomeModal
              db={db}
              save={save}
              onClose={() => setModal(null)}
              type="gider"
            />
          )}
          {modal === "product" && (
            <QuickProductModal
              db={db}
              save={save}
              onClose={() => setModal(null)}
            />
          )}
        </Modal>
      )}
    </>
  );
}

// ── AI Drawer ──
function AIDrawer({
  open,
  onClose,
  db,
  save,
}: {
  open: boolean;
  onClose: () => void;
  db: ReturnType<typeof useDB>["db"];
  save: ReturnType<typeof useDB>["save"];
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`ai-drawer-backdrop ${open ? "open" : ""}`}
      />
      {/* Drawer panel */}
      <div className={`ai-drawer-panel ${open ? "open" : ""}`}>
        {/* Drawer header */}
        <div className="ai-drawer-header">
          <div className="ai-drawer-badge">🤖</div>
          <div className="ai-drawer-head-main">
            <div className="ai-drawer-title">Soba AI Asistan</div>
            <div className="ai-drawer-subtitle">
              Claude · Gemini · Çevrimdışı
            </div>
          </div>
          <button onClick={onClose} className="ai-drawer-close">
            ×
          </button>
        </div>
        {/* AIAsistan content — her zaman mount, sadece visibility değişir (konuşma korunur) */}
        <div className="ai-drawer-content">
          <AIAsistan db={db} save={save} embedded />
        </div>
      </div>
    </>
  );
}

function AppContent({
  onLogout,
  username,
}: {
  onLogout: () => void;
  username?: string;
}) {
  const { db, save, exportJSON, importJSON } = useDB();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [favoriteTabs, setFavoriteTabs] = useState<TabId[]>(loadFavoriteTabs);
  const [expandedGroups, setExpandedGroups] = useState<
    Record<TabGroup, boolean>
  >({
    Ana: true,
    Tedarik: false,
    Finans: true,
    Analiz: false,
    Sistem: false,
  });
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [uiPrefs, setUiPrefs] = useState(loadUIPrefs);
  const isOnline = useOnlineStatus();
  const prevOnline = useRef(isOnline);
  const { showToast } = useToast();

  // UIPrefs değişikliklerini dinle (Settings'ten güncelleme gelince yansısın)
  useEffect(() => {
    const handler = () => setUiPrefs(loadUIPrefs());
    window.addEventListener("storage", handler);
    window.addEventListener("sobaUI:updated", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("sobaUI:updated", handler);
    };
  }, []);

  // Sync durum izleme
  useEffect(() => {
    const unsub = onSyncStatus((status, detail) => {
      setSyncStatus(status);
      if (status === "saved")
        setLastSyncTime(
          new Date().toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      if (status === "error" && detail) console.warn("[sync]", detail);
    });
    return unsub;
  }, []);

  // Son güncelleme toast'u — her versiyon için bir kez göster
  useEffect(() => {
    const LATEST_VERSION = '3.0.0';
    const seenKey = `parspel_update_seen_${LATEST_VERSION}`;
    try {
      if (!localStorage.getItem(seenKey)) {
        setTimeout(() => {
          showToast(`🚀 v${LATEST_VERSION} — Multi-agent orkestrasyonu, IndexedDB snapshot ve fallback aksiyon akisi eklendi`, 'info');
          try { localStorage.setItem(seenKey, '1'); } catch { /* localStorage yazma hatası */ }
        }, 1500);
      }
    } catch { /* localStorage okuma hatası */ }
  }, [showToast]);

  // İlk kurulum verisini DB'ye yaz (bir kez)
  useEffect(() => {
    const setup = getSetupData();
    if (!setup) return;
    const applied = localStorage.getItem("sobaYonetim_setupApplied");
    if (applied) return;
    save((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const now = new Date().toISOString();
      // Kasalar
      const kasalar = setup.kasalar.length > 0 ? setup.kasalar : prev.kasalar;
      // Ürünler
      const mevcutIds = new Set(prev.products.map((p: { id: string }) => p.id));
      const yeniUrunler = (setup.urunler || []).filter(
        (u: { id: string }) => !mevcutIds.has(u.id),
      );
      const products = [...prev.products, ...yeniUrunler];
      // Ortaklar
      const mevcutOrtakIds = new Set(
        (prev.partners || []).map((p: { id: string }) => p.id),
      );
      const yeniOrtaklar = (setup.ortaklar || []).filter(
        (o: { id: string }) => !mevcutOrtakIds.has(o.id),
      );
      const partners = [...(prev.partners || []), ...yeniOrtaklar];
      // Ortak carileri
      const mevcutCariIds = new Set(prev.cari.map((c: { id: string }) => c.id));
      const yeniCariOrtaklar = (setup.cariOrtaklar || []).filter(
        (c: { id: string }) => !mevcutCariIds.has(c.id),
      );
      const cari = [...prev.cari, ...yeniCariOrtaklar];
      // Settings
      const settings = {
        ...prev.settings,
        companyName: setup.companyName,
        city: setup.city,
      };
      // Kategoriler
      const mevcutKatIds = new Set(
        (prev.productCategories || []).map((k: { id: string }) => k.id),
      );
      const yeniKategoriler = (setup.kategoriler || []).filter(
        (k: { id: string }) => !mevcutKatIds.has(k.id),
      );
      const productCategories = [
        ...(prev.productCategories || []),
        ...yeniKategoriler,
      ];
      return {
        ...prev,
        kasalar,
        products,
        partners,
        cari,
        settings,
        productCategories,
      };
    });
    localStorage.setItem("sobaYonetim_setupApplied", "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevOnline.current !== isOnline) {
      if (isOnline) {
        showToast("İnternet bağlantısı yeniden kuruldu", "success");
      } else {
        showToast(
          "Çevrimdışı çalışıyorsunuz — veriler korunuyor",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "info" as any,
        );
      }
      prevOnline.current = isOnline;
    }
  }, [isOnline, showToast]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const navigate = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  }, []);

  const toggleGroup = useCallback((group: TabGroup) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }, []);

  const toggleFavoriteTab = useCallback((tabId: TabId) => {
    setFavoriteTabs((prev) => {
      const next = prev.includes(tabId)
        ? prev.filter((currentTabId) => currentTabId !== tabId)
        : [
            tabId,
            ...prev.filter((currentTabId) => currentTabId !== tabId),
          ].slice(0, 6);
      saveFavoriteTabs(next);
      return next;
    });
  }, []);

  const priorityTabs = useMemo(
    () =>
      favoriteTabs
        .map((id) => TABS.find((tab) => tab.id === id))
        .filter((tab): tab is (typeof TABS)[number] => Boolean(tab)),
    [favoriteTabs],
  );

  useEffect(() => {
    const activeGroup = TABS.find((tab) => tab.id === activeTab)?.group;
    if (!activeGroup) return;
    setExpandedGroups((prev) =>
      prev[activeGroup] ? prev : { ...prev, [activeGroup]: true },
    );
  }, [activeTab]);

  // Yedek event listener (Dashboard widget'ından tetiklenir)
  useEffect(() => {
    const handler = () => {
      exportJSON();
      localStorage.setItem("sobaYonetim_lastBackup", new Date().toISOString());
    };
    window.addEventListener("soba:exportJSON", handler);
    return () => window.removeEventListener("soba:exportJSON", handler);
  }, [exportJSON]);

  const badges = useMemo(
    () => ({
      products:
        db.products.filter((p) => !p.deleted && p.stock === 0).length +
        db.products.filter(
          (p) => !p.deleted && p.stock > 0 && p.stock <= p.minStock,
        ).length,
      sales: db.sales.filter(
        (s) =>
          s.status === "tamamlandi" &&
          new Date(s.createdAt).toDateString() === new Date().toDateString(),
      ).length,
      suppliers: db.orders.filter((o) => o.status === "bekliyor").length,
      bank: db.bankTransactions.filter((t) => t.status === "unmatched").length,
      monitor: db.monitorRules
        .filter((r) => r.active)
        .reduce((c, r) => {
          if (
            r.type === "stok_sifir" &&
            db.products.some((p) => !p.deleted && p.stock === 0)
          )
            return c + 1;
          if (
            r.type === "stok_min" &&
            db.products.some(
              (p) => !p.deleted && p.stock > 0 && p.stock <= p.minStock,
            )
          )
            return c + 1;
          return c;
        }, 0),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.products, db.orders, db.invoices, db.sales],
  );

  const totalKasa = useMemo(
    () =>
      db.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0),
    [db.kasa],
  );
  const nakit = useMemo(
    () =>
      db.kasa
        .filter((k) => !k.deleted && k.kasa === "nakit")
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0),
    [db.kasa],
  );
  const groups: TabGroup[] = ["Ana", "Tedarik", "Finans", "Analiz", "Sistem"];
  const activeGroup = TABS.find((t) => t.id === activeTab)?.group || "Sistem";
  const activeGroupClass =
    activeGroup === "Ana"
      ? "ana"
      : activeGroup === "Tedarik"
        ? "tedarik"
        : activeGroup === "Finans"
          ? "finans"
          : activeGroup === "Analiz"
            ? "analiz"
            : "sistem"; // FIXED: Aktif grup rengi className ile yonetilir

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const map: Record<string, TabId> = {
          "1": "dashboard",
          "2": "products",
          "3": "sales",
          "4": "kasa",
          "5": "reports",
        };
        if (map[e.key]) {
          e.preventDefault();
          navigate(map[e.key]);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="app-mobile-overlay"
        />
      )}
      {/* SIDEBAR */}
      <aside
        className={`app-sidebar ${isMobile && !sidebarOpen ? "mobile-closed" : "mobile-open"}`}
      >
        {/* Logo */}
        <div className="app-sidebar-logo-wrap">
          <div className="app-sidebar-logo-row">
            <div className="app-sidebar-logo-icon">🔥</div>
            <div className="app-sidebar-logo-text-wrap">
              <div className="app-sidebar-logo-title">Soba Yönetim</div>
              <div className="app-sidebar-logo-subtitle">Sistemi · v3.0</div>
            </div>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="app-sidebar-close-btn"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* NAV */}
        <nav className="app-sidebar-nav">
          <div
            role="region"
            aria-label="Hızlı erişim"
            className="app-quick-region"
          >
            <div className="app-quick-region-head">
              <div className="app-quick-region-title">Hızlı Erişim</div>
              <div className="app-quick-region-subtitle">Favori modüller</div>
            </div>
            <div className="app-quick-grid">
              {priorityTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const tabGroupClass =
                  tab.group === "Ana"
                    ? "ana"
                    : tab.group === "Tedarik"
                      ? "tedarik"
                      : tab.group === "Finans"
                        ? "finans"
                        : tab.group === "Analiz"
                          ? "analiz"
                          : "sistem"; // FIXED: Grup rengi className ile yonetilir
                return (
                  <button
                    key={tab.id}
                    onClick={() => navigate(tab.id)}
                    aria-label={`${tab.label} hızlı erişim`}
                    className={`app-priority-tab ${tabGroupClass} ${isActive ? "active" : "inactive"}`}
                  >
                    <span
                      className={`app-priority-tab-icon ${isActive ? "active" : "inactive"}`}
                    >
                      {tab.icon}
                    </span>
                    <span className="app-priority-tab-label">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {groups.map((group) => {
            const groupClass =
              group === "Ana"
                ? "ana"
                : group === "Tedarik"
                  ? "tedarik"
                  : group === "Finans"
                    ? "finans"
                    : group === "Analiz"
                      ? "analiz"
                      : "sistem"; // FIXED: Grup stili className ile yonetilir
            const groupTabs = TABS.filter((t) => t.group === group);
            const isExpanded =
              expandedGroups[group] ?? DEFAULT_EXPANDED_GROUPS.includes(group);
            return (
              <div key={group} className="app-nav-group">
                <button
                  onClick={() => toggleGroup(group)}
                  className={`app-nav-group-toggle ${groupClass}`}
                  aria-expanded={isExpanded}
                  aria-label={`${group} grubunu ${isExpanded ? "daralt" : "genislet"}`}
                >
                  <span
                    className={`app-nav-group-arrow ${isExpanded ? "expanded" : ""}`}
                  >
                    ▶
                  </span>
                  <span className="app-nav-group-name">{group}</span>
                  <div className={`app-nav-group-line ${groupClass}`} />
                  <span className="app-nav-group-count">
                    {groupTabs.length}
                  </span>
                </button>
                {isExpanded &&
                  groupTabs.map((tab) => {
                    const badge = badges[tab.id as keyof typeof badges];
                    const isActive = activeTab === tab.id;
                    const isFavorite = favoriteTabs.includes(tab.id);
                    const tabGroupClass =
                      tab.group === "Ana"
                        ? "ana"
                        : tab.group === "Tedarik"
                          ? "tedarik"
                          : tab.group === "Finans"
                            ? "finans"
                            : tab.group === "Analiz"
                              ? "analiz"
                              : "sistem";
                    return (
                      <div key={tab.id} className="app-nav-tab-row">
                        <button
                          onClick={() => navigate(tab.id)}
                          className={`app-nav-tab-btn ${tabGroupClass} ${isActive ? "active" : "inactive"}`}
                        >
                          <span
                            className={`app-nav-tab-icon ${isActive ? "active" : "inactive"}`}
                          >
                            {tab.icon}
                          </span>
                          <span className="app-nav-tab-label">{tab.label}</span>
                          {badge ? (
                            <span
                              className={`app-nav-badge ${tab.id === "products" || tab.id === "monitor" ? "danger" : "warn"}`}
                            >
                              {badge > 99 ? "99+" : badge}
                            </span>
                          ) : null}
                          {isActive && (
                            <span
                              className={`app-nav-tab-active-line ${tabGroupClass}`}
                            />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavoriteTab(tab.id)}
                          aria-label={`${tab.label} favorilere ${isFavorite ? "ekli, kaldır" : "ekle"}`}
                          title={
                            isFavorite
                              ? "Favorilerden kaldır"
                              : "Favorilere ekle"
                          }
                          className={`app-favorite-btn ${isFavorite ? "active" : "inactive"}`}
                        >
                          {isFavorite ? "★" : "☆"}
                        </button>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </nav>

        {/* Kasa Widget */}
        <div onClick={() => navigate("kasa")} className="app-kasa-widget">
          <div className="app-kasa-widget-head">
            <span>💰</span>
            <span>Toplam Kasa</span>
            <span className="app-kasa-widget-dot" />
          </div>
          <div
            className={`app-kasa-widget-total ${totalKasa >= 0 ? "positive" : "negative"}`}
          >
            {formatMoney(totalKasa)}
          </div>
          <div className="app-kasa-widget-split">
            <div className="app-kasa-widget-col">
              <div className="app-kasa-widget-col-label">Nakit</div>
              <div className="app-kasa-widget-col-value">
                {formatMoney(nakit)}
              </div>
            </div>
            <div className="app-kasa-widget-divider" />
            <div className="app-kasa-widget-col">
              <div className="app-kasa-widget-col-label">Banka</div>
              <div className="app-kasa-widget-col-value">
                {formatMoney(totalKasa - nakit)}
              </div>
            </div>
          </div>
        </div>

        {/* Alt durum çubuğu */}
        <div className="app-status-wrap">
          {/* Online/offline + sync durumu */}
          <div className="app-status-row">
            <span
              className={`app-status-dot ${isOnline ? "online" : "offline"}`}
            />
            <span
              className={`app-status-text ${isOnline ? "online" : "offline"}`}
            >
              {isOnline ? "Çevrimiçi" : "Çevrimdışı"}
            </span>
            {/* Sync durumu */}
            <span className={`app-sync-mini ${syncStatus}`}>
              {syncStatus === "saving"
                ? "⟳ Senkronize…"
                : syncStatus === "saved"
                  ? `✓ ${lastSyncTime}`
                  : syncStatus === "error"
                    ? "✗ Hata"
                    : syncStatus === "loading"
                      ? "↓ Yüklüyor"
                      : ""}
            </span>
          </div>
          <div className="app-status-foot">
            🔒 Firebase & localStorage · Güvenli
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className={`app-main-shell ${isMobile ? "mobile" : "desktop"}`}>
        <header className={`app-header ${isMobile ? "mobile" : "desktop"}`}>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="app-header-menu-btn"
            >
              ☰
            </button>
          )}
          {/* Sayfa başlığı */}
          <div
            className={`app-header-title-wrap ${isMobile ? "mobile" : "desktop"}`}
          >
            <h1
              className={`app-header-title ${isMobile ? "mobile" : "desktop"}`}
            >
              <span className={`app-header-title-icon ${activeGroupClass}`}>
                {TABS.find((t) => t.id === activeTab)?.icon}
              </span>
              {TABS.find((t) => t.id === activeTab)?.label}
            </h1>
          </div>
          {!isMobile && (
            <GlobalSearch
              onNavigate={navigate}
              db={db}
              favoriteTabs={favoriteTabs}
            />
          )}
          <div
            className={`app-header-actions ${isMobile ? "mobile" : "desktop"}`}
          >
            {/* Kısayollar */}
            {!isMobile && (
              <div className="app-shortcuts-row">
                {[
                  { k: "⌘1", t: "dashboard", label: "Özet" },
                  { k: "⌘2", t: "products", label: "Ürün" },
                  { k: "⌘3", t: "sales", label: "Satış" },
                  { k: "⌘4", t: "kasa", label: "Kasa" },
                ].map((s) => (
                  <button
                    key={s.k}
                    onClick={() => navigate(s.t as TabId)}
                    title={`${s.label} (Ctrl+${s.k.replace("⌘", "")})`}
                    className={`app-shortcut-btn ${activeTab === s.t ? "active" : "inactive"}`}
                  >
                    {s.k}
                  </button>
                ))}
              </div>
            )}
            {/* Akıllı Bildirim Merkezi */}
            <NotificationCenter
              db={db}
              onNavigate={(tab) =>
                navigate(tab as Parameters<typeof navigate>[0])
              }
            />
            {/* Uyarı bildirimleri */}
            {badges.monitor > 0 && (
              <button
                onClick={() => navigate("monitor")}
                className="app-alert-btn"
              >
                🔔 {badges.monitor}
              </button>
            )}
            {!isMobile && badges.products > 0 && (
              <button
                onClick={() => navigate("products")}
                className="app-products-alert-btn"
              >
                📦 {badges.products}
              </button>
            )}
            {/* Sync göstergesi */}
            {!isMobile && (
              <div className={`app-sync-badge ${syncStatus}`}>
                <span className={`app-sync-dot ${syncStatus}`} />
                <span className={`app-sync-text ${syncStatus}`}>
                  {syncStatus === "saving"
                    ? "Kaydediliyor"
                    : syncStatus === "saved"
                      ? `Senkron ${lastSyncTime}`
                      : syncStatus === "error"
                        ? "Sync Hatası"
                        : syncStatus === "loading"
                          ? "Yükleniyor"
                          : "Firebase"}
                </span>
              </div>
            )}
            <button
              onClick={exportJSON}
              title="Hızlı Yedek Al"
              className="app-backup-btn"
            >
              {isMobile ? "💾" : "💾 Yedek"}
            </button>
            {!isMobile && (
              <div className="app-header-date">
                {new Date().toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            )}
            {/* Kullanıcı menüsü */}
            <UserMenu
              username={username}
              onLogout={onLogout}
              isMobile={isMobile}
            />
          </div>
        </header>

        {/* CONTENT */}
        <main
          key={activeTab}
          className={`page-enter app-main-content ${isMobile ? "mobile" : "desktop"}`}
        >
          {activeTab === "dashboard" && (
            <Dashboard
              db={db}
              save={save}
              onTabChange={(tab) => navigate(tab as TabId)}
            />
          )}
          {activeTab === "products" && <Products db={db} save={save} />}
          {activeTab === "sales" && <Sales db={db} save={save} />}
          {activeTab === "fatura" && <Fatura db={db} save={save} />}
          {activeTab === "suppliers" && <Suppliers db={db} save={save} />}
          {activeTab === "pelet" && <Pelet db={db} save={save} />}
          {activeTab === "boruTed" && <BoruTed db={db} save={save} />}
          {activeTab === "cari" && <Cari db={db} save={save} />}
          {activeTab === "kasa" && <Kasa db={db} save={save} />}
          {activeTab === "butce" && <Butce db={db} save={save} />}
          {activeTab === "bank" && <Bank db={db} save={save} />}
          {activeTab === "reports" && <Reports db={db} />}
          {activeTab === "stock" && <Stock db={db} save={save} />}
          {activeTab === "monitor" && <Monitor db={db} save={save} />}
          {activeTab === "kontrol" && <KontrolHalkasi db={db} />}
          {activeTab === "entegrasyon" && <Entegrasyonlar db={db} />}
          {activeTab === "excelmerge" && <ExcelMerge />}
          {activeTab === "notlar" && <Notlar db={db} save={save} />}
          {activeTab === "cizelge" && <Cizelge db={db} />}
          {activeTab === "partners" && <Partners db={db} save={save} />}
          {activeTab === "settings" && (
            <Settings
              db={db}
              save={save}
              exportJSON={exportJSON}
              importJSON={importJSON}
            />
          )}
          {activeTab === "bughunter" && <BugHunter />}
        </main>
      </div>

      {/* FAB */}
      <FAB
        db={db}
        save={save}
        onOpenAI={() => setAiDrawerOpen(true)}
        uiPrefs={uiPrefs}
      />

      {/* Hata Bildirme Butonu */}
      <ReportButton visible={uiPrefs.showReportButton} />

      {/* AI Drawer */}
      <AIDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        db={db}
        save={save}
      />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070e1c; }
        input, select, textarea, button { outline: none; font-family: inherit; }
        input:focus, select:focus, textarea:focus { border-color: rgba(255,87,34,0.5) !important; box-shadow: 0 0 0 3px rgba(255,87,34,0.12) !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.13); }
        nav::-webkit-scrollbar { width: 0; }

        /* ── Animasyonlar ── */
        @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp  { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn  { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes scaleIn  { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse    { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        @keyframes shimmer  { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes reportPulse { 0%,100% { box-shadow: 0 4px 20px rgba(245,158,11,0.4); } 50% { box-shadow: 0 4px 28px rgba(245,158,11,0.8), 0 0 0 6px rgba(245,158,11,0.15); } }

        @keyframes badgePulse {
          0%,100% { box-shadow: 0 0 6px rgba(239,68,68,0.4); }
          50%      { box-shadow: 0 0 14px rgba(239,68,68,0.7); }
        }
        @keyframes onlinePulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.6; transform: scale(0.8); }
        }
        @keyframes sidebarLogoPulse {
          0%,100% { box-shadow: 0 4px 20px rgba(255,87,34,0.45), 0 0 0 6px rgba(255,87,34,0.06); }
          50%      { box-shadow: 0 6px 28px rgba(255,87,34,0.65), 0 0 0 8px rgba(255,87,34,0.1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Sayfa geçiş animasyonu */
        .page-enter { animation: scaleIn 0.22s cubic-bezier(0.22,1,0.36,1); }

        /* Kart hover efekti */
        .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }

        /* Sonner toast özelleştirmeleri */
        [data-sonner-toast][data-type='success'] { border-color: rgba(16,185,129,0.35) !important; background: linear-gradient(135deg, rgba(16,185,129,0.1), #0a1525) !important; }
        [data-sonner-toast][data-type='error']   { border-color: rgba(239,68,68,0.35)  !important; background: linear-gradient(135deg, rgba(239,68,68,0.1),  #0a1525) !important; }
        [data-sonner-toast][data-type='warning'] { border-color: rgba(245,158,11,0.35) !important; background: linear-gradient(135deg, rgba(245,158,11,0.08), #0a1525) !important; }
        [data-sonner-toast][data-type='info']    { border-color: rgba(99,102,241,0.35) !important; background: linear-gradient(135deg, rgba(99,102,241,0.1),  #0a1525) !important; }
        [data-sonner-toaster] [data-sonner-toast] { min-width: 280px !important; max-width: 380px !important; }
        [data-sonner-toast] [data-icon] { font-size: 1.1rem !important; }

        /* Tablo satırı hover */
        tr:hover td { background: rgba(255,255,255,0.02) !important; transition: background 0.12s; }
        button:active { transform: scale(0.97) !important; }

        /* Modal backdrop blur */
        .modal-backdrop { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }

        @media (max-width: 768px) {
          table { display: block; overflow-x: auto; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .stat-grid { grid-template-columns: 1fr !important; }
        }
        @media print {
          body { background: #fff !important; }
          aside, header, .fab-container, [data-sonner-toaster] { display: none !important; }
          * { color: #000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const { authed, login, logout, currentUser } = useAuth();
  const [setupDone, setSetupDone] = useState(isSetupDone);

  if (!authed) {
    return (
      <LoginScreen
        onLogin={(user, remember) => {
          login(user, remember);
          if (!isSetupDone()) {
            localStorage.setItem("sobaYonetim_setupDone", "1");
            setSetupDone(true);
          }
        }}
      />
    );
  }

  if (!setupDone) {
    return (
      <SetupWizard
        onComplete={() => {
          setSetupDone(true);
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <ConfirmProvider>
        <AppContent onLogout={logout} username={currentUser?.username} />
        <Toaster
          richColors
          position="bottom-right"
          gap={8}
          toastOptions={{
            duration: 3500,
            style: {
              background: "linear-gradient(135deg, #0f1e35, #0c1628)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: "14px",
              color: "#e2e8f0",
              fontSize: "0.875rem",
              fontWeight: 600,
              fontFamily:
                "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              padding: "13px 18px",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
              backdropFilter: "blur(12px)",
              gap: "10px",
            },
            classNames: {
              toast: "soba-toast",
              title: "soba-toast-title",
              description: "soba-toast-desc",
            },
          }}
        />
      </ConfirmProvider>
    </ErrorBoundary>
  );
}

function Row({
  label,
  value,
  color,
  big,
}: {
  label: string;
  value: string;
  color?: string;
  big?: boolean;
}) {
  const rowColorClass =
    color === "#10b981"
      ? "success"
      : color === "#ef4444"
        ? "danger"
        : "default"; // FIXED: Dinamik renk inline stil yerine className ile yonetilir
  const rowSizeClass = big ? "big" : "regular"; // FIXED: Dinamik boyut inline stil yerine className ile yonetilir

  return (
    <div className="app-row">
      <span className="app-row-label">{label}</span>
      <span className={`app-row-value ${rowColorClass} ${rowSizeClass}`}>
        {value}
      </span>
    </div>
  );
}
