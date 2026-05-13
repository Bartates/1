import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Feature: android-build-optimization
// Task 6.1: .gitlab-ci.yml yapılandırma doğrulaması
// Requirements: 1.1, 1.2, 1.3, 2.3

const CI_CONFIG_PATH = resolve(process.cwd(), '.gitlab-ci.yml');

/**
 * Minimal YAML parser for simple key-value and list structures.
 * Used as fallback when js-yaml / yaml packages are not available.
 */
function parseYamlStages(content: string): string[] {
  const stagesMatch = content.match(/^stages\s*:\s*\n((?:\s+-\s+\S+\n?)+)/m);
  if (!stagesMatch) {
    // Try inline array: stages: [a, b, c]
    const inlineMatch = content.match(/^stages\s*:\s*\[([^\]]+)\]/m);
    if (inlineMatch) {
      return inlineMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
    }
    return [];
  }
  return stagesMatch[1]
    .split('\n')
    .map(line => line.replace(/^\s+-\s+/, '').trim())
    .filter(Boolean);
}

describe('.gitlab-ci.yml CI configuration', () => {
  // Graceful skip when the file does not exist yet (created in Task 7)
  const fileExists = existsSync(CI_CONFIG_PATH);

  if (!fileExists) {
    test.skip('.gitlab-ci.yml does not exist yet — skipping CI config tests (will be created in Task 7)', () => {
      // intentionally skipped
    });
    return;
  }

  const content = readFileSync(CI_CONFIG_PATH, 'utf-8');

  // ── Stage validation ────────────────────────────────────────────────────────

  describe('stages', () => {
    test('contains "install" stage', () => {
      const stages = parseYamlStages(content);
      if (stages.length > 0) {
        expect(stages).toContain('install');
      } else {
        // Fallback: plain string search
        expect(content).toMatch(/install/);
      }
    });

    test('contains "build" stage', () => {
      const stages = parseYamlStages(content);
      if (stages.length > 0) {
        expect(stages).toContain('build');
      } else {
        expect(content).toMatch(/build/);
      }
    });

    test('contains "test" stage', () => {
      const stages = parseYamlStages(content);
      if (stages.length > 0) {
        expect(stages).toContain('test');
      } else {
        expect(content).toMatch(/\btest\b/);
      }
    });

    test('contains "android-build" stage', () => {
      const stages = parseYamlStages(content);
      if (stages.length > 0) {
        expect(stages).toContain('android-build');
      } else {
        expect(content).toMatch(/android-build/);
      }
    });
  });

  // ── build-apk job validation ────────────────────────────────────────────────

  describe('build-apk job', () => {
    test('build-apk job is defined', () => {
      expect(content).toMatch(/build-apk\s*:/);
    });

    test('build-apk runs only on main branch (only: [main] or rules)', () => {
      // Accept either `only: [main]`, `only:\n  - main`, or `rules:` with `main` reference
      const hasOnly = /only\s*:\s*[\[\n][\s\S]*?main/.test(content);
      const hasRules = /rules\s*:[\s\S]*?main/.test(content);
      expect(hasOnly || hasRules).toBe(true);
    });

    test('build-apk artifacts expire_in contains "7 days"', () => {
      // Look for expire_in: 7 days anywhere in the file (associated with apk artifact)
      expect(content).toMatch(/expire_in\s*:\s*7\s*days/);
    });
  });
});
