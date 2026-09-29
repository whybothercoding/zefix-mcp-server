/**
 * @fileoverview Unit tests for validation MCP tools.
 * Tests UID and VAT number validation tools.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to ensure mock functions are available during hoisting
const { mockValidateUid, mockValidateVatNumber } = vi.hoisted(() => ({
  mockValidateUid: vi.fn(),
  mockValidateVatNumber: vi.fn(),
}));

vi.mock('../../../src/api/uid-client.js', () => ({
  UidClient: vi.fn(function () { return {
    validateUid: mockValidateUid,
    validateVatNumber: mockValidateVatNumber,
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
import { validateUid, validateVatNumber, registerValidationTools } from '../../../src/tools/validation.js';

describe('Validation Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateUid.mockReset();
    mockValidateVatNumber.mockReset();
  });

  describe('validateUid', () => {
    it('should validate a valid UID successfully', async () => {
      mockValidateUid.mockResolvedValue(true);

      const result = await validateUid({ uid: 'CHE-123.456.789' });

      // Schema normalizes UID to CHE123456789 before passing to client
      expect(mockValidateUid).toHaveBeenCalledWith('CHE123456789');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                uid: 'CHE-123.456.789',
                valid: true,
                message: 'UID is valid and exists in the register',
              },
              null,
              2
            ),
          },
        ],
      });
    });

    it('should return false for invalid UID', async () => {
      mockValidateUid.mockResolvedValue(false);

      const result = await validateUid({ uid: 'CHE-999.999.999' });

      // Schema normalizes UID to CHE999999999 before passing to client
      expect(mockValidateUid).toHaveBeenCalledWith('CHE999999999');
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                uid: 'CHE-999.999.999',
                valid: false,
                message: 'UID is invalid or does not exist in the register',
              },
              null,
              2
            ),
          },
        ],
      });
    });

    it('should format unformatted UID', async () => {
      mockValidateUid.mockResolvedValue(true);

      const result = await validateUid({ uid: 'CHE123456789' });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.uid).toBe('CHE-123.456.789');
    });

    it('should handle UID with spaces', async () => {
      mockValidateUid.mockResolvedValue(true);

      const result = await validateUid({ uid: 'CHE 123 456 789' });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.uid).toBe('CHE-123.456.789');
    });

    it('should throw error for missing UID parameter', async () => {
      await expect(validateUid({})).rejects.toThrow();
    });

    it('should throw error for invalid UID format', async () => {
      await expect(validateUid({ uid: 'invalid' })).rejects.toThrow();
    });

    it('should throw error for empty UID', async () => {
      await expect(validateUid({ uid: '' })).rejects.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      mockValidateUid.mockRejectedValue(
        new Error('Service unavailable')
      );

      await expect(validateUid({ uid: 'CHE-123.456.789' })).rejects.toThrow(
        'Service unavailable'
      );
    });

    it('should return MCP-compliant response structure', async () => {
      mockValidateUid.mockResolvedValue(true);

      const result = await validateUid({ uid: 'CHE-123.456.789' });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('should return valid JSON in response', async () => {
      mockValidateUid.mockResolvedValue(true);

      const result = await validateUid({ uid: 'CHE-123.456.789' });

      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });
  });

  describe('validateVatNumber', () => {
    it('should validate a valid VAT number successfully', async () => {
      mockValidateVatNumber.mockResolvedValue(true);

      const result = await validateVatNumber({ vatNumber: 'CHE-123.456.789' });

      // Schema normalizes VAT number to CHE123456789 before passing to client
      expect(mockValidateVatNumber).toHaveBeenCalledWith(
        'CHE123456789'
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                vatNumber: 'CHE-123.456.789',
                valid: true,
                active: true,
                message: 'VAT number is valid and active',
              },
              null,
              2
            ),
          },
        ],
      });
    });

    it('should return false for invalid VAT number', async () => {
      mockValidateVatNumber.mockResolvedValue(false);

      const result = await validateVatNumber({ vatNumber: 'CHE-999.999.999' });

      // Schema normalizes VAT number to CHE999999999 before passing to client
      expect(mockValidateVatNumber).toHaveBeenCalledWith(
        'CHE999999999'
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                vatNumber: 'CHE-999.999.999',
                valid: false,
                active: false,
                message: 'VAT number is invalid or not active',
              },
              null,
              2
            ),
          },
        ],
      });
    });

    it('should format unformatted VAT number', async () => {
      mockValidateVatNumber.mockResolvedValue(true);

      const result = await validateVatNumber({ vatNumber: 'CHE123456789' });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.vatNumber).toBe('CHE-123.456.789');
    });

    it('should handle VAT number with spaces', async () => {
      mockValidateVatNumber.mockResolvedValue(true);

      const result = await validateVatNumber({
        vatNumber: 'CHE 123 456 789',
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.vatNumber).toBe('CHE-123.456.789');
    });

    it('should throw error for missing vatNumber parameter', async () => {
      await expect(validateVatNumber({})).rejects.toThrow();
    });

    it('should throw error for invalid VAT number format', async () => {
      await expect(validateVatNumber({ vatNumber: 'invalid' })).rejects.toThrow();
    });

    it('should throw error for empty VAT number', async () => {
      await expect(validateVatNumber({ vatNumber: '' })).rejects.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      mockValidateVatNumber.mockRejectedValue(
        new Error('Service unavailable')
      );

      await expect(
        validateVatNumber({ vatNumber: 'CHE-123.456.789' })
      ).rejects.toThrow('Service unavailable');
    });

    it('should return MCP-compliant response structure', async () => {
      mockValidateVatNumber.mockResolvedValue(true);

      const result = await validateVatNumber({ vatNumber: 'CHE-123.456.789' });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('should return valid JSON in response', async () => {
      mockValidateVatNumber.mockResolvedValue(true);

      const result = await validateVatNumber({ vatNumber: 'CHE-123.456.789' });

      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should include active status in response', async () => {
      mockValidateVatNumber.mockResolvedValue(true);

      const result = await validateVatNumber({ vatNumber: 'CHE-123.456.789' });
      const parsedResult = JSON.parse(result.content[0].text);

      expect(parsedResult).toHaveProperty('active');
      expect(parsedResult.active).toBe(true);
    });
  });

  describe('registerValidationTools', () => {
    it('should register validate_uid tool', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerValidationTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'validate_uid',
        expect.any(String),
        expect.any(Object),
        validateUid
      );
    });

    it('should register validate_vat_number tool', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerValidationTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'validate_vat_number',
        expect.any(String),
        expect.any(Object),
        validateVatNumber
      );
    });

    it('should register both tools', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerValidationTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledTimes(2);
    });

    it('should provide tool descriptions', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerValidationTools(mockServer);

      const uidCall = mockServer.tool.mock.calls.find(
        (call) => call[0] === 'validate_uid'
      );
      const vatCall = mockServer.tool.mock.calls.find(
        (call) => call[0] === 'validate_vat_number'
      );

      expect(uidCall[1]).toContain('UID');
      expect(vatCall[1]).toContain('VAT');
    });

    it('should provide schema shapes for tools', () => {
      const mockServer = {
        tool: vi.fn(),
      };

      registerValidationTools(mockServer);

      const uidCall = mockServer.tool.mock.calls.find(
        (call) => call[0] === 'validate_uid'
      );
      const vatCall = mockServer.tool.mock.calls.find(
        (call) => call[0] === 'validate_vat_number'
      );

      expect(uidCall[2]).toBeDefined();
      expect(vatCall[2]).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent validation requests', async () => {
      mockValidateUid.mockResolvedValue(true);

      const promises = [
        validateUid({ uid: 'CHE-123.456.789' }),
        validateUid({ uid: 'CHE-987.654.321' }),
        validateUid({ uid: 'CHE-111.222.333' }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockValidateUid).toHaveBeenCalledTimes(3);
    });

    it('should handle special characters in UID', async () => {
      mockValidateUid.mockResolvedValue(true);

      // Should handle and format correctly
      await validateUid({ uid: 'CHE-123.456.789' });

      expect(mockValidateUid).toHaveBeenCalled();
    });

    it('should maintain response consistency across multiple calls', async () => {
      mockValidateUid.mockResolvedValue(true);

      const result1 = await validateUid({ uid: 'CHE-123.456.789' });
      const result2 = await validateUid({ uid: 'CHE-123.456.789' });

      expect(result1).toEqual(result2);
    });
  });
});
