/**
 * @fileoverview Unit tests for Zefix REST API client.
 * Tests HTTP client initialization, API methods, caching, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZefixClient } from '../../../src/api/zefix-client.js';
import { cache } from '../../../src/utils/cache.js';

// Mock ky module
vi.mock('ky', () => {
  const mockKy = {
    create: vi.fn(() => mockKy),
    post: vi.fn(),
    get: vi.fn(),
  };
  return { default: mockKy };
});

// Mock cache
vi.mock('../../../src/utils/cache.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock config
vi.mock('../../../src/config.js', () => ({
  config: {
    zefix: {
      baseUrl: 'https://www.zefix.admin.ch/ZefixPublicREST/api/v1',
      username: 'test-user',
      password: 'test-pass',
    },
  },
}));

describe('ZefixClient', () => {
  let client;
  let mockKy;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Get mocked ky
    const kyModule = await import('ky');
    mockKy = kyModule.default;
    
    // Create new client instance
    client = new ZefixClient();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(mockKy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          prefixUrl: 'https://www.zefix.admin.ch/ZefixPublicREST/api/v1',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          timeout: 30000,
        })
      );
    });

    it('should set up basic authentication', () => {
      const createCall = mockKy.create.mock.calls[0][0];
      expect(createCall.headers.Authorization).toMatch(/^Basic /);
    });

    it('should configure retry logic', () => {
      const createCall = mockKy.create.mock.calls[0][0];
      expect(createCall.retry).toEqual({
        limit: 3,
        methods: ['get', 'post'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
      });
    });
  });

  describe('searchCompanies', () => {
    const mockSearchParams = {
      name: 'Test Company',
      canton: 'ZH',
      activeOnly: true,
      maxEntries: 10,
    };

    const mockSearchResponse = {
      list: [
        {
          uid: 'CHE-123.456.789',
          name: 'Test Company AG',
          legalSeat: 'Zürich',
          canton: 'ZH',
          status: 'ACTIVE',
        },
      ],
    };

    it('should search companies successfully', async () => {
      cache.get.mockReturnValue(null);
      mockKy.post.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockSearchResponse),
      });

      const result = await client.searchCompanies(mockSearchParams);

      expect(mockKy.post).toHaveBeenCalledWith('company/search', {
        json: mockSearchParams,
      });
      expect(result).toEqual(mockSearchResponse);
    });

    it('should return cached results if available', async () => {
      cache.get.mockReturnValue(mockSearchResponse);

      const result = await client.searchCompanies(mockSearchParams);

      expect(mockKy.post).not.toHaveBeenCalled();
      expect(result).toEqual(mockSearchResponse);
    });

    it('should cache successful search results', async () => {
      cache.get.mockReturnValue(null);
      mockKy.post.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockSearchResponse),
      });

      await client.searchCompanies(mockSearchParams);

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('zefix:search:'),
        mockSearchResponse,
        1800 // 30 minutes
      );
    });

    it('should handle search errors', async () => {
      cache.get.mockReturnValue(null);
      mockKy.post.mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      await expect(client.searchCompanies(mockSearchParams)).rejects.toThrow(
        'Zefix search failed: Network error'
      );
    });

    it('should generate unique cache keys for different searches', async () => {
      cache.get.mockReturnValue(null);
      mockKy.post.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockSearchResponse),
      });

      await client.searchCompanies({ name: 'Company A' });
      const cacheKey1 = cache.set.mock.calls[0][0];

      await client.searchCompanies({ name: 'Company B' });
      const cacheKey2 = cache.set.mock.calls[1][0];

      expect(cacheKey1).not.toEqual(cacheKey2);
    });
  });

  describe('getCompanyByUid', () => {
    const mockUid = 'CHE-123.456.789';
    const mockCompanyResponse = {
      uid: mockUid,
      name: 'Test Company AG',
      legalSeat: 'Zürich',
      canton: 'ZH',
      legalForm: {
        uid: '0106',
        name: 'Aktiengesellschaft',
      },
      status: 'ACTIVE',
      address: {
        street: 'Teststrasse 1',
        city: 'Zürich',
        postalCode: '8000',
      },
      chid: 'CH123456789',
    };

    it('should get company by UID successfully', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockCompanyResponse),
      });

      const result = await client.getCompanyByUid(mockUid);

      expect(mockKy.get).toHaveBeenCalledWith(`company/uid/${mockUid}`);
      expect(result).toEqual(mockCompanyResponse);
    });

    it('should return cached company data if available', async () => {
      cache.get.mockReturnValue(mockCompanyResponse);

      const result = await client.getCompanyByUid(mockUid);

      expect(mockKy.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockCompanyResponse);
    });

    it('should cache successful company lookups', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockCompanyResponse),
      });

      await client.getCompanyByUid(mockUid);

      expect(cache.set).toHaveBeenCalledWith(
        `zefix:company:${mockUid}`,
        mockCompanyResponse,
        3600 // 1 hour
      );
    });

    it('should unwrap the array Zefix answers with', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue([mockCompanyResponse]),
      });

      const result = await client.getCompanyByUid(mockUid);

      expect(result).toEqual(mockCompanyResponse);
      expect(cache.set).toHaveBeenCalledWith(
        `zefix:company:${mockUid}`,
        mockCompanyResponse,
        3600
      );
    });

    it('should keep further entries instead of dropping them', async () => {
      const second = { ...mockCompanyResponse, ehraid: 2 };
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue([mockCompanyResponse, second]),
      });

      const result = await client.getCompanyByUid(mockUid);

      expect(result).toEqual({ ...mockCompanyResponse, additionalEntries: [second] });
    });

    it('should report an empty answer as company not found', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue([]),
      });

      await expect(client.getCompanyByUid(mockUid)).rejects.toThrow(
        `Company not found for UID ${mockUid}`
      );
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('should report an HTTP 404 as company not found', async () => {
      const notFound = Object.assign(new Error('Request failed with status code 404'), {
        response: { status: 404 },
      });
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockRejectedValue(notFound),
      });

      await expect(client.getCompanyByUid(mockUid)).rejects.toThrow(
        `Company not found for UID ${mockUid}`
      );
    });

    it('should handle company not found errors', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error('Not found')),
      });

      await expect(client.getCompanyByUid(mockUid)).rejects.toThrow(
        'Failed to get company: Not found'
      );
    });
  });

  describe('error reporting', () => {
    // ky drops Zefix's explanation from error.message; it is only in the body.
    const httpError = (body) =>
      Object.assign(new Error('Request failed with status code 400 Bad Request: POST company/search'), {
        response: { status: 400, clone: () => ({ json: async () => body }) },
      });

    it('should explain a too-large search and how to narrow it', async () => {
      cache.get.mockReturnValue(null);
      mockKy.post.mockReturnValue({
        json: vi.fn().mockRejectedValue(
          httpError({ error: { type: 'RESULTLIST_TO_LARGE', message: 'too many results' } })
        ),
      });

      await expect(client.searchCompanies({ name: '*ab*' })).rejects.toThrow(
        /too many results; narrow the search \(add canton or legalFormUid/
      );
    });

    it('should append other Zefix error messages to the client message', async () => {
      cache.get.mockReturnValue(null);
      mockKy.post.mockReturnValue({
        json: vi.fn().mockRejectedValue(httpError({ error: { type: 'X', message: 'bad name' } })),
      });

      await expect(client.searchCompanies({ name: 'ab' })).rejects.toThrow(
        /Zefix search failed: Request failed with status code 400 .* \(bad name\)/
      );
    });

    it('should fall back to the client message when the body is not JSON', async () => {
      cache.get.mockReturnValue(null);
      const error = Object.assign(new Error('Request failed with status code 502'), {
        response: {
          status: 502,
          clone: () => ({
            json: async () => {
              throw new SyntaxError('Unexpected token <');
            },
          }),
        },
      });
      mockKy.post.mockReturnValue({ json: vi.fn().mockRejectedValue(error) });

      await expect(client.searchCompanies({ name: 'Test' })).rejects.toThrow(
        'Zefix search failed: Request failed with status code 502'
      );
    });
  });

  describe('SOGC message cleanup', () => {
    // What Zefix really sends: double-encoded UTF-8, FT tags, XML entities.
    const rawMessage =
      '<FT TYPE="N">M&amp;M AG</FT>, in <FT TYPE="5">ZÃ¼rich</FT>. Zweck: Software fÃ¼r O&apos;Brien.';
    const cleanMessage = "M&M AG, in Zürich. Zweck: Software für O'Brien.";

    it('should clean the message of every publication by date', async () => {
      cache.get.mockReturnValue(null);
      const record = {
        sogcPublication: { sogcId: 1, message: rawMessage },
        companyShort: { name: 'M&M AG' },
      };
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue([record, { companyShort: { name: 'No publication' } }]),
      });

      const result = await client.getSogcByDate('2026-09-28');

      expect(result[0].sogcPublication.message).toBe(cleanMessage);
      expect(result[0].sogcPublication.sogcId).toBe(1);
      expect(result[0].companyShort).toEqual({ name: 'M&M AG' });
      expect(result[1]).toEqual({ companyShort: { name: 'No publication' } });
    });

    it('should cache the cleaned publications', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue([{ sogcPublication: { message: rawMessage } }]),
      });

      await client.getSogcByDate('2026-09-28');

      expect(cache.set).toHaveBeenCalledWith(
        'zefix:sogc:2026-09-28',
        [{ sogcPublication: { message: cleanMessage } }],
        21600
      );
    });

    it('should clean the message of every company publication', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue([
          { name: 'M&M AG', sogcPub: [{ sogcId: 7, message: rawMessage }, { sogcId: 8 }] },
        ]),
      });

      const result = await client.getSogcByUid('CHE-123.456.789');

      expect(result).toEqual([{ sogcId: 7, message: cleanMessage }, { sogcId: 8 }]);
    });
  });

  describe('getSogcByDate', () => {
    const mockDate = '2024-11-13';
    const mockSogcResponse = [
      {
        uid: 'CHE-123.456.789',
        publicationDate: mockDate,
        publicationType: 'NEW',
        publicationText: 'New company registration',
        cantonalGazette: 'SHAB',
      },
      {
        uid: 'CHE-987.654.321',
        publicationDate: mockDate,
        publicationType: 'MUTATION',
        publicationText: 'Address change',
        cantonalGazette: 'SHAB',
      },
    ];

    it('should get SOGC publications by date successfully', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockSogcResponse),
      });

      const result = await client.getSogcByDate(mockDate);

      expect(mockKy.get).toHaveBeenCalledWith(`sogc/bydate/${mockDate}`);
      expect(result).toEqual(mockSogcResponse);
    });

    it('should return cached SOGC data if available', async () => {
      cache.get.mockReturnValue(mockSogcResponse);

      const result = await client.getSogcByDate(mockDate);

      expect(mockKy.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockSogcResponse);
    });

    it('should cache successful SOGC queries', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockSogcResponse),
      });

      await client.getSogcByDate(mockDate);

      expect(cache.set).toHaveBeenCalledWith(
        `zefix:sogc:${mockDate}`,
        mockSogcResponse,
        21600 // 6 hours
      );
    });

    it('should handle SOGC query errors', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error('Invalid date')),
      });

      await expect(client.getSogcByDate(mockDate)).rejects.toThrow(
        'Failed to get SOGC data: Invalid date'
      );
    });
  });

  describe('getSogcByUid', () => {
    const mockUid = 'CHE-123.456.789';
    const mockSogcResponse = [
      {
        publicationDate: '2024-11-13',
        publicationType: 'NEW',
        publicationText: 'Company registration',
        cantonalGazette: 'SHAB',
      },
      {
        publicationDate: '2024-10-15',
        publicationType: 'MUTATION',
        publicationText: 'Address change',
        cantonalGazette: 'SHAB',
      },
    ];

    it('should get SOGC publications by UID successfully', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ sogcPub: mockSogcResponse }),
      });

      const result = await client.getSogcByUid(mockUid);

      expect(mockKy.get).toHaveBeenCalledWith(`company/uid/${mockUid}`);
      expect(result).toEqual(mockSogcResponse);
    });

    it('should return cached SOGC data if available', async () => {
      cache.get.mockReturnValue(mockSogcResponse);

      const result = await client.getSogcByUid(mockUid);

      expect(mockKy.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockSogcResponse);
    });

    it('should cache successful SOGC queries', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ sogcPub: mockSogcResponse }),
      });

      await client.getSogcByUid(mockUid);

      expect(cache.set).toHaveBeenCalledWith(
        `zefix:sogc:uid:${mockUid}`,
        mockSogcResponse,
        3600 // 1 hour
      );
    });

    it('should return empty array for 404 responses', async () => {
      cache.get.mockReturnValue(null);
      const error = new Error('Not found');
      error.response = { status: 404 };
      mockKy.get.mockReturnValue({
        json: vi.fn().mockRejectedValue(error),
      });

      const result = await client.getSogcByUid(mockUid);

      expect(result).toEqual([]);
    });

    it('should throw error for non-404 failures', async () => {
      cache.get.mockReturnValue(null);
      const error = new Error('Server error');
      error.response = { status: 500 };
      mockKy.get.mockReturnValue({
        json: vi.fn().mockRejectedValue(error),
      });

      await expect(client.getSogcByUid(mockUid)).rejects.toThrow(
        'Failed to get SOGC data for company: Server error'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty search results', async () => {
      cache.get.mockReturnValue(null);
      mockKy.post.mockReturnValue({
        json: vi.fn().mockResolvedValue({ list: [] }),
      });

      const result = await client.searchCompanies({ name: 'NonExistent' });

      expect(result.list).toEqual([]);
    });

    it('should handle special characters in search', async () => {
      cache.get.mockReturnValue(null);
      mockKy.post.mockReturnValue({
        json: vi.fn().mockResolvedValue({ list: [] }),
      });

      const params = { name: 'Test & Co.' };
      await client.searchCompanies(params);

      expect(mockKy.post).toHaveBeenCalledWith('company/search', {
        json: params,
      });
    });

    it('should handle UID with different formats', async () => {
      cache.get.mockReturnValue(null);
      mockKy.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ uid: 'CHE123456789' }),
      });

      await client.getCompanyByUid('CHE123456789');
      expect(mockKy.get).toHaveBeenCalledWith('company/uid/CHE123456789');

      await client.getCompanyByUid('CHE-123.456.789');
      expect(mockKy.get).toHaveBeenCalledWith('company/uid/CHE-123.456.789');
    });
  });
});
