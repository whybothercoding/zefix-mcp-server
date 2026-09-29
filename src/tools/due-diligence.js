/**
 * @fileoverview MCP tool for generating comprehensive due diligence reports.
 * Combines data from Zefix, UID Webservice, and SOGC publications into a formatted report.
 * 
 * @module tools/due-diligence
 */

import { ZefixClient } from '../api/zefix-client.js';
import { UidClient } from '../api/uid-client.js';
import { dueDiligenceSchema } from '../api/schemas.js';
import { logger } from '../utils/logger.js';
import { formatDueDiligenceReport } from '../utils/formatting.js';

const zefixClient = new ZefixClient();
const uidClient = new UidClient();

/**
 * Extract legal form name from multilingual object.
 * 
 * Handles both string values and multilingual objects with language keys.
 * Prefers German (de), falls back to English (en), French (fr), Italian (it).
 * 
 * @private
 * @param {Object} legalForm - Legal form object from API response
 * @param {string|Object} legalForm.name - Name as string or multilingual object
 * @returns {string|null} Extracted legal form name or null
 * 
 * @example
 * // String value
 * extractLegalFormName({ name: 'Aktiengesellschaft' })
 * // Returns: 'Aktiengesellschaft'
 * 
 * @example
 * // Multilingual object
 * extractLegalFormName({ name: { de: 'AG', en: 'Ltd', fr: 'SA' } })
 * // Returns: 'AG'
 */
function extractLegalFormName(legalForm) {
  if (!legalForm) return null;
  
  // If it's already a string, return it
  if (typeof legalForm.name === 'string') {
    return legalForm.name;
  }
  
  // If it's an object with language keys, extract preferred language
  if (typeof legalForm.name === 'object') {
    return legalForm.name.de || legalForm.name.en || legalForm.name.fr || legalForm.name.it || null;
  }
  
  return null;
}

/**
 * Extract legal form short name from multilingual object.
 * 
 * Handles both string values and multilingual objects with language keys.
 * Prefers German (de), falls back to English (en), French (fr), Italian (it).
 * 
 * @private
 * @param {Object} legalForm - Legal form object from API response
 * @param {string|Object} legalForm.shortName - Short name as string or multilingual object
 * @returns {string|null} Extracted short name or null
 * 
 * @example
 * extractLegalFormShortName({ shortName: { de: 'AG', en: 'Ltd' } })
 * // Returns: 'AG'
 */
function extractLegalFormShortName(legalForm) {
  if (!legalForm) return null;
  
  // If it's already a string, return it
  if (typeof legalForm.shortName === 'string') {
    return legalForm.shortName;
  }
  
  // If it's an object with language keys, extract preferred language
  if (typeof legalForm.shortName === 'object') {
    return legalForm.shortName.de || legalForm.shortName.en || legalForm.shortName.fr || legalForm.shortName.it || null;
  }
  
  return null;
}

/**
 * Normalize company status values to consistent format.
 * 
 * Maps various status representations (German, English, different cases)
 * to standardized English status strings.
 * 
 * @private
 * @param {string|number} status - Raw status value from API
 * @returns {string} Normalized status string
 * 
 * @example
 * normalizeStatus('AKTIV') // Returns: 'Active'
 * normalizeStatus('inactive') // Returns: 'Inactive'
 * normalizeStatus('LIQUIDATION') // Returns: 'In Liquidation'
 */
function normalizeStatus(status) {
  if (!status) return 'Unknown';
  
  const statusStr = String(status).toUpperCase();
  
  // Map common status values
  if (statusStr === 'ACTIVE' || statusStr === 'AKTIV') return 'Active';
  if (statusStr === 'INACTIVE' || statusStr === 'INAKTIV') return 'Inactive';
  if (statusStr === 'DELETED' || statusStr === 'GELÖSCHT') return 'Deleted';
  if (statusStr === 'LIQUIDATION' || statusStr === 'BEING_CANCELLED') return 'In Liquidation';
  if (statusStr === 'CANCELLED') return 'Deleted';
  
  // Return original if no mapping found
  return status;
}

