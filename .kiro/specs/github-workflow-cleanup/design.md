# GitHub Branch Stratejisi ve Workflow Temizliği — Bugfix Design

## Overview

Bu bugfix, Parspel projesinin GitHub Actions workflow yapılandırmalarının gerçek branch stratejisini (`dev`-only) yansıtmamasından kaynaklanan tutarsızlıkları giderir.

**Sorun**: `quality-gate.yml` gereksiz yere `main` branch'ini ve `pull_request` trigger'larını dinlemekte; `block-new-branch.yml` ise `main` branch'ini koruma kapsamı dışında bırakmaktadır. Ek olarak remote'da stale Copilot branch referansları bulunmaktadır.

**Etki**: Gereksiz CI dakikası tüketimi, tutarsız branch koruma politikası ve repo görünümünde kirlilik.

**Fix Stratejisi**: `quality-gate.yml`'den `main` push trigger'ı ve `pull_request` bloğu kaldırılır; `block-new-branch.yml` mesajı `main` dahil tüm yetkisiz branch'leri kapsayacak şekilde güncellenir; stale remote referanslar `git remote prune origin` ile temizlenir.

---

## Glossary

- **Bug_Condition (C)**: Workflow yapılandırmalarının `dev`-only stratejisini yansıtmadığı durum — `quality-gate.yml`'de `main` push veya `pull_request` trigger'ı aktif olduğunda ya da `block-new-branch.yml` `main`'i engelleme kapsamı dışında bıraktığında
- **Property (P)**: Düzeltilmiş workflow'ların beklenen davranışı — yalnızca `dev` push'unda CI çalışır, `dev` dışındaki tüm branch'ler (`main` dahil) otomatik silinir
- **Preservation**: `dev` push'unda `deploy.yml` ve `quality-gate.yml`'nin çalışmaya devam etmesi; `block-new-branch.yml`'nin `dev` dışı branch'leri silme davranışının korunması
- **quality-gate.yml**: `.github/workflows/quality-gate.yml` — typecheck, unit test ve build adımlarını çalıştıran CI workflow'u
- **block-new-branch.yml**: `.github/workflows/block-new-branch.yml` — `dev` dışında oluşturulan branch'leri otomatik silen workflow
- **deploy.yml**: `.github/workflows/deploy.yml` — `dev` push'unda GitHub Pages'e deploy eden workflow (değişmeyecek)
- **stale remote ref**: Remote'da silinmiş ama yerel git'te hâlâ izlenen branch referansı
- **WorkflowTriggerConfig**: Bir workflow dosyasının `on:` bloğundaki tetikleyici yapılandırması

---

## Bug Details

### Bug Condition

Bug, GitHub Actions workflow yapılandırmaları `dev`-only branch stratejisini yansıtmadığında ortaya çıkar. Dört ayrı alt koşul mevcuttur:

1. `quality-gate.yml` `push.branches` listesinde `main` bulunduğunda
2. `quality-gate.yml`'de `pull_request` trigger bloğu aktif olduğunda
3. `block-new-branch.yml`'nin `if` koşulu `main` branch'ini dışlamadığında (mevcut koşul `!= 'dev'` olduğundan `main` teorik olarak kapsanıyor; ancak mesaj ve davranış doğrulanmamış)
4. Remote'da stale Copilot branch referansları bulunduğunda

**Formal Specification:**

```
FUNCTION isBugCondition(X)
  INPUT: X of type WorkflowTriggerConfig
  OUTPUT: boolean

  RETURN (
    X.qualityGate.push.branches CONTAINS 'main'
    OR X.qualityGate.triggers CONTAINS 'pull_request'
    OR X.blockNewBranch.message DOES_NOT_MENTION 'main'
    OR X.remoteRefs CONTAINS_ANY ['copilot/update-references-in-docs',
                                   'copilot/block-new-branch-creation',
                                   'copilot/fix-build-error',
                                   'copilot/update-dependency-version']
  )
END FUNCTION
```

### Examples

