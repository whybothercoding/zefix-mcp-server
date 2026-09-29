/**
 * @fileoverview Unit tests for SOGC publication text cleanup.
 * Fixtures mirror what Zefix really sends: UTF-8 bytes read as Windows-1252
 * and encoded again, <FT TYPE="..."> tags, and XML entities.
 */

import { describe, it, expect } from 'vitest';
import { cleanSogcMessage } from '../../../src/utils/sogc-text.js';

// Reproduce the upstream defect: encode as UTF-8, read the bytes as Windows-1252.
const garble = (text) => new TextDecoder('windows-1252').decode(Buffer.from(text, 'utf-8'));

describe('cleanSogcMessage', () => {
  it('should repair double-encoded umlauts and accents', () => {
    expect(garble('Zürich')).toBe('ZÃ¼rich');
    expect(cleanSogcMessage('ZÃ¼rich')).toBe('Zürich');
    expect(cleanSogcMessage(garble('Gesellschaft mit beschränkter Haftung, Genève, Öl'))).toBe(
      'Gesellschaft mit beschränkter Haftung, Genève, Öl'
    );
  });

  it('should repair characters that Windows-1252 maps outside Latin-1', () => {
    expect(cleanSogcMessage(garble('Kapital 100 € – „Test“'))).toBe('Kapital 100 € – „Test“');
  });

  it('should repair text containing bytes Windows-1252 leaves undefined', () => {
    // "Á" is UTF-8 C3 81; 0x81 has no Windows-1252 character and arrives as U+0081.
    const raw = garble('ANASTÁCIO');
    expect(raw).toContain('\u0081');
    expect(cleanSogcMessage(raw)).toBe('ANASTÁCIO');
  });

  it('should leave already-correct text untouched', () => {
    expect(cleanSogcMessage('Zürich, Genève, 100 €, Łódź')).toBe('Zürich, Genève, 100 €, Łódź');
    expect(cleanSogcMessage('plain ascii')).toBe('plain ascii');
  });

  it('should not alter text that only looks like it could be double-encoded', () => {
    // Lone Latin-1 characters are not valid UTF-8 once mapped back to bytes.
    expect(cleanSogcMessage('Müller & Söhne')).toBe('Müller & Söhne');
  });

  it('should strip FT markup tags and keep their content', () => {
    expect(
      cleanSogcMessage('<FT TYPE="F">14Peaks Capital AG</FT>, in <FT TYPE="S">Zug</FT>, <FT TYPE="A">CHE-300.573.585</FT>')
    ).toBe('14Peaks Capital AG, in Zug, CHE-300.573.585');
  });

  it('should decode XML entities in a single pass', () => {
    expect(cleanSogcMessage('Meier &amp; Co. AG, O&apos;Brien, &quot;Test&quot;')).toBe(
      'Meier & Co. AG, O\'Brien, "Test"'
    );
    expect(cleanSogcMessage('&amp;lt;')).toBe('&lt;');
  });

  it('should clean a realistic registration text end to end', () => {
    const raw = garble(
      '<FT TYPE="N">Müller &amp; Söhne GmbH</FT>, in <FT TYPE="5">Zürich</FT>, Gesellschaft mit beschränkter Haftung (Neueintragung). Zweck: Die Gesellschaft bezweckt die Entwicklung von Software.'
    );

    expect(cleanSogcMessage(raw)).toBe(
      'Müller & Söhne GmbH, in Zürich, Gesellschaft mit beschränkter Haftung (Neueintragung). Zweck: Die Gesellschaft bezweckt die Entwicklung von Software.'
    );
  });

  it('should return non-string values unchanged', () => {
    expect(cleanSogcMessage(undefined)).toBeUndefined();
    expect(cleanSogcMessage(null)).toBeNull();
    expect(cleanSogcMessage(42)).toBe(42);
  });

  it('should handle an empty string', () => {
    expect(cleanSogcMessage('')).toBe('');
  });
});
