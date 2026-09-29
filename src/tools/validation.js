/**
 * @fileoverview MCP tools for validating Swiss business identifiers.
 * Provides validation for UIDs and VAT numbers using the public UID Webservice.
 * 
 * @module tools/validation
 */

import { UidClient } from '../api/uid-client.js';
import { validateUidSchema, validateVatSchema } from '../api/schemas.js';
import { logger } from '../utils/logger.js';
import { formatUid } from '../utils/formatting.js';

const uidClient = new UidClient();

/**
 * Validate a Swiss UID (Unternehmens-Identifikationsnummer).
 * 
 * Checks if a UID exists in the official Swiss UID register.
 * This is a lightweight validation that only confirms existence,
 * not detailed company status.
 * 
 * **Use Cases:**
 * - Quick validation before detailed lookups
 * - Form validation in applications
 * - Batch validation of UID lists
 * - Data quality checks
 * 
 * **No Authentication Required** - Uses public UID Webservice.
 * 
 * @async
 * @param {Object} args - Validation parameters (validated against validateUidSchema)
 * @param {string} args.uid - UID to validate (CHE-XXX.XXX.XXX format)
 * 
 * @returns {Promise<Object>} MCP tool response with validation result
 * @returns {Array<Object>} return.content - MCP content array
 * @returns {string} return.content[].type - Content type ('text')
 * @returns {string} return.content[].text - JSON string with validation result
 * 
 * @throws {ZodError} When parameters fail validation
 * @throws {Error} When UID Webservice request fails
 * 
 * @example
 * const result = await validateUid({
 *   uid: 'CHE-123.456.789'
 * });
 * 
 * // Returns:
 * // {
 * //   uid: 'CHE-123.456.789',
 * //   valid: true,
 * //   message: 'UID is valid and exists in the register'
 * // }
 * 
 * @example
 * // Invalid UID
 * const result = await validateUid({
 *   uid: 'CHE-999.999.999'
 * });
 * 
 * // Returns:
 * // {
 * //   uid: 'CHE-999.999.999',
 * //   valid: false,
 * //   message: 'UID is invalid or does not exist in the register'
 * // }
 * 
 * @see {@link module:api/uid-client~UidClient#validateUid}
 * @see {@link module:tools/uid-only~getCompanyDetailsUid} For detailed company information
 */
export async function validateUid(args) {
  const params = validateUidSchema.parse(args);
  
  logger.info({ params }, 'Executing validate_uid tool');

  const isValid = await uidClient.validateUid(params.uid);

  const result = {
    uid: formatUid(params.uid),
    valid: isValid,
    message: isValid 
      ? 'UID is valid and exists in the register' 
      : 'UID is invalid or does not exist in the register',
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

/**
 * Validate a Swiss VAT (MWST) number.
 * 
 * Checks if a VAT number is valid and currently active in the Swiss
 * VAT register. This validation confirms both format validity and
 * active registration status.
 * 
 * **Use Cases:**
 * - Verify supplier VAT numbers
 * - Validate customer VAT registration
 * - Compliance checks for invoicing
 * - B2B transaction validation
 * 
 * **No Authentication Required** - Uses public UID Webservice.
 * 
 * **Note:** Swiss VAT numbers use the same format as UIDs but with
 * " MWST" or " TVA" suffix (e.g., "CHE-123.456.789 MWST").
 * 
 * @async
 * @param {Object} args - Validation parameters (validated against validateVatSchema)
 * @param {string} args.vatNumber - VAT number to validate (CHE-XXX.XXX.XXX format)
 * 
 * @returns {Promise<Object>} MCP tool response with validation result
 * @returns {Array<Object>} return.content - MCP content array
 * @returns {string} return.content[].type - Content type ('text')
 * @returns {string} return.content[].text - JSON string with validation result
 * 
 * @throws {ZodError} When parameters fail validation
 * @throws {Error} When UID Webservice request fails
 * 
 * @example
 * const result = await validateVatNumber({
 *   vatNumber: 'CHE-123.456.789'
 * });
 * 
 * // Returns:
 * // {
 * //   vatNumber: 'CHE-123.456.789',
 * //   valid: true,
 * //   active: true,
 * //   message: 'VAT number is valid and active'
 * // }
 * 
 * @example
 * // Inactive or invalid VAT number
 * const result = await validateVatNumber({
 *   vatNumber: 'CHE-999.999.999'
 * });
 * 
 * // Returns:
 * // {
 * //   vatNumber: 'CHE-999.999.999',
 * //   valid: false,
 * //   active: false,
 * //   message: 'VAT number is invalid or not active'
 * // }
 * 
 * @see {@link module:api/uid-client~UidClient#validateVatNumber}
 * @see {@link https://www.uid.admin.ch/|Swiss UID Register}
 */
export async function validateVatNumber(args) {
  const params = validateVatSchema.parse(args);
  
  logger.info({ params }, 'Executing validate_vat_number tool');

  const isValid = await uidClient.validateVatNumber(params.vatNumber);

  const result = {
    vatNumber: formatUid(params.vatNumber),
    valid: isValid,
    active: isValid,
    message: isValid 
      ? 'VAT number is valid and active' 
      : 'VAT number is invalid or not active',
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

/**
 * Register validation tools with the MCP server.
 * 
 * Registers two validation tools:
 * 1. **validate_uid** - Validate Swiss UIDs
 * 2. **validate_vat_number** - Validate Swiss VAT numbers
 * 
 * Both tools use the public UID Webservice and require no authentication.
 * 
 * @param {Object} server - MCP server instance with tool() method
 * 
 * @example
 * import { Server } from '@modelcontextprotocol/sdk/server/index.js';
 * import { registerValidationTools } from './tools/validation.js';
 * 
 * const server = new Server(...);
 * registerValidationTools(server);
 * 
 * @see {@link https://modelcontextprotocol.io/docs/concepts/tools|MCP Tools Documentation}
 */
export function registerValidationTools(server) {
  // Tool 4: validate_uid
  server.tool(
    'validate_uid',
    'Validate a Swiss UID (Unternehmens-Identifikationsnummer) using the UID Webservice. Checks if the UID exists in the official register.',
    validateUidSchema.shape,
    validateUid
  );

  // Tool 5: validate_vat_number
  server.tool(
    'validate_vat_number',
    'Validate a Swiss VAT (MWST) number using the UID Webservice. Checks if the VAT number is valid and currently active.',
    validateVatSchema.shape,
    validateVatNumber
  );
}