- **Örnek 1** — `main`'e push yapıldığında: `quality-gate.yml` tetiklenir ve typecheck + test + build çalışır. Beklenen: hiçbir şey çalışmamalı.
- **Örnek 2** — Herhangi bir branch'e PR açıldığında: `quality-gate.yml` `pull_request` trigger'ı nedeniyle tetiklenir. Beklenen: `block-new-branch.yml` zaten yeni branch'i sileceğinden bu trigger anlamsız; tetiklenmemeli.
- **Örnek 3** — `main` branch'i oluşturulduğunda: `block-new-branch.yml` `main`'i silmeli. Mevcut `if: github.ref_name != 'dev'` koşulu `main`'i kapsıyor ancak mesaj bunu açıkça belirtmiyor; doğrulama gerekli.
- **Edge Case** — `git remote prune origin` çalıştırılmadan `git branch -r` komutu çalıştırıldığında: Silinmiş `copilot/*` branch'leri hâlâ listelenir.

---

## Expected Behavior

### Preservation Requirements

**Değişmemesi Gereken Davranışlar:**
- `dev` branch'ine push yapıldığında `deploy.yml` GitHub Pages'e deploy etmeye devam etmeli
- `dev` branch'ine push yapıldığında `quality-gate.yml` typecheck, unit test ve build adımlarını çalıştırmaya devam etmeli
- `dev` dışında bir branch oluşturulduğunda `block-new-branch.yml` bu branch'i silmeye devam etmeli
- İki farklı bilgisayardan `dev`'e yapılan doğrudan push'lar çakışmasız çalışmaya devam etmeli

**Kapsam:**
`dev` branch'ine yapılan push'lar ve `dev` dışı branch oluşturma olayları bu fix'ten etkilenmemeli. Şunlar tamamen korunmalı:
- `dev` push → deploy pipeline
- `dev` push → quality gate pipeline
- `dev` dışı branch oluşturma → otomatik silme

---

## Hypothesized Root Cause

Bug analizine göre en olası nedenler:

1. **Eksik Strateji Güncellemesi**: `quality-gate.yml` başlangıçta `main` + `dev` çift-branch stratejisi için yapılandırılmış; `dev`-only stratejisine geçildiğinde workflow güncellenmemiş.
   - `push.branches: [main, dev]` satırı hâlâ mevcut
   - `pull_request` trigger bloğu kaldırılmamış

2. **`block-new-branch.yml` Mesaj Eksikliği**: `if: github.ref_name != 'dev'` koşulu teknik olarak `main`'i de kapsıyor ancak mesaj metni yalnızca genel bir uyarı içeriyor; `main`'in de engellendiği açıkça belirtilmiyor. Bu, operasyonel belirsizliğe yol açıyor.

3. **Stale Remote Referanslar**: Copilot tarafından oluşturulan ve sonradan remote'dan silinen branch'ler (`copilot/fix-build-error`, `copilot/update-dependency-version`, `copilot/update-references-in-docs`, `copilot/block-new-branch-creation`) yerel git'te izlenmeye devam ediyor. `git remote prune origin` hiç çalıştırılmamış.

4. **`main` Branch Varlığı**: Remote'da `main` branch'i hâlâ mevcut ve `dev`'den 6 commit geride. Kullanıcı Seçenek A'yı seçti: `main` silinecek, yalnızca `dev` kalacak.

---

## Correctness Properties

Property 1: Bug Condition — Workflow Yapılandırmaları Dev-Only Stratejiyi Yansıtmalı

_For any_ workflow yapılandırması X'te isBugCondition(X) doğru olduğunda (yani `quality-gate.yml`'de `main` push veya `pull_request` trigger'ı aktif olduğunda, ya da stale remote referanslar bulunduğunda), düzeltilmiş yapılandırma F'(X) SHALL şu sonuçları üretmeli:
- `quality-gate.yml` yalnızca `push: branches: [dev]` trigger'ına sahip olmalı
- `pull_request` trigger bloğu tamamen kaldırılmış olmalı
- `block-new-branch.yml` mesajı `main` dahil tüm yetkisiz branch'lerin engellendiğini açıkça belirtmeli
- `git remote prune origin` çalıştırıldıktan sonra stale Copilot referansları yerel git'te bulunmamalı

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation — Dev Push Davranışı Değişmemeli

