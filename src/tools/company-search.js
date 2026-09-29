/**
 * @fileoverview MCP tools for searching Swiss companies in commercial registers.
 * Provides three search methods: basic Zefix search, detailed UID lookup, and advanced UID search.
 * 
 * @module tools/company-search
 */

import { ZefixClient } from '../api/zefix-client.js';
import { UidClient } from '../api/uid-client.js';
import { 
  searchCompaniesSchema, 
  getCompanyByUidSchema,
  advancedSearchSchema 
} from '../api/schemas.js';
import { logger } from '../utils/logger.js';

const zefixClient = new ZefixClient();
const uidClient = new UidClient();

/** Zefix statuses that activeOnly must exclude (in liquidation, deleted). */
const INACTIVE_STATUSES = ['BEING_CANCELLED', 'CANCELLED'];

/**
 * Wrap a value as an MCP text response. Compact JSON keeps large registry
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
 * Search for companies using Zefix REST API.
 * 
 * Provides fast, basic company search with filtering by name, canton,
 * legal form, and active status. Uses the Zefix commercial register API
 * which is optimized for quick lookups.
 * 
 * @async
 * @param {Object} args - Search parameters (validated against searchCompaniesSchema)
 * @param {string} args.name - Company name to search (minimum 3 characters, supports wildcards)
 * @param {string} [args.canton] - Canton code filter (e.g., 'ZH', 'BE')
 * @param {string} [args.legalFormUid] - Legal form code filter (e.g., '0106' for AG)
 * @param {boolean} [args.activeOnly=true] - Only return active companies
 * @param {number} [args.maxResults=30] - Maximum results to return (1-200)
 * 
 * @returns {Promise<Object>} MCP tool response with search results
 * @returns {Array<Object>} return.content - MCP content array
 * @returns {string} return.content[].type - Content type ('text')
 * @returns {string} return.content[].text - JSON string:
 *   `{ totalMatches, returned, companies }` (companies capped at maxResults)
 * 
 * @throws {ZodError} When parameters fail validation
 * @throws {Error} When Zefix API request fails
 * 
 * @example
 * const result = await searchCompanies({
 *   name: 'Migros',
 *   canton: 'ZH',
 *   activeOnly: true,
 *   maxResults: 10
 * });
 * 
 * @see {@link module:api/zefix-client~ZefixClient#searchCompanies}
 */
export async function searchCompanies(args) {
  const params = searchCompaniesSchema.parse(args);
  
  logger.info({ params }, 'Executing search_companies tool');

  // Build Zefix search query
  const searchQuery = {
    name: params.name,
    activeOnly: params.activeOnly,
  };

  if (params.canton) {
    searchQuery.canton = params.canton;
  }

  if (params.legalFormUid) {
    searchQuery.legalFormUid = params.legalFormUid;
  }

  // The Zefix search endpoint has no server-side limit, so maxResults is applied here.
  const matches = await zefixClient.searchCompanies(searchQuery);
  let companies = Array.isArray(matches) ? matches : [];

  // Zefix's own activeOnly still returns companies in liquidation (BEING_CANCELLED).
  if (params.activeOnly) {
    companies = companies.filter((company) => !INACTIVE_STATUSES.includes(company.status));
  }
  const page = companies.slice(0, params.maxResults);

  return toTextResponse({
    totalMatches: companies.length,
    returned: page.length,
    companies: page,
  });
}

