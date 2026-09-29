import ky from 'ky';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';
import { cleanSogcMessage } from '../utils/sogc-text.js';

/**
 * Explain a failed Zefix request. Zefix describes 4xx errors in the response
 * body (`{ error: { type, message } }`), which ky leaves out of `error.message`;
 * the useful one is RESULTLIST_TO_LARGE, raised when a search matches too much.
 *
 * @private
 * @param {Error} error - Error thrown by the HTTP client
 * @returns {Promise<string>} Human-readable reason
 */
async function describeError(error) {
  try {
    const detail = (await error.response?.clone().json())?.error;
    if (detail?.type === 'RESULTLIST_TO_LARGE') {
      return 'too many results; narrow the search (add canton or legalFormUid, or use a more specific name)';
    }
    if (detail?.message) return `${error.message} (${detail.message})`;
  } catch {
    // The body is not JSON; fall back to the client's own message.
  }
  return error.message;
}

/**
 * Return a SOGC publication with a cleaned `message` (see utils/sogc-text.js).
 * Anything that is not a publication object with a text message is returned as is.
 *
 * @private
 * @param {Object} publication - SOGC publication from Zefix
 * @returns {Object} Publication with a readable message
 */
function cleanPublication(publication) {
  if (typeof publication?.message !== 'string') return publication;
  return { ...publication, message: cleanSogcMessage(publication.message) };
}

/**
 * @fileoverview Client for interacting with the Zefix REST API.
 * Provides methods for searching companies, retrieving company details,
 * and accessing SOGC (Swiss Official Gazette of Commerce) publications.
 * 
 * @module api/zefix-client
 * @see {@link https://www.zefix.admin.ch/ZefixPublicREST/api/v1|Zefix REST API Documentation}
 */

/**
 * Client for the Zefix REST API (Swiss Commercial Register).
 * 
 * Features:
 * - Basic authentication with username/password
 * - Automatic retry on transient failures (3 attempts)
 * - Response caching with configurable TTL
 * - Comprehensive error handling
 * - 30-second timeout per request
 * 
 * @class
 * 
 * @example
 * const client = new ZefixClient();
 * const results = await client.searchCompanies({ name: 'Migros', canton: 'ZH' });
 */