/**
 * Extract data from nested UID Webservice response structure.
 * 
 * The UID Webservice returns deeply nested data:
 * `GetByUIDResult.organisationType[0].organisation`
 * 
 * This function flattens the structure for easier access.
 * 
 * @private
 * @param {Object} uidResponse - Raw UID Webservice response
 * @param {Object} uidResponse.GetByUIDResult - Top-level result wrapper
 * @param {Array<Object>} uidResponse.GetByUIDResult.organisationType - Organization types array
 * @returns {Object|null} Extracted organization data or null if invalid structure
 * @returns {Object} return.organisation - Organization details
 * @returns {Object} return.uidregInformation - UID register information
 * @returns {Object} return.commercialRegisterInformation - Commercial register data
 * @returns {Object} return.vatRegisterInformation - VAT registration data
 * @returns {Object} return.leiRegisterInformation - LEI register data
 * 
 * @example
 * const data = extractUidData(uidResponse);
 * console.log(data.organisation.organisationName);
 * console.log(data.vatRegisterInformation.vatNumber);
 */
function extractUidData(uidResponse) {
  if (!uidResponse) return null;
  
  // Navigate the nested structure
  const result = uidResponse.GetByUIDResult;
  if (!result || !result.organisationType || !Array.isArray(result.organisationType)) {
    return null;
  }
  
  const orgType = result.organisationType[0];
  if (!orgType) return null;
  
  return {
    organisation: orgType.organisation,
    uidregInformation: orgType.uidregInformation,
    commercialRegisterInformation: orgType.commercialRegisterInformation,
    vatRegisterInformation: orgType.vatRegisterInformation,
    leiRegisterInformation: orgType.leiRegisterInformation,
  };
}

/**
 * Map UID status codes to human-readable status strings.
 * 
 * Based on UID Webservice documentation for `uidregStatusEnterpriseDetail`.
 * 
 * @private
 * @param {string|number} statusCode - UID status code
 * @returns {string} Human-readable status
 * 
 * @example
 * mapUidStatus('1') // Returns: 'Active'
 * mapUidStatus('2') // Returns: 'Inactive'
 * mapUidStatus('4') // Returns: 'Deleted'
 * mapUidStatus('99') // Returns: 'Unknown (99)'
 */
function mapUidStatus(statusCode) {
  if (!statusCode) return 'Unknown';
  
  const code = String(statusCode);
  
  // uidregStatusEnterpriseDetail codes
  switch (code) {
    case '1': return 'Active';
    case '2': return 'Inactive';
    case '3': return 'Active'; // Active with special status
    case '4': return 'Deleted';
    default: return `Unknown (${code})`;
  }
}

/**
 * Map Swiss legal form codes to names and abbreviations.
 * 
 * Provides mappings for common Swiss legal forms (AG, GmbH, etc.).
 * Returns generic mapping for unknown codes.
 * 
 * @private
 * @param {string} code - Legal form code (e.g., '0106', '0107')
 * @returns {Object|null} Legal form information or null
 * @returns {string} return.name - Full legal form name in German
 * @returns {string} return.shortName - Abbreviated form
 * 
 * @example
 * mapLegalFormCode('0106')
 * // Returns: { name: 'Aktiengesellschaft', shortName: 'AG' }
 * 
 * @example
 * mapLegalFormCode('0107')
 * // Returns: { name: 'Gesellschaft mit beschränkter Haftung', shortName: 'GmbH' }
 */
function mapLegalFormCode(code) {
  if (!code) return null;
  
  const legalForms = {
    '0106': { name: 'Aktiengesellschaft', shortName: 'AG' },
    '0107': { name: 'Gesellschaft mit beschränkter Haftung', shortName: 'GmbH' },
    '0108': { name: 'Kommanditgesellschaft', shortName: 'KG' },
    '0109': { name: 'Kollektivgesellschaft', shortName: 'KlG' },
    '0110': { name: 'Einzelunternehmen', shortName: 'Einzelfirma' },
    '0112': { name: 'Genossenschaft', shortName: 'Gen' },
    '0113': { name: 'Verein', shortName: 'Verein' },
    '0114': { name: 'Stiftung', shortName: 'Stiftung' },
  };
  
  return legalForms[code] || { name: `Legal Form ${code}`, shortName: code };
}

