# Gereksinimler Belgesi

## Giriş

Bu belge, PARSPEL-TEMİZ projesindeki test altyapısının mevcut Parspel uygulamasına entegrasyonunu tanımlar. Hedef; Vitest + fast-check + @testing-library/react + Playwright kombinasyonunu kullanarak birim, property-based ve uçtan uca (e2e) testlerin çalışır hale getirilmesi, mevcut test dosyalarının bu workspace'e uyarlanması ve CI/CD uyumlu raporlama altyapısının kurulmasıdır.

Mevcut durumda workspace'de test dosyaları (`src/lib/*.test.ts`) ve temel Vitest konfigürasyonu (`vite.config.ts`) mevcuttur; ancak bazı test dosyaları çalışmamakta, `src/test/setup.ts` eksik içerik barındırmakta ve Playwright e2e testleri için kurulum tamamlanmamıştır.

## Sözlük

- **Test_Altyapisi**: Vitest, fast-check, @testing-library/react ve Playwright'tan oluşan test araç seti
- **Vitest**: Vite tabanlı birim ve property-based test çalıştırıcısı
- **Fast_Check**: TypeScript için property-based test kütüphanesi
- **Playwright**: Chromium tabanlı uçtan uca (e2e) test çalıştırıcısı
- **Rule_Engine**: `src/lib/ruleEngine.ts` — finansal kural değerlendirme motoru
- **Audit_Engine**: `src/lib/auditEngine.ts` — işlem denetim kaydı motoru
- **DataIntegrity_Checker**: `src/lib/dataIntegrityChecker.ts` — veri bütünlüğü denetçisi
- **Similarity_Module**: `src/lib/similarity.ts` — Türkçe metin benzerlik modülü
- **Utils_TR**: `src/lib/utils-tr.ts` — Türkçe yardımcı fonksiyonlar
- **Test_Setup**: `src/test/setup.ts` — Vitest global test kurulum dosyası
- **HTML_Reporter**: `@vitest/ui` ile üretilen HTML test raporu
- **PBT**: Property-Based Testing — fast-check ile rastgele girdi üretimi
- **DB**: Uygulamanın localStorage tabanlı veri modeli (`src/types.ts`)
- **jsdom**: Tarayıcı ortamını simüle eden Node.js kütüphanesi
- **E2E_Test**: Playwright ile çalışan uçtan uca tarayıcı testi

---

## Gereksinimler

### Gereksinim 1: Vitest Konfigürasyonu

**Kullanıcı Hikayesi:** Bir geliştirici olarak, `npm run test:run` komutunu çalıştırdığımda tüm birim ve property-based testlerin hatasız geçmesini istiyorum; böylece kod değişikliklerinin mevcut işlevselliği bozmadığını hızlıca doğrulayabileyim.

#### Kabul Kriterleri

1. THE Test_Altyapisi SHALL `vite.config.ts` içinde `test.environment: 'jsdom'` konfigürasyonunu içermelidir.
2. THE Test_Altyapisi SHALL `vite.config.ts` içinde `test.globals: true` konfigürasyonunu içermelidir.
3. THE Test_Altyapisi SHALL `vite.config.ts` içinde `test.setupFiles: ['./src/test/setup.ts']` konfigürasyonunu içermelidir.
4. THE Test_Altyapisi SHALL `vite.config.ts` içinde `test.exclude` listesinde `**/e2e/**`, `**/dist/**`, `**/node_modules/**` ve boş test dosyalarını (`gercekci-senaryolar.test.ts`, `uygulama-gercek.test.ts`) dışlamalıdır.
5. WHEN `npm run test:run` komutu çalıştırıldığında, THE Vitest SHALL tüm `src/lib/*.test.ts` dosyalarını tek seferlik (watch modu olmadan) çalıştırmalıdır.
6. WHEN `npm run test:report` komutu çalıştırıldığında, THE HTML_Reporter SHALL `./test-report/index.html` dosyasını üretmelidir.

---

### Gereksinim 2: Test Kurulum Dosyası

**Kullanıcı Hikayesi:** Bir geliştirici olarak, `@testing-library/jest-dom` matchers'larının tüm test dosyalarında otomatik olarak kullanılabilir olmasını istiyorum; böylece her test dosyasında tekrar tekrar import yazmak zorunda kalmayayım.

