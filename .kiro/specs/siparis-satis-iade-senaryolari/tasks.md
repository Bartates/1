# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Nakit Satış → İade Net Kasa Sıfır
  - **CRITICAL**: Bu test UNFIXED kodda BAŞARISIZ olmalıdır — başarısızlık bug'ın varlığını kanıtlar
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: Bu test beklenen davranışı kodlar — implementasyon sonrası geçtiğinde fix'i doğrular
  - **GOAL**: Nakit satış → iade akışında kasa net bakiyesinin sıfır olmadığını gösteren karşı-örnekler bul
  - **Scoped PBT Approach**: Somut başarısız duruma odaklan: 1 adet soba satışı (1200₺) → iade → net kasa ≠ 0
  - `isBugCondition(X)`: `X.sale.payment = 'nakit' AND X.sale.total > 0 AND iadeYap sonrası net kasa ≠ 0`
  - `src/lib/kapsamli-senaryo.test.ts` dosyasını oluştur (test altyapısı dahil)
  - `makeDB` fabrika fonksiyonunu yaz (soba-satis-senaryosu.test.ts'deki pattern'i referans al)
  - Tüm yardımcı operasyon fonksiyonlarını yaz: `satisYap`, `iadeYap`, `iptalYap`, `cariEkle`, `cariDuzenle`, `cariSil`, `tahsilatYap`, `kasaGelirEkle`, `kasaGiderEkle`, `kasaKayitSil`, `stokGiris`, `stokCikis`, `stokDuzeltme`
  - Her fonksiyon `prevDB → { nextDB, violations, ... }` dönüşümünü uygular ve `validateTransaction` çağırır
  - Grup 1 testini yaz: `satisYap(db, [{soba,1}], 'nakit')` → `iadeYap(db, saleId)` → `net kasa = 0` assert et
  - Testi UNFIXED kodda çalıştır
  - **EXPECTED OUTCOME**: Test BAŞARISIZ olur (iade gider kaydı eksik veya yanlış kasaya yazılıyor)
  - Karşı-örnekleri belgele (örn. "iade sonrası kasa bakiyesi 1200₺ kaldı, 0 olması gerekiyordu")
  - Görev tamamlandı sayılır: test yazıldı, çalıştırıldı, başarısızlık belgelendi
  - _Requirements: 1.1, 2.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Normal Nakit Satış ve Stok Kuralları Korunur
  - **IMPORTANT**: Observation-first metodolojisini uygula
  - UNFIXED kodda bug koşulunu tetiklemeyen girdilerle davranışı gözlemle:
    - `satisYap(db, [{soba,1}], 'nakit')` → stok azalır, kasaya gelir yazılır (iade YOK)
    - `satisYap(db, [{soba,121}], 'nakit')` (stok=120) → `negative_stock` ihlali üretilir
    - `satisYap(db, [{soba,1}], 'cari', cariId)` → kasaya giriş yok, cari.balance artar
  - Gözlemlenen davranışları property-based testlerle kodla:
    - `fc.property(fc.integer({min:1,max:120}), qty => satisYap sonrası stok = 120 - qty)`
    - `fc.property(fc.integer({min:121,max:300}), qty => negative_stock ihlali üretilir)`
    - Tam cari satışta kasa boş kalır
    - `zero_amount` kuralı sıfır tutarlı işlemleri engeller
  - Testleri UNFIXED kodda çalıştır
  - **EXPECTED OUTCOME**: Testler GEÇER (korunacak baseline davranışı doğrular)
  - Görev tamamlandı sayılır: testler yazıldı, çalıştırıldı, UNFIXED kodda geçiyor
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix — Kapsamlı Senaryo Test Dosyasını Tamamla

  - [x] 3.1 Grup 1: Nakit satış → iade kasa bakiyesi testleri
    - `satisYap(db, [{soba,1}], 'nakit')` → kasa geliri = 1200₺
    - `iadeYap(db, saleId)` → kasa gideri = 1200₺ eklenir
    - Assert: `Σ(gelir) - Σ(gider) = 0` (net kasa sıfır)
    - Assert: `sale.status = 'iade'`
    - Assert: `product.stock` başlangıç değerine döner
    - Assert: `violations` boş (kural ihlali yok)
    - _Bug_Condition: `isBugCondition(X)` → `X.payment='nakit' AND iade sonrası net kasa ≠ 0`_
    - _Expected_Behavior: iade gider kaydı `amount = sale.total`, aynı kasaya yazılır_
    - _Preservation: Normal satış davranışı (stok azalma, kasa geliri) değişmez_
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 3.2 Grup 2: Cari satış → kısmi tahsilat → iade testleri
    - Müşteri oluştur (balance: 0)
    - `satisYap(db, [{soba,1}], 'cari', cariId, tahsilat=500)` → kasa +500, cari.balance +700
    - Assert: `kasa geliri = 500`, `cari.balance = 700`, `500 + 700 = 1200 = sale.total`
    - `iadeYap(db, saleId)` → kasa -500 (gider), cari.balance -700
    - Assert: `cari.balance = 0`
    - Assert: `Σ(gelir) - Σ(gider) = 0` (net kasa sıfır)
    - Assert: `sale.status = 'iade'`
    - _Bug_Condition: `isBugCondition(X)` → `tahsilat > 0 AND iade sonrası cari.balance ≠ 0`_
    - _Requirements: 1.2, 2.2_

  - [x] 3.3 Grup 3: Sipariş tamamlandığında stok artışı testleri
    - Ürün oluştur (stock: 5)
    - Order oluştur: `{ items: [{productId, qty: 10}], status: 'bekliyor' }`
    - Order'ı `status: 'tamamlandi', stockCompleted: true` olarak güncelle
    - Assert: `product.stock = 5 + 10 = 15`
    - Assert: StockMovement kaydı: `type: 'giris', amount: 10, before: 5, after: 15`
    - Çoklu kalemli sipariş testi: `[{ürün1, qty:3}, {ürün2, qty:7}]` → her ürün stoğu artar
    - _Bug_Condition: `isBugCondition(X)` → `order.status='tamamlandi' AND product.stock değişmedi`_
    - _Requirements: 1.3, 2.3_

  - [x] 3.4 Grup 4: Çoklu ürünlü satış → iade testleri
    - İki ürün oluştur: soba (stock=10), aksesuar (stock=5)
    - `satisYap(db, [{soba,2},{aksesuar,1}], 'nakit')`
    - Assert: `soba.stock = 8`, `aksesuar.stock = 4`
    - Assert: kasa geliri = `2×soba.price + 1×aksesuar.price`
    - `iadeYap(db, saleId)`
    - Assert: `soba.stock = 10`, `aksesuar.stock = 5` (başlangıç değerlerine döner)
    - Assert: net kasa = 0
    - Assert: her iki ürün için StockMovement `type: 'iade'` kaydı oluştu
    - _Bug_Condition: `isBugCondition(X)` → `sale.items.length > 1 AND iade sonrası tüm stoklar geri yüklenmedi`_
    - _Requirements: 1.4, 2.4_

  - [x] 3.5 Grup 5: İskontolu satış → iade testleri
    - `satisYap(db, [{soba,1}], 'nakit', undefined, undefined, {type:'percent', value:10})`
    - Assert: `subtotal = 1200`, `discountAmount = 120`, `total = 1080`
    - Assert: kasa geliri = 1080 (brüt 1200 değil)
    - `iadeYap(db, saleId)`
    - Assert: iade gider kaydı `amount = 1080` (total, brüt değil)
    - Assert: net kasa = 0
    - Tutar iskontosu testi: `{type:'amount', value:200}` → `total = 1000`, iade = 1000
    - _Bug_Condition: `isBugCondition(X)` → `discount > 0 AND iade sonrası kasadan brüt tutar düşüldü`_
    - _Requirements: 1.5, 2.5_

  - [x] 3.6 Grup 6: Stok sıfırken iade testleri
    - Ürün oluştur (stock: 1)
    - `satisYap(db, [{ürün,1}], 'nakit')` → stock = 0
    - Assert: `product.stock = 0`
    - `iadeYap(db, saleId)` → stock = 1 olmalı
    - Assert: `violations` boş (`negative_stock` tetiklenmemeli)
    - Assert: `product.stock = 1`
    - Assert: StockMovement `type: 'iade', before: 0, after: 1`
    - _Bug_Condition: `isBugCondition(X)` → `product.stock = 0 AND iade yapılıyor AND negative_stock tetiklendi`_
    - _Requirements: 1.6, 2.6_

  - [x] 3.7 Grup 7: Cari CRUD testleri (ekleme/düzenleme/silme)
    - **7a — Duplicate engeli**: `cariEkle(db, {name:'Ahmet'})` başarılı → `cariEkle(db, {name:'Ahmet'})` hata döner; `db.cari.filter(!deleted).length = 1`
    - **7b — Soft-delete**: Bakiyeli cari sil → `cari.deleted = true`; ilişkili satışlar hâlâ mevcut
    - **7c — Düzenleme bakiye koruması**: `cari.balance = 5000` → `cariDuzenle(db, id, {phone:'555'})` → `cari.balance = 5000` (değişmedi)
    - **7d — Benzerlik uyarısı**: `cariEkle(db, {name:'Ahmet Yilmaz'})` → `cariEkle(db, {name:'Ahmet Yılmaz'})` → uyarı üretilmeli
    - Assert: `updatedAt` düzenleme sonrası güncellendi
    - Assert: Silinen cari listede görünmez (`deleted: true` filtresi)
    - _Bug_Condition: `isBugCondition(X)` → duplicate cari oluştu VEYA bakiye sıfırlandı VEYA ilişkili kayıtlar kayboldu_
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [x] 3.8 Grup 8: Satış fiyat ve iskonto düzeltmesi testleri
    - **8a — Fiyat değişikliği kâr hesabı**: `items=[{qty:2, unitPrice:1500, cost:800}]` → `profit = (1500-800)×2 = 1400`
    - **8b — Yüzde iskonto**: `subtotal=2000, discPct=10` → `discountAmount=200, total=1800, profit=(price-cost)×qty-200`
    - **8c — Tutar iskontosu**: `subtotal=2000, discAmount=300` → `total=1700`
    - Assert: `total = subtotal - discountAmount`
    - Assert: `profit = (unitPrice - cost) × qty - discountAmount`
    - Assert: Negatif toplam oluşturacak iskonto → `zero_amount` ihlali
    - _Bug_Condition: `isBugCondition(X)` → `profit eski fiyatla hesaplandı VEYA total/discountAmount tutarsız`_
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3_

  - [x] 3.9 Grup 9: Kasa ekleme/düzenleme testleri
    - **9a — Sıfır tutar engeli**: `kasaGelirEkle(db, 0, 'nakit')` → `zero_amount` ihlali
    - **9b — Negatif kasa engeli**: Boş kasaya `kasaGiderEkle(db, 500, 'nakit')` → `negative_kasa` ihlali
    - **9c — CariId bağlı kasa kaydı**: `cari.balance=1000` → `kasaGelirEkle(db, 300, 'nakit', cariId)` → `cari.balance=700`
    - Assert: Geçerli gelir kaydı kasa bakiyesini artırır
    - Assert: Geçerli gider kaydı kasa bakiyesini azaltır
    - Assert: `cariId` olmayan kasa kaydı cari tablosuna dokunmaz
    - _Bug_Condition: `isBugCondition(X)` → `amount=0 ile kayıt oluştu VEYA negatif kasaya gider eklendi`_
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2, 12.3_

  - [x] 3.10 Grup 10: Kasa hareketleri soft-delete testleri
    - **10a — Birikimli bakiye**: `gelir(500)` → `gelir(300)` → `gider(200)` → bakiye = 600
    - **10b — Soft-delete cari geri alımı**: `cari.balance=1000` → `kasaGelirEkle(300, cariId)` → `cari.balance=700` → `kasaKayitSil(entryId)` → `cari.balance=1000`
    - **10c — Silinen kayıt bakiye dışı**: `gelir(500)` → sil → bakiye = 0
    - Assert: `deleted: true` kayıtlar bakiye hesabına dahil edilmez
    - Assert: Farklı kasaların (nakit, banka) bakiyeleri bağımsız hesaplanır
    - _Bug_Condition: `isBugCondition(X)` → `kasa kaydı silindi AND cari.balance geri alınmadı`_
    - _Requirements: 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 15.1, 15.2, 15.3_

  - [x] 3.11 Grup 11: Stok hareketleri testleri
    - **11a — Giriş before/after**: `product.stock=20` → `stokGiris(db, productId, 10)` → `movement.before=20, movement.after=30, movement.amount=10, product.stock=30`
    - **11b — Çıkış sıfır stok koruması**: `product.stock=0` → `stokCikis(db, productId, 5)` → `product.stock=0` (negatife düşmez)
    - **11c — Düzeltme amount hesabı**: `product.stock=15` → `stokDuzeltme(db, productId, 8)` → `movement.amount=-7, movement.before=15, movement.after=8, product.stock=8`
    - **11d — Ürün stoğu ile hareket tutarlılığı**: `product.stock = movement.after` her zaman
    - Assert: StockMovement `type` alanı doğru: `'giris'`, `'cikis'`, `'duzeltme'`
    - _Bug_Condition: `isBugCondition(X)` → `before/after yer değiştirdi VEYA amount yanlış işaretlendi VEYA product.stock ≠ movement.after`_
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 17.1, 17.2, 17.3, 17.4, 18.1, 18.2, 18.3_

  - [x] 3.12 Grup 12: Satış tam yaşam döngüsü testleri
    - **12a — Kısmi tahsilat tutarlılığı**: `sale.total=1200, tahsilat=400` → `kasa geliri=400, cari.balance artışı=800, 400+800=1200`
    - **12b — Ek tahsilat**: `cari.balance=800` → `tahsilatYap(db, cariId, 800, 'nakit')` → `kasa+800, cari.balance=0`
    - **12c — Kısmi tahsilatlı iade**: `satış:[kasa+400, cari+800]` → `iade:[kasa-400, cari-800]` → `cari.balance=0, net kasa=0`
    - **12d — İptal sonrası çift iade engeli**: `iptalYap(db, saleId)` → `iadeYap(db, saleId)` → engellenmeli (`status !== 'tamamlandi'`)
    - **12e — İptal stok geri yükleme**: `satış: stock=10→9` → `iptal: stock=9→10`
    - Assert: `sale.status = 'iptal'` iptal sonrası
    - Assert: Tam nakit satışta cari.balance değişmez
    - Assert: Tam cari satışta kasaya giriş yok
    - _Bug_Condition: `isBugCondition(X)` → `kasa+cari toplamı ≠ sale.total VEYA iade sonrası bakiyeler sıfırlanmadı VEYA çift iade oluştu`_
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 20.1, 20.2, 20.3, 20.4, 20.5, 21.1, 21.2, 21.3, 21.4_

  - [x] 3.13 Property-based testler — 4 global invariant
    - **P1 — Kasa Bakiyesi Tutarlılığı**: `fc.property(fc.array(fc.record({type, amount})), entries => computeKasaBalance(entries) = Σ(gelir) - Σ(gider) where !deleted)`
    - **P2 — Stok Negatife Düşmez**: `fc.property(fc.integer({min:0,max:200}), fc.integer({min:1,max:300}), (stock, qty) => qty > stock ? negative_stock ihlali : violations boş)`
    - **P3 — Satış Toplam Tutarlılığı**: `fc.property(qty, price, cost, discPct => total = subtotal*(1-discPct/100) AND profit = (price-cost)*qty - discountAmount AND total >= 0)`
    - **P4 — İade Sonrası Sıfır Net**: `fc.property(qty, price => satisYap → iadeYap → net kasa = 0)`
    - fast-check import et: `import * as fc from 'fast-check'`
    - Her property en az 100 örnek üretmeli (fast-check default)
    - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.2, 3.5_

  - [x] 3.14 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Nakit Satış → İade Net Kasa Sıfır
    - **IMPORTANT**: Görev 1'deki AYNI testi yeniden çalıştır — yeni test yazma
    - Görev 1'deki test beklenen davranışı kodlar
    - Bu test geçtiğinde beklenen davranışın sağlandığı doğrulanır
    - Grup 1 exploration testini çalıştır
    - **EXPECTED OUTCOME**: Test GEÇER (bug düzeltildi)
    - _Requirements: 2.1_

  - [x] 3.15 Verify preservation tests still pass
    - **Property 2: Preservation** - Normal Nakit Satış ve Stok Kuralları Korunur
    - **IMPORTANT**: Görev 2'deki AYNI testleri yeniden çalıştır — yeni test yazma
    - Görev 2'deki preservation testlerini çalıştır
    - **EXPECTED OUTCOME**: Testler GEÇER (regresyon yok)
    - Tüm testlerin hâlâ geçtiğini doğrula

- [x] 4. Checkpoint — Tüm testlerin geçtiğini doğrula
  - `npx vitest run src/lib/kapsamli-senaryo.test.ts` komutunu çalıştır
  - **SONUÇ**: 55/55 test geçti ✓
  - Grup 2–12 tüm senaryo testleri geçti (Grup 1 testleri Görev 1 ve 3.1 kapsamında dahil edildi)
  - 4 property-based test (P1–P4) geçti
  - Başarısız test yok
  - Süre: ~2.8s
