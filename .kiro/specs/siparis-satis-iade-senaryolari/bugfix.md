# Bugfix Requirements Document

## Introduction

Soba yönetim uygulamasında sipariş, satış ve iade akışlarında kasa bakiyesi, cari bakiyesi ve stok değerlerinin doğru güncellenmediğine dair şüpheler mevcuttur. Bu belge, söz konusu akışlardaki mevcut (hatalı olabilecek) davranışları, beklenen doğru davranışları ve değişmemesi gereken mevcut davranışları tanımlar.

Test edilecek on iki kritik senaryo grubu:
1. Satış → İade akışında kasa bakiyesi
2. Cari satış → kısmi tahsilat → iade akışında cari bakiyesi
3. Sipariş (Order) tamamlandığında stok artışı
4. Çoklu ürünlü satış → kısmi iade
5. İskontolu satış → iade sonrası kasa dengesi
6. Stok sıfırken iade (stok geri gelme)
7. Cari CRUD — ekleme/düzenleme/silme bütünlüğü
8. Satış fiyat ve iskonto düzeltmesi
9. Kasa ekleme/düzenleme — manuel gelir/gider girişleri
10. Kasa hareketleri — gelir/gider sırası ve soft-delete geri alımı
11. Stok hareketleri — giriş/çıkış/düzeltme türleri ve before/after takibi
12. Satış hareketleri — tam yaşam döngüsü (oluşturma → kısmi ödeme → tahsilat → iade/iptal)

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN nakit satış yapılıp ardından iade edildiğinde THEN sistemin kasa bakiyesi satış tutarı kadar azalmayabilir (iade gider kaydı eksik veya yanlış kasaya yazılabilir)

1.2 WHEN cari satışta kısmi tahsilat yapılıp ardından iade edildiğinde THEN sistemin cari bakiyesi tam olarak sıfırlanmayabilir (yalnızca cariye yazılan kısım düşülür, tahsil edilen kısım hesaba katılmayabilir)

1.3 WHEN sipariş (Order) durumu "tamamlandi" olarak işaretlendiğinde THEN sistemin ürün stoğu siparişteki kalem miktarları kadar artmayabilir

1.4 WHEN çoklu ürünlü satışta yalnızca bir ürün iade edildiğinde THEN sistemin yalnızca iade edilen ürünün stoğunu geri yükleyip diğer ürünlere dokunmaması gerekirken tüm satış iade edilebilir

1.5 WHEN iskontolu satış iade edildiğinde THEN sistemin kasadan düşeceği tutar iskonto sonrası ödenen tutar yerine brüt tutar olabilir

1.6 WHEN stok sıfırken iade yapıldığında THEN sistemin stoğu negatif_stok kuralını tetiklemeden geri yükleyip yüklemediği belirsizdir

### Expected Behavior (Correct)

2.1 WHEN nakit satış yapılıp ardından iade edildiğinde THEN sistem SHALL satışta kasaya giren tutarın tamamını iade gideri olarak aynı kasaya yazmalı ve net kasa bakiyesi sıfır olmalıdır

2.2 WHEN cari satışta kısmi tahsilat yapılıp ardından iade edildiğinde THEN sistem SHALL cari bakiyesini tam olarak sıfırlamalıdır (tahsil edilen kısım kasadan gider, cariye yazılan kısım cari bakiyesinden düşülür)

2.3 WHEN sipariş (Order) durumu "tamamlandi" olarak işaretlendiğinde THEN sistem SHALL her sipariş kalemi için ürün stoğunu `qty` kadar artırmalıdır

2.4 WHEN çoklu ürünlü satış iade edildiğinde THEN sistem SHALL satıştaki tüm kalemlerin stoğunu geri yüklemeli, kasa bakiyesi satışta tahsil edilen tutarın tamamı kadar azalmalıdır

2.5 WHEN iskontolu satış iade edildiğinde THEN sistem SHALL kasadan yalnızca fiilen tahsil edilen tutarı (iskonto sonrası toplam) düşmelidir

2.6 WHEN stok sıfırken iade yapıldığında THEN sistem SHALL stoğu 0'dan 1'e (veya iade miktarı kadar) yükseltmeli ve negative_stock kuralı tetiklenmemelidir

