import soap from 'soap';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';

/**
 * @fileoverview Client for interacting with the Swiss UID Webservice (SOAP API).
 * Provides methods for searching companies, validating UIDs/VAT numbers,
 * and retrieving detailed company information from the federal business register.
 * 
 * @module api/uid-client
 * @see {@link https://www.uid.admin.ch/Detail.aspx?lang=en&uid_id=CHE107769148|UID Webservice Documentation}
 */

/**
 * Client for the Swiss UID (Unternehmens-Identifikationsnummer) Webservice.
 * 
 * Features:
 * - SOAP-based API client for Swiss federal business register
 * - Advanced search with multiple filter options
 * - UID and VAT number validation
 * - Response caching with configurable TTL
 * - Automatic UID formatting (CHE-XXX.XXX.XXX)
 * - Lazy initialization of SOAP client
 * 
 * @class
 * 
 * @example
 * const client = new UidClient();
 * const results = await client.search({
 *   organisationName: 'Migros',
 *   canton: 'ZH'
 * });
 */
export class UidClient {
  /**
   * Creates a new UID Webservice SOAP client.
   * 
   * The SOAP client is initialized lazily on first use to avoid
   * unnecessary WSDL downloads during server startup.
   * 
   * @constructor
   */
  constructor() {
    this.publicUrl = config.uid.publicUrl;
    this.publicClient = null;
  }

  /**
   * Initialize SOAP client for UID Public Services.
   * 
   * Lazily creates and caches the SOAP client. Downloads WSDL from
   * the configured endpoint and creates a client instance. Subsequent
   * calls return the cached client.
   * 
   * @async
   * @private
   * @returns {Promise<Object>} Initialized SOAP client
   * @throws {Error} When WSDL download or client creation fails
   * 
   * @example
   * const client = await this.initPublicClient();
   * const [result] = await client.SearchAsync({ ... });
   */
  async initPublicClient() {
    if (!this.publicClient) {
      logger.info({ url: this.publicUrl }, 'Initializing UID Public Services SOAP client');
      try {
        this.publicClient = await soap.createClientAsync(this.publicUrl, {
          disableCache: true,
        });
        logger.info('UID Public Services client initialized');
      } catch (error) {
        logger.error({ error: error.message }, 'Failed to initialize UID SOAP client');
        throw new Error(`Failed to initialize UID client: ${error.message}`);
      }
    }
    return this.publicClient;
  }

