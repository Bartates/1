/**
 * Anomali Tespit Motoru
 * Canlı DB verisi üzerinde iş mantığı odaklı anomali tespiti yapar.
 * dataIntegrityChecker.ts'i genişletir — statik kural kontrollerinin ötesinde
 * örüntü tabanlı ve istatistiksel anomaliler tespit eder.
 */
import type { DB } from "@/types";
import { runIntegrityCheck } from "./dataIntegrityChecker";
import { formatMoney, genId } from "./utils-tr";

// ── Tipler ──────────────────────────────────────────────────────────────────

export type AnomalyCategory =
  | "fiyat"
  | "tutar"
  | "stok"
  | "kasa"
  | "cari"
  | "siparis"
  | "veri"
  | "supheli";

export type AnomalySeverity = "critical" | "warning" | "info";

export type FixType =
  | "stok_guncelle"
  | "kasa_duzelt"
  | "cari_duzelt"
  | "satis_iptal"
  | "manuel";

export interface QuickFix {
  type: FixType;
  label: string;
  description: string;
  apply: (prev: DB) => DB;
  canAutoFix: boolean;
}

export interface AnomalyResult {
  id: string;
  severity: AnomalySeverity;
  category: AnomalyCategory;
  title: string;
  detail: string;
  suggestion: string;
  relatedIds: string[];
  detectedAt: string;
  quickFixes: QuickFix[];
  aiContext: string;
  resolved?: boolean;
}

export interface AnomalyReport {
  anomalies: AnomalyResult[];
  healthScore: number;
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    byCategory: Record<AnomalyCategory, number>;
  };
  generatedAt: string;
  partial?: boolean; // timeout nedeniyle kısmi sonuç
}

// ── Yardımcı ────────────────────────────────────────────────────────────────

function makeAnomaly(
  severity: AnomalySeverity,
  category: AnomalyCategory,
  title: string,
  detail: string,
  suggestion: string,
  relatedIds: string[],
  quickFixes: QuickFix[],
  aiContext: string,
): AnomalyResult {
  return {
    id: `ANO-${genId().slice(0, 8).toUpperCase()}`,
    severity,
    category,
    title,
    detail,
    suggestion,
    relatedIds,
    detectedAt: new Date().toISOString(),
    quickFixes,
    aiContext,
    resolved: false,
  };
}

// ── Dedektörler ──────────────────────────────────────────────────────────────

/** Kural 1: Sıfır veya negatif fiyatlı tamamlanmış satışlar */
function zeroPriceSalesDetector(db: DB): AnomalyResult[] {
  const results: AnomalyResult[] = [];
  db.sales
    .filter(
      (s) =>
        !s.deleted &&
        s.status === "tamamlandi" &&
        (s.total <= 0 || s.unitPrice <= 0),
    )
    .forEach((s) => {
      results.push(
        makeAnomaly(
          "critical",
          "fiyat",
          "Sıfır/Negatif Fiyatlı Satış",
          `"${s.productName}" ${new Date(s.createdAt).toLocaleDateString("tr-TR")} tarihinde ${formatMoney(s.total)} tutarında satıldı.`,
          "Satışı iptal edip doğru fiyatla yeniden kaydedin.",
          [s.id],
          [
            {
              type: "satis_iptal",
              label: "🗑️ Satışı İptal Et",
              description:
                'Satış durumunu "iptal" olarak işaretler, stok geri yüklenir.',
              canAutoFix: true,
              apply: (prev: DB): DB => ({
                ...prev,
                sales: prev.sales.map((x) =>
                  x.id === s.id
                    ? {
                        ...x,
                        status: "iptal" as const,
                        updatedAt: new Date().toISOString(),
                      }
                    : x,
                ),
                products: prev.products.map((p) =>
                  p.id === s.productId
                    ? {
                        ...p,
                        stock: p.stock + s.quantity,
                        updatedAt: new Date().toISOString(),
                      }
                    : p,
                ),
              }),
            },
          ],
          `Sıfır fiyatlı satış: ${s.productName}, tarih: ${s.createdAt}, tutar: ${s.total}`,
        ),
      );
    });
  return results;
}