### Unchanged Behavior (Regression Prevention)

3.1 WHEN stok yeterli olduğunda normal nakit satış yapıldığında THEN sistem SHALL CONTINUE TO stoku azaltmaya, kasaya gelir yazmaya ve satış kaydı oluşturmaya devam etmelidir

3.2 WHEN stok yetersiz olduğunda satış yapılmaya çalışıldığında THEN sistem SHALL CONTINUE TO negative_stock kuralı ile işlemi engellemeye devam etmelidir

3.3 WHEN tam cari satış yapıldığında (tahsilat yok) THEN sistem SHALL CONTINUE TO kasaya hiçbir giriş yazmamaya ve cari bakiyesini satış tutarı kadar artırmaya devam etmelidir

3.4 WHEN sıfır veya negatif tutarlı işlem denendiğinde THEN sistem SHALL CONTINUE TO zero_amount kuralı ile işlemi engellemeye devam etmelidir

3.5 WHEN ardışık satışlar yapıldığında THEN sistem SHALL CONTINUE TO her satışta stok ve kasa bakiyesini doğru birikimli olarak güncellemeye devam etmelidir

---

## Bug Analysis — Cari CRUD (Ekleme / Düzenleme / Silme)

### Current Behavior (Defect)

4.1 WHEN aynı isimde (tam eşleşme) ikinci bir cari eklenmeye çalışıldığında THEN sistemin kaydı engelleyip engellemediği belirsizdir; mükerrer cari oluşabilir

4.2 WHEN bakiyesi sıfırdan farklı olan bir cari silindiğinde THEN sistemin ilişkili satış ve kasa kayıtlarını koruyup korumadığı belirsizdir; geçmiş kayıtlar kaybolabilir

4.3 WHEN mevcut bir carinin adı düzenlendiğinde THEN sistemin cari bakiyesini ve ilişkili kayıtları olduğu gibi koruyup korumadığı belirsizdir; bakiye sıfırlanabilir

4.4 WHEN benzer isimde (≥ %70 benzerlik) bir cari eklenmeye çalışıldığında THEN sistemin kullanıcıyı uyarmadan kaydı kabul etmesi mümkündür

### Expected Behavior (Correct)

5.1 WHEN aynı isimde (tam eşleşme) ikinci bir cari eklenmeye çalışıldığında THEN sistem SHALL kaydı engellemeli ve "zaten var" hatası göstermelidir

5.2 WHEN bakiyesi sıfırdan farklı olan bir cari silindiğinde THEN sistem SHALL carileri soft-delete ile gizlemeli (deleted: true), ilişkili satış ve kasa kayıtlarını korumalıdır

5.3 WHEN mevcut bir carinin adı düzenlendiğinde THEN sistem SHALL yalnızca ad ve iletişim bilgilerini güncellemeli, bakiye ve ilişkili kayıtlar değişmemelidir

5.4 WHEN benzer isimde (≥ %70 benzerlik) bir cari eklenmeye çalışıldığında THEN sistem SHALL kullanıcıyı uyarmalı ve onay alınmadan kaydı kabul etmemelidir

### Unchanged Behavior (Regression Prevention)

6.1 WHEN benzersiz isimle yeni cari eklendiğinde THEN sistem SHALL CONTINUE TO carileri başlangıç bakiyesi 0 ile oluşturmaya devam etmelidir

6.2 WHEN cari düzenlendiğinde THEN sistem SHALL CONTINUE TO updatedAt alanını güncel ISO zaman damgasıyla güncellemeye devam etmelidir

6.3 WHEN silinen cari listelendiğinde THEN sistem SHALL CONTINUE TO deleted: true olan carileri listeden gizlemeye devam etmelidir

---

## Bug Analysis — Satış Fiyat ve İskonto Düzeltmesi

### Current Behavior (Defect)

7.1 WHEN satış kaydedildikten sonra birim fiyat değiştirildiğinde THEN sistemin kâr hesabını (profit) yeni fiyata göre yeniden hesaplayıp hesaplamadığı belirsizdir; eski maliyet farkı kullanılabilir