  /**
   * Search for companies in the Swiss federal business register.
   * 
   * Performs advanced search using UID Webservice with support for:
   * - Organization name search
   * - Person name search (for sole proprietorships)
   * - Canton filtering
   * - Legal form filtering
   * - Active/inactive status filtering
   * 
   * Results are cached for 30 minutes.
   * 
   * @async
   * @param {Object} searchParams - Search parameters
   * @param {string} [searchParams.organisationName] - Organization name (min 3 chars)
   * @param {Object} [searchParams.personName] - Person name for sole proprietorships
   * @param {string} searchParams.personName.officialName - Last name
   * @param {string} [searchParams.personName.firstName] - First name
   * @param {string} [searchParams.canton] - Canton code (e.g., 'ZH', 'BE')
   * @param {Array<string>} [searchParams.legalForms] - Legal form codes (e.g., ['0106', '0107'])
   * @param {boolean} [searchParams.activeOnly] - Only active companies
   * 
   * @param {Object} [searchSettings] - Search configuration
   * @param {string} [searchSettings.searchMode='Auto'] - Search mode (Auto, Exact, Fuzzy)
   * @param {number} [searchSettings.maxNumberOfRecords=30] - Maximum results (1-200)
   * @param {boolean} [searchSettings.searchNameAndAddressHistory=false] - Search historical data
   * 
   * @returns {Promise<Object>} Search results from UID Webservice
   * @returns {Object} return.SearchResult - Search result container
   * @returns {Array<Object>} return.SearchResult.uidEntitySearchResultItem - Array of companies
   * @returns {Object} return.SearchResult.uidEntitySearchResultItem[].organisation - Company data
   * @returns {Object} return.SearchResult.uidEntitySearchResultItem[].organisation.uid - UID structure
   * @returns {number} return.SearchResult.uidEntitySearchResultItem[].organisation.uid.uidOrganisationId - Numeric UID
   * @returns {Object} return.SearchResult.uidEntitySearchResultItem[].organisation.organisationIdentification - Company details
   * 
   * @throws {Error} When SOAP request fails or returns error
   * 
   * @example
   * // Search by organization name
   * const results = await client.search({
   *   organisationName: 'Migros',
   *   canton: 'ZH',
   *   activeOnly: true
   * });
   * 
   * @example
   * // Search by person name (sole proprietorship)
   * const results = await client.search({
   *   personName: {
   *     officialName: 'Müller',
   *     firstName: 'Hans'
   *   }
   * });
   * 
   * @example
   * // Search with custom settings
   * const results = await client.search(
   *   { organisationName: 'Migros' },
   *   { searchMode: 'Exact', maxNumberOfRecords: 10 }
   * );
   */
  async search(searchParams, searchSettings = null) {
    // Normalize and support "address shorthand" by auto-wrapping address fields under { address: {...} }
    const sp = { ...(searchParams || {}) };

    const ADDRESS_KEYS = [
      'addressLine1',
      'addressLine2',
      'street',
      'houseNumber',
      'postOfficeBoxNumber',
      'town',
      'swissZipCode',
      'swissZipCodeAddOn',
      'municipalityId',
      'cantonAbbreviation',
      'EGID',
      'foreignZipCode',
      'countryIdISO2'
    ];

    const hasAddressShorthand = ADDRESS_KEYS.some((k) => Object.prototype.hasOwnProperty.call(sp, k));
    if (hasAddressShorthand && !sp.address) {
      const addr = {};
      for (const key of ADDRESS_KEYS) {
        if (Object.prototype.hasOwnProperty.call(sp, key) && sp[key] !== undefined && sp[key] !== null && sp[key] !== '') {
          addr[key] = sp[key];
          delete sp[key];
        }
      }
      // Ensure zip is string and default country is CH
      if (addr.swissZipCode !== undefined && addr.swissZipCode !== null) {
        addr.swissZipCode = String(addr.swissZipCode);
      }
      if (!addr.countryIdISO2) {
        addr.countryIdISO2 = 'CH';
      }
      sp.address = addr;
    }

    const settings = {
      searchMode: 'Auto',
      maxNumberOfRecords: 30, // PublicServices cap
      searchNameAndAddressHistory: false,
      quick: false,
      ...(searchSettings || {})
    };

    const cacheKey = `uid:search:${JSON.stringify({ sp, settings })}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const client = await this.initPublicClient();

    logger.info({ searchParams: sp, settings }, 'Searching via UID Webservice');

    try {
      // Public Services: free search via uidEntitySearchParameters (type uidEntityPublicSearchParameters)
      const payload = {
        searchParameters: {
          // Per WSDL: searchParameters is type uidEntityPublicSearchRequest
          // with child element 'uidEntitySearchParameters'
          uidEntitySearchParameters: sp
        },
        // Per WSDL: the second element name is 'config' (searchConfiguration type),
        // not 'searchSettings'
        config: {
          searchMode: settings.searchMode,
          maxNumberOfRecords: settings.maxNumberOfRecords,
          searchNameAndAddressHistory: settings.searchNameAndAddressHistory
        }
      };

      const [result] = settings.quick
        ? await client.QuickSearchAsync(payload)
        : await client.SearchAsync(payload);

      cache.set(cacheKey, result, 1800); // Cache for 30 minutes
      return result;
    } catch (error) {
      logger.error({ error: error.message, searchParams: sp }, 'UID search failed');
      throw new Error(`UID search failed: ${error.message}`);
    }
  }

  /**
   * Get detailed company information by UID from federal register.
   * 
   * Retrieves comprehensive company data including:
   * - Organization identification (name, legal form)
   * - Address information
   * - VAT registration status
   * - Commercial register details
   * - LEI, when registered
   * 
   * The schema also defines NOGA code, industry text, foundation date and contact,
   * but the public service leaves them empty for most companies.
   * 
   * Results are cached for 1 hour.
   * 
   * @async
   * @param {string} uid - Company UID in any format (CHE-XXX.XXX.XXX, CHE XXX XXX XXX, or CHEXXXXXXXXX)
   * 
   * @returns {Promise<Object>} Company details from UID Webservice
   * @returns {Object} return.GetByUIDResult - Result container
   * @returns {Object} return.GetByUIDResult.organisation - Organization data
   * @returns {Object} return.GetByUIDResult.organisation.uid - UID structure
   * @returns {Object} return.GetByUIDResult.organisation.organisationIdentification - Company identification
   * @returns {Array<Object>} return.GetByUIDResult.organisation.address - Address information
   * @returns {Array<Object>} return.GetByUIDResult.organisation.contact - Contact details
   * @returns {Object} return.GetByUIDResult.organisation.vatRegisterInformation - VAT registration
   * @returns {Object} return.GetByUIDResult.organisation.commercialRegisterInformation - Commercial register data
   * 
   * @throws {Error} When company not found or SOAP request fails
   * 
   * @example
   * // All UID formats are supported
   * const company1 = await client.getByUid('CHE-123.456.789');
   * const company2 = await client.getByUid('CHE 123 456 789');
   * const company3 = await client.getByUid('CHE123456789');
   * 
   * console.log(company1.GetByUIDResult.organisation.organisationIdentification);
   */
  async getByUid(uid) {
    // Format UID with dots if not already formatted (CHE-123.456.789)
    const formattedUid = this.formatUid(uid);
    
    const cacheKey = `uid:company:${formattedUid}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const client = await this.initPublicClient();

    logger.info({ uid: formattedUid }, 'Getting company by UID via UID Webservice');

    try {
      // Parse UID into structure required by WSDL (uidStructureType)
      // Format: CHE-123.456.789 -> { uidOrganisationIdCategorie: 'CHE', uidOrganisationId: 123456789 }
      const cleaned = formattedUid.replace(/[^A-Z0-9]/gi, '');
      const category = cleaned.substring(0, 3); // CHE or ADM
      const numericId = parseInt(cleaned.substring(3), 10);
      
      const [result] = await client.GetByUIDAsync({
        uid: {
          uidOrganisationIdCategorie: category,
          uidOrganisationId: numericId
        }
      });
      
      cache.set(cacheKey, result, 3600); // Cache for 1 hour
      return result;
    } catch (error) {
      logger.error({ error: error.message, uid: formattedUid }, 'UID get by UID failed');
      throw new Error(`Failed to get company by UID: ${error.message}`);
    }
  }

