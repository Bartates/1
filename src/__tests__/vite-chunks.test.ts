// Feature: android-build-optimization, Property 1: manualChunks deterministik ve doğru chunk ataması yapar

import { describe, test } from 'vitest';
import * as fc from 'fast-check';
import { manualChunks } from '../lib/vite-manual-chunks';

/**
 * Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.6, 8.2, 8.3
 *
 * Property 1: manualChunks Fonksiyonu Deterministik ve Doğru Chunk Ataması Yapar
 *
 * Her node_modules yolu için manualChunks fonksiyonu:
 * - framer-motion içeren yolları 'animations' chunk'ına atar
 * - lucide-react içeren yolları 'icons' chunk'ına atar
 * - xlsx içeren yolları 'excel' chunk'ına atar
 * - Aynı yol için her zaman aynı sonucu döndürür (deterministik)
 */

describe('manualChunks — Property 1', () => {
  test('framer-motion yolları animations chunk\'ına atanır', () => {
    fc.assert(
      fc.property(
        fc.string().map((s) => `node_modules/framer-motion/${s}`),
        (path) => manualChunks(path) === 'animations'
      ),
      { numRuns: 100 }
    );
  });

  test('lucide-react yolları icons chunk\'ına atanır', () => {
    fc.assert(
      fc.property(
        fc.string().map((s) => `node_modules/lucide-react/${s}`),
        (path) => manualChunks(path) === 'icons'
      ),
      { numRuns: 100 }
    );
  });

  test('xlsx yolları excel chunk\'ına atanır', () => {
    fc.assert(
      fc.property(
        fc.string().map((s) => `node_modules/xlsx/${s}`),
        (path) => manualChunks(path) === 'excel'
      ),
      { numRuns: 100 }
    );
  });

  test('aynı yol için iki çağrı aynı sonucu döndürür (deterministik)', () => {
    fc.assert(
      fc.property(
        fc.string().map((s) => `node_modules/${s}`),
        (path) => manualChunks(path) === manualChunks(path)
      ),
      { numRuns: 100 }
    );
  });
});