#### Kabul Kriterleri

1. THE Test_Setup SHALL `@testing-library/jest-dom` paketini import etmelidir.
2. THE Test_Setup SHALL Vitest'in `setupFiles` konfigürasyonu aracılığıyla her test dosyasından önce otomatik olarak çalıştırılmalıdır.
3. IF `@testing-library/jest-dom` paketi yüklü değilse, THEN THE Test_Altyapisi SHALL kurulum sırasında açıklayıcı bir hata mesajı üretmelidir.

---

### Gereksinim 3: Rule Engine Testleri

**Kullanıcı Hikayesi:** Bir geliştirici olarak, `validateTransaction` fonksiyonunun finansal kuralları doğru uyguladığını hem birim testleri hem de property-based testlerle doğrulamak istiyorum; böylece kural motoru değişikliklerinin regresyon yaratmadığından emin olabileyim.

#### Kabul Kriterleri

1. WHEN `negative_stock` kuralı değerlendirildiğinde ve herhangi bir ürünün `stock` değeri 0'ın altındaysa, THE Rule_Engine SHALL `severity: 'block'` içeren bir `RuleViolation` döndürmelidir.
2. WHEN `negative_kasa` kuralı değerlendirildiğinde ve herhangi bir kasanın hesaplanan bakiyesi 0'ın altındaysa, THE Rule_Engine SHALL `severity: 'block'` içeren bir `RuleViolation` döndürmelidir.
3. WHEN `duplicate_transaction` kuralı değerlendirildiğinde ve son 60 saniye içinde aynı `cariId + amount + kasa` kombinasyonu mevcutsa, THE Rule_Engine SHALL `severity: 'warn'` içeren bir `RuleViolation` döndürmelidir.
4. WHEN `zero_amount` kuralı değerlendirildiğinde ve yeni bir `KasaEntry.amount` değeri 0 veya negatifse, THE Rule_Engine SHALL `severity: 'block'` içeren bir `RuleViolation` döndürmelidir.
5. WHEN `zero_amount` kuralı değerlendirildiğinde ve yeni bir `Sale.total` değeri 0 veya negatifse, THE Rule_Engine SHALL `severity: 'block'` içeren bir `RuleViolation` döndürmelidir.
6. THE Rule_Engine SHALL herhangi bir girdi kombinasyonu için exception fırlatmadan her zaman `RuleViolation[]` döndürmelidir.
7. WHEN bir kural değerlendirmesi exception fırlatırsa, THE Rule_Engine SHALL diğer kuralları değerlendirmeye devam etmelidir (graceful degradation).
8. FOR ALL geçerli `prevDB` ve `nextDB` çiftleri, THE Rule_Engine SHALL `validateTransaction(prevDB, nextDB)` çağrısının her zaman geçerli bir `RuleViolation[]` döndürdüğünü garanti etmelidir (PBT — property: never throws).
9. FOR ALL negatif `stock` değeri içeren `nextDB` nesneleri, THE Rule_Engine SHALL en az bir `severity: 'block'` ihlali döndürmelidir (PBT — property: negative stock always blocks).
10. FOR ALL negatif bakiyeye düşen kasa konfigürasyonları, THE Rule_Engine SHALL en az bir `severity: 'block'` ihlali döndürmelidir (PBT — property: negative kasa always blocks).
11. FOR ALL `amount <= 0` olan yeni `KasaEntry` nesneleri, THE Rule_Engine SHALL `zero_amount` kuralı için `severity: 'block'` ihlali döndürmelidir (PBT — property: zero/negative amount always blocks).

---

### Gereksinim 4: Audit Engine Testleri

**Kullanıcı Hikayesi:** Bir geliştirici olarak, `auditEngine.ts` içindeki `computeDiff`, `createAuditEntry`, `trimAuditLog` ve `runFullAudit` fonksiyonlarının doğru çalıştığını test etmek istiyorum; böylece denetim kayıtlarının güvenilirliğini garanti altına alabileyim.

#### Kabul Kriterleri

