/**
 * @fileoverview Unit tests for UID Webservice SOAP API client.
 * Tests SOAP client initialization, API methods, caching, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UidClient } from '../../../src/api/uid-client.js';
import { cache } from '../../../src/utils/cache.js';

// Mock soap module
vi.mock('soap', () => ({
  default: {
    createClientAsync: vi.fn(),
  },
}));

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
    uid: {
      publicUrl: 'https://www.uid.admin.ch/services/uid/PublicServices.svc?wsdl',
    },
  },
}));

describe('UidClient', () => {
  let client;
  let mockSoapClient;
  let soap;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Get mocked soap
    const soapModule = await import('soap');
    soap = soapModule.default;
    
    // Create mock SOAP client
    mockSoapClient = {
      SearchAsync: vi.fn(),
      GetByUIDAsync: vi.fn(),
      ValidateUIDAsync: vi.fn(),
      ValidateVatNumberAsync: vi.fn(),
      GetOrganisationSampleAsync: vi.fn(),
    };
    
    soap.createClientAsync.mockResolvedValue(mockSoapClient);
    
    // Create new client instance
    client = new UidClient();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(client.publicUrl).toBe(
        'https://www.uid.admin.ch/services/uid/PublicServices.svc?wsdl'
      );
      expect(client.publicClient).toBeNull();
    });
  });

  describe('initPublicClient', () => {
    it('should initialize SOAP client on first call', async () => {
      const result = await client.initPublicClient();

      expect(soap.createClientAsync).toHaveBeenCalledWith(
        'https://www.uid.admin.ch/services/uid/PublicServices.svc?wsdl',
        { disableCache: true }
      );
      expect(result).toBe(mockSoapClient);
    });

    it('should return cached client on subsequent calls', async () => {
      await client.initPublicClient();
      await client.initPublicClient();

      expect(soap.createClientAsync).toHaveBeenCalledTimes(1);
    });

    it('should handle SOAP client initialization errors', async () => {
      soap.createClientAsync.mockRejectedValue(new Error('WSDL download failed'));

      await expect(client.initPublicClient()).rejects.toThrow(
        'Failed to initialize UID client: WSDL download failed'
      );
    });
  });

  describe('search', () => {
    const mockSearchParams = {
      organisationName: 'Test Company',
      canton: 'ZH',
      activeOnly: true,
    };

    const mockSearchResponse = {
      SearchResult: {
        uidEntitySearchResultItem: [
          {
            organisation: {
              uid: {
                uidOrganisationId: 123456789,
              },
              organisationIdentification: {
                organisationName: 'Test Company AG',
              },
            },
          },
        ],
      },
    };

    it('should search companies successfully', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.SearchAsync.mockResolvedValue([mockSearchResponse]);

      const result = await client.search(mockSearchParams);

      expect(mockSoapClient.SearchAsync).toHaveBeenCalledWith({
        searchParameters: {
          uidEntitySearchParameters: mockSearchParams,
        },
        config: {
          searchMode: 'Auto',
          maxNumberOfRecords: 30,
          searchNameAndAddressHistory: false,
        },
      });
      expect(result).toEqual(mockSearchResponse);
    });

    it('should return cached results if available', async () => {
      cache.get.mockReturnValue(mockSearchResponse);

      const result = await client.search(mockSearchParams);

      expect(mockSoapClient.SearchAsync).not.toHaveBeenCalled();
      expect(result).toEqual(mockSearchResponse);
    });

    it('should cache successful search results', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.SearchAsync.mockResolvedValue([mockSearchResponse]);

      await client.search(mockSearchParams);

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('uid:search:'),
        mockSearchResponse,
        1800 // 30 minutes
      );
    });

    it('should accept custom search settings', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.SearchAsync.mockResolvedValue([mockSearchResponse]);

      const customSettings = {
        searchMode: 'Exact',
        maxNumberOfRecords: 10,
        searchNameAndAddressHistory: true,
      };

      await client.search(mockSearchParams, customSettings);

      expect(mockSoapClient.SearchAsync).toHaveBeenCalledWith({
        searchParameters: {
          uidEntitySearchParameters: mockSearchParams,
        },
        config: customSettings,
      });
    });

    it('should handle search errors', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.SearchAsync.mockRejectedValue(new Error('SOAP fault'));

      await expect(client.search(mockSearchParams)).rejects.toThrow(
        'UID search failed: SOAP fault'
      );
    });

    it('should support person name search', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.SearchAsync.mockResolvedValue([mockSearchResponse]);

      const personSearchParams = {
        personName: {
          officialName: 'Müller',
          firstName: 'Hans',
        },
      };

      await client.search(personSearchParams);

      expect(mockSoapClient.SearchAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          searchParameters: {
            uidEntitySearchParameters: personSearchParams,
          },
        })
      );
    });
  });

  describe('getByUid', () => {
    const mockUid = 'CHE-123.456.789';
    const mockCompanyResponse = {
      GetByUIDResult: {
        organisation: {
          uid: {
            uidOrganisationIdCategorie: 'CHE',
            uidOrganisationId: 123456789,
          },
          organisationIdentification: {
            organisationName: 'Test Company AG',
          },
          address: [],
          contact: [],
        },
      },
    };

    it('should get company by UID successfully', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.GetByUIDAsync.mockResolvedValue([mockCompanyResponse]);

      const result = await client.getByUid(mockUid);

      expect(mockSoapClient.GetByUIDAsync).toHaveBeenCalledWith({
        uid: {
          uidOrganisationIdCategorie: 'CHE',
          uidOrganisationId: 123456789,
        },
      });
      expect(result).toEqual(mockCompanyResponse);
    });

    it('should return cached company data if available', async () => {
      cache.get.mockReturnValue(mockCompanyResponse);

      const result = await client.getByUid(mockUid);

      expect(mockSoapClient.GetByUIDAsync).not.toHaveBeenCalled();
      expect(result).toEqual(mockCompanyResponse);
    });

    it('should cache successful company lookups', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.GetByUIDAsync.mockResolvedValue([mockCompanyResponse]);

      await client.getByUid(mockUid);

      expect(cache.set).toHaveBeenCalledWith(
        `uid:company:${mockUid}`,
        mockCompanyResponse,
        3600 // 1 hour
      );
    });

    it('should handle company not found errors', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.GetByUIDAsync.mockRejectedValue(new Error('Not found'));

      await expect(client.getByUid(mockUid)).rejects.toThrow(
        'Failed to get company by UID: Not found'
      );
    });

    it('should format UID before lookup', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.GetByUIDAsync.mockResolvedValue([mockCompanyResponse]);

      // Test with unformatted UID
      await client.getByUid('CHE123456789');

      expect(mockSoapClient.GetByUIDAsync).toHaveBeenCalledWith({
        uid: {
          uidOrganisationIdCategorie: 'CHE',
          uidOrganisationId: 123456789,
        },
      });
    });
  });

  describe('formatUid', () => {
    it('should format unformatted UID', () => {
      expect(client.formatUid('CHE123456789')).toBe('CHE-123.456.789');
    });

    it('should handle already formatted UID', () => {
      expect(client.formatUid('CHE-123.456.789')).toBe('CHE-123.456.789');
    });

    it('should handle UID with spaces', () => {
      expect(client.formatUid('CHE 123 456 789')).toBe('CHE-123.456.789');
    });

    it('should handle lowercase UID', () => {
      expect(client.formatUid('che123456789')).toBe('che-123.456.789');
    });

    it('should return invalid UID unchanged', () => {
      expect(client.formatUid('invalid')).toBe('invalid');
      expect(client.formatUid('CHE12345')).toBe('CHE12345');
      expect(client.formatUid('ABC123456789')).toBe('ABC123456789');
    });
  });

  describe('validateUid', () => {
    it('should validate UID successfully', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.ValidateUIDAsync.mockResolvedValue([
        { ValidateUIDResult: true },
      ]);

      const result = await client.validateUid('CHE-123.456.789');

      expect(mockSoapClient.ValidateUIDAsync).toHaveBeenCalledWith({
        uid: 'CHE-123.456.789',
      });
      expect(result).toBe(true);
    });

    it('should return false for invalid UID', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.ValidateUIDAsync.mockResolvedValue([
        { ValidateUIDResult: false },
      ]);

      const result = await client.validateUid('CHE-999.999.999');

      expect(result).toBe(false);
    });

    it('should return cached validation result', async () => {
      cache.get.mockReturnValue(true);

      const result = await client.validateUid('CHE-123.456.789');

      expect(mockSoapClient.ValidateUIDAsync).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should cache validation results', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.ValidateUIDAsync.mockResolvedValue([
        { ValidateUIDResult: true },
      ]);

      await client.validateUid('CHE-123.456.789');

      expect(cache.set).toHaveBeenCalledWith(
        'uid:validate:CHE-123.456.789',
        true,
        86400 // 24 hours
      );
    });

    it('should handle validation errors', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.ValidateUIDAsync.mockRejectedValue(
        new Error('Service unavailable')
      );

      await expect(client.validateUid('CHE-123.456.789')).rejects.toThrow(
        'UID validation failed: Service unavailable'
      );
    });
  });

  describe('validateVatNumber', () => {
    it('should validate VAT number successfully', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.ValidateVatNumberAsync.mockResolvedValue([
        { ValidateVatNumberResult: true },
      ]);

      const result = await client.validateVatNumber('CHE-123.456.789');

      expect(mockSoapClient.ValidateVatNumberAsync).toHaveBeenCalledWith({
        vatNumber: 'CHE-123.456.789',
      });
      expect(result).toBe(true);
    });

    it('should return false for invalid VAT number', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.ValidateVatNumberAsync.mockResolvedValue([
        { ValidateVatNumberResult: false },
      ]);

      const result = await client.validateVatNumber('CHE-999.999.999');

      expect(result).toBe(false);
    });

    it('should return cached validation result', async () => {
      cache.get.mockReturnValue(true);

      const result = await client.validateVatNumber('CHE-123.456.789');

      expect(mockSoapClient.ValidateVatNumberAsync).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should cache validation results', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.ValidateVatNumberAsync.mockResolvedValue([
        { ValidateVatNumberResult: true },
      ]);

      await client.validateVatNumber('CHE-123.456.789');

      expect(cache.set).toHaveBeenCalledWith(
        'uid:validate:vat:CHE-123.456.789',
        true,
        3600 // 1 hour
      );
    });

    it('should handle validation errors', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.ValidateVatNumberAsync.mockRejectedValue(
        new Error('Service unavailable')
      );

      await expect(
        client.validateVatNumber('CHE-123.456.789')
      ).rejects.toThrow('VAT validation failed: Service unavailable');
    });
  });

  describe('getSample', () => {
    const mockSampleData = {
      GetOrganisationSampleResult: {
        organisation: {
          uid: {
            uidOrganisationId: 100000001,
          },
          organisationIdentification: {
            organisationName: 'Sample Organization',
          },
        },
      },
    };

    it('should get sample organization data', async () => {
      mockSoapClient.GetOrganisationSampleAsync.mockResolvedValue([
        mockSampleData,
      ]);

      const result = await client.getSample();

      expect(mockSoapClient.GetOrganisationSampleAsync).toHaveBeenCalledWith(
        {}
      );
      expect(result).toEqual(mockSampleData.GetOrganisationSampleResult);
    });

    it('should handle errors when getting sample data', async () => {
      mockSoapClient.GetOrganisationSampleAsync.mockRejectedValue(
        new Error('Service error')
      );

      await expect(client.getSample()).rejects.toThrow(
        'Failed to get sample data: Service error'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty search results', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.SearchAsync.mockResolvedValue([
        { SearchResult: { uidEntitySearchResultItem: [] } },
      ]);

      const result = await client.search({ organisationName: 'NonExistent' });

      expect(result.SearchResult.uidEntitySearchResultItem).toEqual([]);
    });

    it('should handle special characters in organization name', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.SearchAsync.mockResolvedValue([
        { SearchResult: { uidEntitySearchResultItem: [] } },
      ]);

      await client.search({ organisationName: 'Test & Co. GmbH' });

      expect(mockSoapClient.SearchAsync).toHaveBeenCalled();
    });

    it('should handle multiple legal forms in search', async () => {
      cache.get.mockReturnValue(null);
      mockSoapClient.SearchAsync.mockResolvedValue([
        { SearchResult: { uidEntitySearchResultItem: [] } },
      ]);

      await client.search({
        organisationName: 'Test',
        legalForms: ['0106', '0107'],
      });

      expect(mockSoapClient.SearchAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          searchParameters: {
            uidEntitySearchParameters: expect.objectContaining({
              legalForms: ['0106', '0107'],
            }),
          },
        })
      );
    });
  });
});
