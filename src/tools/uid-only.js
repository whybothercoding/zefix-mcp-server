/**
 * @fileoverview MCP tool for accessing company data via UID Webservice only.
 * Provides an alternative to Zefix that doesn't require authentication.
 * 
 * @module tools/uid-only
 */

import { UidClient } from '../api/uid-client.js';
import { getCompanyByUidSchema } from '../api/schemas.js';
import { logger } from '../utils/logger.js';

const uidClient = new UidClient();

/**
 * Get company details using only UID Webservice (no Zefix authentication required).
 * 
 * This tool provides an alternative to Zefix-based tools when:
 * - Zefix authentication is not available
 * - Only basic company information is needed
 * - VAT registration information is required
 * - Commercial register data is sufficient
 * 
 * The UID Webservice is a public Swiss government service that provides
 * comprehensive company information without requiring authentication.
 * 
 * **Data Included:**
 * - Organization name and identification
 * - Legal form and status
 * - Complete address information
 * - VAT registration details
 * - Commercial register information
 * - LEI (Legal Entity Identifier) if available
 * - Foundation date
 * 
 * **Data NOT Included (compared to Zefix):**
 * - SOGC publications
 * - Detailed commercial register history
 * - Some Zefix-specific metadata
 * 
 * @async
 * @param {Object} args - Query parameters (validated against getCompanyByUidSchema)
 * @param {string} args.uid - Company UID (CHE-XXX.XXX.XXX format)
 * 
 * @returns {Promise<Object>} MCP tool response with company data
 * @returns {Array<Object>} return.content - MCP content array
 * @returns {string} return.content[].type - Content type ('text')
 * @returns {string} return.content[].text - JSON string with raw UID Webservice data
 * 
 * @throws {ZodError} When parameters fail validation
 * @throws {Error} When UID Webservice request fails
 * 
 * @example
 * const result = await getCompanyDetailsUid({
 *   uid: 'CHE-123.456.789'
 * });
 * 
 * // Returns nested structure:
 * // {
 * //   GetByUIDResult: {
 * //     organisationType: [{
 * //       organisation: {
 * //         organisationIdentification: {
 * //           uid: { uidOrganisationId: 123456789 },
 * //           organisationName: 'Example AG',
 * //           legalForm: '0106'
 * //         },
 * //         address: {
 * //           street: 'Bahnhofstrasse',
 * //           houseNumber: '1',
 * //           swissZipCode: '8001',
 * //           town: 'Zürich',
 * //           cantonAbbreviation: 'ZH'
 * //         },
 * //         foundationDate: '2020-01-15'
 * //       },
 * //       uidregInformation: {
 * //         uidregStatusEnterpriseDetail: '1'
 * //       },
 * //       vatRegisterInformation: {
 * //         vatNumber: 'CHE-123.456.789 MWST',
 * //         vatStatus: '1'
 * //       },
 * //       commercialRegisterInformation: {
 * //         registerOffice: 'Zürich',
 * //         registerNumber: 'CH-020.1.234.567-8'
 * //       }
 * //     }]
 * //   }
 * // }
 * 
 * @see {@link module:api/uid-client~UidClient#getByUid}
 * @see {@link module:tools/due-diligence~generateDueDiligenceReport} For formatted reports combining multiple sources
 */
export async function getCompanyDetailsUid(args) {
  const params = getCompanyByUidSchema.parse(args);
  
  logger.info({ params }, 'Executing get_company_details_uid tool');

  const uidData = await uidClient.getByUid(params.uid);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(uidData, null, 2),
      },
    ],
  };
}

/**
 * Register UID-only tools with the MCP server.
 * 
 * Registers the `get_company_details_uid` tool for accessing company data
 * via the public UID Webservice without requiring Zefix authentication.
 * 
 * This tool is useful when:
 * - Zefix credentials are not available
 * - Only basic company information is needed
 * - Working with systems that don't have Zefix access
 * 
 * @param {Object} server - MCP server instance with tool() method
 * 
 * @example
 * import { Server } from '@modelcontextprotocol/sdk/server/index.js';
 * import { registerUidOnlyTools } from './tools/uid-only.js';
 * 
 * const server = new Server(...);
 * registerUidOnlyTools(server);
 * 
 * @see {@link https://modelcontextprotocol.io/docs/concepts/tools|MCP Tools Documentation}
 */
export function registerUidOnlyTools(server) {
  server.tool(
    'get_company_details_uid',
    'Get detailed company information using only the UID Webservice. This does not require Zefix authentication.',
    {
      uid: getCompanyByUidSchema.shape.uid,
    },
    getCompanyDetailsUid
  );
}
