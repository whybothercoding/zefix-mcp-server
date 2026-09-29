/**
 * @fileoverview MCP tools for accessing Swiss Official Gazette of Commerce (SOGC/SHAB) publications.
 * Provides access to daily registrations and company-specific publication history.
 * 
 * @module tools/sogc
 */

import { ZefixClient } from '../api/zefix-client.js';
import { getSogcByDateSchema, getSogcByUidSchema } from '../api/schemas.js';
import { logger } from '../utils/logger.js';

const zefixClient = new ZefixClient();

/**
 * Wrap a value as an MCP text response. Compact JSON keeps large gazette
 * payloads within MCP clients' output limits without dropping any field.
 *
 * @private
 * @param {*} value - JSON-serializable value
 * @returns {{content: Array<{type: string, text: string}>}} MCP tool response
 */
function toTextResponse(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

/**
 * Check whether a publication carries a mutation type, matching either the
 * exact key or any of its sub-keys (`status` matches `status.neu`).
 *
 * @private
 * @param {Object} publication - SOGC publication (`sogcPublication`)
 * @param {string} wanted - Lower-cased mutation type key
 * @returns {boolean} True if a mutation type matches
 */
function hasMutationType(publication, wanted) {
  return (publication?.mutationTypes || []).some((mutation) => {
    const key = String(mutation?.key ?? '').toLowerCase();
    return key === wanted || key.startsWith(`${wanted}.`);
  });
}

/**
 * Reduce a Zefix `{ sogcPublication, companyShort }` record to the fields
 * needed to identify what happened to which company.
 *
 * @private
 * @param {Object} record - Zefix SOGC-by-date record
 * @param {boolean} includeText - Whether to include the publication text
 * @returns {Object} Compact publication summary
 */
function summarizePublication({ sogcPublication = {}, companyShort = {} }, includeText) {
  const summary = {
    sogcId: sogcPublication.sogcId,
    sogcDate: sogcPublication.sogcDate,
    canton: sogcPublication.registryOfCommerceCanton,
    mutationTypes: (sogcPublication.mutationTypes || []).map((mutation) => mutation.key),
    company: {
      name: companyShort.name,
      uid: companyShort.uid,
      legalSeat: companyShort.legalSeat,
      legalForm: companyShort.legalForm?.shortName?.de ?? companyShort.legalForm?.uid,
      status: companyShort.status,
    },
  };

  if (includeText) {
    summary.message = sogcPublication.message;
  }

  return summary;
}

/**
 * Get daily registrations and publications from SOGC.
 * 
 * Retrieves all company-related publications from the Swiss Official Gazette
 * of Commerce (Schweizerisches Handelsamtsblatt - SHAB) for a specific date.
 * 
 * Publications include:
 * - New company registrations
 * - Modifications (address changes, name changes, etc.)
 * - Deletions and liquidations
 * - Capital changes
 * - Management changes
 * 
 * @async
 * A single day holds ~1,000 publications, so the response is a filtered,
 * paged list of compact summaries; pass `includeText` for the full text.
 * 
 * @param {Object} args - Query parameters (validated against getSogcByDateSchema)
 * @param {string} args.date - Date in YYYY-MM-DD format
 * @param {string} [args.canton] - Only publications of this cantonal registry
 * @param {string} [args.mutationType] - Only publications with this mutation type key
 * @param {number} [args.maxResults=50] - Page size
 * @param {number} [args.offset=0] - Matching publications to skip
 * @param {boolean} [args.includeText=false] - Include the full publication text
 * 
 * @returns {Promise<Object>} MCP tool response with publications
 * @returns {Array<Object>} return.content - MCP content array
 * @returns {string} return.content[].type - Content type ('text')
 * @returns {string} return.content[].text - JSON string with publications
 * 
 * @throws {ZodError} When parameters fail validation
 * @throws {Error} When Zefix API request fails
 * 
 * @example
 * const result = await getDailyRegistrations({
 *   date: '2025-01-15',
 *   canton: 'ZH',
 *   mutationType: 'status.neu'
 * });
 * 
 * // Returns:
 * // {
 * //   date: '2025-01-15',
 * //   totalPublications: 1030,  // whole day
 * //   matched: 12,              // after canton / mutationType filters
 * //   returned: 12,             // in this page
 * //   offset: 0,
 * //   publications: [
 * //     {
 * //       sogcId: 1006767022,
 * //       sogcDate: '2025-01-15',
 * //       canton: 'ZH',
 * //       mutationTypes: ['status.neu'],
 * //       company: { name: 'Example AG', uid: 'CHE123456789', legalSeat: 'Zürich', legalForm: 'AG', status: 'ACTIVE' }
 * //     },
 * //     ...
 * //   ]
 * // }
 * 
 * @see {@link module:api/zefix-client~ZefixClient#getSogcByDate}
 */
export async function getDailyRegistrations(args) {
  const params = getSogcByDateSchema.parse(args);
  
  logger.info({ params }, 'Executing get_daily_registrations tool');

  const publications = (await zefixClient.getSogcByDate(params.date)) || [];

  // The Zefix endpoint has no filters or paging, so both are applied here.
  const wantedMutation = params.mutationType?.toLowerCase();
  const matched = publications.filter(({ sogcPublication } = {}) =>
    (!params.canton || sogcPublication?.registryOfCommerceCanton === params.canton) &&
    (!wantedMutation || hasMutationType(sogcPublication, wantedMutation))
  );
  const page = matched
    .slice(params.offset, params.offset + params.maxResults)
    .map((record) => summarizePublication(record, params.includeText));

  return toTextResponse({
    date: params.date,
    totalPublications: publications.length,
    matched: matched.length,
    returned: page.length,
    offset: params.offset,
    publications: page,
  });
}

/**
 * Get SOGC publications for a specific company.
 * 
 * Retrieves all historical publications from the Swiss Official Gazette
 * of Commerce (SHAB) for a specific company identified by UID.
 * 
 * Useful for:
 * - Due diligence research
 * - Tracking company history and changes
 * - Identifying recent modifications
 * - Monitoring liquidations or deletions
 * 
 * Publications are returned in chronological order (most recent first),
 * paged via `maxResults` and `offset`.
 * 
 * @async
 * @param {Object} args - Query parameters (validated against getSogcByUidSchema)
 * @param {string} args.uid - Company UID (CHE-XXX.XXX.XXX format)
 * @param {number} [args.maxResults=20] - Page size
 * @param {number} [args.offset=0] - Publications to skip
 * 
 * @returns {Promise<Object>} MCP tool response with publications
 * @returns {Array<Object>} return.content - MCP content array
 * @returns {string} return.content[].type - Content type ('text')
 * @returns {string} return.content[].text - JSON string with publications
 * 
 * @throws {ZodError} When parameters fail validation
 * @throws {Error} When Zefix API request fails
 * 
 * @example
 * const result = await getCompanyPublications({
 *   uid: 'CHE-123.456.789'
 * });
 * 
 * // Returns:
 * // {
 * //   uid: 'CHE123456789',
 * //   totalPublications: 43,  // all publications on record
 * //   returned: 20,           // in this page
 * //   offset: 0,
 * //   publications: [
 * //     {
 * //       sogcDate: '2025-01-15',
 * //       sogcId: 1006766918,
 * //       registryOfCommerceCanton: 'BE',
 * //       mutationTypes: [{ id: 17, key: 'aenderungorgane' }],
 * //       message: 'Address change from...'
 * //     },
 * //     ...
 * //   ]
 * // }
 * 
 * @see {@link module:api/zefix-client~ZefixClient#getSogcByUid}
 */
export async function getCompanyPublications(args) {
  const params = getSogcByUidSchema.parse(args);
  
  logger.info({ params }, 'Executing get_company_publications tool');

  const publications = (await zefixClient.getSogcByUid(params.uid)) || [];
  const page = publications.slice(params.offset, params.offset + params.maxResults);

  return toTextResponse({
    uid: params.uid,
    totalPublications: publications.length,
    returned: page.length,
    offset: params.offset,
    publications: page,
  });
}

/**
 * Register SOGC tools with the MCP server.
 * 
 * Registers two tools for accessing Swiss Official Gazette of Commerce data:
 * 1. **get_daily_registrations** - All publications for a specific date
 * 2. **get_company_publications** - All publications for a specific company
 * 
 * @param {Object} server - MCP server instance with tool() method
 * 
 * @example
 * import { Server } from '@modelcontextprotocol/sdk/server/index.js';
 * import { registerSogcTools } from './tools/sogc.js';
 * 
 * const server = new Server(...);
 * registerSogcTools(server);
 * 
 * @see {@link https://modelcontextprotocol.io/docs/concepts/tools|MCP Tools Documentation}
 */
export function registerSogcTools(server) {
  // Tool 6: get_daily_registrations
  server.tool(
    'get_daily_registrations',
    'Get company registrations and publications from SOGC (Swiss Official Gazette of Commerce) for a specific date using the Zefix API. A day has ~1,000 publications, so results are compact summaries; filter by canton and mutationType, page with offset, and set includeText for the full publication text.',
    getSogcByDateSchema.shape,
    getDailyRegistrations
  );

  // Tool 7: get_company_publications
  server.tool(
    'get_company_publications',
    'Get SOGC publications for a specific company by UID using the Zefix API, most recent first; page with maxResults and offset.',
    getSogcByUidSchema.shape,
    getCompanyPublications
  );
}
