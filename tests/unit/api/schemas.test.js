/**
 * @fileoverview Unit tests for API schemas.
 * Tests Zod schema validation for Zefix and UID API requests/responses.
 */

import { describe, it, expect } from 'vitest';
import {
  searchCompaniesSchema,
  getCompanyByUidSchema,
  advancedSearchSchema,
  validateUidSchema,
  validateVatSchema,
  getSogcByDateSchema,
  getSogcByUidSchema,
} from '../../../src/api/schemas.js';

describe('API Schemas', () => {
  describe('searchCompaniesSchema', () => {
    it('should validate valid search request', () => {
      const validData = {
        name: 'Test Company',
        canton: 'ZH',
        activeOnly: true,
        legalFormUid: '0106',
        maxResults: 30,
      };

      const result = searchCompaniesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require name field', () => {
      const invalidData = {
        canton: 'ZH',
      };

      const result = searchCompaniesSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate name minimum length', () => {
      const invalidData = {
        name: 'AB', // Too short
      };

      const result = searchCompaniesSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept optional fields', () => {
      const validData = {
        name: 'Test',
      };

      const result = searchCompaniesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate canton format', () => {
      const invalidData = {
        name: 'Test',
        canton: 'ZZZ', // Invalid canton
      };

      const result = searchCompaniesSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate maxResults range', () => {
      const invalidData = {
        name: 'Test',
        maxResults: 300, // Too high
      };

      const result = searchCompaniesSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept wildcard in name', () => {
      const validData = {
        name: 'Test*',
      };

      const result = searchCompaniesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('getCompanyByUidSchema', () => {
    it('should validate valid UID format', () => {
      const validData = {
        uid: 'CHE-123.456.789',
        enrichWithUidData: true,
      };

      const result = getCompanyByUidSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require uid field', () => {
      const invalidData = {};

      const result = getCompanyByUidSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate UID format', () => {
      const invalidData = {
        uid: 'INVALID-UID',
      };

      const result = getCompanyByUidSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept enrichWithUidData as optional', () => {
      const validData = {
        uid: 'CHE-123.456.789',
      };

      const result = getCompanyByUidSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should default enrichWithUidData to true', () => {
      const validData = {
        uid: 'CHE-123.456.789',
      };

      const result = getCompanyByUidSchema.parse(validData);
      expect(result.enrichWithUidData).toBe(true);
    });
  });

  describe('advancedSearchSchema', () => {
    it('should validate valid advanced search with organisation', () => {
      const validData = {
        organisationName: 'Test Company',
        canton: 'ZH',
        legalForms: ['0106', '0107'],
        activeOnly: true,
        maxResults: 50,
      };

      const result = advancedSearchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate valid advanced search with person name', () => {
      const validData = {
        personName: {
          officialName: 'Doe',
          firstName: 'John',
        },
        canton: 'ZH',
        activeOnly: true,
      };

      const result = advancedSearchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate person name with only officialName', () => {
      const validData = {
        personName: {
          officialName: 'Doe',
        },
      };

      const result = advancedSearchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const validData = {};

      const result = advancedSearchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate organisationName minimum length', () => {
      const invalidData = {
        organisationName: 'AB', // Too short
      };

      const result = advancedSearchSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate legalForms as array', () => {
      const validData = {
        legalForms: ['0106'],
      };

      const result = advancedSearchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate maxResults range', () => {
      const invalidData = {
        maxResults: 0, // Too low
      };

      const result = advancedSearchSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('validateUidSchema', () => {
    it('should validate valid UID', () => {
      const validData = {
        uid: 'CHE-123.456.789',
      };

      const result = validateUidSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require uid field', () => {
      const invalidData = {};

      const result = validateUidSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate UID format', () => {
      const invalidData = {
        uid: '123456789',
      };

      const result = validateUidSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept different UID formats', () => {
      const validFormats = [
        'CHE-123.456.789',
        'CHE-100.000.000',
        'CHE-999.999.999',
      ];

      validFormats.forEach(uid => {
        const result = validateUidSchema.safeParse({ uid });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('validateVatSchema', () => {
    it('should validate valid VAT number', () => {
      const validData = {
        vatNumber: 'CHE-123.456.789',
      };

      const result = validateVatSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require vatNumber field', () => {
      const invalidData = {};

      const result = validateVatSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate VAT number format', () => {
      const invalidData = {
        vatNumber: 'INVALID',
      };

      const result = validateVatSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('getSogcByDateSchema', () => {
    it('should validate valid date', () => {
      const validData = {
        date: '2025-01-15',
      };

      const result = getSogcByDateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require date field', () => {
      const invalidData = {};

      const result = getSogcByDateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate date format', () => {
      const invalidData = {
        date: '15-01-2025', // Wrong format
      };

      const result = getSogcByDateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept valid ISO dates', () => {
      const validDates = [
        '2025-01-01',
        '2025-12-31',
        '2024-02-29', // Leap year
      ];

      validDates.forEach(date => {
        const result = getSogcByDateSchema.safeParse({ date });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('getSogcByUidSchema', () => {
    it('should validate valid UID', () => {
      const validData = {
        uid: 'CHE-123.456.789',
      };

      const result = getSogcByUidSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require uid field', () => {
      const invalidData = {};

      const result = getSogcByUidSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate UID format', () => {
      const invalidData = {
        uid: 'INVALID-FORMAT',
      };

      const result = getSogcByUidSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle extra fields gracefully', () => {
      const dataWithExtra = {
        name: 'Test',
        extraField: 'should be ignored',
      };

      const result = searchCompaniesSchema.safeParse(dataWithExtra);
      expect(result.success).toBe(true);
      // Zod strips extra fields by default
      expect(result.data).not.toHaveProperty('extraField');
    });

    it('should handle null values', () => {
      const dataWithNull = {
        name: 'Test',
        canton: null,
      };

      const result = searchCompaniesSchema.safeParse(dataWithNull);
      // Should fail because canton expects string or undefined
      expect(result.success).toBe(false);
    });

    it('should handle undefined vs missing fields', () => {
      const dataWithUndefined = {
        name: 'Test',
        canton: undefined,
      };

      const result = searchCompaniesSchema.safeParse(dataWithUndefined);
      expect(result.success).toBe(true);
    });
  });
});
