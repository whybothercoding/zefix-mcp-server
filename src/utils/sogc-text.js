/**
 * @fileoverview Cleanup for SOGC publication texts returned by Zefix.
 *
 * The `message` field of a Zefix SOGC publication arrives (1) double-encoded:
 * UTF-8 bytes that were read as Windows-1252 and encoded again ("ZÃ¼rich" for
 * "Zürich"), (2) wrapped in `<FT TYPE="...">` markup tags, and (3) with XML
 * entities (`&apos;`, `&amp;`, `&quot;`). Company names and other fields are
 * unaffected.
 *
 * @module utils/sogc-text
 */

const WINDOWS_1252 = new TextDecoder('windows-1252');
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true });

/** Character produced by reading a byte as Windows-1252 → that byte. */
const BYTE_OF_CHAR = new Map();
for (let byte = 0; byte < 256; byte++) {
  BYTE_OF_CHAR.set(WINDOWS_1252.decode(Uint8Array.of(byte)), byte);
}

const ENTITIES = { '&apos;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&amp;': '&' };

/**
 * Undo double UTF-8 encoding. Text is returned unchanged unless every
 * character maps back to a single byte and those bytes form valid UTF-8, so
 * already-correct text ("Zürich", "€") is never altered.
 *
 * @private
 * @param {string} text - Possibly double-encoded text
 * @returns {string} Repaired text, or the input if it was not double-encoded
 */
function repairEncoding(text) {
  if (!/\P{ASCII}/u.test(text)) return text;

  const bytes = [];
  for (const char of text) {
    const byte = BYTE_OF_CHAR.get(char);
    if (byte === undefined) return text;
    bytes.push(byte);
  }

  try {
    return UTF8_STRICT.decode(Uint8Array.from(bytes));
  } catch {
    return text;
  }
}

/**
 * Turn a raw SOGC publication message into plain, correctly encoded text.
 *
 * @param {*} message - Raw `message` value from Zefix
 * @returns {*} Cleaned text; non-string values are returned unchanged
 *
 * @example
 * cleanSogcMessage('<FT TYPE="N">Meier &amp; Co. AG</FT>, in <FT TYPE="5">ZÃ¼rich</FT>')
 * // → 'Meier & Co. AG, in Zürich'
 */
export function cleanSogcMessage(message) {
  if (typeof message !== 'string') return message;

  return repairEncoding(message)
    .replace(/<\/?FT\b[^>]*>/gi, '')
    .replace(/&(?:apos|quot|lt|gt|amp);/g, (entity) => ENTITIES[entity]);
}
