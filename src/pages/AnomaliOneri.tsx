/**
 * Anomali & Öneri Ekranı
 * Canlı DB verisi üzerinde anomali tespiti, AI analizi ve hızlı düzeltme.
 */
import {
  runAnomalyDetection,
  type AnomalyCategory,
  type AnomalyReport,
  type AnomalyResult,
  type AnomalySeverity,
} from "@/lib/anomalyEngine";
import type { DB } from "@/types";
import { useCallback, useMemo, useState } from "react";

interface Props {
  db: DB;
  save?: (updater: (prev: DB) => DB) => void;
}

// ── Renk & stil sabitleri ────────────────────────────────────────────────────

const SEV_STYLE: Record<
  AnomalySeverity,
  { bg: string; border: string; text: string; badge: string; icon: string }
> = {
  critical: {
    bg: "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.3)",
    text: "#fca5a5",
    badge: "rgba(220,38,38,0.2)",
    icon: "🔴",
  },
  warning: {
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.3)",
    text: "#fcd34d",
    badge: "rgba(245,158,11,0.2)",
    icon: "🟡",
  },
  info: {
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.25)",
    text: "#93c5fd",
    badge: "rgba(59,130,246,0.15)",
    icon: "🔵",
  },
};

const CAT_LABEL: Record<AnomalyCategory, string> = {
  fiyat: "💰 Fiyat",
  tutar: "📊 Tutar",
  stok: "📦 Stok",
  kasa: "🏦 Kasa",
  cari: "👤 Cari",
  siparis: "📋 Sipariş",
  veri: "🗄️ Veri",
  supheli: "🔍 Şüpheli",
};

// ── AnomalyCard ──────────────────────────────────────────────────────────────

function AnomalyCard({
  anomaly,
  onFix,
  onAskAI,
  isFixing,
  isResolved,
}: {
  anomaly: AnomalyResult;
  onFix: (fix: AnomalyResult["quickFixes"][0]) => void;
  onAskAI: (a: AnomalyResult) => void;
  isFixing: boolean;
  isResolved: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = isResolved
    ? {
        bg: "rgba(16,185,129,0.06)",
        border: "rgba(16,185,129,0.2)",
        text: "#6ee7b7",
        badge: "rgba(16,185,129,0.15)",
        icon: "✅",
      }
    : SEV_STYLE[anomaly.severity];

  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 14,
        overflow: "hidden",
        opacity: isResolved ? 0.6 : 1,
        transition: "all 0.2s",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: "1rem", flexShrink: 0 }}>{s.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              color: "#f1f5f9",
              fontSize: "0.88rem",
              marginBottom: 2,
            }}
          >
            {anomaly.title}
            {isResolved && (
              <span
                style={{ marginLeft: 8, fontSize: "0.72rem", color: "#6ee7b7" }}
              >
                ✓ Çözüldü
              </span>
            )}
          </div>
          <div
            style={{
              color: "#94a3b8",
              fontSize: "0.78rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {anomaly.detail}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            flexShrink: 0,
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              background: s.badge,
              color: s.text,
              padding: "2px 8px",
              borderRadius: 6,
              fontWeight: 700,
            }}
          >
            {CAT_LABEL[anomaly.category]}
          </span>
          <span style={{ color: "#475569", fontSize: "0.8rem" }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div
          style={{ padding: "0 18px 16px", borderTop: `1px solid ${s.border}` }}
        >
          <div
            style={{
              paddingTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Öneri */}
            <div
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: "0.82rem",
                color: "#6ee7b7",
              }}
            >
              <strong>💡 Öneri:</strong> {anomaly.suggestion}
            </div>

            {/* Hızlı düzeltmeler */}
            {anomaly.quickFixes.length > 0 && !isResolved && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {anomaly.quickFixes
                  .filter((f) => f.canAutoFix)
                  .map((fix, i) => (
                    <button
                      key={i}
                      onClick={() => onFix(fix)}
                      disabled={isFixing}
                      style={{
                        background: isFixing
                          ? "rgba(255,255,255,0.05)"
                          : "linear-gradient(135deg,#ff5722,#ff7043)",
                        border: "none",
                        borderRadius: 8,
                        color: "#fff",
                        padding: "8px 14px",
                        fontWeight: 700,
                        cursor: isFixing ? "not-allowed" : "pointer",
                        fontSize: "0.8rem",
                        opacity: isFixing ? 0.5 : 1,
                      }}
                    >
                      {isFixing ? "⏳ Uygulanıyor..." : fix.label}
                    </button>
                  ))}
                {anomaly.quickFixes
                  .filter((f) => !f.canAutoFix)
                  .map((fix, i) => (
                    <div
                      key={i}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        padding: "8px 14px",
                        fontSize: "0.78rem",
                        color: "#64748b",
                      }}
                    >
                      ⚠️ {fix.label} — Manuel müdahale gerekli
                    </div>
                  ))}
              </div>
            )}

            {/* AI'ya sor */}
            <button
              onClick={() => onAskAI(anomaly)}
              style={{
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: 8,
                color: "#818cf8",
                padding: "8px 14px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.8rem",
                alignSelf: "flex-start",
              }}
            >
              🤖 AI'ya Sor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ana sayfa ────────────────────────────────────────────────────────────────

