/**
 * @fileoverview Unit tests for UID-only MCP tools.
 * Tests company data retrieval via UID Webservice without Zefix.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to ensure mock functions are available during hoisting
const { mockGetByUid } = vi.hoisted(() => ({
  mockGetByUid: vi.fn(),
}));

vi.mock('../../../src/api/uid-client.js', () => ({
  UidClient: vi.fn(function () { return {
    getByUid: mockGetByUid,
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
  getCompanyDetailsUid,
  registerUidOnlyTools,
} from '../../../src/tools/uid-only.js';

describe('UID-Only Tools', () => {
  const mockUidData = {
    GetByUIDResult: {
      organisationType: [
        {
          organisation: {
            organisationIdentification: {
              uid: { uidOrganisationId: 123456789 },
              organisationName: 'Test Company AG',
              legalForm: '0106',
            },
            address: {
              street: 'Bahnhofstrasse',
              houseNumber: '1',
              swissZipCode: '8001',
              town: 'Zürich',
              cantonAbbreviation: 'ZH',
            },
            nogaCode: [{ nogaCodeId: '62.01' }],
            foundationDate: '2020-01-15',
          },
          uidregInformation: {
            uidregStatusEnterpriseDetail: '1',
          },
          vatRegisterInformation: {
            vatNumber: 'CHE-123.456.789 MWST',
            vatStatus: '1',
          },
          commercialRegisterInformation: {
            registerOffice: 'Zürich',
            registerNumber: 'CH-020.1.234.567-8',
          },
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetByUid.mockReset();
  });

  describe('getCompanyDetailsUid', () => {
    it('should retrieve company details successfully', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });

      // Schema normalizes UID to CHE123456789 before passing to client
      expect(mockGetByUid).toHaveBeenCalledWith('CHE123456789');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockUidData, null, 2),
          },
        ],
      });
    });

    it('should handle unformatted UID', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      await getCompanyDetailsUid({ uid: 'CHE123456789' });

      expect(mockGetByUid).toHaveBeenCalledWith('CHE123456789');
    });

    it('should handle UID with spaces', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      await getCompanyDetailsUid({ uid: 'CHE 123 456 789' });

      expect(mockGetByUid).toHaveBeenCalledWith('CHE123456789');
    });

    it('should throw error for missing UID parameter', async () => {
      await expect(getCompanyDetailsUid({})).rejects.toThrow();
    });

    it('should throw error for invalid UID format', async () => {
      await expect(
        getCompanyDetailsUid({ uid: 'invalid' })
      ).rejects.toThrow();
    });

    it('should throw error for empty UID', async () => {
      await expect(getCompanyDetailsUid({ uid: '' })).rejects.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      mockGetByUid.mockRejectedValue(new Error('Service unavailable'));

      await expect(
        getCompanyDetailsUid({ uid: 'CHE-123.456.789' })
      ).rejects.toThrow('Service unavailable');
    });

    it('should return MCP-compliant response structure', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('should return valid JSON in response', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });

      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should include organization data in response', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult).toHaveProperty('GetByUIDResult');
      expect(parsedResult.GetByUIDResult).toHaveProperty('organisationType');
    });

    it('should include address information', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });
      const parsedResult = JSON.parse(result.content[0].text);

      const org =
        parsedResult.GetByUIDResult.organisationType[0].organisation;
      expect(org).toHaveProperty('address');
      expect(org.address).toHaveProperty('street');
      expect(org.address).toHaveProperty('town');
    });

    it('should include NOGA codes', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });
      const parsedResult = JSON.parse(result.content[0].text);

      const org =
        parsedResult.GetByUIDResult.organisationType[0].organisation;
      expect(org).toHaveProperty('nogaCode');
      expect(Array.isArray(org.nogaCode)).toBe(true);
    });

    it('should include VAT information', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });
      const parsedResult = JSON.parse(result.content[0].text);

      const orgType = parsedResult.GetByUIDResult.organisationType[0];
      expect(orgType).toHaveProperty('vatRegisterInformation');
      expect(orgType.vatRegisterInformation).toHaveProperty('vatNumber');
    });

    it('should include commercial register information', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });
      const parsedResult = JSON.parse(result.content[0].text);

      const orgType = parsedResult.GetByUIDResult.organisationType[0];
      expect(orgType).toHaveProperty('commercialRegisterInformation');
      expect(orgType.commercialRegisterInformation).toHaveProperty(
        'registerOffice'
      );
    });

    it('should handle company without VAT registration', async () => {
      const dataWithoutVat = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  uid: { uidOrganisationId: 123456789 },
                  organisationName: 'Test Company',
                },
              },
              uidregInformation: {
                uidregStatusEnterpriseDetail: '1',
              },
            },
          ],
        },
      };

      mockGetByUid.mockResolvedValue(dataWithoutVat);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.GetByUIDResult.organisationType[0]).not.toHaveProperty(
        'vatRegisterInformation'
      );
    });

    it('should handle company without commercial register', async () => {
      const dataWithoutCR = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  uid: { uidOrganisationId: 123456789 },
                  organisationName: 'Test Company',
                },
              },
              uidregInformation: {
                uidregStatusEnterpriseDetail: '1',
              },
            },
          ],
        },
      };

      mockGetByUid.mockResolvedValue(dataWithoutCR);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.GetByUIDResult.organisationType[0]).not.toHaveProperty(
        'commercialRegisterInformation'
      );
    });

    it('should handle empty result', async () => {
      const emptyData = {
        GetByUIDResult: {
          organisationType: [],
        },
      };

      mockGetByUid.mockResolvedValue(emptyData);

      const result = await getCompanyDetailsUid({ uid: 'CHE-999.999.999' });
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.GetByUIDResult.organisationType).toHaveLength(0);
    });
  });

  describe('registerUidOnlyTools', () => {
    it('should register get_company_details_uid tool', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerUidOnlyTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_company_details_uid',
        expect.any(String),
        expect.any(Object),
        getCompanyDetailsUid
      );
    });

    it('should register exactly one tool', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerUidOnlyTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledTimes(1);
    });

    it('should provide tool description', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerUidOnlyTools(mockServer);

      const call = mockServer.tool.mock.calls[0];
      expect(call[1]).toBe('Get detailed company information using only the UID Webservice. This does not require Zefix authentication.');
    });

    it('should provide schema shape for tool', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerUidOnlyTools(mockServer);

      const call = mockServer.tool.mock.calls[0];
      expect(call[2]).toBeDefined();
      expect(call[2]).toHaveProperty('uid');
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent requests', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      const promises = [
        getCompanyDetailsUid({ uid: 'CHE-123.456.789' }),
        getCompanyDetailsUid({ uid: 'CHE-987.654.321' }),
        getCompanyDetailsUid({ uid: 'CHE-111.222.333' }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockGetByUid).toHaveBeenCalledTimes(3);
    });

    it('should handle large response data', async () => {
      const largeData = {
        GetByUIDResult: {
          organisationType: Array(10)
            .fill(null)
            .map((_, i) => ({
              organisation: {
                organisationIdentification: {
                  uid: { uidOrganisationId: 123456789 + i },
                  organisationName: `Company ${i}`,
                },
              },
            })),
        },
      };

      mockGetByUid.mockResolvedValue(largeData);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult.GetByUIDResult.organisationType).toHaveLength(10);
    });

    it('should maintain response consistency across multiple calls', async () => {
      mockGetByUid.mockResolvedValue(mockUidData);

      const result1 = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });
      const result2 = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });

      expect(result1).toEqual(result2);
    });

    it('should handle special characters in response data', async () => {
      const dataWithSpecialChars = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Café & Restaurant "Zürich"',
                },
                address: {
                  street: 'Straße mit Umlauten äöü',
                },
              },
            },
          ],
        },
      };

      mockGetByUid.mockResolvedValue(dataWithSpecialChars);

      const result = await getCompanyDetailsUid({ uid: 'CHE-123.456.789' });
      const parsedResult = JSON.parse(result.content[0].text);

      expect(
        parsedResult.GetByUIDResult.organisationType[0].organisation
          .organisationIdentification.organisationName
      ).toContain('Café');
    });
  });
});
