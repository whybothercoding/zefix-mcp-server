/**
 * @fileoverview Unit tests for SOGC (Swiss Official Gazette of Commerce) tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDailyRegistrations, getCompanyPublications, registerSogcTools } from '../../../src/tools/sogc.js';

// Mock dependencies using vi.hoisted()
const { mockGetSogcByDate, mockGetSogcByUid } = vi.hoisted(() => ({
  mockGetSogcByDate: vi.fn(),
  mockGetSogcByUid: vi.fn(),
}));

vi.mock('../../../src/api/zefix-client.js', () => ({
  ZefixClient: vi.fn(function () { return {
    getSogcByDate: mockGetSogcByDate,
    getSogcByUid: mockGetSogcByUid,
  }; }),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Zefix answers sogc/bydate with { sogcPublication, companyShort } records.
const makeRecord = (i, overrides = {}) => ({
  sogcPublication: {
    sogcDate: '2025-01-15',
    sogcId: 1000 + i,
    registryOfCommerceCanton: 'ZH',
    message: `Publication ${i}`,
    mutationTypes: [{ id: 1, key: 'adressaenderung' }],
    ...overrides.sogcPublication,
  },
  companyShort: {
    name: `Company ${i} AG`,
    uid: `CHE${String(100000000 + i)}`,
    legalSeat: 'Zürich',
    legalForm: { uid: '0106', shortName: { de: 'AG', en: 'Ltd' } },
    status: 'ACTIVE',
    ehraid: i,
    ...overrides.companyShort,
  },
});

// Zefix returns a company's sogcPub list most recent first.
const makePublications = (count) =>
  Array.from({ length: count }, (_, i) => ({
    sogcDate: `2025-01-${String(28 - (i % 28)).padStart(2, '0')}`,
    sogcId: 5000 + i,
    registryOfCommerceCanton: 'BE',
    message: `Change ${i + 1}`,
    mutationTypes: [{ id: 17, key: 'aenderungorgane' }],
  }));

describe('SOGC Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDailyRegistrations', () => {
    it('should summarize daily publications', async () => {
      mockGetSogcByDate.mockResolvedValue([
        makeRecord(1),
        makeRecord(2, {
          sogcPublication: { registryOfCommerceCanton: 'BE', mutationTypes: [{ id: 2, key: 'status.neu' }] },
          companyShort: { name: 'Example GmbH', legalForm: { uid: '0107', shortName: { de: 'GmbH' } } },
        }),
      ]);

      const result = await getDailyRegistrations({ date: '2025-01-15' });

      expect(mockGetSogcByDate).toHaveBeenCalledWith('2025-01-15');
      expect(result.content[0].type).toBe('text');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        date: '2025-01-15',
        totalPublications: 2,
        matched: 2,
        returned: 2,
        offset: 0,
      });
      expect(parsed.publications[1]).toEqual({
        sogcId: 1002,
        sogcDate: '2025-01-15',
        canton: 'BE',
        mutationTypes: ['status.neu'],
        company: {
          name: 'Example GmbH',
          uid: 'CHE100000002',
          legalSeat: 'Zürich',
          legalForm: 'GmbH',
          status: 'ACTIVE',
        },
      });
    });

    it('should omit the publication text unless includeText is set', async () => {
      mockGetSogcByDate.mockResolvedValue([makeRecord(1)]);

      const without = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15' })).content[0].text
      );
      const withText = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15', includeText: true })).content[0].text
      );

      expect(without.publications[0]).not.toHaveProperty('message');
      expect(withText.publications[0].message).toBe('Publication 1');
    });

    it('should filter by canton', async () => {
      mockGetSogcByDate.mockResolvedValue([
        makeRecord(1, { sogcPublication: { registryOfCommerceCanton: 'ZH' } }),
        makeRecord(2, { sogcPublication: { registryOfCommerceCanton: 'BE' } }),
        makeRecord(3, { sogcPublication: { registryOfCommerceCanton: 'ZH' } }),
      ]);

      const parsed = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15', canton: 'ZH' })).content[0].text
      );

      expect(parsed.totalPublications).toBe(3);
      expect(parsed.matched).toBe(2);
      expect(parsed.publications.map((p) => p.sogcId)).toEqual([1001, 1003]);
    });

    it('should filter by mutation type, matching exact keys and sub-keys', async () => {
      mockGetSogcByDate.mockResolvedValue([
        makeRecord(1, { sogcPublication: { mutationTypes: [{ key: 'status.neu' }] } }),
        makeRecord(2, { sogcPublication: { mutationTypes: [{ key: 'status.loeschung' }] } }),
        makeRecord(3, { sogcPublication: { mutationTypes: [{ key: 'adressaenderung' }] } }),
        makeRecord(4, { sogcPublication: { mutationTypes: [{ key: 'statusquo' }] } }),
      ]);

      const run = async (mutationType) =>
        JSON.parse(
          (await getDailyRegistrations({ date: '2025-01-15', mutationType })).content[0].text
        ).publications.map((p) => p.sogcId);

      expect(await run('status.neu')).toEqual([1001]);
      expect(await run('STATUS')).toEqual([1001, 1002]); // sub-keys, case-insensitive
      expect(await run('adressaenderung')).toEqual([1003]);
      expect(await run('nonexistent')).toEqual([]);
    });

    it('should page with maxResults and offset', async () => {
      mockGetSogcByDate.mockResolvedValue(Array.from({ length: 120 }, (_, i) => makeRecord(i)));

      const first = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15' })).content[0].text
      );
      const second = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15', maxResults: 50, offset: 50 })).content[0].text
      );
      const last = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15', offset: 100 })).content[0].text
      );

      expect(first.returned).toBe(50); // default page size
      expect(first.matched).toBe(120);
      expect(second.publications[0].sogcId).toBe(1050);
      expect(last.returned).toBe(20);
    });

    it('should handle empty results', async () => {
      mockGetSogcByDate.mockResolvedValue([]);

      const parsed = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15' })).content[0].text
      );

      expect(parsed.totalPublications).toBe(0);
      expect(parsed.publications).toEqual([]);
    });

    it('should handle null results', async () => {
      mockGetSogcByDate.mockResolvedValue(null);

      const parsed = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15' })).content[0].text
      );

      expect(parsed.totalPublications).toBe(0);
      expect(parsed.publications).toEqual([]);
    });

    it('should handle undefined results', async () => {
      mockGetSogcByDate.mockResolvedValue(undefined);

      const parsed = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15' })).content[0].text
      );

      expect(parsed.totalPublications).toBe(0);
      expect(parsed.publications).toEqual([]);
    });

    it('should throw error for invalid date format', async () => {
      await expect(
        getDailyRegistrations({ date: 'invalid-date' })
      ).rejects.toThrow();
    });

    it('should throw error for missing date', async () => {
      await expect(getDailyRegistrations({})).rejects.toThrow();
    });

    it('should throw error for out-of-range paging parameters', async () => {
      await expect(
        getDailyRegistrations({ date: '2025-01-15', maxResults: 0 })
      ).rejects.toThrow();
      await expect(
        getDailyRegistrations({ date: '2025-01-15', maxResults: 201 })
      ).rejects.toThrow();
      await expect(
        getDailyRegistrations({ date: '2025-01-15', offset: -1 })
      ).rejects.toThrow();
    });

    it('should handle API errors', async () => {
      mockGetSogcByDate.mockRejectedValue(new Error('API Error'));

      await expect(
        getDailyRegistrations({ date: '2025-01-15' })
      ).rejects.toThrow('API Error');
    });

    it('should return MCP-compliant response', async () => {
      mockGetSogcByDate.mockResolvedValue([]);

      const result = await getDailyRegistrations({ date: '2025-01-15' });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should tolerate records with missing sections', async () => {
      mockGetSogcByDate.mockResolvedValue([{}, { sogcPublication: { sogcId: 7 } }]);

      const parsed = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15' })).content[0].text
      );

      expect(parsed.returned).toBe(2);
      expect(parsed.publications[1].sogcId).toBe(7);
      expect(parsed.publications[1].mutationTypes).toEqual([]);
    });
  });

  describe('getCompanyPublications', () => {
    it('should get company publications with valid UID', async () => {
      mockGetSogcByUid.mockResolvedValue(makePublications(2));

      const result = await getCompanyPublications({ uid: 'CHE-123.456.789' });

      expect(mockGetSogcByUid).toHaveBeenCalledWith('CHE123456789');
      expect(result.content[0].type).toBe('text');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toMatchObject({
        uid: 'CHE123456789',
        totalPublications: 2,
        returned: 2,
        offset: 0,
      });
      expect(parsed.publications).toHaveLength(2);
      expect(parsed.publications[0].message).toBe('Change 1');
    });

    it('should cap at 20 publications by default and report the total', async () => {
      mockGetSogcByUid.mockResolvedValue(makePublications(50));

      const parsed = JSON.parse(
        (await getCompanyPublications({ uid: 'CHE-123.456.789' })).content[0].text
      );

      expect(parsed.totalPublications).toBe(50);
      expect(parsed.returned).toBe(20);
      expect(parsed.publications).toHaveLength(20);
    });

    it('should page with maxResults and offset, keeping most recent first', async () => {
      mockGetSogcByUid.mockResolvedValue(makePublications(50));

      const parsed = JSON.parse(
        (await getCompanyPublications({ uid: 'CHE-123.456.789', maxResults: 10, offset: 45 })).content[0].text
      );

      expect(parsed.returned).toBe(5);
      expect(parsed.offset).toBe(45);
      expect(parsed.publications[0].sogcId).toBe(5045);
    });

    it('should return every publication when maxResults allows', async () => {
      mockGetSogcByUid.mockResolvedValue(makePublications(50));

      const parsed = JSON.parse(
        (await getCompanyPublications({ uid: 'CHE-123.456.789', maxResults: 200 })).content[0].text
      );

      expect(parsed.publications).toHaveLength(50);
    });

    it('should handle empty results', async () => {
      mockGetSogcByUid.mockResolvedValue([]);

      const parsed = JSON.parse(
        (await getCompanyPublications({ uid: 'CHE-123.456.789' })).content[0].text
      );

      expect(parsed.totalPublications).toBe(0);
      expect(parsed.publications).toEqual([]);
    });

    it('should handle null results', async () => {
      mockGetSogcByUid.mockResolvedValue(null);

      const parsed = JSON.parse(
        (await getCompanyPublications({ uid: 'CHE-123.456.789' })).content[0].text
      );

      expect(parsed.totalPublications).toBe(0);
      expect(parsed.publications).toEqual([]);
    });

    it('should handle undefined results', async () => {
      mockGetSogcByUid.mockResolvedValue(undefined);

      const parsed = JSON.parse(
        (await getCompanyPublications({ uid: 'CHE-123.456.789' })).content[0].text
      );

      expect(parsed.totalPublications).toBe(0);
      expect(parsed.publications).toEqual([]);
    });

    it('should throw error for invalid UID format', async () => {
      await expect(
        getCompanyPublications({ uid: 'invalid-uid' })
      ).rejects.toThrow();
    });

    it('should throw error for missing UID', async () => {
      await expect(getCompanyPublications({})).rejects.toThrow();
    });

    it('should handle API errors', async () => {
      mockGetSogcByUid.mockRejectedValue(new Error('API Error'));

      await expect(
        getCompanyPublications({ uid: 'CHE-123.456.789' })
      ).rejects.toThrow('API Error');
    });

    it('should return MCP-compliant response', async () => {
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await getCompanyPublications({ uid: 'CHE-123.456.789' });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should handle unformatted UID', async () => {
      mockGetSogcByUid.mockResolvedValue([]);

      await getCompanyPublications({ uid: 'CHE123456789' });

      expect(mockGetSogcByUid).toHaveBeenCalledWith('CHE123456789');
    });
  });

  describe('registerSogcTools', () => {
    it('should register both SOGC tools', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerSogcTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledTimes(2);
    });

    it('should register get_daily_registrations tool', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerSogcTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_daily_registrations',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_company_publications tool', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerSogcTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_company_publications',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register tools with correct descriptions', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerSogcTools(mockServer);

      const calls = mockServer.tool.mock.calls;
      
      const dailyRegCall = calls.find(call => call[0] === 'get_daily_registrations');
      expect(dailyRegCall[1]).toContain('SOGC');
      expect(dailyRegCall[1]).toContain('date');

      const companyPubCall = calls.find(call => call[0] === 'get_company_publications');
      expect(companyPubCall[1]).toContain('SOGC');
      expect(companyPubCall[1]).toContain('UID');
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent requests for daily registrations', async () => {
      mockGetSogcByDate.mockResolvedValue([makeRecord(1)]);

      const results = await Promise.all([
        getDailyRegistrations({ date: '2025-01-15' }),
        getDailyRegistrations({ date: '2025-01-16' }),
        getDailyRegistrations({ date: '2025-01-17' }),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('content');
        expect(result.content[0].type).toBe('text');
      });
    });

    it('should handle concurrent requests for company publications', async () => {
      mockGetSogcByUid.mockResolvedValue(makePublications(1));

      const results = await Promise.all([
        getCompanyPublications({ uid: 'CHE-123.456.789' }),
        getCompanyPublications({ uid: 'CHE-234.567.890' }),
        getCompanyPublications({ uid: 'CHE-345.678.901' }),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('content');
        expect(result.content[0].type).toBe('text');
      });
    });

    it('should preserve special characters in publication text', async () => {
      mockGetSogcByDate.mockResolvedValue([
        makeRecord(1, {
          sogcPublication: { message: 'Company with special chars: äöü, €, <>&"' },
          companyShort: { name: 'Test & Co. AG' },
        }),
      ]);

      const parsed = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15', includeText: true })).content[0].text
      );

      expect(parsed.publications[0].company.name).toBe('Test & Co. AG');
      expect(parsed.publications[0].message).toContain('äöü');
      expect(parsed.publications[0].message).toContain('€');
    });

    it('should not truncate very long publication texts', async () => {
      mockGetSogcByDate.mockResolvedValue([
        makeRecord(1, { sogcPublication: { message: 'A'.repeat(10000) } }),
      ]);

      const parsed = JSON.parse(
        (await getDailyRegistrations({ date: '2025-01-15', includeText: true })).content[0].text
      );

      expect(parsed.publications[0].message).toHaveLength(10000);
    });
  });
});
