## Son Kontroller — Protection Hazırlık

Açıklama: Merge/Prod öncesi çalıştırılması gereken hızlı kontroller. Bu dosya, CI ve manuel adımlar içerir.

1) Otomatik (CI tarafından yapılır)
- `npm run lint -- --max-warnings 0` — kod kalitesi
- `npm run typecheck` — TypeScript hataları
- `npm run test:run` — birim & entegrasyon testleri
- `npm audit --json` — bilinen güvenlik açıkları

2) Manuel / Lokal
- Lokal dev server başlat: `npm run dev`
- Lokal Playwright quota testi (opsiyonel, ağır):
  - `node scripts/testLocalStorageQuota.cjs`
  - Çıktı ve screenshot: `scripts/testLocalStorageQuota-result.json`, `scripts/test-quota-*.png`
- Logger maskelerini doğrula: `src/lib/logger.ts` konsola hassas alan yazmamalı
- `localStorage` sentinel/rotasyon kontrolü: `src/lib/storageQuota.ts`

3) Repo güvenliği
- `git-secrets` veya benzeri ile gizli anahtar taraması yapın.
- Merge request ayarlarında `Require successful pipeline` aktif olsun.
- `CODEOWNERS` ile kritik dizinleri sahiplerine atayın.

4) Deploy öncesi (Opsiyonel)
- Eğer uzak loglama (S3/HTTP) eklenecekse, konfigürasyon ve kredensiyeller PR dışında tutulmalı.

5) Hızlı komutlar
- Hepsini yerelde hızlıca çalıştır:
```
npm ci --ignore-scripts
npm run lint -- --max-warnings 0
npm run typecheck
npm run test:run
node scripts/testLocalStorageQuota.cjs # opsiyonel
```

İhtiyaç: Bu checklist'i otomatikleştirmek isterseniz, ek bir `pre-merge` job veya MR template oluşturabilirim.
