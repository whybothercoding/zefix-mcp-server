/**
 * @fileoverview Unit tests for Zod → JSON Schema conversion of MCP tool inputs.
 * Regression: wrapped types (.optional().default(...)) used to be advertised as
 * "string", so clients sent "30" for maxResults and Zod rejected it.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { shapeToJsonSchema } from '../../../src/utils/json-schema.js';
import {
  searchCompaniesSchema,
  getCompanyByUidSchema,
  advancedSearchSchema,
  validateUidSchema,
  getSogcByDateSchema,
  getSogcByUidSchema,
  dueDiligenceSchema,
} from '../../../src/api/schemas.js';

describe('shapeToJsonSchema', () => {
  it('should describe an object without a $schema marker', () => {
    const schema = shapeToJsonSchema({ name: z.string() });

    expect(schema.type).toBe('object');
    expect(schema).not.toHaveProperty('$schema');
    expect(schema.properties.name.type).toBe('string');
  });

  it('should keep the real type of optional and defaulted fields', () => {
    const { properties } = shapeToJsonSchema(searchCompaniesSchema.shape);

    expect(properties.maxResults).toMatchObject({ type: 'integer', default: 30, minimum: 1, maximum: 200 });
    expect(properties.activeOnly).toMatchObject({ type: 'boolean', default: true });
    expect(properties.canton.type).toBe('string');
    expect(properties.legalFormUid.type).toBe('string');
  });

  it('should list only fields without a default or optional marker as required', () => {
    expect(shapeToJsonSchema(searchCompaniesSchema.shape).required).toEqual(['name']);
    expect(shapeToJsonSchema(getCompanyByUidSchema.shape).required).toEqual(['uid']);
    expect(shapeToJsonSchema(getSogcByDateSchema.shape).required).toEqual(['date']);
    expect(shapeToJsonSchema(advancedSearchSchema.shape).required ?? []).toEqual([]);
  });

  it('should advertise transformed fields by the string clients send', () => {
    const { properties } = shapeToJsonSchema(validateUidSchema.shape);

    expect(properties.uid.type).toBe('string');
    expect(properties.uid.description).toContain('CHE-XXX.XXX.XXX');
  });

  it('should describe nested objects and arrays', () => {
    const { properties } = shapeToJsonSchema(advancedSearchSchema.shape);

    expect(properties.personName.type).toBe('object');
    expect(properties.personName.required).toEqual(['officialName']);
    expect(properties.personName.properties.firstName.type).toBe('string');
    expect(properties.legalForms).toMatchObject({ type: 'array', items: { type: 'string' } });
  });

  it('should describe the SOGC paging options', () => {
    const daily = shapeToJsonSchema(getSogcByDateSchema.shape).properties;
    const company = shapeToJsonSchema(getSogcByUidSchema.shape).properties;

    expect(daily.maxResults).toMatchObject({ type: 'integer', default: 50 });
    expect(daily.offset).toMatchObject({ type: 'integer', default: 0, minimum: 0 });
    expect(daily.includeText).toMatchObject({ type: 'boolean', default: false });
    expect(daily.canton.type).toBe('string');
    expect(company.maxResults).toMatchObject({ type: 'integer', default: 20 });
  });

  it('should describe every boolean option as a boolean', () => {
    expect(shapeToJsonSchema(getCompanyByUidSchema.shape).properties.enrichWithUidData.type).toBe('boolean');
    expect(shapeToJsonSchema(dueDiligenceSchema.shape).properties.includePublications.type).toBe('boolean');
  });

  it('should produce schemas whose typed values pass Zod validation', () => {
    const { properties } = shapeToJsonSchema(searchCompaniesSchema.shape);
    const typed = { name: 'Migros', maxResults: 3, activeOnly: false };

    expect(typeof typed.maxResults === 'number' && properties.maxResults.type === 'integer').toBe(true);
    expect(() => searchCompaniesSchema.parse(typed)).not.toThrow();
  });
});