1. WHEN `computeDiff(prevDB, nextDB)` çağrıldığında ve iki DB arasında fark varsa, THE Audit_Engine SHALL yalnızca değişen alanları içeren `{ prevValue, nextValue }` nesnesi döndürmelidir.
2. WHEN `computeDiff(prevDB, nextDB)` çağrıldığında ve `_auditLog` alanı değişmişse, THE Audit_Engine SHALL `_auditLog` alanını diff sonucuna dahil etmemelidir (sonsuz döngü önlemi).
3. WHEN `createAuditEntry` çağrıldığında, THE Audit_Engine SHALL geçerli `id`, `action`, `entity`, `status`, `time` ve `sessionId` alanlarını içeren bir `AuditEntry` nesnesi döndürmelidir.
4. WHEN `trimAuditLog` fonksiyonuna 500'den fazla kayıt içeren bir dizi verildiğinde, THE Audit_Engine SHALL diziyi 500 kayıtla sınırlandırmalıdır.
5. WHEN `trimAuditLog` fonksiyonuna 500 veya daha az kayıt içeren bir dizi verildiğinde, THE Audit_Engine SHALL diziyi değiştirmeden döndürmelidir.
6. WHEN `runFullAudit(db)` çağrıldığında, THE Audit_Engine SHALL `anomalies`, `balanceDrifts`, `riskFlags`, `totalEntries`, `appliedCount`, `blockedCount` ve `warnedCount` alanlarını içeren bir `AuditReport` döndürmelidir.
7. FOR ALL geçerli `DB` nesneleri, THE Audit_Engine SHALL `computeDiff(db, db)` çağrısının boş `prevValue` ve `nextValue` döndürdüğünü garanti etmelidir (PBT — invariant: diff of identical DBs is empty).
8. FOR ALL `AuditEntry[]` dizileri, THE Audit_Engine SHALL `trimAuditLog` uygulandıktan sonra dizi uzunluğunun 500'ü aşmadığını garanti etmelidir (PBT — invariant: trimAuditLog length ≤ 500).

---

### Gereksinim 5: Veri Bütünlüğü Testleri

**Kullanıcı Hikayesi:** Bir geliştirici olarak, `dataIntegrityChecker.ts` içindeki `runIntegrityCheck`, `detectAnomalies` ve `getHealthScore` fonksiyonlarının doğru çalıştığını test etmek istiyorum; böylece veri bütünlüğü kontrollerinin güvenilirliğini doğrulayabileyim.

#### Kabul Kriterleri

1. WHEN `runIntegrityCheck(db)` çağrıldığında ve herhangi bir ürünün `stock` değeri negatifse, THE DataIntegrity_Checker SHALL `severity: 'critical'` ve `category: 'stok'` içeren bir `IntegrityIssue` döndürmelidir.
2. WHEN `runIntegrityCheck(db)` çağrıldığında ve herhangi bir kasanın hesaplanan bakiyesi negatifse, THE DataIntegrity_Checker SHALL `severity: 'critical'` ve `category: 'kasa'` içeren bir `IntegrityIssue` döndürmelidir.
3. WHEN `runIntegrityCheck(db)` çağrıldığında ve bir `KasaEntry.amount` değeri 0 veya negatifse, THE DataIntegrity_Checker SHALL `severity: 'warning'` ve `category: 'kasa'` içeren bir `IntegrityIssue` döndürmelidir.
4. WHEN `getHealthScore(db)` çağrıldığında, THE DataIntegrity_Checker SHALL 0 ile 100 arasında bir tam sayı döndürmelidir.
5. WHEN `getHealthScore(db)` çağrıldığında ve DB'de kritik sorun yoksa, THE DataIntegrity_Checker SHALL 100 değeri döndürmelidir.
6. FOR ALL geçerli `DB` nesneleri, THE DataIntegrity_Checker SHALL `runIntegrityCheck(db)` çağrısının her zaman `IntegrityIssue[]` döndürdüğünü garanti etmelidir (PBT — property: never throws).
7. FOR ALL geçerli `DB` nesneleri, THE DataIntegrity_Checker SHALL `getHealthScore(db)` sonucunun 0 ile 100 arasında olduğunu garanti etmelidir (PBT — invariant: health score in [0, 100]).

---

### Gereksinim 6: Benzerlik Modülü Testleri

**Kullanıcı Hikayesi:** Bir geliştirici olarak, `similarity.ts` içindeki `normalizeTR`, `similarity` ve `isExactMatch` fonksiyonlarının Türkçe karakterleri doğru işlediğini test etmek istiyorum; böylece cari adı benzerlik kontrollerinin güvenilirliğini doğrulayabileyim.

