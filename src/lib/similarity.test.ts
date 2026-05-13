/**
 * similarity.ts — Birim ve Property-Based Testler
 *
 * Validates: Requirements 6.1–6.7
 * Properties: Property 8 — Benzerlik Skoru Aralık ve Simetri İnvariantları
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeTR, similarity, isExactMatch } from './similarity';

// ─── normalizeTR ──────────────────────────────────────────────────────────────

describe('normalizeTR', () => {
  it('ğ → g dönüşümü', () => {
    expect(normalizeTR('ğ')).toBe('g');
    expect(normalizeTR('Ğ')).toBe('g');
  });

  it('ü → u dönüşümü', () => {
    expect(normalizeTR('ü')).toBe('u');
    expect(normalizeTR('Ü')).toBe('u');
  });

  it('ş → s dönüşümü', () => {
    expect(normalizeTR('ş')).toBe('s');
    expect(normalizeTR('Ş')).toBe('s');
  });

  it('ı → i dönüşümü', () => {
    expect(normalizeTR('ı')).toBe('i');
  });

  it('ö → o dönüşümü', () => {
    expect(normalizeTR('ö')).toBe('o');
    expect(normalizeTR('Ö')).toBe('o');
  });

  it('ç → c dönüşümü', () => {
    expect(normalizeTR('ç')).toBe('c');
    expect(normalizeTR('Ç')).toBe('c');
  });

  it('tüm Türkçe karakterleri aynı anda dönüştürür', () => {
    expect(normalizeTR('Güneş Şehri')).toBe('gunes sehri');
    expect(normalizeTR('Çiğdem Öztürk')).toBe('cigdem ozturk');
    expect(normalizeTR('Işık Yılmaz')).toBe('isik yilmaz');
  });

  it('baştaki ve sondaki boşlukları temizler', () => {
    expect(normalizeTR('  ahmet  ')).toBe('ahmet');
  });

  it('birden fazla boşluğu tek boşluğa indirger', () => {
    expect(normalizeTR('ahmet   yilmaz')).toBe('ahmet yilmaz');
  });

  it('özel karakterleri boşluğa çevirir', () => {
    expect(normalizeTR('ahmet-yilmaz')).toBe('ahmet yilmaz');
    expect(normalizeTR('ahmet.yilmaz')).toBe('ahmet yilmaz');
  });

  it('boş string için boş string döner', () => {
    expect(normalizeTR('')).toBe('');
  });
});

// ─── similarity ───────────────────────────────────────────────────────────────

describe('similarity', () => {
  // Validates: Requirement 6.2
  it('aynı string için 100 döner', () => {
    expect(similarity('abc', 'abc')).toBe(100);
    expect(similarity('Ahmet Yılmaz', 'Ahmet Yılmaz')).toBe(100);
  });

  // Validates: Requirement 6.3
  it('boş string için 0 döner', () => {
    expect(similarity('', 'abc')).toBe(0);
    expect(similarity('abc', '')).toBe(0);
    expect(similarity('', '')).toBe(0);
  });

  it('tamamen farklı stringler için düşük skor döner', () => {
    const score = similarity('xyz', 'abc');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(50);
  });

  it('Türkçe karakter farkı olan benzer isimler için yüksek skor döner', () => {
    // 'Ahmet Yilmaz' vs 'Ahmet Yılmaz' — normalize sonrası aynı
    const score = similarity('Ahmet Yilmaz', 'Ahmet Yılmaz');
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('kısmi eşleşme için orta-yüksek skor döner', () => {
    const score = similarity('Mehmet Demir', 'Mehmet');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('bir string diğerini içeriyorsa yüksek skor döner', () => {
    const score = similarity('Parspel', 'Parspel Yazılım');
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('skor her zaman 0-100 arasındadır', () => {
    const pairs = [
      ['abc', 'def'],
      ['Türkçe', 'Turkce'],
      ['a', 'abcdefghij'],
      ['test', 'test'],
    ];
    for (const [a, b] of pairs) {
      const score = similarity(a, b);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

// ─── isExactMatch ─────────────────────────────────────────────────────────────

describe('isExactMatch', () => {
  // Validates: Requirement 6.4
  it('normalize edilmiş eşleşme için true döner', () => {
    expect(isExactMatch('Ahmet', 'ahmet')).toBe(true);
    expect(isExactMatch('AHMET', 'ahmet')).toBe(true);
  });

  it('Türkçe karakter farkı olan eşleşme için true döner', () => {
    // 'Işık' → 'isik', 'Isik' → 'isik'
    expect(isExactMatch('Işık', 'Isik')).toBe(true);
    expect(isExactMatch('Güneş', 'Gunes')).toBe(true);
  });

  it('farklı stringler için false döner', () => {
    expect(isExactMatch('Ahmet', 'Mehmet')).toBe(false);
    expect(isExactMatch('abc', 'def')).toBe(false);
  });

  it('boş stringler için true döner', () => {
    expect(isExactMatch('', '')).toBe(true);
  });

  it('boşluk farkı gözetmez', () => {
    expect(isExactMatch('  ahmet  ', 'ahmet')).toBe(true);
  });
});

// ─── Property-Based Tests ─────────────────────────────────────────────────────

describe('Property 8: Benzerlik Skoru Aralık ve Simetri İnvariantları', () => {
  /**
   * Validates: Requirements 6.5, 6.6, 6.7
   *
   * P8a: similarity(a, b) ∈ [0, 100]
   * P8b: similarity(a, b) === similarity(b, a)  (simetri)
   * P8c: similarity(s, s) === 100               (self-similarity)
   */

  it('P8a — skor her zaman [0, 100] aralığında olmalı', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 50 }),
        fc.string({ maxLength: 50 }),
        (a, b) => {
          const score = similarity(a, b);
          return score >= 0 && score <= 100;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P8b — simetri: similarity(a, b) === similarity(b, a)', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 50 }),
        fc.string({ maxLength: 50 }),
        (a, b) => {
          return similarity(a, b) === similarity(b, a);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P8c — self-similarity: similarity(s, s) === 100', () => {
    // normalizeTR sonrası boş olmayan stringler için self-similarity 100 olmalı.
    // normalizeTR: Türkçe→ASCII, özel karakter→boşluk, trim, lowercase
    // Sadece harf veya rakam içeren stringler normalize sonrası boş olmaz.
    fc.assert(
      fc.property(
        fc.stringMatching(/[a-zA-Z0-9]/),
        (s) => {
          return similarity(s, s) === 100;
        }
      ),
      { numRuns: 100 }
    );
  });
});
