/**
 * @fileoverview Unit tests for due diligence report generation tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDueDiligenceReport, registerDueDiligenceTools } from '../../../src/tools/due-diligence.js';

// Mock dependencies using vi.hoisted()
const { mockGetCompanyByUid, mockGetSogcByUid, mockGetByUid, mockFormatDueDiligenceReport } = vi.hoisted(() => ({
  mockGetCompanyByUid: vi.fn(),
  mockGetSogcByUid: vi.fn(),
  mockGetByUid: vi.fn(),
  mockFormatDueDiligenceReport: vi.fn(),
}));

vi.mock('../../../src/api/zefix-client.js', () => ({
  ZefixClient: vi.fn(function () { return {
    getCompanyByUid: mockGetCompanyByUid,
    getSogcByUid: mockGetSogcByUid,
  }; }),
}));

vi.mock('../../../src/api/uid-client.js', () => ({
  UidClient: vi.fn(function () { return {
    getByUid: mockGetByUid,
  }; }),
}));

vi.mock('../../../src/utils/formatting.js', () => ({
  formatDueDiligenceReport: mockFormatDueDiligenceReport,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Due Diligence Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormatDueDiligenceReport.mockReturnValue('# Mock Report');
  });

  describe('generateDueDiligenceReport', () => {
    it('should generate report with data from all sources', async () => {
      const mockZefixData = {
        name: 'Test AG',
        uid: 'CHE-123.456.789',
        status: 'ACTIVE',
        legalForm: {
          name: 'Aktiengesellschaft',
          shortName: 'AG',
          uid: '0106',
        },
        address: {
          street: 'Teststrasse 1',
          city: 'Zürich',
          postalCode: '8000',
          canton: 'ZH',
        },
        legalSeat: 'ZH',
      };

      const mockUidData = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Test AG',
                  legalForm: '0106',
                },
                address: {
                  street: 'Teststrasse',
                  houseNumber: '1',
                  town: 'Zürich',
                  swissZipCode: '8000',
                  cantonAbbreviation: 'ZH',
                },
                NOGACode: '62.01',
                foundationDate: '2020-01-15',
              },
              uidregInformation: {
                uidregStatusEnterpriseDetail: '1',
              },
              vatRegisterInformation: {
                vatNumber: 'CHE-123.456.789 MWST',
                vatStatus: 'Active',
              },
              commercialRegisterInformation: {
                registerNumber: 'CH-020.3.123.456-7',
              },
            },
          ],
        },
      };

      const mockSogcData = [
        {
          publicationDate: '2025-01-15',
          publicationType: 'Modification',
          text: 'Address change',
        },
      ];

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockResolvedValue(mockUidData);
      mockGetSogcByUid.mockResolvedValue(mockSogcData);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
        includePublications: true,
      });

      expect(mockGetCompanyByUid).toHaveBeenCalledWith('CHE123456789');
      expect(mockGetByUid).toHaveBeenCalledWith('CHE123456789');
      expect(mockGetSogcByUid).toHaveBeenCalledWith('CHE123456789');
      expect(mockFormatDueDiligenceReport).toHaveBeenCalled();

      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('# Mock Report');
      expect(result.content[1].text).toContain('Raw Data');
    });

    it('should work with only Zefix data', async () => {
      const mockZefixData = {
        name: 'Test AG',
        uid: 'CHE-123.456.789',
        status: 'ACTIVE',
        legalForm: {
          name: 'Aktiengesellschaft',
          shortName: 'AG',
        },
      };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockRejectedValue(new Error('UID API Error'));
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(result).toHaveProperty('content');
      expect(result.content[0].text).toContain('# Mock Report');
    });

    it('should work with only UID data', async () => {
      const mockUidData = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Test AG',
                  legalForm: '0106',
                },
              },
              uidregInformation: {
                uidregStatusEnterpriseDetail: '1',
              },
            },
          ],
        },
      };

      mockGetCompanyByUid.mockRejectedValue(new Error('Zefix API Error'));
      mockGetByUid.mockResolvedValue(mockUidData);
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(result).toHaveProperty('content');
      expect(result.content[0].text).toContain('# Mock Report');
    });

    it('should throw error when both sources fail', async () => {
      mockGetCompanyByUid.mockRejectedValue(new Error('Zefix Error'));
      mockGetByUid.mockRejectedValue(new Error('UID Error'));

      await expect(
        generateDueDiligenceReport({ uid: 'CHE-123.456.789' })
      ).rejects.toThrow('Failed to retrieve company data');
    });

    it('should skip publications when includePublications is false', async () => {
      const mockZefixData = {
        name: 'Test AG',
        status: 'ACTIVE',
      };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockRejectedValue(new Error('UID Error'));

      await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
        includePublications: false,
      });

      expect(mockGetSogcByUid).not.toHaveBeenCalled();
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockZefixData = {
        name: 'Test AG',
        // Missing status, legalForm, address, etc.
      };

      const mockUidData = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Test AG',
                },
                // Missing other fields
              },
            },
          ],
        },
      };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockResolvedValue(mockUidData);
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(result).toHaveProperty('content');
      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'CHE123456789',
          name: 'Test AG',
        })
      );
    });

    it('should throw error for invalid UID format', async () => {
      await expect(
        generateDueDiligenceReport({ uid: 'invalid-uid' })
      ).rejects.toThrow();
    });

    it('should throw error for missing UID', async () => {
      await expect(generateDueDiligenceReport({})).rejects.toThrow();
    });

    it('should handle string legal form names', async () => {
      const mockZefixData = {
        name: 'Test AG',
        legalForm: {
          name: 'Aktiengesellschaft',
          shortName: 'AG',
        },
      };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockRejectedValue(new Error('UID Error'));
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(result).toHaveProperty('content');
    });

    it('should handle multilingual legal form names', async () => {
      const mockZefixData = {
        name: 'Test AG',
        legalForm: {
          name: {
            de: 'Aktiengesellschaft',
            en: 'Limited Company',
            fr: 'Société Anonyme',
          },
          shortName: {
            de: 'AG',
            en: 'Ltd',
            fr: 'SA',
          },
        },
      };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockRejectedValue(new Error('UID Error'));
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(result).toHaveProperty('content');
      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          legalForm: expect.objectContaining({
            name: 'Aktiengesellschaft',
            shortName: 'AG',
          }),
        })
      );
    });

    it('should map legal form codes correctly', async () => {
      const mockUidData = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Test GmbH',
                  legalForm: '0107', // GmbH code
                },
              },
              uidregInformation: {
                uidregStatusEnterpriseDetail: '1',
              },
            },
          ],
        },
      };

      mockGetCompanyByUid.mockRejectedValue(new Error('Zefix Error'));
      mockGetByUid.mockResolvedValue(mockUidData);
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          legalForm: expect.objectContaining({
            name: 'Gesellschaft mit beschränkter Haftung',
            shortName: 'GmbH',
            code: '0107',
          }),
        })
      );
    });

    it('should normalize status values', async () => {
      const mockZefixData = {
        name: 'Test AG',
        status: 'AKTIV', // German status
      };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockRejectedValue(new Error('UID Error'));
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Active',
        })
      );
    });

    it('should map UID status codes', async () => {
      const mockUidData = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Test AG',
                },
              },
              uidregInformation: {
                uidregStatusEnterpriseDetail: '2', // Inactive code
              },
            },
          ],
        },
      };

      mockGetCompanyByUid.mockRejectedValue(new Error('Zefix Error'));
      mockGetByUid.mockResolvedValue(mockUidData);
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Inactive',
        })
      );
    });

    it('should pass the register NOGA code (schema field NOGACode) to the report', async () => {
      mockGetCompanyByUid.mockRejectedValue(new Error('Zefix Error'));
      mockGetByUid.mockResolvedValue({
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: { organisationName: 'Test AG' },
                NOGACode: '62.01',
              },
            },
          ],
        },
      });
      mockGetSogcByUid.mockResolvedValue([]);

      await generateDueDiligenceReport({ uid: 'CHE-123.456.789' });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({ nogaCode: '62.01' })
      );
    });

    it('should use the Zefix canton, not the legal seat town', async () => {
      mockGetCompanyByUid.mockResolvedValue({
        name: 'Test AG',
        legalSeat: 'Zürich',
        canton: 'ZH',
      });
      mockGetByUid.mockRejectedValue(new Error('UID Error'));
      mockGetSogcByUid.mockResolvedValue([]);

      await generateDueDiligenceReport({ uid: 'CHE-123.456.789' });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({ canton: 'ZH' })
      );
    });

    it('should fall back to the canton and legal address of the UID Webservice', async () => {
      mockGetCompanyByUid.mockRejectedValue(new Error('Zefix Error'));
      mockGetByUid.mockResolvedValue({
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: { organisationName: 'Test AG' },
                // The UID Webservice lists one address per category.
                address: [
                  { addressCategory: 'POBOX', town: 'Bern Post', cantonAbbreviation: 'GE' },
                  { addressCategory: 'LEGAL', street: 'Teststrasse', town: 'Bern', cantonAbbreviation: 'BE' },
                ],
              },
            },
          ],
        },
      });
      mockGetSogcByUid.mockResolvedValue([]);

      await generateDueDiligenceReport({ uid: 'CHE-123.456.789' });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          canton: 'BE',
          address: expect.objectContaining({ street: 'Teststrasse', town: 'Bern' }),
        })
      );
    });

    it('should map Zefix address fields to the ones the report reads', async () => {
      mockGetCompanyByUid.mockResolvedValue({
        name: 'Test AG',
        canton: 'BE',
        address: { street: 'Teststrasse', houseNumber: '1', city: 'Bern', poBox: '12', swissZipCode: 3050 },
      });
      mockGetByUid.mockRejectedValue(new Error('UID Error'));
      mockGetSogcByUid.mockResolvedValue([]);

      await generateDueDiligenceReport({ uid: 'CHE-123.456.789' });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          address: expect.objectContaining({
            town: 'Bern',
            postOfficeBoxNumber: '12',
            swissZipCode: 3050,
          }),
        })
      );
    });

    it('should describe Zefix liquidation statuses in plain words', async () => {
      mockGetCompanyByUid.mockResolvedValue({ name: 'Test AG', status: 'BEING_CANCELLED' });
      mockGetByUid.mockRejectedValue(new Error('UID Error'));
      mockGetSogcByUid.mockResolvedValue([]);

      await generateDueDiligenceReport({ uid: 'CHE-123.456.789' });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'In Liquidation' })
      );
    });

    it('should not repeat the publication list in the raw data', async () => {
      const publications = Array.from({ length: 25 }, (_, i) => ({ sogcId: i }));
      mockGetCompanyByUid.mockResolvedValue({ name: 'Test AG', sogcPub: publications });
      mockGetByUid.mockRejectedValue(new Error('UID Error'));
      mockGetSogcByUid.mockResolvedValue(publications);

      const result = await generateDueDiligenceReport({ uid: 'CHE-123.456.789' });
      const raw = JSON.parse(result.content[1].text.split('**Raw Data (JSON)**')[1]);

      expect(raw.zefix).not.toHaveProperty('sogcPub');
      expect(raw.zefix.name).toBe('Test AG');
      expect(raw.sogc).toHaveLength(10);
      expect(raw.sogcPublicationCount).toBe(25);
    });

    it('should include VAT information when available', async () => {
      const mockUidData = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Test AG',
                },
              },
              uidregInformation: {
                uidregStatusEnterpriseDetail: '1',
              },
              vatRegisterInformation: {
                vatNumber: 'CHE-123.456.789 MWST',
                vatStatus: 'Active',
              },
            },
          ],
        },
      };

      mockGetCompanyByUid.mockRejectedValue(new Error('Zefix Error'));
      mockGetByUid.mockResolvedValue(mockUidData);
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          vatInfo: expect.objectContaining({
            vatNumber: 'CHE-123.456.789 MWST',
            vatStatus: 'Active',
          }),
        })
      );
    });

    it('should return MCP-compliant response', async () => {
      const mockZefixData = {
        name: 'Test AG',
      };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockRejectedValue(new Error('UID Error'));
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      expect(result.content[1]).toHaveProperty('type', 'text');
      expect(result.content[1]).toHaveProperty('text');
    });

    it('should include data source status in raw data', async () => {
      const mockZefixData = { name: 'Test AG' };
      const mockUidData = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Test AG',
                },
              },
            },
          ],
        },
      };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockResolvedValue(mockUidData);
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      const rawDataText = result.content[1].text;
      expect(rawDataText).toContain('Raw Data');
      expect(() => {
        const jsonMatch = rawDataText.match(/\{[\s\S]*\}/);
        if (jsonMatch) JSON.parse(jsonMatch[0]);
      }).not.toThrow();
    });
  });

  describe('registerDueDiligenceTools', () => {
    it('should register due diligence tool', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerDueDiligenceTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledTimes(1);
      expect(mockServer.tool).toHaveBeenCalledWith(
        'generate_due_diligence_report',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register tool with correct description', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerDueDiligenceTools(mockServer);

      const call = mockServer.tool.mock.calls[0];
      expect(call[1]).toContain('due diligence');
      expect(call[1]).toContain('Zefix');
      expect(call[1]).toContain('UID');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null UID response', async () => {
      const mockZefixData = { name: 'Test AG' };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockResolvedValue(null);
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(result).toHaveProperty('content');
    });

    it('should handle malformed UID response structure', async () => {
      const mockZefixData = { name: 'Test AG' };
      const malformedUidData = {
        GetByUIDResult: {
          // Missing organisationType array
        },
      };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockResolvedValue(malformedUidData);
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(result).toHaveProperty('content');
    });

    it('should handle unknown legal form codes', async () => {
      const mockUidData = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Test Company',
                  legalForm: '9999', // Unknown code
                },
              },
              uidregInformation: {
                uidregStatusEnterpriseDetail: '1',
              },
            },
          ],
        },
      };

      mockGetCompanyByUid.mockRejectedValue(new Error('Zefix Error'));
      mockGetByUid.mockResolvedValue(mockUidData);
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          legalForm: expect.objectContaining({
            name: 'Legal Form 9999',
            shortName: '9999',
          }),
        })
      );
    });

    it('should handle unknown status codes', async () => {
      const mockUidData = {
        GetByUIDResult: {
          organisationType: [
            {
              organisation: {
                organisationIdentification: {
                  organisationName: 'Test AG',
                },
              },
              uidregInformation: {
                uidregStatusEnterpriseDetail: '99', // Unknown code
              },
            },
          ],
        },
      };

      mockGetCompanyByUid.mockRejectedValue(new Error('Zefix Error'));
      mockGetByUid.mockResolvedValue(mockUidData);
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
      });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Unknown (99)',
        })
      );
    });

    it('should handle empty SOGC publications', async () => {
      const mockZefixData = { name: 'Test AG' };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockRejectedValue(new Error('UID Error'));
      mockGetSogcByUid.mockResolvedValue([]);

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
        includePublications: true,
      });

      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          sogcPublications: [],
        })
      );
    });

    it('should handle SOGC API failure gracefully', async () => {
      const mockZefixData = { name: 'Test AG' };

      mockGetCompanyByUid.mockResolvedValue(mockZefixData);
      mockGetByUid.mockRejectedValue(new Error('UID Error'));
      mockGetSogcByUid.mockRejectedValue(new Error('SOGC Error'));

      const result = await generateDueDiligenceReport({
        uid: 'CHE-123.456.789',
        includePublications: true,
      });

      expect(result).toHaveProperty('content');
      expect(mockFormatDueDiligenceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          sogcPublications: [],
        })
      );
    });
  });
});