/** Kural 2: Sıfır adet satışlar */
function zeroQuantitySalesDetector(db: DB): AnomalyResult[] {
  const results: AnomalyResult[] = [];
  db.sales
    .filter((s) => !s.deleted && s.status === "tamamlandi" && s.quantity <= 0)
    .forEach((s) => {
      results.push(
        makeAnomaly(
          "critical",
          "veri",
          "Sıfır/Negatif Adetli Satış",
          `"${s.productName}" satışında adet: ${s.quantity}.`,
          "Satışı iptal edip doğru adetle yeniden kaydedin.",
          [s.id],
          [
            {
              type: "satis_iptal",
              label: "🗑️ Satışı İptal Et",
              description: 'Satış durumunu "iptal" olarak işaretler.',
              canAutoFix: true,
              apply: (prev: DB): DB => ({
                ...prev,
                sales: prev.sales.map((x) =>
                  x.id === s.id
                    ? {
                        ...x,
                        status: "iptal" as const,
                        updatedAt: new Date().toISOString(),
                      }
                    : x,
                ),
              }),
            },
          ],
          `Sıfır adetli satış: ${s.productName}, tarih: ${s.createdAt}`,
        ),
      );
    });
  return results;
}

/** Kural 3: Anormal tutar — son 30 günlük ortalamadan 3x sapma */
function abnormalAmountDetector(db: DB): AnomalyResult[] {
  const results: AnomalyResult[] = [];
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Ürün bazında son 30 günlük satışları grupla
  const productSales: Record<string, number[]> = {};
  db.sales
    .filter(
      (s) =>
        !s.deleted &&
        s.status === "tamamlandi" &&
        new Date(s.createdAt).getTime() >= thirtyDaysAgo &&
        s.unitPrice > 0,
    )
    .forEach((s) => {
      const productId = s.productId;
      if (!productId) return;
      if (!productSales[productId]) productSales[productId] = [];
      productSales[productId].push(s.unitPrice);
    });

  // En az 3 satışı olan ürünlerde sapma kontrol et
  db.sales
    .filter((s) => !s.deleted && s.status === "tamamlandi" && s.unitPrice > 0)
    .forEach((s) => {
      const productId = s.productId;
      if (!productId) return;
      const prices = productSales[productId];
      if (!prices || prices.length < 3) return;
      const avg =
        prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
      const isHigh = s.unitPrice > avg * 3;
      const isLow = s.unitPrice < avg / 3;
      if (!isHigh && !isLow) return;
      const pct = Math.round((Math.abs(s.unitPrice - avg) / avg) * 100);
      results.push(
        makeAnomaly(
          "warning",
          "tutar",
          `Anormal Satış Fiyatı (${isHigh ? "+" : "-"}%${pct})`,
          `"${s.productName}" ${formatMoney(s.unitPrice)} fiyatıyla satıldı. 30 günlük ortalama: ${formatMoney(Math.round(avg))}.`,
          "Fiyat girişini kontrol edin. Yanlış birim veya sıfır fazlası olabilir.",
          [s.id],
          [],
          `Anormal fiyat: ${s.productName}, fiyat: ${s.unitPrice}, ort: ${avg.toFixed(0)}, sapma: %${pct}`,
        ),
      );
    });
  return results;
}

