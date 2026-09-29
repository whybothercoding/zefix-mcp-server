/**
 * @fileoverview Unit tests for formatting utilities.
 * 
 * Tests UID formatting, date formatting, and report generation.
 * 
 * @module tests/unit/utils/formatting.test
 */

import { describe, it, expect } from 'vitest';
import {
  formatUid,
  parseUid,
  formatDate,
  formatCompanyData,
  formatDueDiligenceReport,
} from '../../../src/utils/formatting.js';

describe('formatUid', () => {
  it('should format numeric UID correctly', () => {
    expect(formatUid('CHE123456789')).toBe('CHE-123.456.789');
  });

  it('should handle already formatted UID', () => {
    expect(formatUid('CHE-123.456.789')).toBe('CHE-123.456.789');
  });

  it('should handle UID with spaces', () => {
    expect(formatUid('CHE 123 456 789')).toBe('CHE-123.456.789');
  });

  it('should handle UID with mixed separators', () => {
    expect(formatUid('CHE-123 456.789')).toBe('CHE-123.456.789');
  });

  it('should return null for null input', () => {
    expect(formatUid(null)).toBe(null);
  });

  it('should return null for undefined input', () => {
    expect(formatUid(undefined)).toBe(null);
  });

  it('should return original for invalid format', () => {
    expect(formatUid('INVALID')).toBe('INVALID');
  });

  it('should handle lowercase prefix', () => {
    expect(formatUid('che123456789')).toBe('CHE-123.456.789');
  });
});

describe('parseUid', () => {
  it('should extract numeric part from formatted UID', () => {
    expect(parseUid('CHE-123.456.789')).toBe('123456789');
  });

  it('should extract numeric part from unformatted UID', () => {
    expect(parseUid('CHE123456789')).toBe('123456789');
  });

  it('should handle UID with spaces', () => {
    expect(parseUid('CHE 123 456 789')).toBe('123456789');
  });

  it('should return null for null input', () => {
    expect(parseUid(null)).toBe(null);
  });

  it('should return null for undefined input', () => {
    expect(parseUid(undefined)).toBe(null);
  });

  it('should return empty string for non-numeric input', () => {
    expect(parseUid('INVALID')).toBe('');
  });
});

describe('formatDate', () => {
  it('should format Date object to ISO 8601', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date)).toBe('2024-01-15');
  });

  it('should handle already formatted ISO date', () => {
    expect(formatDate('2024-01-15')).toBe('2024-01-15');
  });

  it('should format ISO datetime to date only', () => {
    expect(formatDate('2024-01-15T10:30:00Z')).toBe('2024-01-15');
  });

  it('should handle various date string formats', () => {
    expect(formatDate('2024-01-15T10:30:00.000Z')).toBe('2024-01-15');
  });

  it('should return null for null input', () => {
    expect(formatDate(null)).toBe(null);
  });

  it('should return null for undefined input', () => {
    expect(formatDate(undefined)).toBe(null);
  });

  it('should handle invalid date strings gracefully', () => {
    const result = formatDate('invalid-date');
    expect(result).toBe('invalid-date');
  });
});

describe('formatCompanyData', () => {
  it('should format company data with UID', () => {
    const company = {
      uid: 'CHE123456789',
      name: 'Test Company AG',
      legalForm: '0106',
      status: 'Active',
      canton: 'ZH',
    };

    const formatted = formatCompanyData(company);

    expect(formatted.uid).toBe('CHE-123.456.789');
    expect(formatted.name).toBe('Test Company AG');
    expect(formatted.legalForm).toBe('0106');
    expect(formatted.status).toBe('Active');
    expect(formatted.canton).toBe('ZH');
  });

  it('should preserve all original fields', () => {
    const company = {
      uid: 'CHE123456789',
      name: 'Test Company AG',
      customField: 'custom value',
    };

    const formatted = formatCompanyData(company);

    expect(formatted.customField).toBe('custom value');
  });

  it('should handle missing address', () => {
    const company = {
      uid: 'CHE123456789',
      name: 'Test Company AG',
    };

    const formatted = formatCompanyData(company);

    expect(formatted.address).toBeUndefined();
  });
});

