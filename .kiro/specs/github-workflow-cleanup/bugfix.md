# Bugfix Gereksinimleri: GitHub Branch Stratejisi ve Workflow Temizliği

## Giriş

Parspel projesi iki farklı bilgisayardan (Copilot + Kiro + VS Code) geliştirilmektedir. Tek aktif branch `dev`'dir; ancak mevcut GitHub Actions workflow yapılandırmaları bu gerçeği yansıtmamaktadır. `quality-gate.yml` gereksiz yere `main` branch'ini ve PR trigger'larını dinlemekte, `block-new-branch.yml` ise `main` branch'ini koruma kapsamı dışında bırakmaktadır. Bu durum gereksiz CI tüketimine, tutarsız koruma politikasına ve stale branch kirliliğine yol açmaktadır.

---

## Bug Analizi

### Mevcut Davranış (Hata)

1.1 WHEN `dev` dışında herhangi bir branch'e (örn. `main`) push yapıldığında THEN `quality-gate.yml` tetiklenir ve gereksiz CI dakikaları tüketilir

1.2 WHEN yeni bir branch oluşturulduğunda ve branch adı `main` olduğunda THEN `block-new-branch.yml` bu branch'i silmez; `main` korumasız kalır

1.3 WHEN `quality-gate.yml` çalıştığında THEN `pull_request: branches: "**"` trigger'ı aktif olduğu için herhangi bir branch'e açılan PR'da da CI tetiklenir; oysa `block-new-branch.yml` zaten yeni branch açılmasını engellediğinden bu trigger anlamsızdır

1.4 WHEN remote'da stale Copilot branch'leri (`copilot/update-references-in-docs`, `copilot/block-new-branch-creation`, `copilot/fix-build-error`, `copilot/update-dependency-version`) bulunduğunda THEN bu branch'ler `git remote prune` yapılmadan temizlenmez ve repo görünümünü kirletir

### Beklenen Davranış (Doğru)

2.1 WHEN `dev` branch'ine push yapıldığında THEN `quality-gate.yml` tetiklenmeli; `main` veya başka herhangi bir branch'e push yapıldığında `quality-gate.yml` tetiklenmemeli

2.2 WHEN yeni bir branch oluşturulduğunda ve branch adı `dev` dışında herhangi bir şey olduğunda (`main` dahil) THEN `block-new-branch.yml` bu branch'i SHALL otomatik olarak silmeli

2.3 WHEN `quality-gate.yml` trigger'ları değerlendirildiğinde THEN `pull_request` trigger'ı SHALL kaldırılmalı; yalnızca `push: branches: [dev]` trigger'ı kalmalı

2.4 WHEN stale remote branch'leri temizlendiğinde THEN `git remote prune origin` komutu çalıştırılmalı ve artık var olmayan remote referansları SHALL yerel git'ten kaldırılmalı

### Değişmemesi Gereken Davranış (Regresyon Önleme)

3.1 WHEN `dev` branch'ine push yapıldığında THEN `deploy.yml` SHALL CONTINUE TO GitHub Pages'e deploy etmeye devam etmeli (mevcut davranış korunmalı)

3.2 WHEN `dev` branch'ine push yapıldığında THEN `quality-gate.yml` SHALL CONTINUE TO typecheck, unit test ve build adımlarını çalıştırmaya devam etmeli

3.3 WHEN `dev` dışında bir branch oluşturulduğunda THEN `block-new-branch.yml` SHALL CONTINUE TO bu branch'i silmeye devam etmeli (mevcut `dev` dışı engelleme davranışı korunmalı)

3.4 WHEN `dev` branch'i üzerinde çalışıldığında THEN iki farklı bilgisayardan yapılan doğrudan push'lar SHALL CONTINUE TO çakışmasız çalışmaya devam etmeli

---

## Bug Koşulu Türetmesi

### Bug Koşul Fonksiyonu

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type WorkflowTriggerConfig
  OUTPUT: boolean

  // Hata koşulu: workflow'lar dev-only stratejisini yansıtmıyor
  RETURN (
    X.qualityGate.push.branches CONTAINS 'main'
    OR X.qualityGate.triggers CONTAINS 'pull_request'
    OR X.blockNewBranch.allowedBranches DOES_NOT_CONTAIN_EXCLUSION_FOR 'main'
    OR X.remoteRefs CONTAINS stale_copilot_branches
  )
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking — Workflow'lar dev-only stratejisini yansıtmalı
FOR ALL X WHERE isBugCondition(X) DO
  result ← applyWorkflowFix'(X)
  ASSERT result.qualityGate.push.branches = ['dev']
  AND result.qualityGate.triggers = ['push']
  AND result.blockNewBranch.deletedBranches INCLUDES 'main'
  AND result.remoteRefs CONTAINS_NO stale_copilot_branches
END FOR
```

### Preservation Checking Property

```pascal
// Property: Preservation Checking — dev push davranışı değişmemeli
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // deploy.yml dev push'unda çalışmaya devam eder
  // quality-gate.yml dev push'unda çalışmaya devam eder
  // block-new-branch.yml dev dışı branch'leri silmeye devam eder
END FOR
```