  /**
   * Format UID to standard Swiss format (CHE-XXX.XXX.XXX).
   * 
   * Accepts various input formats and normalizes to the official format
   * with hyphens and dots. Returns input unchanged if not a valid UID.
   * 
   * @param {string} uid - UID in any format
   * 
   * @returns {string} Formatted UID (CHE-XXX.XXX.XXX) or original input if invalid
   * 
   * @example
   * formatUid('CHE123456789')     // Returns: 'CHE-123.456.789'
   * formatUid('CHE 123 456 789')  // Returns: 'CHE-123.456.789'
   * formatUid('CHE-123.456.789')  // Returns: 'CHE-123.456.789' (unchanged)
   * formatUid('invalid')          // Returns: 'invalid' (unchanged)
   */
  formatUid(uid) {
    // Remove any existing formatting
    const cleaned = uid.replace(/[^A-Z0-9]/gi, '');
    
    // Check if it's a valid UID format (CHE followed by 9 digits)
    if (!/^CHE\d{9}$/i.test(cleaned)) {
      return uid; // Return as-is if not standard format
    }
    
    // Format as CHE-XXX.XXX.XXX
    const prefix = cleaned.substring(0, 3); // CHE
    const part1 = cleaned.substring(3, 6);
    const part2 = cleaned.substring(6, 9);
    const part3 = cleaned.substring(9, 12);
    
    return `${prefix}-${part1}.${part2}.${part3}`;
  }