7.2 WHEN satışa iskonto uygulandıktan sonra iskonto tutarı değiştirildiğinde THEN sistemin total ve profit alanlarını tutarlı biçimde güncelleyip güncellemediği belirsizdir; total ile discountAmount arasında tutarsızlık oluşabilir

7.3 WHEN yüzde iskonto uygulanıp ardından tutar iskontosu seçildiğinde THEN sistemin discountAmount'u doğru türe göre yeniden hesaplayıp hesaplamadığı belirsizdir

### Expected Behavior (Correct)

8.1 WHEN satış kaydedildikten sonra birim fiyat değiştirildiğinde THEN sistem SHALL profit = (unitPrice - cost) × quantity - discountAmount formülüyle kârı yeniden hesaplamalıdır

8.2 WHEN satışa iskonto uygulandıktan sonra iskonto tutarı değiştirildiğinde THEN sistem SHALL total = subtotal - discountAmount ve profit = subtotal - totalCost - discountAmount değerlerini tutarlı biçimde güncellemelidir

8.3 WHEN yüzde iskonto uygulanıp ardından tutar iskontosu seçildiğinde THEN sistem SHALL discountAmount'u seçilen türe göre (% veya ₺) yeniden hesaplamalı ve total'i buna göre düzeltmelidir

### Unchanged Behavior (Regression Prevention)

9.1 WHEN iskonto sıfır olduğunda THEN sistem SHALL CONTINUE TO total = subtotal hesaplamaya devam etmelidir

9.2 WHEN fiyat düzeltmesi yapılmadığında THEN sistem SHALL CONTINUE TO mevcut satış kaydını değiştirmemeye devam etmelidir

9.3 WHEN negatif veya sıfır toplam oluşacak iskonto girildiğinde THEN sistem SHALL CONTINUE TO zero_amount kuralı ile işlemi engellemeye devam etmelidir

---

## Bug Analysis — Kasa Ekleme ve Düzenleme

### Current Behavior (Defect)

10.1 WHEN manuel gelir girişi yapılırken tutar alanı boş bırakıldığında THEN sistemin kaydı engelleyip engellemediği belirsizdir; sıfır tutarlı kasa kaydı oluşabilir

10.2 WHEN manuel gider girişi yapılırken kasa bakiyesi yetersizse THEN sistemin negative_kasa kuralını tetikleyip tetiklemediği belirsizdir; kasa bakiyesi negatife düşebilir

10.3 WHEN kasa kaydına cariId bağlandığında THEN sistemin cari bakiyesini otomatik olarak düşürüp düşürmediği belirsizdir; cari bakiyesi güncellenmeyebilir

10.4 WHEN ortak_tahsilat kategorisiyle gelir girilirken ortak seçilmediğinde THEN sistemin kaydı engelleyip engellemediği belirsizdir; ortaksız ortak tahsilatı oluşabilir

### Expected Behavior (Correct)

11.1 WHEN manuel gelir girişi yapılırken tutar alanı boş bırakıldığında THEN sistem SHALL kaydı engellemeli ve "Geçerli tutar girin" hatası göstermelidir

11.2 WHEN manuel gider girişi yapılırken kasa bakiyesi yetersizse THEN sistem SHALL negative_kasa kuralını tetiklemeli ve işlemi engellemelidir

11.3 WHEN kasa kaydına cariId bağlandığında THEN sistem SHALL cari bakiyesini kayıt tutarı kadar azaltmalıdır (balance -= amount)

11.4 WHEN ortak_tahsilat kategorisiyle gelir girilirken ortak seçilmediğinde THEN sistem SHALL kaydı engellemeli ve "Ortak seçin" hatası göstermelidir

### Unchanged Behavior (Regression Prevention)

12.1 WHEN geçerli tutarla gelir kaydedildiğinde THEN sistem SHALL CONTINUE TO kasa bakiyesini artırmaya devam etmelidir

12.2 WHEN geçerli tutarla gider kaydedildiğinde THEN sistem SHALL CONTINUE TO kasa bakiyesini azaltmaya devam etmelidir

12.3 WHEN cariId olmadan kasa kaydı eklendiğinde THEN sistem SHALL CONTINUE TO cari tablosuna dokunmamaya devam etmelidir

