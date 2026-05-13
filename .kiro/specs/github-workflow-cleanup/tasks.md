# Implementation Plan

- [ ] 1. Bug koşulu keşif testi yaz (fix öncesi)
  - **Property 1: Bug Condition** - Workflow Yapılandırmaları Dev-Only Stratejiyi Yansıtmıyor
  - **CRITICAL**: Bu test UNFIXED kodda BAŞARISIZ olmalı — başarısızlık bug'ın var olduğunu kanıtlar
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: Bu test beklenen davranışı kodlar — fix sonrası geçtiğinde düzeltmenin doğru olduğunu doğrular
  - **GOAL**: Bug'ın varlığını gösteren counterexample'ları ortaya çıkar
  - **Scoped PBT Approach**: Deterministik bug olduğundan, property'yi somut başarısız durumlara kısıtla:
    - `quality-gate.yml` parse edildiğinde `push.branches` listesinde `main` bulunduğunu doğrula
    - `quality-gate.yml`'de `pull_request` trigger bloğunun varlığını doğrula
    - `block-new-branch.yml` mesajında `main` kelimesinin geçmediğini doğrula
  - Test, YAML dosyalarını parse ederek `isBugCondition(X)` koşulunu kontrol etmeli (design'daki pseudocode'a göre)
  - Unfixed kodda çalıştır — BAŞARISIZLIK bekleniyor (bu doğru — bug'ın var olduğunu kanıtlar)
  - Bulunan counterexample'ları belgele:
    - `quality-gate.yml` `push.branches` listesinde `main` bulunur
    - `quality-gate.yml`'de `pull_request` trigger bloğu aktiftir
    - `block-new-branch.yml` mesajı `main`'i açıkça engellenmiş olarak belirtmez
  - Görevi tamamlandı olarak işaretle: test yazıldığında, çalıştırıldığında ve başarısızlık belgelendiğinde
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Preservation property testleri yaz (fix öncesi)
  - **Property 2: Preservation** - Dev Push Davranışı Değişmemeli
  - **IMPORTANT**: Observation-first metodolojisini takip et
  - Unfixed kodda `dev` push senaryoları için mevcut davranışı gözlemle:
    - `deploy.yml` parse edildiğinde `push.branches: [dev]` trigger'ını içerdiğini gözlemle
    - `quality-gate.yml` parse edildiğinde `push.branches` listesinde `dev` bulunduğunu gözlemle
    - `block-new-branch.yml` parse edildiğinde `if: github.ref_name != 'dev'` koşulunu içerdiğini gözlemle
    - `quality-gate.yml` adımlarının (typecheck, test, build) değişmediğini gözlemle
  - Gözlemlenen davranışı yakalayan property-based testler yaz:
    - Rastgele branch adları üret (`main`, `feature/*`, `hotfix/*`, `release/*` vb.) ve `block-new-branch.yml`'nin `if` koşulunun bunların tümünü `dev` dışında değerlendirdiğini doğrula
    - `dev` push senaryoları üret ve `deploy.yml` + `quality-gate.yml`'nin tetiklendiğini doğrula
  - Unfixed kodda testleri çalıştır — GEÇMESI bekleniyor (bu baseline davranışı doğrular)
  - Görevi tamamlandı olarak işaretle: testler yazıldığında, çalıştırıldığında ve unfixed kodda geçtiğinde
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. GitHub workflow yapılandırmalarını düzelt

  - [ ] 3.1 `quality-gate.yml` trigger bloğunu güncelle
    - `on:` bloğundan `pull_request` bölümünü tamamen kaldır
    - `push.branches: [main, dev]` → `push.branches: [dev]` olarak değiştir
    - Hedef yapılandırma:
      ```yaml
      on:
        push:
          branches:
            - dev
      ```
    - `jobs:` bloğu ve tüm adımlar (typecheck, test, build) değişmeden kalmalı
    - _Bug_Condition: isBugCondition(X) where X.qualityGate.push.branches CONTAINS 'main' OR X.qualityGate.triggers CONTAINS 'pull_request'_
    - _Expected_Behavior: result.qualityGate.push.branches = ['dev'] AND result.qualityGate.triggers = ['push']_
    - _Preservation: dev push → quality-gate.yml çalışmaya devam eder; typecheck, test, build adımları değişmez_
    - _Requirements: 2.1, 2.3_

  - [ ] 3.2 `block-new-branch.yml` mesajını güncelle
    - Mevcut mesajı `main` dahil tüm yetkisiz branch'lerin engellendiğini açıkça belirten Türkçe mesajla değiştir
    - Hedef mesaj:
      ```
      echo "⛔ '${{ github.ref_name }}' branch'i oluşturmak yasaktır."
      echo "Bu proje yalnızca 'dev' branch'ini kullanır."
      echo "'main' dahil tüm diğer branch'ler otomatik olarak silinir."
      echo "Tüm değişiklikler doğrudan 'dev' branch'ine push edilmelidir."
      ```
    - `if: github.ref_type == 'branch' && github.ref_name != 'dev'` koşulu değişmeden kalmalı
    - `gh api --method DELETE` silme komutu değişmeden kalmalı
    - _Bug_Condition: isBugCondition(X) where X.blockNewBranch.message DOES_NOT_MENTION 'main'_
    - _Expected_Behavior: result.blockNewBranch.message CONTAINS 'main'_
    - _Preservation: dev dışı branch oluşturma → block-new-branch.yml silmeye devam eder_
    - _Requirements: 2.2_

  - [ ] 3.3 Stale remote referansları temizle
    - `git remote prune origin` komutunu çalıştır
    - Temizlenecek stale referanslar:
      - `origin/copilot/fix-build-error`
      - `origin/copilot/update-dependency-version`
      - `origin/copilot/update-references-in-docs`
      - `origin/copilot/block-new-branch-creation`
    - Temizlik sonrası `git branch -r` çıktısında bu referansların bulunmadığını doğrula
    - _Bug_Condition: isBugCondition(X) where X.remoteRefs CONTAINS_ANY stale_copilot_branches_
    - _Expected_Behavior: result.remoteRefs CONTAINS_NO stale_copilot_branches_
    - _Requirements: 2.4_

  - [ ] 3.4 `main` branch'ini sil (Kullanıcı Onaylı — Seçenek A)
    - Remote'dan `main` branch'ini sil:
      ```bash
      git push origin --delete main
      ```
    - Yerel `main` branch varsa sil:
      ```bash
      git branch -d main 2>/dev/null || true
      ```
    - **NOT**: Bu işlem geri alınamaz. Kullanıcı Seçenek A'yı onaylamıştır.
    - _Requirements: 2.1, 2.2_

  - [ ] 3.5 Bug koşulu keşif testinin artık geçtiğini doğrula
    - **Property 1: Expected Behavior** - Workflow Yapılandırmaları Dev-Only Stratejiyi Yansıtıyor
    - **IMPORTANT**: Görev 1'deki AYNI testi yeniden çalıştır — yeni test yazma
    - Görev 1'deki test beklenen davranışı kodlar
    - Bu test geçtiğinde, beklenen davranışın sağlandığı doğrulanmış olur
    - Görev 1'deki bug koşulu keşif testini çalıştır
    - **EXPECTED OUTCOME**: Test GEÇER (bug'ın düzeltildiğini doğrular)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.6 Preservation testlerinin hâlâ geçtiğini doğrula
    - **Property 2: Preservation** - Dev Push Davranışı Değişmedi
    - **IMPORTANT**: Görev 2'deki AYNI testleri yeniden çalıştır — yeni test yazma
    - Görev 2'deki preservation property testlerini çalıştır
    - **EXPECTED OUTCOME**: Testler GEÇER (regresyon olmadığını doğrular)
    - Fix sonrası tüm testlerin geçtiğini doğrula (regresyon yok)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4. Checkpoint — Tüm testlerin geçtiğinden emin ol
  - Tüm testlerin geçtiğinden emin ol; sorular çıkarsa kullanıcıya sor.
  - `quality-gate.yml` yalnızca `push: branches: [dev]` trigger'ına sahip
  - `pull_request` trigger bloğu tamamen kaldırılmış
  - `block-new-branch.yml` mesajı `main`'i açıkça belirtiyor
  - Stale Copilot remote referansları temizlenmiş
  - `main` branch'i remote'dan silinmiş
  - `deploy.yml` değişmemiş (preservation doğrulandı)