  /**
   * Validate if a UID exists in the Swiss business register.
   * 
   * Checks if the UID is registered and valid. Does not check if the
   * company is active or inactive. Results are cached for 24 hours.
   * 
   * @async
   * @param {string} uid - UID to validate (any format accepted)
   * 
   * @returns {Promise<boolean>} True if UID exists and is valid, false otherwise
   * 
   * @throws {Error} When SOAP request fails
   * 
   * @example
   * const isValid = await client.validateUid('CHE-123.456.789');
   * if (isValid) {
   *   console.log('UID exists in register');
   * } else {
   *   console.log('UID not found or invalid');
   * }
   */
  async validateUid(uid) {
    const cacheKey = `uid:validate:${uid}`;
    const cached = cache.get(cacheKey);
    if (cached !== null && cached !== undefined) return cached;

    const client = await this.initPublicClient();

    logger.info({ uid }, 'Validating UID');

    try {
      const [result] = await client.ValidateUIDAsync({ uid });
      
      const isValid = result?.ValidateUIDResult || false;
      cache.set(cacheKey, isValid, 86400); // Cache for 24 hours
      return isValid;
    } catch (error) {
      logger.error({ error: error.message, uid }, 'UID validation failed');
      throw new Error(`UID validation failed: ${error.message}`);
    }
  }

  /**
   * Validate if a VAT number is valid and currently active.
   * 
   * Checks if the VAT number is registered and the VAT registration
   * is currently active. Results are cached for 1 hour (VAT status
   * can change more frequently than UID validity).
   * 
   * @async
   * @param {string} vatNumber - VAT number to validate (CHE-XXX.XXX.XXX format)
   * 
   * @returns {Promise<boolean>} True if VAT number is valid and active, false otherwise
   * 
   * @throws {Error} When SOAP request fails
   * 
   * @example
   * const isValid = await client.validateVatNumber('CHE-123.456.789');
   * if (isValid) {
   *   console.log('VAT number is valid and active');
   * } else {
   *   console.log('VAT number is invalid or inactive');
   * }
   * 
   * @see {@link https://www.estv.admin.ch/estv/en/home/value-added-tax.html|Swiss VAT Information}
   */
  async validateVatNumber(vatNumber) {
    const cacheKey = `uid:validate:vat:${vatNumber}`;
    const cached = cache.get(cacheKey);
    if (cached !== null && cached !== undefined) return cached;

    const client = await this.initPublicClient();

    logger.info({ vatNumber }, 'Validating VAT number');

    try {
      const [result] = await client.ValidateVatNumberAsync({ vatNumber });
      
      const isValid = result?.ValidateVatNumberResult || false;
      cache.set(cacheKey, isValid, 3600); // Cache for 1 hour (VAT status can change)
      return isValid;
    } catch (error) {
      logger.error({ error: error.message, vatNumber }, 'VAT validation failed');
      throw new Error(`VAT validation failed: ${error.message}`);
    }
  }

  /**
   * Get sample organization data from UID Webservice.
   * 
   * Retrieves a sample organization record for testing and documentation
   * purposes. Useful for understanding the data structure returned by
   * the UID Webservice without needing a real UID.
   * 
   * @async
   * @returns {Promise<Object>} Sample organization data with full structure
   * 
   * @throws {Error} When SOAP request fails
   * 
   * @example
   * const sample = await client.getSample();
   * console.log(sample); // Full organization structure with sample data
   * 
   * @see Use this to understand the data structure before implementing
   */
  async getSample() {
    const client = await this.initPublicClient();

    logger.info('Getting sample organization data');

    try {
      const [result] = await client.GetOrganisationSampleAsync({});
      return result?.GetOrganisationSampleResult;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get sample data');
      throw new Error(`Failed to get sample data: ${error.message}`);
    }
  }
}