---

## Bug Analysis — Kasa Hareketleri (Gelir/Gider Sırası ve Soft-Delete Geri Alımı)

### Current Behavior (Defect)

13.1 WHEN ardışık gelir ve gider kayıtları eklendiğinde THEN sistemin kasa bakiyesini her işlem sonrası doğru birikimli olarak hesaplayıp hesaplamadığı belirsizdir; sıra bağımlı hata oluşabilir

13.2 WHEN cariId'li bir kasa kaydı soft-delete ile silindiğinde THEN sistemin cari bakiyesini geri alıp almadığı belirsizdir; cari bakiyesi fazla düşük kalabilir

13.3 WHEN silinen kasa kaydı bakiye hesabına dahil edildiğinde THEN sistemin deleted: true kayıtları filtreleyip filtrelemediği belirsizdir; bakiye yanlış hesaplanabilir

### Expected Behavior (Correct)

14.1 WHEN ardışık gelir ve gider kayıtları eklendiğinde THEN sistem SHALL kasa bakiyesini Σ(gelir) - Σ(gider) formülüyle doğru birikimli olarak hesaplamalıdır (deleted: true kayıtlar hariç)

14.2 WHEN cariId'li bir kasa kaydı soft-delete ile silindiğinde THEN sistem SHALL cari bakiyesini kayıt tutarı kadar geri artırmalıdır (balance += amount)

14.3 WHEN silinen kasa kaydı bakiye hesabına dahil edildiğinde THEN sistem SHALL deleted: true olan kayıtları bakiye hesabından dışlamalıdır

### Unchanged Behavior (Regression Prevention)

15.1 WHEN kasa kaydı silinmediğinde THEN sistem SHALL CONTINUE TO bakiye hesabına dahil etmeye devam etmelidir

15.2 WHEN cariId olmayan kasa kaydı silindiğinde THEN sistem SHALL CONTINUE TO cari tablosuna dokunmamaya devam etmelidir

15.3 WHEN farklı kasalara (nakit, banka) kayıt eklendiğinde THEN sistem SHALL CONTINUE TO her kasanın bakiyesini bağımsız olarak hesaplamaya devam etmelidir

---

## Bug Analysis — Stok Hareketleri (Giriş / Çıkış / Düzeltme)

### Current Behavior (Defect)

16.1 WHEN stok giriş işlemi yapıldığında THEN sistemin StockMovement kaydındaki before ve after değerlerini doğru sırayla (işlem öncesi / sonrası) kaydettiği belirsizdir; before ve after yer değiştirebilir

16.2 WHEN stok çıkış işlemi yapıldığında THEN sistemin mevcut stok 0 iken çıkış yapılmasına izin verip vermediği belirsizdir; stok negatife düşebilir

16.3 WHEN stok düzeltme işlemi yapıldığında THEN sistemin amount alanını (after - before) olarak hesaplayıp hesaplamadığı belirsizdir; amount yanlış işaretlenebilir (pozitif/negatif)

16.4 WHEN stok hareketi kaydedildiğinde THEN sistemin ürün tablosundaki stock değerini de güncelleyip güncellemediği belirsizdir; hareket kaydı ile ürün stoğu arasında tutarsızlık oluşabilir

### Expected Behavior (Correct)

17.1 WHEN stok giriş işlemi yapıldığında THEN sistem SHALL StockMovement kaydında before = işlem öncesi stok, after = before + amount değerlerini doğru kaydetmelidir

17.2 WHEN stok çıkış işlemi yapıldığında THEN sistem SHALL mevcut stok 0 iken çıkış girişimini engellemeli veya after değerini 0 ile sınırlamalıdır

17.3 WHEN stok düzeltme işlemi yapıldığında THEN sistem SHALL amount = after - before (pozitif veya negatif olabilir) olarak hesaplamalı ve ürün stoğunu after değerine eşitlemelidir

17.4 WHEN stok hareketi kaydedildiğinde THEN sistem SHALL ürün tablosundaki stock değerini StockMovement.after ile tutarlı biçimde güncellemelidir

### Unchanged Behavior (Regression Prevention)