_For any_ workflow tetikleyici olayı X'te isBugCondition(X) yanlış olduğunda (yani `dev` branch'ine push yapıldığında veya `dev` dışı branch oluşturulduğunda), düzeltilmiş F'(X) SHALL orijinal F(X) ile aynı sonucu üretmeli:
- `dev` push → `deploy.yml` çalışır (değişmez)
- `dev` push → `quality-gate.yml` çalışır (değişmez)
- `dev` dışı branch oluşturma → `block-new-branch.yml` siler (değişmez)

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

Kök neden analizimizin doğru olduğunu varsayarak:

**Dosya 1**: `.github/workflows/quality-gate.yml`

**Değişiklikler**:
1. **`pull_request` Trigger Bloğunu Kaldır**: `on:` bloğundan `pull_request` bölümünü tamamen sil
2. **`push.branches` Güncelle**: `[main, dev]` → `[dev]` olarak değiştir

Mevcut:
```yaml
on:
  pull_request:
    branches:
      - "**"
  push:
    branches:
      - main
      - dev
```

Hedef:
```yaml
on:
  push:
    branches:
      - dev
```

---

**Dosya 2**: `.github/workflows/block-new-branch.yml`

**Değişiklikler**:
1. **Mesajı Güncelle**: `main` dahil tüm yetkisiz branch'lerin engellendiğini açıkça belirten Türkçe mesaj ekle

Mevcut mesaj:
```
echo "⛔ Branch '${{ github.ref_name }}' creation is not allowed."
echo "Tüm değişiklikler doğrudan 'dev' branch'ine push edilmelidir."
```

Hedef mesaj:
```
echo "⛔ '${{ github.ref_name }}' branch'i oluşturmak yasaktır."
echo "Bu proje yalnızca 'dev' branch'ini kullanır."
echo "'main' dahil tüm diğer branch'ler otomatik olarak silinir."
echo "Tüm değişiklikler doğrudan 'dev' branch'ine push edilmelidir."
```

---

**Komut 3**: Stale Remote Referans Temizliği

```bash
git remote prune origin
```

Bu komut şu stale referansları temizler:
- `origin/copilot/fix-build-error`
- `origin/copilot/update-dependency-version`
- `origin/copilot/update-references-in-docs`
- `origin/copilot/block-new-branch-creation`

---

**Komut 4**: `main` Branch Silme (Seçenek A — Kullanıcı Onaylı)

```bash
# Remote'dan main'i sil
git push origin --delete main

# Yerel main varsa sil
git branch -d main 2>/dev/null || true
```

---

## Testing Strategy

### Validation Approach

Test stratejisi iki aşamalıdır: önce mevcut (hatalı) yapılandırmada bug'ı gösteren counterexample'lar üretilir, ardından fix'in doğru çalıştığı ve mevcut davranışın korunduğu doğrulanır.

### Exploratory Bug Condition Checking

**Hedef**: Fix uygulanmadan önce bug'ı gösteren counterexample'ları ortaya çıkar. Kök neden analizini doğrula veya çürüt.

**Test Planı**: Mevcut workflow YAML dosyalarını parse ederek trigger yapılandırmalarını doğrula. Unfixed kod üzerinde çalıştır.