/**
 * Pick the registered (legal) address from the UID Webservice address list.
 *
 * The UID Webservice returns one entry per address category (LEGAL, POBOX, ...).
 *
 * @private
 * @param {Array<Object>|Object|undefined} addresses - UID Webservice address(es)
 * @returns {Object|null} Legal address, else the first address, else null
 */
function pickUidAddress(addresses) {
  if (Array.isArray(addresses)) {
    return addresses.find((address) => address?.addressCategory === 'LEGAL') || addresses[0] || null;
  }
  return addresses || null;
}

/**
 * Build the address block the report formatter expects (`town`,
 * `postOfficeBoxNumber`, `swissZipCode`, ...) from either data source.
 *
 * Zefix names the town `city` and the P.O. box `poBox`; the UID Webservice
 * names the town `town`. Zefix is preferred, matching the rest of the report.
 *
 * @private
 * @param {Object|undefined} zefixAddress - `address` from the Zefix company
 * @param {Object|null} uidAddress - Address from `pickUidAddress`
 * @returns {Object|null} Report address or null
 */
function buildReportAddress(zefixAddress, uidAddress) {
  if (zefixAddress) {
    return {
      ...zefixAddress,
      town: zefixAddress.town || zefixAddress.city,
      postOfficeBoxNumber: zefixAddress.postOfficeBoxNumber || zefixAddress.poBox || undefined,
    };
  }
  return uidAddress;
}

/** Number of SOGC publications echoed in the raw-data block (all are counted). */
const RAW_SOGC_LIMIT = 10;

/**
 * Generate comprehensive due diligence report for a Swiss company.
 * 
 * Combines data from multiple sources:
 * - **Zefix**: Basic company information and commercial register data
 * - **UID Webservice**: Legal address, VAT and commercial register status
 * - **SOGC**: Recent publications and changes (optional)
 * 
 * Returns both a formatted markdown report and raw JSON data.
 * Gracefully handles partial failures - returns data from available sources.
 * 
 * @async
 * @param {Object} args - Report parameters (validated against dueDiligenceSchema)
 * @param {string} args.uid - Company UID (CHE-XXX.XXX.XXX format)
 * @param {boolean} [args.includePublications=true] - Include SOGC publications
 * 
 * @returns {Promise<Object>} MCP tool response with report and raw data
 * @returns {Array<Object>} return.content - MCP content array with two items
 * @returns {Object} return.content[0] - Formatted markdown report
 * @returns {string} return.content[0].type - Content type ('text')
 * @returns {string} return.content[0].text - Markdown-formatted report
 * @returns {Object} return.content[1] - Raw JSON data
 * @returns {string} return.content[1].type - Content type ('text')
 * @returns {string} return.content[1].text - JSON string with raw data from all sources
 * 
 * @throws {ZodError} When parameters fail validation
 * @throws {Error} When all data sources fail (both Zefix and UID)
 * 
 * @example
 * const report = await generateDueDiligenceReport({
 *   uid: 'CHE-123.456.789',
 *   includePublications: true
 * });
 * 
 * // Returns markdown report with:
 * // - Company overview (name, UID, status, legal form)
 * // - Address and location
 * // - Economic activity (NOGA code, only if the register holds one)
 * // - VAT registration status
 * // - Commercial register details
 * // - Recent SOGC publications
 * // - Raw JSON data for reference
 * 
 * @see {@link module:api/zefix-client~ZefixClient#getCompanyByUid}
 * @see {@link module:api/uid-client~UidClient#getByUid}
 * @see {@link module:api/zefix-client~ZefixClient#getSogcByUid}
 * @see {@link module:utils/formatting~formatDueDiligenceReport}
 */
