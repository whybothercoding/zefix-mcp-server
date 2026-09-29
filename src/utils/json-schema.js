/**
 * @fileoverview Zod → JSON Schema conversion for MCP tool `inputSchema`.
 *
 * MCP clients read the advertised JSON Schema to decide how to type each
 * argument (a `"string"` here makes clients send `"30"` instead of `30`).
 * Delegating to `zod-to-json-schema` keeps the advertised types in sync with
 * the Zod schemas that actually validate the call, including wrapped types
 * such as `.optional()`, `.default()` and `.transform()`.
 *
 * @module utils/json-schema
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Convert a Zod shape (the `{ key: ZodType }` object passed to `server.tool`)
 * into an MCP-compatible JSON Schema object.
 *
 * Transforms are described by their *input* type, so `uidSchema` is advertised
 * as the string the client should send, not the normalized string it becomes.
 *
 * @param {Object<string, import('zod').ZodTypeAny>} shape - Zod shape
 * @returns {Object} JSON Schema with `type: 'object'`, `properties`, `required`
 *
 * @example
 * shapeToJsonSchema({ maxResults: z.number().int().optional().default(30) });
 * // → { type: 'object', properties: { maxResults: { type: 'integer', default: 30, ... } }, ... }
 */
export function shapeToJsonSchema(shape) {
  const schema = zodToJsonSchema(z.object(shape), {
    target: 'jsonSchema7',
    $refStrategy: 'none',
    effectStrategy: 'input',
  });
  delete schema.$schema;

  return schema;
}