/**
 * Get detailed company information by UID with optional enrichment.
 * 
 * Retrieves company data from Zefix and optionally enriches it with
 * comprehensive data from the UID Webservice including:
 * - VAT registration details
 * - Commercial register information
 * - Address data
 * (The public UID service does not populate NOGA industry codes.)
 * 
 * Falls back gracefully to Zefix-only data if UID enrichment fails.
 * 
 * The SOGC publication texts are left out (they are ~half the payload and have
 * their own tool, get_company_publications); `sogcPublicationCount` reports how
 * many exist.
 * 
 * @async
 * @param {Object} args - Lookup parameters (validated against getCompanyByUidSchema)
 * @param {string} args.uid - Company UID (CHE-XXX.XXX.XXX format)
 * @param {boolean} [args.enrichWithUidData=true] - Enrich with UID Webservice data
 * 
 * @returns {Promise<Object>} MCP tool response with company details
 * @returns {Array<Object>} return.content - MCP content array
 * @returns {string} return.content[].type - Content type ('text')
 * @returns {string} return.content[].text - JSON string with company data
 * 
 * @throws {ZodError} When parameters fail validation
 * @throws {Error} When Zefix lookup fails
 * 
 * @example
 * // Basic lookup (Zefix only)
 * const result = await getCompanyByUid({
 *   uid: 'CHE-123.456.789',
 *   enrichWithUidData: false
 * });
 * 
 * @example
 * // Enriched lookup (Zefix + UID Webservice)
 * const result = await getCompanyByUid({
 *   uid: 'CHE-123.456.789',
 *   enrichWithUidData: true
 * });
 * // Returns: { ...zefixData, uidWebserviceData: {...} }
 * 
 * @see {@link module:api/zefix-client~ZefixClient#getCompanyByUid}
 * @see {@link module:api/uid-client~UidClient#getByUid}
 */
export async function getCompanyByUid(args) {
  const params = getCompanyByUidSchema.parse(args);
  
  logger.info({ params }, 'Executing get_company_by_uid tool');

  // Get basic data from Zefix (publications are served by get_company_publications)
  const { sogcPub, ...zefixData } = await zefixClient.getCompanyByUid(params.uid);
  if (Array.isArray(sogcPub)) {
    zefixData.sogcPublicationCount = sogcPub.length;
  }

  // Optionally enrich with UID Webservice data
  if (params.enrichWithUidData) {
    try {
      const uidData = await uidClient.getByUid(params.uid);
      
      // Merge data from both sources
      return toTextResponse({
        ...zefixData,
        uidWebserviceData: uidData,
      });
    } catch (error) {
      logger.warn({ error: error.message, uid: params.uid }, 'UID enrichment failed, returning Zefix data only');
      // Return Zefix data even if UID enrichment fails
    }
  }

  return toTextResponse(zefixData);
}

/**
 * Advanced company search using UID Webservice with multiple filters.
 * 
 * Provides more comprehensive search capabilities than basic Zefix search:
 * - Search by organization name or person name (sole proprietorships)
 * - Filter by canton, legal forms, and active status
 * - Returns richer data including VAT and commercial register status
 * - Supports searching historical names and addresses
 * 
 * Note: Active status filtering is performed client-side after receiving
 * results, as the UID Webservice SOAP API doesn't reliably support
 * server-side status filtering.
 * 
 * @async
 * @param {Object} args - Search parameters (validated against advancedSearchSchema)
 * @param {string} [args.organisationName] - Organization name (min 3 chars)
 * @param {Object} [args.personName] - Person name for sole proprietorships
 * @param {string} args.personName.officialName - Last name
 * @param {string} [args.personName.firstName] - First name
 * @param {string} [args.canton] - Canton code (e.g., 'ZH', 'BE')
 * @param {Array<string>} [args.legalForms] - Legal form codes (e.g., ['0106', '0107'])
 * @param {boolean} [args.activeOnly] - Filter to active companies only (client-side)
 * @param {number} [args.maxResults=30] - Maximum results (1-200)
 * 
 * @returns {Promise<Object>} MCP tool response with search results
 * @returns {Array<Object>} return.content - MCP content array
 * @returns {string} return.content[].type - Content type ('text')
 * @returns {string} return.content[].text - JSON string of UID Webservice results
 * 
 * @throws {ZodError} When parameters fail validation
 * @throws {Error} When UID Webservice request fails
 * 
 * @example
 * // Search by organization name with filters
 * const result = await advancedSearch({
 *   organisationName: 'Migros',
 *   canton: 'ZH',
 *   legalForms: ['0106'], // AG only
 *   activeOnly: true,
 *   maxResults: 20
 * });
 * 
 * @example
 * // Search by person name (sole proprietorship)
 * const result = await advancedSearch({
 *   personName: {
 *     officialName: 'Müller',
 *     firstName: 'Hans'
 *   },
 *   canton: 'BE'
 * });
 * 
 * @see {@link module:api/uid-client~UidClient#search}
 */