export async function generateDueDiligenceReport(args) {
  const params = dueDiligenceSchema.parse(args);
  
  logger.info({ params }, 'Executing generate_due_diligence_report tool');

  // Gather data from both sources
  const [zefixData, uidData, sogcData] = await Promise.allSettled([
    zefixClient.getCompanyByUid(params.uid),
    uidClient.getByUid(params.uid),
    params.includePublications ? zefixClient.getSogcByUid(params.uid) : Promise.resolve(null),
  ]);

  // Extract successful results
  const zefix = zefixData.status === 'fulfilled' ? zefixData.value : null;
  const uidRaw = uidData.status === 'fulfilled' ? uidData.value : null;
  const sogc = sogcData.status === 'fulfilled' ? sogcData.value : null;

  // Extract UID data from nested structure
  const uid = extractUidData(uidRaw);

  if (!zefix && !uid) {
    throw new Error('Failed to retrieve company data from both Zefix and UID Webservice');
  }

  // Extract legal form information properly
  let legalFormData = null;
  if (zefix?.legalForm) {
    legalFormData = {
      name: extractLegalFormName(zefix.legalForm),
      shortName: extractLegalFormShortName(zefix.legalForm),
      code: zefix.legalForm.uid || zefix.legalForm.id || null,
    };
  } else if (uid?.organisation?.organisationIdentification?.legalForm) {
    const legalFormCode = uid.organisation.organisationIdentification.legalForm;
    const mappedForm = mapLegalFormCode(legalFormCode);
    legalFormData = {
      name: mappedForm.name,
      shortName: mappedForm.shortName,
      code: legalFormCode,
    };
  }

  // Extract canton - Zefix has a top-level 'canton', UID has 'cantonAbbreviation' in its address
  const uidAddress = pickUidAddress(uid?.organisation?.address);
  const canton = zefix?.canton || zefix?.address?.canton || uidAddress?.cantonAbbreviation || null;

  // Extract status from UID
  const uidStatus = uid?.uidregInformation?.uidregStatusEnterpriseDetail;
  const mappedStatus = mapUidStatus(uidStatus);

  // Combine data for report
  const reportData = {
    uid: params.uid,
    name: zefix?.name || uid?.organisation?.organisationIdentification?.organisationName || 'Unknown',
    legalForm: legalFormData,
    status: normalizeStatus(zefix?.status || mappedStatus),
    address: buildReportAddress(zefix?.address, uidAddress),
    canton: canton,
    foundationDate: uid?.organisation?.foundationDate || zefix?.foundationDate || null,
    nogaCode: uid?.organisation?.NOGACode || null,
    vatInfo: uid?.vatRegisterInformation || null,
    commercialRegister: uid?.commercialRegisterInformation || zefix?.commercialRegister || null,
    sogcPublications: sogc || [],
  };

  // Generate markdown report
  const markdownReport = formatDueDiligenceReport(reportData);

  // Also include raw data for reference. Zefix's own `sogcPub` list is left out
  // (it duplicates `sogc`), and only the most recent publications are echoed.
  const rawData = {
    zefix: zefix ? { ...zefix, sogcPub: undefined } : null,
    uid: uid,
    sogc: sogc ? sogc.slice(0, RAW_SOGC_LIMIT) : null,
    sogcPublicationCount: sogc ? sogc.length : null,
  };

  return {
    content: [
      {
        type: 'text',
        text: markdownReport,
      },
      {
        type: 'text',
        text: '\n\n---\n\n**Raw Data (JSON)**\n\n' + JSON.stringify(rawData),
      },
    ],
  };
}

/**
 * Register due diligence tools with the MCP server.
 * 
 * Registers the `generate_due_diligence_report` tool for comprehensive
 * company analysis combining multiple Swiss business data sources.
 * 
 * @param {Object} server - MCP server instance with tool() method
 * 
 * @example
 * import { Server } from '@modelcontextprotocol/sdk/server/index.js';
 * import { registerDueDiligenceTools } from './tools/due-diligence.js';
 * 
 * const server = new Server(...);
 * registerDueDiligenceTools(server);
 * 
 * @see {@link https://modelcontextprotocol.io/docs/concepts/tools|MCP Tools Documentation}
 */
export function registerDueDiligenceTools(server) {
  // Tool 8: generate_due_diligence_report
  server.tool(
    'generate_due_diligence_report',
    'Generate a due diligence report for a Swiss company using Zefix and UID Webservice data.',
    dueDiligenceSchema.shape,
    generateDueDiligenceReport
  );
}