18.1 WHEN stok giriş işlemi yapıldığında THEN sistem SHALL CONTINUE TO ürün stoğunu artırmaya devam etmelidir

18.2 WHEN satış yapıldığında THEN sistem SHALL CONTINUE TO type: 'satis' ile stok hareketi kaydetmeye ve stoğu azaltmaya devam etmelidir

18.3 WHEN iade yapıldığında THEN sistem SHALL CONTINUE TO type: 'iade' ile stok hareketi kaydetmeye ve stoğu geri yüklemeye devam etmelidir

---

## Bug Analysis — Satış Hareketleri (Tam Yaşam Döngüsü)

### Current Behavior (Defect)

19.1 WHEN satış oluşturulurken kısmi tahsilat girildiğinde THEN sistemin kalan tutarı cari bakiyesine doğru biçimde yazıp yazmadığı belirsizdir; cari bakiyesi fazla veya eksik artabilir

19.2 WHEN kısmi tahsilatlı satış sonrası ek tahsilat yapıldığında THEN sistemin cari bakiyesini doğru biçimde azaltıp azaltmadığı belirsizdir; bakiye çift düşülebilir veya hiç düşülmeyebilir

19.3 WHEN kısmi tahsilatlı satış iade edildiğinde THEN sistemin hem kasaya yazılan tahsilat tutarını hem de cariye yazılan kalan tutarı doğru biçimde geri alıp almadığı belirsizdir; cari bakiyesi veya kasa bakiyesi hatalı kalabilir

19.4 WHEN satış iptal edildiğinde THEN sistemin satış durumunu 'iptal' olarak işaretleyip stokları geri yükleyip yüklemediği belirsizdir; stok geri yüklenmeyebilir

19.5 WHEN iade veya iptal edilmiş satış tekrar iade/iptal edilmeye çalışıldığında THEN sistemin işlemi engelleyip engellemediği belirsizdir; çift iade oluşabilir

### Expected Behavior (Correct)

20.1 WHEN satış oluşturulurken kısmi tahsilat girildiğinde THEN sistem SHALL tahsil edilen tutarı kasaya gelir olarak yazmalı, kalan tutarı (total - tahsilat) cari bakiyesine eklemeli ve ikisinin toplamı satış totaline eşit olmalıdır

20.2 WHEN kısmi tahsilatlı satış sonrası ek tahsilat yapıldığında THEN sistem SHALL ek tahsilat tutarını kasaya gelir olarak yazmalı ve cari bakiyesini aynı tutar kadar azaltmalıdır

20.3 WHEN kısmi tahsilatlı satış iade edildiğinde THEN sistem SHALL kasaya yazılan tahsilat tutarını iade gideri olarak kasadan düşmeli, cariye yazılan kalan tutarı cari bakiyesinden çıkarmalı ve satış durumunu 'iade' olarak işaretlemelidir

20.4 WHEN satış iptal edildiğinde THEN sistem SHALL satış durumunu 'iptal' olarak işaretlemeli, stokları geri yüklemeli ve tahsil edilen tutarı kasadan gider olarak düşmelidir

20.5 WHEN iade veya iptal edilmiş satış tekrar iade/iptal edilmeye çalışıldığında THEN sistem SHALL işlemi engellemeli; yalnızca status: 'tamamlandi' olan satışlar iade/iptal edilebilmelidir

### Unchanged Behavior (Regression Prevention)

21.1 WHEN tam nakit satış yapıldığında THEN sistem SHALL CONTINUE TO tüm tutarı kasaya gelir olarak yazmaya ve cari bakiyesini değiştirmemeye devam etmelidir

21.2 WHEN tam cari satış yapıldığında (tahsilat yok) THEN sistem SHALL CONTINUE TO kasaya hiçbir giriş yazmamaya ve cari bakiyesini satış tutarı kadar artırmaya devam etmelidir

21.3 WHEN satış tamamlandığında THEN sistem SHALL CONTINUE TO stok hareketi kaydı oluşturmaya ve ürün stoğunu azaltmaya devam etmelidir

21.4 WHEN satış listesi görüntülendiğinde THEN sistem SHALL CONTINUE TO deleted: true olan satışları listeden gizlemeye devam etmelidir
 