/** Kural 4: Stok tutarsızlığı — hareket toplamı ile mevcut stok uyuşmuyor */
function stockConsistencyDetector(db: DB): AnomalyResult[] {
  const results: AnomalyResult[] = [];
  db.products
    .filter((p) => !p.deleted)
    .forEach((p) => {
      const movements = db.stockMovements.filter((m) => m.productId === p.id);
      if (movements.length === 0) return;

      // Hareketlerden beklenen stoğu hesapla
      const calculated = movements.reduce((acc, m) => {
        if (m.type === "giris" || m.type === "iade")
          return acc + Math.abs(m.amount);
        if (m.type === "satis" || m.type === "cikis")
          return acc - Math.abs(m.amount);
        if (m.type === "duzeltme") return acc + m.amount; // signed
        return acc;
      }, 0);

      const diff = Math.abs(p.stock - calculated);
      if (diff > 0.5) {
        // küsurat toleransı
        results.push(
          makeAnomaly(
            diff > 5 ? "critical" : "warning",
            "stok",
            "Stok Tutarsızlığı",
            `"${p.name}" mevcut stok: ${p.stock}, hareketlerden hesaplanan: ${calculated} (fark: ${diff}).`,
            "Stok düzeltme hareketi ekleyin veya hareketleri kontrol edin.",
            [p.id],
            [
              {
                type: "stok_guncelle",
                label: "🔧 Stoğu Düzelt",
                description: `Stoğu ${calculated} olarak günceller.`,
                canAutoFix: true,
                apply: (prev: DB): DB => ({
                  ...prev,
                  products: prev.products.map((x) =>
                    x.id === p.id
                      ? {
                          ...x,
                          stock: Math.max(0, calculated),
                          updatedAt: new Date().toISOString(),
                        }
                      : x,
                  ),
                  stockMovements: [
                    ...prev.stockMovements,
                    {
                      id: genId(),
                      productId: p.id,
                      productName: p.name,
                      type: "duzeltme" as const,
                      amount: calculated - p.stock,
                      before: p.stock,
                      after: Math.max(0, calculated),
                      note: "Anomali motoru otomatik düzeltme",
                      date: new Date().toISOString(),
                    },
                  ],
                }),
              },
            ],
            `Stok tutarsızlığı: ${p.name}, mevcut: ${p.stock}, hesaplanan: ${calculated}`,
          ),
        );
      }
    });
  return results;
}

/** Kural 5: Şüpheli kasa hareketleri */
function suspiciousKasaDetector(db: DB): AnomalyResult[] {
  const results: AnomalyResult[] = [];
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Kasa bazında 30 günlük ortalama günlük gider
  const kasaAvgGider: Record<string, number> = {};
  const activeKasa = db.kasa.filter((k) => !k.deleted);
  const kasaIds = [...new Set(activeKasa.map((k) => k.kasa))];

  kasaIds.forEach((kasaId) => {
    const giderler = activeKasa.filter(
      (k) =>
        k.kasa === kasaId &&
        k.type === "gider" &&
        new Date(k.createdAt).getTime() >= thirtyDaysAgo,
    );
    const totalGider = giderler.reduce((s, k) => s + k.amount, 0);
    kasaAvgGider[kasaId] = totalGider / 30;
  });

  // Aynı gün 5+ gider kaydı
  const giderByDay: Record<string, Record<string, number>> = {};
  activeKasa
    .filter((k) => k.type === "gider")
    .forEach((k) => {
      const day = k.createdAt.slice(0, 10);
      if (!giderByDay[day]) giderByDay[day] = {};
      giderByDay[day][k.kasa] = (giderByDay[day][k.kasa] || 0) + 1;
    });

  Object.entries(giderByDay).forEach(([day, kasaMap]) => {
    Object.entries(kasaMap).forEach(([kasaId, count]) => {
      if (count >= 5) {
        const entries = activeKasa.filter(
          (k) =>
            k.type === "gider" &&
            k.kasa === kasaId &&
            k.createdAt.startsWith(day),
        );
        results.push(
          makeAnomaly(
            "warning",
            "kasa",
            "Aynı Günde Çok Sayıda Gider",
            `${kasaId} kasasında ${day} tarihinde ${count} gider kaydı var.`,
            "İşlemlerin doğruluğunu kontrol edin.",
            entries.map((e) => e.id),
            [],
            `Şüpheli kasa: ${kasaId}, tarih: ${day}, gider sayısı: ${count}`,
          ),
        );
      }
    });
  });

  // Ortalamadan 20x büyük tek gider
  activeKasa
    .filter((k) => k.type === "gider")
    .forEach((k) => {
      const avg = kasaAvgGider[k.kasa] || 0;
      if (avg > 0 && k.amount > avg * 20) {
        results.push(
          makeAnomaly(
            "critical",
            "kasa",
            "Anormal Büyük Gider",
            `${k.kasa} kasasında ${formatMoney(k.amount)} gider kaydı. 30 günlük günlük ort: ${formatMoney(Math.round(avg))}.`,
            "Bu gider kaydının doğruluğunu kontrol edin.",
            [k.id],
            [],
            `Anormal gider: kasa=${k.kasa}, tutar=${k.amount}, ort=${avg.toFixed(0)}`,
          ),
        );
      }
    });

  return results;
}

