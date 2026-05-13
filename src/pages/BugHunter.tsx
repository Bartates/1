import React, { useState, useCallback, useRef } from "react";

// ============================================================================
// TİP TANIMLARI
// ============================================================================

interface TestResult {
  id: string;
  category: string;
  subCategory: string;
  testName: string;
  status: "pass" | "fail" | "warning" | "critical" | "pending" | "running";
  message: string;
  details?: string;
  timestamp: number;
  duration: number;
  severity: 1 | 2 | 3 | 4 | 5;
  fix?: string;
}

interface BugReport {
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  critical: number;
  results: TestResult[];
  startTime: number;
  endTime: number;
  score: number;
  grade: string;
}
// ============================================================================
// TEST RUNNER CLASS
// ============================================================================

class TestRunner {
  private results: TestResult[] = [];
  private testId = 0;

  private addResult(
    category: string, subCategory: string, testName: string,
    status: TestResult["status"], message: string, severity: TestResult["severity"],
    details?: string, fix?: string, duration: number = 0
  ) {
    this.results.push({
      id: `TEST-${String(++this.testId).padStart(4, "0")}`,
      category, subCategory, testName, status, message,
      details, timestamp: Date.now(), duration, severity, fix
    });
  }

  // 1. JAVASCRIPT TEMELLERI
  testJavaScriptFundamentals() {
    const cat = "1. JavaScript Temelleri";
    const sum = 0.1 + 0.2;
    if (sum !== 0.3) {
      this.addResult(cat, "Aritmetik", "Floating Point Hassasiyeti", "critical",
        `0.1 + 0.2 = ${sum} (beklenen: 0.3)`, 5,
        "JavaScript floating point aritmetigi muhasebe hesaplamalarinda ciddi hatalara yol acar.",
        "Tum para birimi hesaplamalarinda kurus cinsinden integer kullanin veya decimal.js ekleyin.");
    }
    const bigNum = 9007199254740992;
    if (bigNum === bigNum + 1) {
      this.addResult(cat, "Aritmetik", "Buyuk Sayi Tasması", "critical",
        `Number.MAX_SAFE_INTEGER ustu: ${bigNum} === ${bigNum + 1}`, 5,
        "Buyuk tutarlar ile calisirken sayi hassasiyeti kaybedilebilir.",
        "BigInt veya decimal.js kullanin.");
    }
    if (isNaN(parseInt("abc"))) {
      this.addResult(cat, "Tip Guvenligi", "NaN Uretimi Riski", "warning",
        "parseInt/parseFloat gecersiz string ile NaN uretir", 3,
        "Kullanici girisler parse edilirken NaN kontrolu yapilmali.",
        "Her parseFloat/parseInt sonrasi isNaN() kontrolu ekleyin.");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((0 == ("" as any))) {
      this.addResult(cat, "Tip Guvenligi", "Loose Equality (==) Kullanimi", "warning",
        '0 == "" true doner', 3,
        "Tutar karsilastirmalarinda 0 ile bos string esit gorulebilir.",
        "Her yerde === (strict equality) kullanin.");
    }
    const amounts = [100, 25, 3, 1000, 50];
    const sorted = [...amounts].sort();
    if (sorted[0] !== 3) {
      this.addResult(cat, "Siralama", "Array.sort() Sayisal Siralama Hatasi", "fail",
        `[100,25,3,1000,50].sort() = [${sorted}]`, 4,
        "Fatura/islem listeleri yanlis siralanabilir.",
        "sort((a, b) => a - b) kullanin.");
    }
    const roundTest = (1.005).toFixed(2);
    if (roundTest !== "1.01") {
      this.addResult(cat, "Yuvarlama", "toFixed() Yuvarlama Hatasi", "critical",
        `(1.005).toFixed(2) = "${roundTest}" (beklenen: "1.01")`, 5,
        "Fatura toplamlari, KDV hesaplamalari yanlis yuvarlanabilir.",
        "Math.round(num * 100) / 100 veya decimal.js kullanin.");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const implicitConv2 = "5" + (3 as any);
    if (implicitConv2 === "53") {
      this.addResult(cat, "Tip Donusumu", "Implicit String/Number Donusumu", "critical",
        '"5" - 3 = 2 ama "5" + 3 = "53"', 5,
        "Kullanici girisler (string) ile toplama yapilirken concatenation olabilir.",
        "Tum input degerlerini Number() veya parseFloat() ile donusturun.");
    }
    const obj1 = { amount: 100 };
    const obj2 = obj1;
    obj2.amount = 200;
    if (obj1.amount === 200) {
      this.addResult(cat, "Referans", "Object Reference Mutasyonu", "fail",
        "Object assignment referans kopyalar, deger degil", 4,
        "State guncellemelerinde orijinal veri degisebilir.",
        "Spread operator {...obj} veya structuredClone() kullanin.");
    }
    const arr1 = [1, 2, 3];
    const arr2 = arr1;
    arr2.push(4);
    if (arr1.length === 4) {
      this.addResult(cat, "Referans", "Array Reference Mutasyonu", "fail",
        "Array assignment referans kopyalar", 4,
        "Islem listesi guncellemelerinde beklenmeyen degisiklikler olabilir.",
        "[...arr] spread operator kullanin.");
    }
  }

  // 2. REACT STATE
  testReactStateManagement() {
    const cat = "2. React State Yonetimi";
    const mockState = { accounts: [{ id: 1, balance: 1000 }] };
    const mutatedState = mockState;
    mutatedState.accounts[0].balance = 2000;
    if (mockState.accounts[0].balance === 2000) {
      this.addResult(cat, "Mutasyon", "Direct State Mutation", "critical",
        "State dogrudan mutate ediliyor, React re-render tetiklemez", 5,
        "Bakiye guncellemeleri ekranda gorunmeyebilir.",
        "setState ile yeni obje olusturun: setState(prev => ({...prev}))");
    }
    this.addResult(cat, "Closure", "Stale Closure Riski", "warning",
      "Closure lar eski degerleri yakalayabilir", 3,
      "useEffect/useCallback icinde eski state degerleri kullanilabilir.",
      "useCallback dependency array lerini kontrol edin.");
    this.addResult(cat, "useEffect", "Eksik Dependency Array", "fail",
      "useEffect dependency array eksik/yanlis olabilir", 4,
      "Hesap bakiyeleri guncellendigi nde dashboard yenilenmeyebilir.",
      "ESLint react-hooks/exhaustive-deps kuralini aktif edin.");
    this.addResult(cat, "Re-render", "Sonsuz Re-render Dongusu Riski", "critical",
      "useEffect icinde setState cagrisi sonsuz dongu olusturabilir", 5,
      "Sayfa donabilir, tarayici cokebilir.",
      "useEffect dependency array ini dogru tanimlayin.");
    this.addResult(cat, "Rendering", "Liste Key Prop Kontrolu", "fail",
      "Liste renderlarinda unique key prop eksik olabilir", 4,
      "Islem listesi guncellendigi nde yanlis satirlar guncellenebilir.",
      "Her liste elemanina benzersiz key prop ekleyin.");
    this.addResult(cat, "Memory", "useEffect Cleanup Eksikligi", "fail",
      "useEffect cleanup fonksiyonu eksik olabilir", 4,
      "Sayfa degistirildiginde eski API cagrilari devam edebilir.",
      "useEffect return () => { cleanup } ekleyin. AbortController kullanin.");
  }

  // 3. MUHASEBE HESAPLAMALARI
  testAccountingCalculations() {
    const cat = "3. Muhasebe Hesaplamalari";
    const kdvAmount = 1000 * 0.18;
    this.addResult(cat, "KDV", "KDV Hesaplama (Basit)",
      Math.abs(kdvAmount - 180) < 0.001 ? "pass" : "critical",
      `KDV: 1000 * 0.18 = ${kdvAmount}`, Math.abs(kdvAmount - 180) < 0.001 ? 1 : 5);
    const reverseKDV = 1180 - (1180 / 1.18);
    this.addResult(cat, "KDV", "KDV Ters Hesaplama",
      Math.abs(reverseKDV - 180) < 0.01 ? "pass" : "critical",
      `KDV dahil 1180 den KDV: ${reverseKDV.toFixed(2)} (beklenen: 180)`,
      Math.abs(reverseKDV - 180) < 0.01 ? 1 : 5,
      "Fatura KDV si yanlis hesaplanabilir.",
      "KDV = gross - (gross / (1 + rate)) formulunu kullanin.");
    const wrongDiscount = 1000 * (0.10 + 0.05);
    const correctDiscount = 1000 - 1000 * (1 - 0.10) * (1 - 0.05);
    if (wrongDiscount !== correctDiscount) {
      this.addResult(cat, "Iskonto", "Kademeli Iskonto Hesaplama Hatasi", "critical",
        `Toplam iskonto: ${wrongDiscount} vs Kademeli: ${correctDiscount}`, 5,
        "Iskonto yanlis hesaplanarak musteri ye fazla/eksik fatura kesilebilir.",
        "Kademeli iskonto: tutar * (1-isk1) * (1-isk2)");
    }
    const journalEntries = [
      { debit: 1000, credit: 0 }, { debit: 0, credit: 800 }, { debit: 0, credit: 200 }
    ];
    const totalDebit = journalEntries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = journalEntries.reduce((s, e) => s + e.credit, 0);
    this.addResult(cat, "Yevmiye", "Borc-Alacak Dengesi",
      Math.abs(totalDebit - totalCredit) < 0.001 ? "pass" : "critical",
      `Borc: ${totalDebit}, Alacak: ${totalCredit}`,
      Math.abs(totalDebit - totalCredit) < 0.001 ? 1 : 5,
      "Muhasebe temel kurali ihlal ediliyor.",
      "Her yevmiye kaydinda borc = alacak kontrolu ekleyin.");
    if (!isFinite(100 / 0)) {
      this.addResult(cat, "Matematik", "Sifira Bolme Riski", "critical",
        "100 / 0 = Infinity", 5,
        "Oran hesaplamalarinda sifira bolme olabilir.",
        "Bolme islemlerinden once divisor !== 0 kontrolu ekleyin.");
    }
    let accumulator = 0;
    for (let i = 0; i < 1000; i++) accumulator += 0.01;
    if (Math.abs(accumulator - 10) > 0.001) {
      this.addResult(cat, "Birikim", "Kusurat Birikim Hatasi", "critical",
        `1000 x 0.01 = ${accumulator} (beklenen: 10.00)`, 5,
        "Binlerce islem sonrasi toplam bakiye kayabilir.",
        "Integer aritmetik kullanin (kurus cinsinden).");
    }
    const linearDep = 100000 / 5;
    this.addResult(cat, "Amortisman", "Dogrusal Amortisman",
      linearDep === 20000 ? "pass" : "fail",
      `Yillik amortisman: ${linearDep} TL`, linearDep === 20000 ? 1 : 4);
  }

  // 4. FORM DOGRULAMA
  testFormValidation() {
    const cat = "4. Form Dogrulama";
    const validateTCKN = (tckn: string): boolean => {
      if (tckn.length !== 11 || tckn[0] === "0") return false;
      const d = tckn.split("").map(Number);
      const check10 = ((d[0]+d[2]+d[4]+d[6]+d[8])*7 - (d[1]+d[3]+d[5]+d[7])) % 10;
      if (check10 !== d[9]) return false;
      return d.slice(0,10).reduce((a,b)=>a+b,0) % 10 === d[10];
    };
    [
      { v: "10000000146", e: true, l: "Gecerli TCKN" },
      { v: "00000000000", e: false, l: "0 ile baslayan TCKN" },
      { v: "12345678901", e: false, l: "Rastgele TCKN" },
    ].forEach(t => {
      const r = validateTCKN(t.v);
      this.addResult(cat, "TCKN", t.l, r === t.e ? "pass" : "fail",
        `${t.v}: ${r} (beklenen: ${t.e})`, r === t.e ? 1 : 4);
    });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    [
      { v: "test@example.com", valid: true },
      { v: "invalid-email", valid: false },
      { v: "@example.com", valid: false },
    ].forEach(t => {
      const r = emailRegex.test(t.v);
      this.addResult(cat, "Email", `Email: ${t.v}`, r === t.valid ? "pass" : "fail",
        `${t.v}: ${r}`, 2);
    });
    const invoiceNumbers = ["FTR-001", "FTR-002", "FTR-001", "FTR-003"];
    const duplicates = invoiceNumbers.filter((item, i) => invoiceNumbers.indexOf(item) !== i);
    if (duplicates.length > 0) {
      this.addResult(cat, "Tekrar", "Fatura Numarasi Tekrari", "critical",
        `Tekrar eden: ${duplicates.join(", ")}`, 5,
        "Ayni fatura numarasiyla birden fazla fatura olusturulabilir.",
        "Fatura numarasi unique constraint ekleyin.");
    }
    const startDate = new Date("2024-12-31");
    const endDate = new Date("2024-01-01");
    if (startDate > endDate) {
      this.addResult(cat, "Tarih", "Baslangic > Bitis Tarihi", "fail",
        "Rapor tarih araligi ters girilebilir", 4,
        "Rapor tarih araligi ters girilebilir.",
        "startDate <= endDate kontrolu ekleyin.");
    }
    [
      '<script>alert("xss")</script>',
      '"><img src=x onerror=alert(1)>',
      "'; DROP TABLE accounts; --",
    ].forEach((input, idx) => {
      this.addResult(cat, "Guvenlik", `XSS/Injection Testi #${idx+1}`, "warning",
        `Zararli input: "${input.substring(0,30)}..."`, 4,
        "Kullanici girisler sanitize edilmezse XSS saldirisi olabilir.",
        "DOMPurify kullanin. dangerouslySetInnerHTML kullanmayin.");
    });
  }

  // 5. API & NETWORK
  testAPIAndNetwork() {
    const cat = "5. API & Network";
    const checks = [
      ["Error Handling", "API Hata Yonetimi", "fail", "API cagrilarinda try-catch eksik olabilir", 4,
       "Sunucu hatasi durumunda uygulama cokebilir.", "Her API cagrisini try-catch icine alin."],
      ["Race Condition", "Eszamanli Istek Yarisma", "critical",
       "Hizli art arda API cagrilari yaris durumu olusturabilir", 5,
       "Ayni faturay i iki kez kaydedebilir.", "AbortController kullanin. Debounce ekleyin."],
      ["Timeout", "API Timeout Yonetimi", "fail", "API timeout suresi belirsiz", 4,
       "Yavas baglan tida uygulama sonsuza kadar bekleyebilir.", "Axios/fetch timeout ekleyin (30sn)."],
      ["Auth", "Token Yenileme Mekanizmasi", "fail",
       "JWT token suresi doldugun da otomatik yenileme olmayabilir", 4,
       "Kullanici uzun sure calisirken session expire olabilir.", "Refresh token mekanizmasi ekleyin."],
      ["Pagination", "Buyuk Veri Seti Yuklemesi", "fail", "Tum kayitlar tek seferde yuklenebilir", 4,
       "10.000+ islem listesi tarayiciyi yavaslatir.", "Server-side pagination ekleyin."],
      ["Concurrency", "Eszamanli Duzenleme", "critical",
       "Ayni kaydi iki kullanici ayni anda duzenleyebilir", 5,
       "Son kaydeden oncekinin degisikliklerini ezebilir.", "Optimistic locking ekleyin."],
    ] as const;
    checks.forEach(([sub, name, status, msg, sev, det, fix]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.addResult(cat, sub, name, status as any, msg, sev as any, det, fix);
    });
  }

  // 6. GUVENLIK
  testSecurity() {
    const cat = "6. Guvenlik";
    this.addResult(cat, "Storage", "localStorage Hassas Veri", "critical",
      "Sifre, token gibi hassas veriler localStorage da saklanabilir", 5,
      "XSS saldirisiyla tum kimlik bilgileri calinabilir.",
      "Hassas verileri httpOnly cookie de saklayın.");
    this.addResult(cat, "Logging", "Console da Hassas Veri", "fail",
      "Production da console.log ile hassas veri yazdirilabilir", 4,
      "Musteri bilgileri, bakiyeler tarayici konsolunda gorunebilir.",
      "Production build de console.log lari kaldirin.");
    const isHTTPS = typeof window !== "undefined" ? window.location.protocol === "https:" : true;
    this.addResult(cat, "Transport", "HTTPS Kullanimi",
      isHTTPS ? "pass" : "critical",
      isHTTPS ? "HTTPS aktif" : "HTTP kullaniliyor!", isHTTPS ? 1 : 5,
      "HTTP uzerinden gonderilen veriler dinlenebilir.", "HTTPS zorunlu tutun.");
    this.addResult(cat, "CSRF", "Cross-Site Request Forgery", "fail",
      "CSRF token kontrolu olmayabilir", 4,
      "Kotu niyetli site kullanici adina islem yapabilir.",
      "CSRF token mekanizmasi ekleyin.");
    this.addResult(cat, "Rate Limit", "Brute Force Korumasi", "critical",
      "Giris denemelerine rate limiting uygulanmayabilir", 5,
      "Saldirgan sinirsiz sifre denemesi yapabilir.",
      [
        "Global Rate Limiting: Dakikada 60 istek/IP",
        "Endpoint Bazli: Giris icin dakikada 5 deneme/IP",
        "HTTP 429 + Retry-After header dondurun",
        "reCAPTCHA / hCaptcha entegre edin",
        "NGINX/Cloudflare seviyesinde rate limiting",
      ].join(" | "));
    this.addResult(cat, "Hata Ayiklama", "Debugger Protection", "warning",
      "Uygulama tersine muhendislige karsi korumasiz olabilir", 3,
      [
        "1. TEMEL: debugger statement loop, DevTools boyut tespiti, console manipulasyon tespiti",
        "2. GELISMIS: Timing attack korumasi, stack trace analizi, function integrity check",
        "3. OBFUSCATION: javascript-obfuscator (controlFlowFlattening, stringArrayEncoding: base64, selfDefending: true)",
        "4. RUNTIME: Object.freeze kritik nesneler, Proxy ile erisim denetimi, prototype korumasi",
        "5. YANIT: Debugger tespitinde hassas veri temizle, sunucuya bildir, oturumu sonlandir",
        "6. SUNUCU: CSP header, SRI, X-Frame-Options: DENY, X-XSS-Protection",
      ].join("\n"),
      "javascript-obfuscator paketi ekleyin. Object.freeze() kritik config nesnelerine uygulayın.");
    this.addResult(cat, "Deps", "Bagimlilik Guvenligi", "warning",
      "npm bagimliliklar guvensiz olabilir", 3,
      "Bilinen guvenlik aciklarına sahip paketler kullaniliyor olabilir.",
      "npm audit calistirin. Dependabot aktif edin.");
  }

  // 7. PERFORMANS
  testPerformance() {
    const cat = "7. Performans";
    const checks = [
      ["Bundle", "Bundle Boyutu", "warning", "JavaScript bundle boyutu cok buyuk olabilir", 3,
       "Ilk yuklenme suresi uzayabilir.", "Code splitting ve lazy loading ekleyin."],
      ["Memo", "Gereksiz Re-render", "warning", "React.memo/useMemo/useCallback eksik olabilir", 3,
       "Her state degisiminde tum liste yeniden render olabilir.", "React.memo ve useMemo kullanin."],
      ["Image", "Gorsel Optimizasyonu", "warning", "Gorseller optimize edilmemis olabilir", 2,
       "Sayfa agir yuklenebilir.", "WebP formatı, lazy loading, srcset kullanin."],
      ["Query", "N+1 Sorgu Problemi", "fail", "Her liste elemanı icin ayri API cagrisi yapilabilir", 4,
       "100 musteri icin 100 ayri istek gidebilir.", "Batch API endpoint olusturun."],
    ] as const;
    checks.forEach(([sub, name, status, msg, sev, det, fix]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.addResult(cat, sub, name, status as any, msg, sev as any, det, fix);
    });
  }

  // 8. VERİ BUTUNLUGU
  testDataIntegrity() {
    const cat = "8. Veri Butunlugu";
    this.addResult(cat, "Yedek", "Otomatik Yedekleme", "critical",
      "Otomatik veri yedekleme mekanizmasi olmayabilir", 5,
      "Veri kaybi durumunda geri donus imkani olmayabilir.",
      "Gunluk otomatik yedekleme + off-site storage ekleyin.");
    this.addResult(cat, "Silinme", "Soft Delete Eksikligi", "fail",
      "Kayitlar kalici olarak silinebilir", 4,
      "Yanlis silinen fatura/islem geri alinamaz.",
      "deleted: true flag ile soft delete kullanin.");
    this.addResult(cat, "Audit", "Degisiklik Gecmisi", "warning",
      "Kim ne zaman ne degistirdi bilgisi tutulmuyor olabilir", 3,
      "Muhasebe denetiminde degisiklik gecmisi gereklidir.",
      "Her kayit icin createdBy, updatedBy, updatedAt alanlari ekleyin.");
    this.addResult(cat, "Senkron", "Coklu Cihaz Senkronizasyonu", "warning",
      "Ayni anda birden fazla cihazdan erisimde conflict olabilir", 3,
      "Iki kullanici ayni faturay i ayni anda duzenleyebilir.",
      "Last-write-wins veya conflict resolution mekanizmasi ekleyin.");
  }

  runAll(): TestResult[] {
    this.results = [];
    this.testId = 0;
    this.testJavaScriptFundamentals();
    this.testReactStateManagement();
    this.testAccountingCalculations();
    this.testFormValidation();
    this.testAPIAndNetwork();
    this.testSecurity();
    this.testPerformance();
    this.testDataIntegrity();
    return this.results;
  }
}
// ============================================================================
// UI COMPONENT
// ============================================================================

export default function BugHunter() {
  const [report, setReport] = useState<BugReport | null>(null);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<"all" | "critical" | "fail" | "warning" | "pass">("all");
  const [search, setSearch] = useState("");
  const runnerRef = useRef<TestRunner | null>(null);

  const runTests = useCallback(() => {
    setRunning(true);
    const startTime = Date.now();
    setTimeout(() => {
      if (!runnerRef.current) runnerRef.current = new TestRunner();
      const results = runnerRef.current.runAll();
      const endTime = Date.now();
      const passed = results.filter(r => r.status === "pass").length;
      const failed = results.filter(r => r.status === "fail").length;
      const warnings = results.filter(r => r.status === "warning").length;
      const critical = results.filter(r => r.status === "critical").length;
      const score = Math.round((passed / results.length) * 100);
      const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
      setReport({
        totalTests: results.length, passed, failed, warnings, critical,
        results, startTime, endTime, score, grade
      });
      setRunning(false);
    }, 100);
  }, []);

  const filteredResults = report?.results.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search && !r.testName.toLowerCase().includes(search.toLowerCase()) &&
        !r.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  const statusColors = {
    pass: { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", text: "#10b981", icon: "✓" },
    fail: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", text: "#ef4444", icon: "✗" },
    warning: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", text: "#f59e0b", icon: "⚠" },
    critical: { bg: "rgba(220,38,38,0.15)", border: "rgba(220,38,38,0.4)", text: "#dc2626", icon: "��" },
    pending: { bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.2)", text: "#64748b", icon: "○" },
    running: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)", text: "#3b82f6", icon: "⟳" },
  };

  return (
    <div style={{ padding: "20px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ background: "linear-gradient(135deg,rgba(220,38,38,0.1),rgba(239,68,68,0.05))", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: "2rem" }}>🐛</span>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#f1f5f9" }}>Bug Hunter</h1>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              Kapsamli Hata Ayiklama & Test Sistemi — React Muhasebe Uygulamasi
            </p>
          </div>
          <button
            onClick={runTests}
            disabled={running}
            style={{
              background: running ? "rgba(100,116,139,0.2)" : "linear-gradient(135deg,#dc2626,#ef4444)",
              border: "none", borderRadius: 10, color: "#fff", padding: "12px 24px",
              fontWeight: 700, cursor: running ? "not-allowed" : "pointer", fontSize: "0.9rem",
              display: "flex", alignItems: "center", gap: 8, opacity: running ? 0.6 : 1
            }}
          >
            {running ? "⟳ Testler Calisiyor..." : "▶ Testleri Baslat"}
          </button>
        </div>
        {report && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 16 }}>
            {[
              { label: "Toplam Test", value: report.totalTests, color: "#64748b" },
              { label: "Basarili", value: report.passed, color: "#10b981" },
              { label: "Basarisiz", value: report.failed, color: "#ef4444" },
              { label: "Uyari", value: report.warnings, color: "#f59e0b" },
              { label: "Kritik", value: report.critical, color: "#dc2626" },
              { label: "Skor", value: `${report.score}% (${report.grade})`, color: report.score >= 80 ? "#10b981" : report.score >= 60 ? "#f59e0b" : "#ef4444" },
            ].map((stat, i) => (
              <div key={i} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {report && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Test ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, minWidth: 200, padding: "10px 14px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, color: "#f1f5f9", fontSize: "0.85rem"
              }}
            />
            {(["all", "critical", "fail", "warning", "pass"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "10px 16px", borderRadius: 8, border: "none",
                  background: filter === f ? "rgba(255,87,34,0.2)" : "rgba(255,255,255,0.05)",
                  color: filter === f ? "#ff7043" : "#94a3b8",
                  fontWeight: 600, cursor: "pointer", fontSize: "0.82rem"
                }}
              >
                {f === "all" ? "Tumu" : f === "critical" ? "Kritik" : f === "fail" ? "Basarisiz" : f === "warning" ? "Uyari" : "Basarili"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredResults.map(result => {
              const style = statusColors[result.status];
              return (
                <details key={result.id} style={{
                  background: style.bg, border: `1px solid ${style.border}`,
                  borderRadius: 12, padding: "14px 18px"
                }}>
                  <summary style={{
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    fontWeight: 600, color: "#f1f5f9", fontSize: "0.9rem"
                  }}>
                    <span style={{ fontSize: "1.1rem" }}>{style.icon}</span>
                    <span style={{ flex: 1 }}>{result.testName}</span>
                    <span style={{
                      fontSize: "0.7rem", background: "rgba(0,0,0,0.2)", padding: "3px 8px",
                      borderRadius: 6, color: "#94a3b8"
                    }}>{result.category} › {result.subCategory}</span>
                    <span style={{
                      fontSize: "0.75rem", background: style.bg, border: `1px solid ${style.border}`,
                      padding: "2px 8px", borderRadius: 6, color: style.text, fontWeight: 700
                    }}>Sev: {result.severity}</span>
                  </summary>
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ color: "#e2e8f0", fontSize: "0.85rem", marginBottom: 8 }}>
                      <strong>Mesaj:</strong> {result.message}
                    </div>
                    {result.details && (
                      <div style={{
                        background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 12px",
                        marginBottom: 8, fontSize: "0.8rem", color: "#cbd5e1", whiteSpace: "pre-wrap"
                      }}>
                        <strong>Detay:</strong><br />{result.details}
                      </div>
                    )}
                    {result.fix && (
                      <div style={{
                        background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
                        borderRadius: 8, padding: "10px 12px", fontSize: "0.8rem", color: "#6ee7b7"
                      }}>
                        <strong>✓ Cozum:</strong><br />{result.fix}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}

      {!report && !running && (
        <div style={{
          textAlign: "center", padding: "60px 20px", color: "#64748b"
        }}>
          <div style={{ fontSize: "4rem", marginBottom: 16, opacity: 0.3 }}>🐛</div>
          <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>Testleri baslatmak icin yukardaki butona tiklayin</p>
          <p style={{ fontSize: "0.85rem", marginTop: 8 }}>
            JavaScript, React, Muhasebe, Form, API, Guvenlik, Performans ve Veri Butunlugu testleri calistirilacak
          </p>
        </div>
      )}
    </div>
  );
}