**Test Cases**:
1. **Quality Gate Main Trigger Testi**: `quality-gate.yml` parse edildiğinde `push.branches` listesinde `main` bulunduğunu doğrula (unfixed kodda başarısız olmalı — yani `main` hâlâ var)
2. **Pull Request Trigger Testi**: `quality-gate.yml`'de `pull_request` trigger bloğunun varlığını doğrula (unfixed kodda başarısız olmalı — yani `pull_request` hâlâ var)
3. **Block Branch Mesaj Testi**: `block-new-branch.yml` mesajında `main` kelimesinin geçip geçmediğini kontrol et (unfixed kodda başarısız olmalı — mesaj `main`'i açıkça belirtmiyor)
4. **Stale Ref Testi**: `git remote prune origin --dry-run` çıktısında stale referansların listelendiğini doğrula

**Expected Counterexamples**:
- `quality-gate.yml` `push.branches` listesinde `main` bulunur
- `quality-gate.yml`'de `pull_request` trigger bloğu aktiftir
- `block-new-branch.yml` mesajı `main`'i açıkça engellenmiş olarak belirtmez

### Fix Checking

**Hedef**: Bug koşulunun geçerli olduğu tüm girdiler için düzeltilmiş fonksiyonun beklenen davranışı ürettiğini doğrula.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := applyWorkflowFix(X)
  ASSERT result.qualityGate.push.branches = ['dev']
  AND result.qualityGate.triggers = ['push']
  AND result.blockNewBranch.message CONTAINS 'main'
  AND result.remoteRefs CONTAINS_NO stale_copilot_branches
END FOR
```

### Preservation Checking

**Hedef**: Bug koşulunun geçerli olmadığı tüm girdiler için düzeltilmiş fonksiyonun orijinal fonksiyonla aynı sonucu ürettiğini doğrula.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // dev push → deploy.yml çalışır
  // dev push → quality-gate.yml çalışır
  // dev dışı branch oluşturma → block-new-branch.yml siler
END FOR
```

**Testing Approach**: Workflow YAML dosyaları için property-based testing önerilir çünkü:
- Farklı branch adı kombinasyonlarını otomatik olarak üretir
- Manuel testlerin kaçırabileceği edge case'leri yakalar
- Tüm non-buggy girdiler için davranışın değişmediğine dair güçlü garanti sağlar

**Test Cases**:
1. **Deploy Preservation**: `deploy.yml`'nin `dev` push trigger'ını hâlâ içerdiğini doğrula
2. **Quality Gate Dev Trigger Preservation**: Fix sonrası `quality-gate.yml`'nin `dev` push'unda çalışmaya devam ettiğini doğrula
3. **Block Branch Dev-Dışı Preservation**: `block-new-branch.yml`'nin `if: github.ref_name != 'dev'` koşulunu hâlâ içerdiğini doğrula
4. **Quality Gate Steps Preservation**: Fix sonrası typecheck, test ve build adımlarının değişmediğini doğrula

### Unit Tests

- `quality-gate.yml` parse edilerek `on:` bloğunun yalnızca `push: branches: [dev]` içerdiğini doğrula
- `block-new-branch.yml` parse edilerek `if` koşulunun `github.ref_name != 'dev'` olduğunu doğrula
- `block-new-branch.yml` mesajının `main` kelimesini içerdiğini doğrula
- `deploy.yml`'nin değişmediğini (checksum veya içerik karşılaştırması ile) doğrula

### Property-Based Tests

- Rastgele branch adları üret (`main`, `feature/*`, `hotfix/*`, `release/*` vb.) ve `block-new-branch.yml`'nin `if` koşulunun bunların tümünü `dev` dışında değerlendirdiğini doğrula
- Rastgele workflow trigger yapılandırmaları üret ve fix sonrası `quality-gate.yml`'nin yalnızca `dev` push'una tepki verdiğini doğrula
- `dev` push senaryoları üret ve tüm senaryolarda `deploy.yml` + `quality-gate.yml`'nin tetiklendiğini doğrula

### Integration Tests

- `dev`'e push simülasyonu: `deploy.yml` ve `quality-gate.yml` tetiklenmeli, `block-new-branch.yml` tetiklenmemeli
- `main`'e push simülasyonu: Hiçbir workflow tetiklenmemeli (çünkü `main` artık var olmayacak)
- `feature/test` branch oluşturma simülasyonu: `block-new-branch.yml` tetiklenmeli ve branch silinmeli
- `git remote prune origin` sonrası `git branch -r` çıktısında stale Copilot referanslarının bulunmadığını doğrula
