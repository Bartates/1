// Feature: android-build-optimization, Property 2: versionCode geçerli ve geçersiz inputları doğru işler

import { describe, test } from 'vitest';
import * as fc from 'fast-check';
import { resolveVersionCode } from '../../scripts/version-utils';

/**
 * Validates: Requirements 5.3, 5.4, 8.4, 8.5
 *
 * Property 2: versionCode Hesaplama Mantığı Geçerli ve Geçersiz Inputları Doğru İşler
 *
 * Her CI_PIPELINE_IID değeri için:
 * - Geçerli pozitif tam sayı string'i verildiğinde o sayıyı döndürmeli
 * - null, undefined, boş string veya sayıya dönüştürülemeyen değer verildiğinde 1 döndürmeli
 */

describe('resolveVersionCode — Property 2', () => {
  test('geçerli pozitif tam sayı string\'i doğru parse edilir', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99999 }),
        (n) => resolveVersionCode(String(n)) === n
      ),
      { numRuns: 100 }
    );
  });

  test('geçersiz değerler için 1 döner (null, undefined, boş string, sayıya dönüştürülemeyen string)', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(''),
          // Sayıya dönüştürülemeyen string'ler: en az bir harf içeren string'ler
          fc.string({ minLength: 1 }).filter((s) => isNaN(Number(s)) || s.trim() === '')
        ),
        (invalidValue) => resolveVersionCode(invalidValue) === 1
      ),
      { numRuns: 100 }
    );
  });
});