/** Kural 6: Cari bakiye anomalileri */
function cariBalanceAnomalyDetector(db: DB): AnomalyResult[] {
  const results: AnomalyResult[] = [];
  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  db.cari
    .filter((c) => !c.deleted)
    .forEach((c) => {
      // Tedarikçi bakiyesi negatif (fazla ödeme)
      if (c.type === "tedarikci" && c.balance < 0) {
        results.push(
          makeAnomaly(
            "warning",
            "cari",
            "Tedarikçi Fazla Ödemesi",
            `"${c.name}" tedarikçisine fazla ödeme yapılmış. Bakiye: ${formatMoney(c.balance)}.`,
            "Tedarikçi ile mutabakat yapın veya bakiyeyi düzeltin.",
            [c.id],
            [],
            `Tedarikçi fazla ödeme: ${c.name}, bakiye: ${c.balance}`,
          ),
        );
      }

      // Müşteri yüksek alacak + 90 gün hareketsiz
      if (c.type === "musteri" && c.balance > 100000) {
        const lastTx = c.lastTransaction
          ? new Date(c.lastTransaction).getTime()
          : 0;
        if (lastTx > 0 && lastTx < ninetyDaysAgo) {
          const days = Math.floor((now - lastTx) / 86400000);
          results.push(
            makeAnomaly(
              "critical",
              "cari",
              "Yüksek Alacak — Uzun Süredir Hareketsiz",
              `"${c.name}" müşterisinin ${formatMoney(c.balance)} alacağı ${days} gündür tahsil edilmemiş.`,
              "Müşteriyle iletişime geçin ve tahsilat planı yapın.",
              [c.id],
              [],
              `Gecikmiş alacak: ${c.name}, bakiye: ${c.balance}, gün: ${days}`,
            ),
          );
        }
      }
    });

  return results;
}

/** Kural 7: Negatif kâr marjlı satışlar (iskontosuz) */
function negativeProfitDetector(db: DB): AnomalyResult[] {
  const results: AnomalyResult[] = [];
  db.sales
    .filter(
      (s) =>
        !s.deleted &&
        s.status === "tamamlandi" &&
        s.profit < 0 &&
        s.total > 0 &&
        (!s.discountAmount || s.discountAmount === 0),
    )
    .forEach((s) => {
      results.push(
        makeAnomaly(
          "warning",
          "fiyat",
          "Zararına Satış (İskontosuz)",
          `"${s.productName}" ${formatMoney(s.total)} satıldı, kâr: ${formatMoney(s.profit)}.`,
          "Ürün maliyetini veya satış fiyatını kontrol edin.",
          [s.id],
          [],
          `Zararına satış: ${s.productName}, tutar: ${s.total}, kâr: ${s.profit}`,
        ),
      );
    });
  return results;
}