#### Kabul Kriterleri

1. WHEN `normalizeTR` fonksiyonuna Türkçe karakter içeren bir string verildiğinde, THE Similarity_Module SHALL Türkçe karakterleri (`ğ→g`, `ü→u`, `ş→s`, `ı→i`, `ö→o`, `ç→c`) ASCII karşılıklarına dönüştürmelidir.
2. WHEN `similarity("abc", "abc")` çağrıldığında, THE Similarity_Module SHALL 100 değeri döndürmelidir.
3. WHEN `similarity("", "abc")` veya `similarity("abc", "")` çağrıldığında, THE Similarity_Module SHALL 0 değeri döndürmelidir.
4. WHEN `isExactMatch(a, b)` çağrıldığında ve normalize edilmiş `a` ile `b` eşitse, THE Similarity_Module SHALL `true` döndürmelidir.
5. FOR ALL string çiftleri `(a, b)`, THE Similarity_Module SHALL `similarity(a, b)` sonucunun 0 ile 100 arasında olduğunu garanti etmelidir (PBT — invariant: score in [0, 100]).
6. FOR ALL string değerleri `s`, THE Similarity_Module SHALL `similarity(s, s)` sonucunun 100 olduğunu garanti etmelidir (PBT — invariant: self-similarity is 100).
7. FOR ALL string çiftleri `(a, b)`, THE Similarity_Module SHALL `similarity(a, b)` ile `similarity(b, a)` sonuçlarının eşit olduğunu garanti etmelidir (PBT — property: symmetry).

---

### Gereksinim 7: Yardımcı Fonksiyon Testleri (utils-tr)

**Kullanıcı Hikayesi:** Bir geliştirici olarak, `utils-tr.ts` içindeki tarih ayrıştırma, para formatlama ve kâr hesaplama fonksiyonlarının doğru çalıştığını test etmek istiyorum; böylece finansal hesaplamaların güvenilirliğini doğrulayabileyim.

#### Kabul Kriterleri

1. WHEN `parseBankDate` fonksiyonuna `DD.MM.YYYY`, `DD/MM/YYYY` veya `DD-MM-YYYY` formatında geçerli bir tarih string'i verildiğinde, THE Utils_TR SHALL geçerli bir `Date` nesnesi döndürmelidir.
2. WHEN `parseBankDate` fonksiyonuna geçersiz bir string verildiğinde, THE Utils_TR SHALL `null` döndürmelidir.
3. WHEN `formatBankDate` fonksiyonuna bir `Date` nesnesi verildiğinde, THE Utils_TR SHALL `DD.MM.YYYY` formatında bir string döndürmelidir.
4. FOR ALL geçerli UTC tarih nesneleri `d`, THE Utils_TR SHALL `parseBankDate(formatBankDate(d))` sonucunun orijinal `d` ile aynı UTC timestamp'e sahip olduğunu garanti etmelidir (PBT — round-trip: format → parse preserves date).
5. WHEN `calcMarkup(price, cost)` çağrıldığında ve `cost > 0` ise, THE Utils_TR SHALL `Math.round(((price - cost) / cost) * 100)` formülüne göre hesaplanan değeri döndürmelidir.
6. WHEN `calcMargin(price, cost)` çağrıldığında ve `price > 0` ise, THE Utils_TR SHALL `Math.round(((price - cost) / price) * 100)` formülüne göre hesaplanan değeri döndürmelidir.
7. FOR ALL `price > cost > 0` koşulunu sağlayan değer çiftleri, THE Utils_TR SHALL `calcMarkup(price, cost) >= calcMargin(price, cost)` koşulunun her zaman sağlandığını garanti etmelidir (PBT — metamorphic: markup ≥ margin).

---

### Gereksinim 8: Kapsamlı Senaryo Testleri

**Kullanıcı Hikayesi:** Bir geliştirici olarak, gerçek iş senaryolarını (satış → iade, sipariş tamamlama, cari tahsilat) uçtan uca test etmek istiyorum; böylece `prevDB → işlem → nextDB` geçişlerinin tutarlı olduğunu doğrulayabileyim.

#### Kabul Kriterleri

