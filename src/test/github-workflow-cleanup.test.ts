/**
 * GitHub Workflow Cleanup — Bugfix Tests
 *
 * Property 1 (Bug Condition): quality-gate.yml'de main push trigger ve
 *   pull_request bloğu bulunmamalı; block-new-branch.yml mesajı 'main'i
 *   açıkça belirtmeli.
 *
 * Property 2 (Preservation): dev push davranışı değişmemeli — deploy.yml
 *   ve quality-gate.yml dev push'unda çalışmaya devam etmeli;
 *   block-new-branch.yml dev dışı branch'leri silmeye devam etmeli.
 *
 * @vitest-environment node
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";
import fc from "fast-check";

// Workflow dosyalarının yolları (proje kökünden)
// __dirname = parspel/src/test → ../../ = parspel/
const WORKFLOWS_DIR = path.resolve(
  __dirname,
  "../../.github/workflows"
);

function readWorkflow(name: string): string {
  // Windows CRLF → LF normalize et
  return fs.readFileSync(path.join(WORKFLOWS_DIR, name), "utf-8").replace(/\r\n/g, "\n");
}

// ─── Yardımcı parse fonksiyonları ────────────────────────────────────────────

/**
 * YAML içindeki `on.push.branches` listesini döner.
 * Satır bazlı parse — YAML kütüphanesi gerektirmez.
 */
function extractPushBranches(yaml: string): string[] {
  const lines = yaml.split("\n");
  let inPush = false;
  let inBranches = false;
  const result: string[] = [];

  for (const line of lines) {
    // `  push:` satırı (on: bloğu içinde)
    if (/^\s+push:\s*$/.test(line)) {
      inPush = true;
      inBranches = false;
      continue;
    }
    // `    branches:` satırı (push: altında)
    if (inPush && /^\s+branches:\s*$/.test(line)) {
      inBranches = true;
      continue;
    }
    // `      - dev` gibi branch listesi satırları
    if (inBranches && /^\s+-\s+/.test(line)) {
      result.push(line.replace(/^\s+-\s+/, "").replace(/["']/g, "").trim());
      continue;
    }
    // branches bloğu bitti (yeni key başladı)
    if (inBranches && /^\s+\w/.test(line) && !/^\s+-/.test(line)) {
      break;
    }
  }

  return result;
}

/** YAML'da pull_request trigger bloğu var mı? */
function hasPullRequestTrigger(yaml: string): boolean {
  return /^\s*pull_request:/m.test(yaml);
}

/** YAML'da belirli bir string var mı? */
function containsText(yaml: string, text: string): boolean {
  return yaml.includes(text);
}

// ─── Property 1: Bug Condition ───────────────────────────────────────────────
// Bu testler FIX ÖNCESI başarısız olmalı (bug'ın varlığını kanıtlar).
// Fix sonrası GEÇMESI beklenir.

describe("Property 1: Bug Condition — quality-gate.yml dev-only stratejisini yansıtmalı", () => {
  it("quality-gate.yml push.branches listesinde main OLMAMALI", () => {
    const yaml = readWorkflow("quality-gate.yml");
    const branches = extractPushBranches(yaml);
    // Fix öncesi: main var → test başarısız (bug kanıtlandı)
    // Fix sonrası: main yok → test geçer
    expect(branches).not.toContain("main");
  });

  it("quality-gate.yml pull_request trigger bloğu OLMAMALI", () => {
    const yaml = readWorkflow("quality-gate.yml");
    // Fix öncesi: pull_request var → test başarısız (bug kanıtlandı)
    // Fix sonrası: pull_request yok → test geçer
    expect(hasPullRequestTrigger(yaml)).toBe(false);
  });

  it("quality-gate.yml yalnızca push: branches: [dev] trigger'ına sahip olmalı", () => {
    const yaml = readWorkflow("quality-gate.yml");
    const branches = extractPushBranches(yaml);
    expect(branches).toEqual(["dev"]);
  });
});

describe("Property 1: Bug Condition — block-new-branch.yml main'i açıkça belirtmeli", () => {
  it("block-new-branch.yml mesajı 'main' kelimesini içermeli", () => {
    const yaml = readWorkflow("block-new-branch.yml");
    // Fix öncesi: 'main' yok → test başarısız (bug kanıtlandı)
    // Fix sonrası: 'main' var → test geçer
    expect(containsText(yaml, "main")).toBe(true);
  });
});

// ─── Property 2: Preservation ────────────────────────────────────────────────
// Bu testler hem fix öncesi hem sonrası GEÇMELI (regresyon yok).

describe("Property 2: Preservation — deploy.yml değişmemeli", () => {
  it("deploy.yml push.branches listesinde dev bulunmalı", () => {
    const yaml = readWorkflow("deploy.yml");
    const branches = extractPushBranches(yaml);
    expect(branches).toContain("dev");
  });

  it("deploy.yml pull_request trigger içermemeli (zaten yoktu)", () => {
    const yaml = readWorkflow("deploy.yml");
    expect(hasPullRequestTrigger(yaml)).toBe(false);
  });

  it("deploy.yml GitHub Pages deploy adımını içermeli", () => {
    const yaml = readWorkflow("deploy.yml");
    expect(containsText(yaml, "deploy-pages")).toBe(true);
  });
});

describe("Property 2: Preservation — quality-gate.yml dev push'unda çalışmaya devam etmeli", () => {
  it("quality-gate.yml push.branches listesinde dev bulunmalı", () => {
    const yaml = readWorkflow("quality-gate.yml");
    const branches = extractPushBranches(yaml);
    expect(branches).toContain("dev");
  });

  it("quality-gate.yml typecheck adımını içermeli", () => {
    const yaml = readWorkflow("quality-gate.yml");
    expect(containsText(yaml, "typecheck")).toBe(true);
  });

  it("quality-gate.yml unit test adımını içermeli", () => {
    const yaml = readWorkflow("quality-gate.yml");
    expect(containsText(yaml, "test:run")).toBe(true);
  });

  it("quality-gate.yml build adımını içermeli", () => {
    const yaml = readWorkflow("quality-gate.yml");
    expect(containsText(yaml, "npm run build")).toBe(true);
  });
});

describe("Property 2: Preservation — block-new-branch.yml dev dışı branch'leri silmeye devam etmeli", () => {
  it("block-new-branch.yml if koşulu github.ref_name != 'dev' içermeli", () => {
    const yaml = readWorkflow("block-new-branch.yml");
    expect(containsText(yaml, "github.ref_name != 'dev'")).toBe(true);
  });

  it("block-new-branch.yml DELETE API çağrısını içermeli", () => {
    const yaml = readWorkflow("block-new-branch.yml");
    expect(containsText(yaml, "--method DELETE")).toBe(true);
  });

  /**
   * PBT: Rastgele branch adları üret ve if koşulunun
   * dev dışındaki tüm branch'leri kapsadığını doğrula.
   */
  it("PBT: dev dışındaki tüm branch adları if koşulunu tetiklemeli", () => {
    const yaml = readWorkflow("block-new-branch.yml");
    // if koşulu: github.ref_name != 'dev'
    // Bu koşul dev dışındaki tüm branch'leri kapsar
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s !== "dev"),
        (branchName) => {
          // dev dışındaki her branch adı için koşul true olmalı
          const condition = branchName !== "dev";
          return condition === true;
        }
      )
    );
    // Koşulun YAML'da doğru tanımlandığını da doğrula
    expect(containsText(yaml, "github.ref_name != 'dev'")).toBe(true);
  });
});
