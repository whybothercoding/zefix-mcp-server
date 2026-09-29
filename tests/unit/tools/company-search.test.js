/**
 * @fileoverview Unit tests for company search MCP tools.
 * Tests Zefix search, UID lookup, and advanced search functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to ensure mock functions are available during hoisting
const { mockZefixSearch, mockZefixGetByUid, mockUidGetByUid, mockUidSearch } =
  vi.hoisted(() => ({
    mockZefixSearch: vi.fn(),
    mockZefixGetByUid: vi.fn(),
    mockUidGetByUid: vi.fn(),
    mockUidSearch: vi.fn(),
  }));

vi.mock('../../../src/api/zefix-client.js', () => ({
  ZefixClient: vi.fn(function () { return {
    searchCompanies: mockZefixSearch,
    getCompanyByUid: mockZefixGetByUid,
  }; }),
}));

vi.mock('../../../src/api/uid-client.js', () => ({
  UidClient: vi.fn(function () { return {
    getByUid: mockUidGetByUid,
    search: mockUidSearch,
  }; }),
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks are set up
import {
  searchCompanies,
  getCompanyByUid,
  advancedSearch,
  registerSearchTools,
} from '../../../src/tools/company-search.js';

describe('Company Search Tools', () => {
  // Zefix answers a search with a plain array of CompanyShort records.
  const makeCompanies = (count) =>
    Array.from({ length: count }, (_, i) => ({
      name: `Test Company ${i} AG`,
      uid: `CHE${String(100000000 + i)}`,
      legalSeat: 'Zürich',
      status: 'ACTIVE',
    }));

  const mockSearchResults = [
    {
      name: 'Test Company AG',
      ehraid: 1,
      uid: 'CHE123456789',
      legalSeat: 'Zürich',
      legalForm: { uid: '0106', shortName: { de: 'AG' } },
      status: 'ACTIVE',
    },
  ];

  const mockCompanyDetails = {
    uid: 'CHE-123.456.789',
    name: 'Test Company AG',
    address: {
      street: 'Bahnhofstrasse 1',
      city: 'Zürich',
      zip: '8001',
    },
    legalForm: 'AG',
    status: 'active',
  };

  const mockUidData = {
    GetByUIDResult: {
      organisationType: [
        {
          organisation: {
            organisationIdentification: {
              uid: { uidOrganisationId: 123456789 },
              organisationName: 'Test Company AG',
            },
            nogaCode: [{ nogaCodeId: '62.01' }],
          },
          vatRegisterInformation: {
            vatNumber: 'CHE-123.456.789 MWST',
          },
        },
      ],
    },
  };

  const mockAdvancedSearchResults = {
    SearchResult: {
      uidEntitySearchResultItem: [
        {
          organisation: {
            organisationIdentification: {
              uid: { uidOrganisationId: 123456789 },
              organisationName: 'Test Company AG',
            },
            uidregInformation: {
              uidregStatusEnterpriseDetail: '3',
            },
          },
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockZefixSearch.mockReset();
    mockZefixGetByUid.mockReset();
    mockUidGetByUid.mockReset();
    mockUidSearch.mockReset();
  });

  describe('searchCompanies', () => {
    it('should search companies with basic parameters', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      const result = await searchCompanies({ name: 'Test' });

      expect(mockZefixSearch).toHaveBeenCalledWith({
        name: 'Test',
        activeOnly: true,
      });
      expect(result).toHaveProperty('content');
      expect(result.content[0].type).toBe('text');
    });

    it('should include canton filter', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      await searchCompanies({ name: 'Test', canton: 'ZH' });

      expect(mockZefixSearch).toHaveBeenCalledWith({
        name: 'Test',
        activeOnly: true,
        canton: 'ZH',
      });
    });

    it('should include legal form filter', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      await searchCompanies({ name: 'Test', legalFormUid: '0106' });

      expect(mockZefixSearch).toHaveBeenCalledWith({
        name: 'Test',
        activeOnly: true,
        legalFormUid: '0106',
      });
    });

    it('should not send maxResults to Zefix (its search has no limit field)', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      await searchCompanies({ name: 'Test', maxResults: 50 });

      expect(mockZefixSearch).toHaveBeenCalledWith({
        name: 'Test',
        activeOnly: true,
      });
    });

    it('should apply maxResults to the returned companies', async () => {
      mockZefixSearch.mockResolvedValue(makeCompanies(77));

      const result = await searchCompanies({ name: 'Test', maxResults: 5 });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.totalMatches).toBe(77);
      expect(parsed.returned).toBe(5);
      expect(parsed.companies.map((c) => c.uid)).toEqual(
        makeCompanies(5).map((c) => c.uid)
      );
    });

    it('should exclude companies in liquidation or deleted when activeOnly', async () => {
      mockZefixSearch.mockResolvedValue([
        { name: 'Alive AG', uid: 'CHE100000001', status: 'ACTIVE' },
        { name: 'Dying AG in Liquidation', uid: 'CHE100000002', status: 'BEING_CANCELLED' },
        { name: 'Gone AG', uid: 'CHE100000003', status: 'CANCELLED' },
      ]);

      const parsed = JSON.parse(
        (await searchCompanies({ name: 'Test' })).content[0].text
      );

      expect(parsed.companies.map((c) => c.name)).toEqual(['Alive AG']);
      expect(parsed.totalMatches).toBe(1);
    });

    it('should keep companies in liquidation when activeOnly is false', async () => {
      mockZefixSearch.mockResolvedValue([
        { name: 'Alive AG', uid: 'CHE100000001', status: 'ACTIVE' },
        { name: 'Dying AG in Liquidation', uid: 'CHE100000002', status: 'BEING_CANCELLED' },
      ]);

      const parsed = JSON.parse(
        (await searchCompanies({ name: 'Test', activeOnly: false })).content[0].text
      );

      expect(parsed.totalMatches).toBe(2);
      expect(parsed.companies).toHaveLength(2);
    });

    it('should default maxResults to 30', async () => {
      mockZefixSearch.mockResolvedValue(makeCompanies(77));

      const result = await searchCompanies({ name: 'Test' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.totalMatches).toBe(77);
      expect(parsed.companies).toHaveLength(30);
    });

    it('should return every match when fewer than maxResults', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      const result = await searchCompanies({ name: 'Test' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toEqual({
        totalMatches: 1,
        returned: 1,
        companies: mockSearchResults,
      });
    });

    it('should handle activeOnly false', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      await searchCompanies({ name: 'Test', activeOnly: false });

      expect(mockZefixSearch).toHaveBeenCalledWith({
        name: 'Test',
        activeOnly: false,
      });
    });

    it('should handle all filters combined', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      await searchCompanies({
        name: 'Test',
        canton: 'ZH',
        legalFormUid: '0106',
        activeOnly: true,
        maxResults: 20,
      });

      expect(mockZefixSearch).toHaveBeenCalledWith({
        name: 'Test',
        canton: 'ZH',
        legalFormUid: '0106',
        activeOnly: true,
      });
    });

    it('should return MCP-compliant response', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      const result = await searchCompanies({ name: 'Test' });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should return valid JSON', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      const result = await searchCompanies({ name: 'Test' });

      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should throw error for invalid parameters', async () => {
      await expect(searchCompanies({ name: 'AB' })).rejects.toThrow();
    });

    it('should throw error for missing name', async () => {
      await expect(searchCompanies({})).rejects.toThrow();
    });

    it('should handle API errors', async () => {
      mockZefixSearch.mockRejectedValue(new Error('API error'));

      await expect(searchCompanies({ name: 'Test' })).rejects.toThrow(
        'API error'
      );
    });

    it('should handle empty results', async () => {
      mockZefixSearch.mockResolvedValue([]);

      const result = await searchCompanies({ name: 'NonExistent' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toEqual({ totalMatches: 0, returned: 0, companies: [] });
    });

    it('should handle wildcard searches', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      await searchCompanies({ name: 'Test*' });

      expect(mockZefixSearch).toHaveBeenCalledWith({
        name: 'Test*',
        activeOnly: true,
      });
    });
  });

  describe('getCompanyByUid', () => {
    it('should get company by UID without enrichment', async () => {
      mockZefixGetByUid.mockResolvedValue(mockCompanyDetails);

      const result = await getCompanyByUid({
        uid: 'CHE-123.456.789',
        enrichWithUidData: false,
      });

      expect(mockZefixGetByUid).toHaveBeenCalledWith('CHE123456789');
      expect(mockUidGetByUid).not.toHaveBeenCalled();
      expect(result.content[0].type).toBe('text');
    });

    it('should get company by UID with enrichment', async () => {
      mockZefixGetByUid.mockResolvedValue(mockCompanyDetails);
      mockUidGetByUid.mockResolvedValue(mockUidData);

      const result = await getCompanyByUid({
        uid: 'CHE-123.456.789',
        enrichWithUidData: true,
      });

      expect(mockZefixGetByUid).toHaveBeenCalledWith('CHE123456789');
      expect(mockUidGetByUid).toHaveBeenCalledWith('CHE123456789');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('uidWebserviceData');
    });

    it('should default to enrichment enabled', async () => {
      mockZefixGetByUid.mockResolvedValue(mockCompanyDetails);
      mockUidGetByUid.mockResolvedValue(mockUidData);

      await getCompanyByUid({ uid: 'CHE-123.456.789' });

      expect(mockUidGetByUid).toHaveBeenCalled();
    });

    it('should fallback to Zefix data if enrichment fails', async () => {
      mockZefixGetByUid.mockResolvedValue(mockCompanyDetails);
      mockUidGetByUid.mockRejectedValue(new Error('UID service error'));

      const result = await getCompanyByUid({
        uid: 'CHE-123.456.789',
        enrichWithUidData: true,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).not.toHaveProperty('uidWebserviceData');
      expect(parsed).toEqual(mockCompanyDetails);
    });

    it('should return a flat company object when enriched', async () => {
      mockZefixGetByUid.mockResolvedValue(mockCompanyDetails);
      mockUidGetByUid.mockResolvedValue(mockUidData);

      const result = await getCompanyByUid({ uid: 'CHE-123.456.789' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.name).toBe('Test Company AG');
      expect(parsed.uidWebserviceData).toEqual(mockUidData);
      expect(parsed).not.toHaveProperty('0');
    });

    it('should replace the sogcPub list with a publication count', async () => {
      mockZefixGetByUid.mockResolvedValue({
        ...mockCompanyDetails,
        sogcPub: [{ sogcId: 1 }, { sogcId: 2 }],
      });

      const result = await getCompanyByUid({
        uid: 'CHE-123.456.789',
        enrichWithUidData: false,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).not.toHaveProperty('sogcPub');
      expect(parsed.sogcPublicationCount).toBe(2);
      expect(parsed.name).toBe('Test Company AG');
    });

    it('should handle unformatted UID', async () => {
      mockZefixGetByUid.mockResolvedValue(mockCompanyDetails);

      await getCompanyByUid({
        uid: 'CHE123456789',
        enrichWithUidData: false,
      });

      expect(mockZefixGetByUid).toHaveBeenCalledWith('CHE123456789');
    });

    it('should throw error for invalid UID', async () => {
      await expect(
        getCompanyByUid({ uid: 'invalid', enrichWithUidData: false })
      ).rejects.toThrow();
    });

    it('should throw error for missing UID', async () => {
      await expect(
        getCompanyByUid({ enrichWithUidData: false })
      ).rejects.toThrow();
    });

    it('should handle Zefix API errors', async () => {
      mockZefixGetByUid.mockRejectedValue(new Error('Zefix error'));

      await expect(
        getCompanyByUid({ uid: 'CHE-123.456.789', enrichWithUidData: false })
      ).rejects.toThrow('Zefix error');
    });

    it('should return MCP-compliant response', async () => {
      mockZefixGetByUid.mockResolvedValue(mockCompanyDetails);

      const result = await getCompanyByUid({
        uid: 'CHE-123.456.789',
        enrichWithUidData: false,
      });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });

    it('should merge Zefix and UID data correctly', async () => {
      mockZefixGetByUid.mockResolvedValue(mockCompanyDetails);
      mockUidGetByUid.mockResolvedValue(mockUidData);

      const result = await getCompanyByUid({
        uid: 'CHE-123.456.789',
        enrichWithUidData: true,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.uid).toBe(mockCompanyDetails.uid);
      expect(parsed.uidWebserviceData).toEqual(mockUidData);
    });
  });

  describe('advancedSearch', () => {
    it('should search by organization name', async () => {
      mockUidSearch.mockResolvedValue(mockAdvancedSearchResults);

      const result = await advancedSearch({ organisationName: 'Test' });

      expect(mockUidSearch).toHaveBeenCalledWith(
        { organisationName: 'Test' },
        expect.objectContaining({
          searchMode: 'Auto',
          maxNumberOfRecords: 30,
        })
      );
      expect(result.content[0].type).toBe('text');
    });

    it('should search by person name', async () => {
      mockUidSearch.mockResolvedValue(mockAdvancedSearchResults);

      await advancedSearch({
        personName: { officialName: 'Müller', firstName: 'Hans' },
      });

      expect(mockUidSearch).toHaveBeenCalledWith(
        {
          personName: { officialName: 'Müller', firstName: 'Hans' },
        },
        expect.any(Object)
      );
    });

    it('should include canton filter', async () => {
      mockUidSearch.mockResolvedValue(mockAdvancedSearchResults);

      await advancedSearch({ organisationName: 'Test', canton: 'ZH' });

      expect(mockUidSearch).toHaveBeenCalledWith(
        {
          organisationName: 'Test',
          address: { cantonAbbreviation: 'ZH' },
        },
        expect.any(Object)
      );
    });

    it('should include legal forms filter', async () => {
      mockUidSearch.mockResolvedValue(mockAdvancedSearchResults);

      await advancedSearch({
        organisationName: 'Test',
        legalForms: ['0106', '0107'],
      });

      expect(mockUidSearch).toHaveBeenCalledWith(
        {
          organisationName: 'Test',
          legalForm: ['0106', '0107'],
        },
        expect.any(Object)
      );
    });

    it('should handle maxResults parameter', async () => {
      mockUidSearch.mockResolvedValue(mockAdvancedSearchResults);

      await advancedSearch({ organisationName: 'Test', maxResults: 50 });

      expect(mockUidSearch).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ maxNumberOfRecords: 50 })
      );
    });

    it('should filter active companies client-side', async () => {
      const mixedResults = {
        SearchResult: {
          uidEntitySearchResultItem: [
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Active Company',
                },
                uidregInformation: {
                  uidregStatusEnterpriseDetail: '3',
                },
              },
            },
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Inactive Company',
                },
                uidregInformation: {
                  uidregStatusEnterpriseDetail: '1',
                },
              },
            },
          ],
        },
      };

      mockUidSearch.mockResolvedValue(mixedResults);

      const result = await advancedSearch({
        organisationName: 'Test',
        activeOnly: true,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(
        parsed.SearchResult.uidEntitySearchResultItem
      ).toHaveLength(1);
      expect(
        parsed.SearchResult.uidEntitySearchResultItem[0].organisation
          .organisationIdentification.organisationName
      ).toBe('Active Company');
    });

    it('should handle numeric status code', async () => {
      const resultsWithNumericStatus = {
        SearchResult: {
          uidEntitySearchResultItem: [
            {
              organisation: {
                uidregInformation: {
                  uidregStatusEnterpriseDetail: 3,
                },
              },
            },
          ],
        },
      };

      mockUidSearch.mockResolvedValue(resultsWithNumericStatus);

      const result = await advancedSearch({
        organisationName: 'Test',
        activeOnly: true,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(
        parsed.SearchResult.uidEntitySearchResultItem
      ).toHaveLength(1);
    });

    it('should not filter when activeOnly is false', async () => {
      const mixedResults = {
        SearchResult: {
          uidEntitySearchResultItem: [
            {
              organisation: {
                uidregInformation: { uidregStatusEnterpriseDetail: '3' },
              },
            },
            {
              organisation: {
                uidregInformation: { uidregStatusEnterpriseDetail: '1' },
              },
            },
          ],
        },
      };

      mockUidSearch.mockResolvedValue(mixedResults);

      const result = await advancedSearch({
        organisationName: 'Test',
        activeOnly: false,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(
        parsed.SearchResult.uidEntitySearchResultItem
      ).toHaveLength(2);
    });

    it('should handle single result item', async () => {
      const singleResult = {
        SearchResult: {
          uidEntitySearchResultItem: {
            organisation: {
              uidregInformation: {
                uidregStatusEnterpriseDetail: '3',
              },
            },
          },
        },
      };

      mockUidSearch.mockResolvedValue(singleResult);

      const result = await advancedSearch({
        organisationName: 'Test',
        activeOnly: true,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed.SearchResult.uidEntitySearchResultItem)).toBe(
        true
      );
    });

    it('should handle empty results', async () => {
      mockUidSearch.mockResolvedValue({
        SearchResult: { uidEntitySearchResultItem: [] },
      });

      const result = await advancedSearch({ organisationName: 'NonExistent' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.SearchResult.uidEntitySearchResultItem).toHaveLength(0);
    });

    it('should handle API errors', async () => {
      mockUidSearch.mockRejectedValue(new Error('UID service error'));

      await expect(
        advancedSearch({ organisationName: 'Test' })
      ).rejects.toThrow('UID service error');
    });

    it('should return MCP-compliant response', async () => {
      mockUidSearch.mockResolvedValue(mockAdvancedSearchResults);

      const result = await advancedSearch({ organisationName: 'Test' });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });

    it('should handle all filters combined', async () => {
      mockUidSearch.mockResolvedValue(mockAdvancedSearchResults);

      await advancedSearch({
        organisationName: 'Test',
        canton: 'ZH',
        legalForms: ['0106'],
        activeOnly: true,
        maxResults: 20,
      });

      expect(mockUidSearch).toHaveBeenCalledWith(
        {
          organisationName: 'Test',
          address: { cantonAbbreviation: 'ZH' },
          legalForm: ['0106'],
        },
        expect.objectContaining({ maxNumberOfRecords: 20 })
      );
    });
  });

  describe('registerSearchTools', () => {
    it('should register all three search tools', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerSearchTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledTimes(3);
    });

    it('should register search_companies tool', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerSearchTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'search_companies',
        expect.stringContaining('Zefix'),
        expect.any(Object),
        searchCompanies
      );
    });

    it('should register get_company_by_uid tool', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerSearchTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_company_by_uid',
        expect.stringContaining('UID'),
        expect.any(Object),
        getCompanyByUid
      );
    });

    it('should register advanced_search tool', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerSearchTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'advanced_search',
        expect.stringContaining('Advanced'),
        expect.any(Object),
        advancedSearch
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent search requests', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      const promises = [
        searchCompanies({ name: 'Test1' }),
        searchCompanies({ name: 'Test2' }),
        searchCompanies({ name: 'Test3' }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockZefixSearch).toHaveBeenCalledTimes(3);
    });

    it('should handle special characters in search', async () => {
      mockZefixSearch.mockResolvedValue(mockSearchResults);

      await searchCompanies({ name: 'Café & Restaurant "Zürich"' });

      expect(mockZefixSearch).toHaveBeenCalledWith({
        name: 'Café & Restaurant "Zürich"',
        activeOnly: true,
      });
    });

    it('should cap large result sets at maxResults and report the total', async () => {
      mockZefixSearch.mockResolvedValue(makeCompanies(250));

      const result = await searchCompanies({ name: 'Test', maxResults: 200 });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.totalMatches).toBe(250);
      expect(parsed.returned).toBe(200);
      expect(parsed.companies).toHaveLength(200);
    });
  });
});