1. WHEN cari satış yapıldığında ve ardından iade gerçekleştirildiğinde, THE Rule_Engine SHALL iade sonrası `cari.balance` değerinin satış öncesi değere döndüğünü garanti etmelidir.
2. WHEN kısmi tahsilatlı cari satış yapıldığında ve ardından iade gerçekleştirildiğinde, THE Rule_Engine SHALL iade sonrası `cari.balance` değerinin 0 olduğunu garanti etmelidir.
3. WHEN sipariş `tamamlandi` durumuna geçirildiğinde, THE Rule_Engine SHALL ilgili ürünlerin `stock` değerinin sipariş kalemleri kadar arttığını garanti etmelidir.
4. WHEN aynı sipariş ikinci kez `tamamlandi` durumuna geçirildiğinde (`stockCompleted: true`), THE Rule_Engine SHALL ürün stoğunun tekrar artmamasını garanti etmelidir (idempotency).
5. WHEN ardışık satışlar yapıldığında ve toplam satış adedi başlangıç stok miktarını aşmadığında, THE Rule_Engine SHALL hiçbir satışta `negative_stock` ihlali üretmemelidir.
6. WHEN stok miktarını aşan bir satış girişimi yapıldığında, THE Rule_Engine SHALL `severity: 'block'` ve `ruleId: 'negative_stock'` içeren bir ihlal üretmelidir.

---

### Gereksinim 9: Soba Satış Senaryosu Testleri

**Kullanıcı Hikayesi:** Bir geliştirici olarak, 120 adet soba stoğuyla başlayan bir mağazanın 100 adet satış, stok sınırı ve stok aşımı senaryolarını test etmek istiyorum; böylece kasa, stok ve cari bakiye tutarlılığını doğrulayabileyim.

#### Kabul Kriterleri

1. WHEN 120 adet stoktan 100 adet soba satıldığında, THE Rule_Engine SHALL kural ihlali üretmemeli ve stok değerinin 20 olduğunu garanti etmelidir.
2. WHEN 120 adet stoktan tam 120 adet soba satıldığında, THE Rule_Engine SHALL kural ihlali üretmemeli ve stok değerinin 0 olduğunu garanti etmelidir.
3. WHEN 120 adet stoktan 121 adet soba satılmaya çalışıldığında, THE Rule_Engine SHALL `severity: 'block'` ve `ruleId: 'negative_stock'` içeren bir ihlal üretmelidir.
4. WHEN 100 adet nakit satış yapıldığında, THE Rule_Engine SHALL kasa gelirinin `100 × birim_fiyat` değerine eşit olduğunu garanti etmelidir.
5. WHEN cari (veresiye) satış yapıldığında, THE Rule_Engine SHALL kasaya nakit girişi olmadığını ve müşteri bakiyesinin satış tutarı kadar arttığını garanti etmelidir.
6. WHEN ardışık 100 adet × 1 satış yapıldığında, THE Rule_Engine SHALL hiçbir satışta kural ihlali üretmemeli ve toplam kasa gelirinin `100 × birim_fiyat` değerine eşit olduğunu garanti etmelidir.

---

### Gereksinim 10: Bağımlılık Yönetimi

**Kullanıcı Hikayesi:** Bir geliştirici olarak, test altyapısı için gerekli tüm npm paketlerinin `package.json`'da tanımlı olmasını istiyorum; böylece `npm install` sonrasında testlerin çalışmaya hazır olduğunu garanti altına alabileyim.

#### Kabul Kriterleri

1. THE Test_Altyapisi SHALL `package.json` içinde `vitest` paketini `devDependencies` altında içermelidir.
2. THE Test_Altyapisi SHALL `package.json` içinde `@vitest/ui` paketini `devDependencies` altında içermelidir.
3. THE Test_Altyapisi SHALL `package.json` içinde `fast-check` paketini `devDependencies` altında içermelidir.
4. THE Test_Altyapisi SHALL `package.json` içinde `@testing-library/react` paketini `devDependencies` altında içermelidir.
5. THE Test_Altyapisi SHALL `package.json` içinde `@testing-library/jest-dom` paketini `devDependencies` altında içermelidir.
6. THE Test_Altyapisi SHALL `package.json` içinde `jsdom` paketini `devDependencies` altında içermelidir.
7. THE Test_Altyapisi SHALL `package.json` içinde `@playwright/test` paketini `devDependencies` altında içermelidir.
8. THE Test_Altyapisi SHALL `package.json` içinde aşağıdaki test scriptlerini içermelidir:
   - `test`: `vitest` (watch modu)
   - `test:run`: `vitest --run` (tek seferlik)
   - `test:report`: `vitest run --reporter=html --outputFile=./test-report/index.html`
   - `test:report:open`: `npx vite preview --outDir test-report --port 4174`
   - `test:e2e`: `playwright test`
   - `test:e2e:ui`: `playwright test --ui`
   - `test:e2e:report`: `playwright show-report`