/** Kural 8: Yetim kayıtlar — silinmiş ilişkili kayıtlara bağlı girişler */
function orphanRecordDetector(db: DB): AnomalyResult[] {
  const results: AnomalyResult[] = [];
  const deletedSaleIds = new Set(
    db.sales.filter((s) => s.deleted).map((s) => s.id),
  );
  const deletedProductIds = new Set(
    db.products.filter((p) => p.deleted).map((p) => p.id),
  );

  // Silinmiş satışa bağlı kasa kaydı
  db.kasa
    .filter((k) => !k.deleted && k.relatedId && deletedSaleIds.has(k.relatedId))
    .forEach((k) => {
      results.push(
        makeAnomaly(
          "info",
          "veri",
          "Yetim Kasa Kaydı",
          `Kasa kaydı (${formatMoney(k.amount)}) silinmiş bir satışa (${k.relatedId}) bağlı.`,
          "Kasa kaydını silin veya doğru satışla ilişkilendirin.",
          [k.id],
          [],
          `Yetim kasa: id=${k.id}, relatedId=${k.relatedId}`,
        ),
      );
    });

  // Silinmiş ürüne bağlı stok hareketi
  db.stockMovements
    .filter((m) => deletedProductIds.has(m.productId))
    .forEach((m) => {
      results.push(
        makeAnomaly(
          "info",
          "veri",
          "Yetim Stok Hareketi",
          `Stok hareketi silinmiş bir ürüne (${m.productName}) bağlı.`,
          "Stok hareketini temizleyin.",
          [m.id],
          [],
          `Yetim stok hareketi: ${m.productName}`,
        ),
      );
    });

  return results;
}

// ── Integrity → Anomaly dönüştürücü ─────────────────────────────────────────

function convertIntegrityToAnomalies(db: DB): AnomalyResult[] {
  const issues = runIntegrityCheck(db);
  return issues.map((issue) =>
    makeAnomaly(
      issue.severity,
      (issue.category as AnomalyCategory) || "veri",
      issue.title,
      issue.detail,
      issue.suggestion || "Veri bütünlüğünü kontrol edin.",
      issue.relatedIds || [],
      [],
      `${issue.category}: ${issue.title} — ${issue.detail}`,
    ),
  );
}

// ── Tekrar eden anomalileri filtrele ─────────────────────────────────────────

function deduplicateAnomalies(anomalies: AnomalyResult[]): AnomalyResult[] {
  const seen = new Set<string>();
  return anomalies.filter((a) => {
    const key = `${a.category}:${a.title}:${a.relatedIds.sort().join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Sağlık skoru ─────────────────────────────────────────────────────────────

function calculateHealthScore(anomalies: AnomalyResult[]): number {
  if (anomalies.length === 0) return 100;
  const criticalPenalty =
    anomalies.filter((a) => a.severity === "critical").length * 15;
  const warningPenalty =
    anomalies.filter((a) => a.severity === "warning").length * 5;
  const infoPenalty = anomalies.filter((a) => a.severity === "info").length * 1;
  return Math.max(
    0,
    Math.min(100, 100 - criticalPenalty - warningPenalty - infoPenalty),
  );
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────

export function runAnomalyDetection(db: DB): AnomalyReport {
  const startTime = Date.now();
  const TIMEOUT_MS = 500;
  let partial = false;
  let allAnomalies: AnomalyResult[] = [];

  // Mevcut integrity checker'dan anomalileri al
  try {
    allAnomalies = [...allAnomalies, ...convertIntegrityToAnomalies(db)];
  } catch {
    /* sessizce geç */
  }

  const detectors = [
    zeroPriceSalesDetector,
    zeroQuantitySalesDetector,
    abnormalAmountDetector,
    stockConsistencyDetector,
    suspiciousKasaDetector,
    cariBalanceAnomalyDetector,
    negativeProfitDetector,
    orphanRecordDetector,
  ];

  for (const detector of detectors) {
    if (Date.now() - startTime > TIMEOUT_MS) {
      partial = true;
      break;
    }
    try {
      allAnomalies = [...allAnomalies, ...detector(db)];
    } catch {
      /* dedektör hatası tüm sistemi çökertmez */
    }
  }

  const unique = deduplicateAnomalies(allAnomalies);
  const sorted = unique.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const byCategory = {} as Record<AnomalyCategory, number>;
  sorted.forEach((a) => {
    byCategory[a.category] = (byCategory[a.category] || 0) + 1;
  });

  return {
    anomalies: sorted,
    healthScore: calculateHealthScore(sorted),
    summary: {
      total: sorted.length,
      critical: sorted.filter((a) => a.severity === "critical").length,
      warning: sorted.filter((a) => a.severity === "warning").length,
      info: sorted.filter((a) => a.severity === "info").length,
      byCategory,
    },
    generatedAt: new Date().toISOString(),
    partial,
  };
}