export class ZefixClient {
  /**
   * Creates a new Zefix REST API client.
   * 
   * Initializes the HTTP client with:
   * - Basic authentication using credentials from config
   * - Retry logic for transient failures (408, 413, 429, 5xx errors)
   * - 30-second timeout
   * - JSON content type headers
   * 
   * @constructor
   * @throws {Error} If ZEFIX_USERNAME or ZEFIX_PASSWORD are not configured
   */
  constructor() {
    const authString = Buffer.from(
      `${config.zefix.username}:${config.zefix.password}`
    ).toString('base64');

    this.client = ky.create({
      prefixUrl: config.zefix.baseUrl,
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      retry: {
        limit: 3,
        methods: ['get', 'post'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
      },
      timeout: 30000,
    });

    logger.info('Zefix REST client initialized');
  }

  /**
   * Search for companies in the Swiss commercial register.
   * 
   * Searches by company name with optional filters for canton, legal form,
   * and active status. Results are cached for 30 minutes.
   * 
   * @async
   * @param {Object} params - Search parameters
   * @param {string} params.name - Company name to search for (supports wildcards)
   * @param {boolean} [params.activeOnly] - Only return active companies
   * @param {string} [params.canton] - 2-letter canton code (e.g., 'ZH', 'BE')
   * @param {string} [params.legalFormUid] - Legal form code (e.g., '0106' for AG)
   * 
   * The Zefix search endpoint has no result-limit parameter and always returns
   * every match; callers apply their own limit.
   * 
   * @returns {Promise<Array<Object>>} Matching companies (CompanyShort)
   * @returns {string} return[].uid - Company UID
   * @returns {string} return[].name - Company name
   * @returns {string} return[].legalSeat - Legal seat location
   * @returns {string} return[].status - Company status (ACTIVE, BEING_CANCELLED, CANCELLED)
   * 
   * @throws {Error} When API request fails or returns error response
   * 
   * @example
   * const results = await client.searchCompanies({
   *   name: 'Migros',
   *   canton: 'ZH',
   *   activeOnly: true
   * });
   * console.log(results.length); // Number of matching companies
   */
  async searchCompanies(params) {
    const cacheKey = `zefix:search:${JSON.stringify(params)}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    logger.info({ params }, 'Searching companies via Zefix');

    try {
      const response = await this.client.post('company/search', {
        json: params,
      }).json();

      cache.set(cacheKey, response, 1800); // Cache for 30 minutes
      return response;
    } catch (error) {
      logger.error({ error: error.message, params }, 'Zefix search failed');
      throw new Error(`Zefix search failed: ${await describeError(error)}`);
    }
  }

  /**
   * Get detailed company information by UID.
   * 
   * Retrieves comprehensive company data including legal form, address,
   * registration details, and status. Results are cached for 1 hour.
   * 
   * @async
   * @param {string} uid - Company UID in format CHE-XXX.XXX.XXX or CHEXXXXXXXXX
   * 
   * The Zefix endpoint answers with an array; the first entry is returned as
   * the company. Any further entries are attached as `additionalEntries`.
   * 
   * @returns {Promise<Object>} Company details from Zefix API
   * @returns {string} return.uid - Company UID
   * @returns {string} return.name - Company name
   * @returns {string} return.legalSeat - Legal seat location
   * @returns {string} return.canton - Canton code
   * @returns {Object} return.legalForm - Legal form information
   * @returns {string} return.status - Company status
   * @returns {Object} return.address - Registered address
   * @returns {string} return.chid - Commercial Register ID
   * 
   * @throws {Error} When company not found or API request fails
   * 
   * @example
   * const company = await client.getCompanyByUid('CHE-123.456.789');
   * console.log(company.name); // Company name
   * console.log(company.legalForm); // Legal form details
   */
  async getCompanyByUid(uid) {
    const cacheKey = `zefix:company:${uid}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    logger.info({ uid }, 'Getting company by UID via Zefix');

    let response;
    try {
      response = await this.client.get(`company/uid/${uid}`).json();
    } catch (error) {
      logger.error({ error: error.message, uid }, 'Zefix get company failed');
      if (error.response?.status === 404) {
        throw new Error(`Company not found for UID ${uid}`);
      }
      throw new Error(`Failed to get company: ${await describeError(error)}`);
    }

    const [company, ...additionalEntries] = Array.isArray(response) ? response : [response];
    if (!company) {
      throw new Error(`Company not found for UID ${uid}`);
    }

    const result = additionalEntries.length > 0 ? { ...company, additionalEntries } : company;
    cache.set(cacheKey, result, 3600); // Cache for 1 hour
    return result;
  }

  /**
   * Get all SOGC (Swiss Official Gazette of Commerce) publications for a specific date.
   * 
   * Retrieves all company registrations, modifications, and deletions published
   * in the official gazette on the specified date. Results are cached for 6 hours.
   * 
   * @async
   * @param {string} date - Date in format YYYY-MM-DD
   * 
   * @returns {Promise<Array<Object>>} Array of SOGC publications
   * @returns {string} return[].uid - Company UID
   * @returns {string} return[].publicationDate - Publication date
   * @returns {string} return[].publicationType - Type of publication (NEW, MUTATION, DELETION)
   * @returns {string} return[].publicationText - Publication text content
   * @returns {string} return[].cantonalGazette - Cantonal gazette reference
   * 
   * @throws {Error} When date format is invalid or API request fails
   * 
   * @example
   * const publications = await client.getSogcByDate('2024-11-13');
   * console.log(publications.length); // Number of publications
   * publications.forEach(pub => {
   *   console.log(`${pub.uid}: ${pub.publicationType}`);
   * });
   */
  async getSogcByDate(date) {
    const cacheKey = `zefix:sogc:${date}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    logger.info({ date }, 'Getting SOGC publications by date');

    try {
      const raw = await this.client.get(`sogc/bydate/${date}`).json();
      const response = Array.isArray(raw)
        ? raw.map((record) => (
            record?.sogcPublication
              ? { ...record, sogcPublication: cleanPublication(record.sogcPublication) }
              : record
          ))
        : raw;
      cache.set(cacheKey, response, 21600); // Cache for 6 hours
      return response;
    } catch (error) {
      logger.error({ error: error.message, date }, 'Zefix SOGC query failed');
      throw new Error(`Failed to get SOGC data: ${await describeError(error)}`);
    }
  }

  /**
   * Get all SOGC publications for a specific company.
   * 
   * Retrieves historical publications from the Swiss Official Gazette of Commerce
   * for a given company UID. Returns empty array if no publications exist (404).
   * Results are cached for 1 hour.
   * 
   * @async
   * @param {string} uid - Company UID in format CHE-XXX.XXX.XXX or CHEXXXXXXXXX
   * 
   * @returns {Promise<Array<Object>>} Array of SOGC publications for the company
   * @returns {string} return[].publicationDate - Publication date
   * @returns {string} return[].publicationType - Type of publication
   * @returns {string} return[].publicationText - Publication text content
   * @returns {string} return[].cantonalGazette - Cantonal gazette reference
   * 
   * @throws {Error} When API request fails (except 404, which returns empty array)
   * 
   * @example
   * const publications = await client.getSogcByUid('CHE-123.456.789');
   * if (publications.length === 0) {
   *   console.log('No publications found');
   * } else {
   *   console.log(`Found ${publications.length} publications`);
   * }
   */
  async getSogcByUid(uid) {
    const cacheKey = `zefix:sogc:uid:${uid}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    logger.info({ uid }, 'Getting SOGC publications for company');

    try {
      // There is no /sogc/uid/{uid} endpoint in the public spec.
      // Publications per company are provided via /company/uid/{uid} under the sogcPub field.
      const companyResponse = await this.client.get(`company/uid/${uid}`).json();
      const company = Array.isArray(companyResponse) ? companyResponse[0] : companyResponse;
      const publications = Array.isArray(company?.sogcPub) ? company.sogcPub.map(cleanPublication) : [];
      cache.set(cacheKey, publications, 3600); // Cache for 1 hour
      return publications;
    } catch (error) {
      // If company not found or no publications exist, API may return 404 - map to empty list
      if (error.response?.status === 404) {
        logger.info({ uid }, 'No SOGC publications found for company (404)');
        return [];
      }
      logger.error({ error: error.message, uid }, 'Zefix SOGC by UID fetch failed');
      throw new Error(`Failed to get SOGC data for company: ${await describeError(error)}`);
    }
  }
}