describe('formatDueDiligenceReport', () => {
  it('should generate basic report with minimal data', () => {
    const data = {
      uid: 'CHE-123.456.789',
      name: 'Test Company AG',
      status: 'Active',
    };

    const report = formatDueDiligenceReport(data);

    expect(report).toContain('# Due Diligence Report: Test Company AG');
    expect(report).toContain('CHE-123.456.789');
    expect(report).toContain('Active');
    expect(report).toContain('## Risk Assessment');
  });

  it('should include legal form information', () => {
    const data = {
      uid: 'CHE-123.456.789',
      name: 'Test Company AG',
      legalForm: {
        name: 'Aktiengesellschaft',
        shortName: 'AG',
        code: '0106',
      },
      status: 'Active',
    };

    const report = formatDueDiligenceReport(data);

    expect(report).toContain('Aktiengesellschaft');
    expect(report).toContain('AG');
    expect(report).toContain('0106');
  });

  it('should include address information', () => {
    const data = {
      uid: 'CHE-123.456.789',
      name: 'Test Company AG',
      status: 'Active',
      address: {
        street: 'Bahnhofstrasse',
        houseNumber: '1',
        swissZipCode: '8001',
        town: 'Zürich',
        canton: 'ZH',
      },
    };

    const report = formatDueDiligenceReport(data);

    expect(report).toContain('## Registered Office');
    expect(report).toContain('Bahnhofstrasse 1');
    expect(report).toContain('8001 Zürich');
  });

  it('should include VAT information', () => {
    const data = {
      uid: 'CHE-123.456.789',
      name: 'Test Company AG',
      status: 'Active',
      vatInfo: {
        vatStatus: '2', // Active
        vatNumber: 'CHE-123.456.789',
      },
    };

    const report = formatDueDiligenceReport(data);

    expect(report).toContain('## VAT Information');
    expect(report).toContain('Active');
    expect(report).toContain('✅ VAT registered and active');
  });

  it('should include commercial register information', () => {
    const data = {
      uid: 'CHE-123.456.789',
      name: 'Test Company AG',
      status: 'Active',
      commercialRegister: {
        status: 'Active',
        entryDate: '2020-01-15',
        type: 'Main Entry',
      },
    };

    const report = formatDueDiligenceReport(data);

    expect(report).toContain('## Commercial Register');
    expect(report).toContain('Active');
    expect(report).toContain('2020-01-15');
  });

  it('should decode the UID Webservice commercial register status code', () => {
    const report = formatDueDiligenceReport({
      uid: 'CHE-123.456.789',
      name: 'Test Company AG',
      status: 'Active',
      commercialRegister: { commercialRegisterStatus: '2' },
    });

    expect(report).toContain('## Commercial Register\n- **Status**: Active');
    expect(report).not.toContain('- **Status**: N/A');
  });

  it('should include SOGC publications', () => {
    const data = {
      uid: 'CHE-123.456.789',
      name: 'Test Company AG',
      status: 'Active',
      sogcPublications: [
        {
          sogcDate: '2024-01-15',
          mutationTypes: [{ key: 'Address Change' }],
          message: 'Company moved to new address',
        },
      ],
    };

    const report = formatDueDiligenceReport(data);

    expect(report).toContain('## Recent Publications (SOGC)');
    expect(report).toContain('2024-01-15');
    expect(report).toContain('Address Change');
  });

  it('should assess risk for active company', () => {
    const data = {
      uid: 'CHE-123.456.789',
      name: 'Test Company AG',
      status: 'Active',
      vatInfo: {
        vatStatus: '2', // Active
      },
      commercialRegister: {
        commercialRegisterStatus: '2', // Active
      },
    };

    const report = formatDueDiligenceReport(data);

    expect(report).toContain('✅ Active and in good standing');
    expect(report).toContain('✅ VAT registered and active');
    expect(report).toContain('✅ Commercial register entry valid');
    expect(report).toContain('Low risk');
  });

  it('should identify risks for inactive company', () => {
    const data = {
      uid: 'CHE-123.456.789',
      name: 'Test Company AG',
      status: 'Inactive',
      vatInfo: {
        vatStatus: '1', // Inactive
      },
    };

    const report = formatDueDiligenceReport(data);

    expect(report).toContain('⚠️ Status: Inactive');
    expect(report).toContain('⚠️ VAT registration inactive');
    expect(report).toContain('Risks Identified');
  });

  it('should handle missing data gracefully', () => {
    const data = {
      uid: 'CHE-123.456.789',
      name: 'Test Company AG',
    };

    const report = formatDueDiligenceReport(data);

    expect(report).toContain('N/A');
    expect(report).toContain('Unknown');
  });

  it('should format NOGA code section', () => {
    const data = {
      uid: 'CHE-123.456.789',
      name: 'Test Company AG',
      status: 'Active',
      nogaCode: '64.19.0',
    };

    const report = formatDueDiligenceReport(data);

    expect(report).toContain('## Business Classification');
    expect(report).toContain('64.19.0');
  });
});