---

### Gereksinim 11: Playwright E2E Kurulumu

**Kullanıcı Hikayesi:** Bir geliştirici olarak, Playwright e2e testlerinin Chromium tarayıcısıyla çalışacak şekilde yapılandırılmış olmasını istiyorum; böylece uygulama arayüzünü gerçek tarayıcı ortamında test edebileyim.

#### Kabul Kriterleri

1. THE Test_Altyapisi SHALL proje kök dizininde `playwright.config.ts` dosyasını içermelidir.
2. THE Test_Altyapisi SHALL `playwright.config.ts` içinde Chromium tarayıcısını test projesi olarak tanımlamalıdır.
3. THE Test_Altyapisi SHALL `playwright.config.ts` içinde `baseURL` değerini geliştirme sunucusu adresine (`http://localhost:3000`) ayarlamalıdır.
4. THE Test_Altyapisi SHALL `playwright.config.ts` içinde e2e test dosyalarının `e2e/` dizininde aranacağını belirtmelidir.
5. IF Playwright Chromium kurulumu eksikse, THEN THE Test_Altyapisi SHALL `npx playwright install chromium` komutuyla kurulumun tamamlanabileceğini belgelemelidir.

---

### Gereksinim 12: Test Dosyası Organizasyonu

**Kullanıcı Hikayesi:** Bir geliştirici olarak, test dosyalarının tutarlı bir dizin yapısında organize edilmesini istiyorum; böylece hangi testin neyi kapsadığını kolayca anlayabileyim.

#### Kabul Kriterleri

1. THE Test_Altyapisi SHALL birim ve property-based test dosyalarını test ettikleri kaynak dosyayla aynı dizinde (`src/lib/*.test.ts`) konumlandırmalıdır.
2. THE Test_Altyapisi SHALL e2e test dosyalarını `e2e/` dizininde konumlandırmalıdır.
3. THE Test_Altyapisi SHALL `src/test/setup.ts` dosyasını Vitest global kurulum dosyası olarak kullanmalıdır.
4. THE Test_Altyapisi SHALL boş veya geçici test dosyalarını (`gercekci-senaryolar.test.ts`, `uygulama-gercek.test.ts`) Vitest `exclude` listesine almalıdır.
5. WHEN yeni bir `src/lib/*.ts` modülü oluşturulduğunda, THE Test_Altyapisi SHALL aynı dizinde karşılık gelen `*.test.ts` dosyasının oluşturulmasını önermelidir.

---

### Gereksinim 13: Test Çalıştırma ve Raporlama

**Kullanıcı Hikayesi:** Bir geliştirici olarak, testlerin sonuçlarını hem terminal çıktısında hem de HTML raporu olarak görmek istiyorum; böylece test kapsamını ve başarı oranını kolayca takip edebileyim.

#### Kabul Kriterleri

1. WHEN `npm run test:run` komutu çalıştırıldığında, THE Vitest SHALL terminal çıktısında her test dosyasının adını, geçen/başarısız test sayısını ve toplam süreyi göstermelidir.
2. WHEN `npm run test:report` komutu çalıştırıldığında, THE HTML_Reporter SHALL `./test-report/index.html` dosyasını üretmelidir.
3. WHEN `npm run test:report:open` komutu çalıştırıldığında, THE HTML_Reporter SHALL `http://localhost:4174` adresinde HTML raporunu sunmalıdır.
4. WHEN herhangi bir test başarısız olduğunda, THE Vitest SHALL terminal çıktısında başarısız testin adını, beklenen değeri ve gerçek değeri göstermelidir.
5. WHEN property-based bir test başarısız olduğunda, THE Vitest SHALL fast-check'in ürettiği minimal karşı örneği (counterexample) terminal çıktısında göstermelidir.