export default function AnomaliOneri({ db, save }: Props) {
  const [filterSev, setFilterSev] = useState<AnomalySeverity | "all">("all");
  const [filterCat, setFilterCat] = useState<AnomalyCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [aiMessage, setAiMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const report: AnomalyReport = useMemo(
    () => runAnomalyDetection(db),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, refreshKey],
  );

  const filtered = useMemo(() => {
    return report.anomalies.filter((a) => {
      if (filterSev !== "all" && a.severity !== filterSev) return false;
      if (filterCat !== "all" && a.category !== filterCat) return false;
      if (
        search &&
        !a.title.toLowerCase().includes(search.toLowerCase()) &&
        !a.detail.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [report.anomalies, filterSev, filterCat, search]);

  const handleFix = useCallback(
    (anomaly: AnomalyResult, fix: AnomalyResult["quickFixes"][0]) => {
      if (!save || !fix.canAutoFix) return;
      setFixingId(anomaly.id);
      try {
        save(fix.apply);
        setResolvedIds((prev) => new Set([...prev, anomaly.id]));
      } catch {
        /* hata toast'u üst bileşen yönetir */
      } finally {
        setFixingId(null);
      }
    },
    [save],
  );

  const handleAskAI = useCallback((anomaly: AnomalyResult) => {
    setAiMessage(
      `Bu anomaliyi analiz et ve çözüm öner:\n\n${anomaly.title}\n${anomaly.detail}\n\nÖneri: ${anomaly.suggestion}`,
    );
  }, []);

  const scoreColor =
    report.healthScore >= 80
      ? "#10b981"
      : report.healthScore >= 60
        ? "#f59e0b"
        : "#ef4444";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div
        style={{
          background:
            "linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.06))",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 16,
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.4rem",
              flexShrink: 0,
            }}
          >
            🔍
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
              Anomali & Öneri
            </h2>
            <p
              style={{
                color: "#475569",
                fontSize: "0.78rem",
                margin: "3px 0 0",
              }}
            >
              Canlı veri analizi — {report.anomalies.length} anomali tespit
              edildi
              {report.partial && (
                <span style={{ color: "#f59e0b", marginLeft: 8 }}>
                  ⚠️ Kısmi sonuç (timeout)
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            style={{
              background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 10,
              color: "#818cf8",
              padding: "8px 16px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.82rem",
            }}
          >
            🔄 Yenile
          </button>
        </div>

        {/* Özet kartlar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
          {[
            {
              label: "Sağlık Skoru",
              value: `${report.healthScore}/100`,
              color: scoreColor,
            },
            {
              label: "Kritik",
              value: report.summary.critical,
              color: "#ef4444",
            },
            { label: "Uyarı", value: report.summary.warning, color: "#f59e0b" },
            { label: "Bilgi", value: report.summary.info, color: "#3b82f6" },
            { label: "Toplam", value: report.summary.total, color: "#94a3b8" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: "rgba(0,0,0,0.25)",
                borderRadius: 10,
                padding: "10px 14px",
                textAlign: "center",
              }}
            >
              <div
                style={{ fontSize: "1.3rem", fontWeight: 800, color: s.color }}
              >
                {s.value}
              </div>
              <div
                style={{ fontSize: "0.72rem", color: "#475569", marginTop: 2 }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI mesajı */}
      {aiMessage && (
        <div
          style={{
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 12,
            padding: "14px 18px",
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                color: "#818cf8",
                fontWeight: 700,
                fontSize: "0.82rem",
                marginBottom: 6,
              }}
            >
              AI Asistan'a Gönderilecek Mesaj
            </div>
            <pre
              style={{
                color: "#94a3b8",
                fontSize: "0.78rem",
                whiteSpace: "pre-wrap",
                margin: 0,
                fontFamily: "inherit",
              }}
            >
              {aiMessage}
            </pre>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aiMessage).catch(() => {});
                }}
                style={{
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: 7,
                  color: "#818cf8",
                  padding: "6px 12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.78rem",
                }}
              >
                📋 Kopyala
              </button>
              <button
                onClick={() => setAiMessage("")}
                style={{
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 7,
                  color: "#475569",
                  padding: "6px 12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.78rem",
                }}
              >
                ✕ Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Anomali ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 180,
            padding: "9px 14px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            color: "#f1f5f9",
            fontSize: "0.85rem",
          }}
        />
        {(["all", "critical", "warning", "info"] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSev(sev)}
            style={{
              padding: "9px 14px",
              borderRadius: 8,
              border: "none",
              background:
                filterSev === sev
                  ? "rgba(99,102,241,0.2)"
                  : "rgba(255,255,255,0.04)",
              color: filterSev === sev ? "#818cf8" : "#64748b",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            {sev === "all"
              ? "Tümü"
              : sev === "critical"
                ? "🔴 Kritik"
                : sev === "warning"
                  ? "🟡 Uyarı"
                  : "🔵 Bilgi"}
          </button>
        ))}
        <select
          value={filterCat}
          onChange={(e) =>
            setFilterCat(e.target.value as AnomalyCategory | "all")
          }
          style={{
            padding: "9px 12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            color: "#94a3b8",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          <option value="all">Tüm Kategoriler</option>
          {Object.entries(CAT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Anomali listesi */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#334155",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 12, opacity: 0.3 }}>
            {report.anomalies.length === 0 ? "✅" : "🔍"}
          </div>
          <p style={{ fontWeight: 600, fontSize: "1rem" }}>
            {report.anomalies.length === 0
              ? "Anomali tespit edilmedi — veriler temiz görünüyor!"
              : "Seçili filtrelere uyan anomali yok."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((anomaly) => (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              onFix={(fix) => handleFix(anomaly, fix)}
              onAskAI={handleAskAI}
              isFixing={fixingId === anomaly.id}
              isResolved={resolvedIds.has(anomaly.id)}
            />
          ))}
        </div>
      )}

      {/* Kategori özeti */}
      {report.summary.total > 0 && (
        <div
          style={{
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 14,
            padding: "14px 18px",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: "#94a3b8",
              fontSize: "0.8rem",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Kategori Dağılımı
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(report.summary.byCategory).map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat as AnomalyCategory)}
                style={{
                  background:
                    filterCat === cat
                      ? "rgba(99,102,241,0.2)"
                      : "rgba(255,255,255,0.04)",
                  border: `1px solid ${filterCat === cat ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 8,
                  padding: "6px 12px",
                  cursor: "pointer",
                  color: filterCat === cat ? "#818cf8" : "#64748b",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                }}
              >
                {CAT_LABEL[cat as AnomalyCategory]} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Oluşturulma zamanı */}
      <div
        style={{ textAlign: "right", color: "#1e3a5f", fontSize: "0.72rem" }}
      >
        Son analiz: {new Date(report.generatedAt).toLocaleTimeString("tr-TR")}
      </div>
    </div>
  );
}