export async function advancedSearch(args) {
  const params = advancedSearchSchema.parse(args);
  
  logger.info({ params }, 'Executing advanced_search tool');

  // Build UID Webservice search parameters - must have at least one search criterion
  const searchParams = {};

  if (params.organisationName) {
    searchParams.organisationName = params.organisationName;
  }

  if (params.personName) {
    searchParams.personName = params.personName;
  }

  if (params.canton) {
    searchParams.address = {
      cantonAbbreviation: params.canton,
    };
  }

  if (params.legalForms && params.legalForms.length > 0) {
    searchParams.legalForm = params.legalForms;
  }

  // Do not push uidregInformation status into the SOAP request; instead post-filter the response.
  // The public WSDL enum values for uidregStatusEnterpriseDetail are not documented in this repo,
  // and attempts with different codes lead to 0 results from the service for this query. We'll filter client-side.

  const searchSettings = {
    searchMode: 'Auto',
    maxNumberOfRecords: params.maxResults || 30,
    searchNameAndAddressHistory: false,
  };

  // Pass searchParams directly - uidClient.search() will wrap it properly
  const results = await uidClient.search(searchParams, searchSettings);

  // Post-filter for activeOnly: keep items with uidregInformation.uidregStatusEnterpriseDetail === '3' (or 3)
  if (params.activeOnly === true && results?.SearchResult?.uidEntitySearchResultItem) {
    const items = Array.isArray(results.SearchResult.uidEntitySearchResultItem)
      ? results.SearchResult.uidEntitySearchResultItem
      : [results.SearchResult.uidEntitySearchResultItem];

    const filtered = items.filter((item) => {
      const status = item?.organisation?.uidregInformation?.uidregStatusEnterpriseDetail;
      return status === '3' || status === 3;
    });

    results.SearchResult.uidEntitySearchResultItem = filtered;
  }

  return toTextResponse(results);
}

/**
 * Register company search tools with the MCP server.
 * 
 * Registers three search tools:
 * 1. **search_companies** - Fast Zefix search with basic filters
 * 2. **get_company_by_uid** - Detailed lookup by UID with optional enrichment
 * 3. **advanced_search** - Comprehensive UID Webservice search
 * 
 * @param {Object} server - MCP server instance with tool() method
 * 
 * @example
 * import { Server } from '@modelcontextprotocol/sdk/server/index.js';
 * import { registerSearchTools } from './tools/company-search.js';
 * 
 * const server = new Server(...);
 * registerSearchTools(server);
 * 
 * @see {@link https://modelcontextprotocol.io/docs/concepts/tools|MCP Tools Documentation}
 */
export function registerSearchTools(server) {
  // Tool 1: search_companies
  server.tool(
    'search_companies',
    'Search for Swiss companies using the Zefix API. Supports filtering by name, canton, legal form, and active status. Names match by prefix; start with * to match anywhere. Zefix rejects searches that match too many companies (e.g. *ab*), so add canton or legalFormUid or use a more specific name.',
    searchCompaniesSchema.shape,
    searchCompanies
  );

  // Tool 2: get_company_by_uid
  server.tool(
    'get_company_by_uid',
    'Get detailed company information from Zefix by UID. Optionally enriches data with UID Webservice information.',
    getCompanyByUidSchema.shape,
    getCompanyByUid
  );

  // Tool 3: advanced_search
  server.tool(
    'advanced_search',
    'Advanced company search using the UID Webservice. Supports multiple filters including person names, legal forms, and canton.',
    advancedSearchSchema.shape,
    advancedSearch
  );
}
