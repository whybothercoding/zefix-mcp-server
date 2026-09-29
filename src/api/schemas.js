import { z } from 'zod';

/**
 * @fileoverview Zod validation schemas for MCP tool inputs and Swiss business identifiers.
 * Provides runtime validation and type safety for all tool parameters.
 * 
 * @module api/schemas
 */

/**
 * Validates and normalizes Swiss UID (Unternehmens-Identifikationsnummer) format.
 * Accepts various formats and normalizes to CHEXXXXXXXXX.
 * 
 * @type {z.ZodEffects<z.ZodString, string, string>}
 * 
 * @example
 * // Valid formats:
 * uidSchema.parse('CHE-123.456.789') // Returns: 'CHE123456789'
 * uidSchema.parse('CHE 123 456 789') // Returns: 'CHE123456789'
 * uidSchema.parse('CHE123456789')    // Returns: 'CHE123456789'
 * 
 * @example
 * // Invalid formats throw ZodError:
 * uidSchema.parse('CH-123.456.789')  // Throws: Invalid UID format
 * uidSchema.parse('CHE-12.456.789')  // Throws: Invalid UID format
 */
export const uidSchema = z.string()
  .trim() // Remove leading/trailing whitespace
  .regex(/^CHE[-\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3}$/, 'Invalid UID format. Expected: CHE-XXX.XXX.XXX')
  .transform(uid => uid.replace(/[^A-Z0-9]/g, '')); // Normalize to CHEXXXXXXXXX

/**
 * Validates Swiss canton codes (2 uppercase letters).
 * 
 * @type {z.ZodString}
 * 
 * @example
 * cantonSchema.parse('ZH') // Valid: Zürich
 * cantonSchema.parse('BE') // Valid: Bern
 * cantonSchema.parse('GE') // Valid: Geneva
 * 
 * @see {@link https://www.bfs.admin.ch/bfs/en/home/basics/swiss-official-commune-register.html|Swiss Canton Codes}
 */
export const cantonSchema = z.string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'Canton code must be 2 uppercase letters (e.g., ZH, BE, GE)');

/**
 * Validates ISO 8601 date format (YYYY-MM-DD).
 * 
 * @type {z.ZodString}
 * 
 * @example
 * dateSchema.parse('2024-11-13') // Valid
 * dateSchema.parse('2024-1-13')  // Invalid: month must be 2 digits
 * dateSchema.parse('13.11.2024') // Invalid: wrong format
 */
export const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in format YYYY-MM-DD');

/**
 * Validates Swiss legal form codes (4 digits).
 * 
 * @type {z.ZodString}
 * 
 * @example
 * legalFormSchema.parse('0106') // Valid: AG (Aktiengesellschaft)
 * legalFormSchema.parse('0107') // Valid: GmbH (Gesellschaft mit beschränkter Haftung)
 * legalFormSchema.parse('0110') // Valid: Verein (Association)
 * 
 * @see {@link https://www.bfs.admin.ch/bfs/en/home/registers/enterprise-register/enterprise-identification.html|Legal Form Codes}
 */
export const legalFormSchema = z.string()
  .length(4)
  .regex(/^\d{4}$/, 'Legal form code must be 4 digits (e.g., 0106 for AG)');

/**
 * @typedef {Object} SearchCompaniesParams
 * @property {string} name - Company name to search for (min 3 chars, supports wildcards)
 * @property {string} [canton] - 2-letter canton code (e.g., ZH, BE, GE)
 * @property {boolean} [activeOnly=true] - Only return active companies
 * @property {string} [legalFormUid] - Legal form code (e.g., 0106 for AG)
 * @property {number} [maxResults=30] - Maximum results (1-200)
 */

/**
 * Validation schema for search_companies tool.
 * Searches Swiss commercial register by company name with optional filters.
 * 
 * @type {z.ZodObject}
 * 
 * @example
 * searchCompaniesSchema.parse({
 *   name: 'Migros',
 *   canton: 'ZH',
 *   activeOnly: true,
 *   maxResults: 10
 * });
 */
export const searchCompaniesSchema = z.object({
  name: z.string()
    .min(3, 'Company name must be at least 3 characters')
    .describe('Company name to search for (minimum 3 characters, use * for wildcard)'),
  canton: cantonSchema.optional()
    .describe('2-letter canton code (e.g., ZH, BE, GE)'),
  activeOnly: z.boolean()
    .optional()
    .default(true)
    .describe('Only return active companies; excludes companies in liquidation or deleted (default: true)'),
  legalFormUid: legalFormSchema.optional()
    .describe('Legal form code (e.g., 0106 for AG, 0107 for GmbH)'),
  maxResults: z.number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(30)
    .describe('Maximum number of results to return (default: 30, max: 200)'),
});

/**
 * @typedef {Object} GetCompanyByUidParams
 * @property {string} uid - Company UID in format CHE-XXX.XXX.XXX
 * @property {boolean} [enrichWithUidData=true] - Enrich with UID Webservice data
 */

/**
 * Validation schema for get_company_by_uid tool.
 * Retrieves detailed company information by UID with optional enrichment.
 * 
 * @type {z.ZodObject}
 * 
 * @example
 * getCompanyByUidSchema.parse({
 *   uid: 'CHE-123.456.789',
 *   enrichWithUidData: true
 * });
 */
export const getCompanyByUidSchema = z.object({
  uid: uidSchema
    .describe('Company UID in format CHE-XXX.XXX.XXX'),
  enrichWithUidData: z.boolean()
    .optional()
    .default(true)
    .describe('Enrich with additional data from UID Webservice (default: true)'),
});

/**
 * @typedef {Object} AdvancedSearchParams
 * @property {string} [organisationName] - Organization name (min 3 chars)
 * @property {Object} [personName] - Person name for sole proprietorships
 * @property {string} personName.officialName - Last name (required)
 * @property {string} [personName.firstName] - First name (optional)
 * @property {string} [canton] - Canton code
 * @property {string[]} [legalForms] - Array of legal form codes
 * @property {boolean} [activeOnly=true] - Only active companies
 * @property {number} [maxResults=30] - Maximum results (1-200)
 */

/**
 * Validation schema for advanced_search tool.
 * Advanced search using UID Webservice with multiple filter options.
 * 
 * @type {z.ZodObject}
 * 
 * @example
 * advancedSearchSchema.parse({
 *   organisationName: 'Migros',
 *   canton: 'ZH',
 *   legalForms: ['0106', '0107'],
 *   activeOnly: true
 * });
 */
export const advancedSearchSchema = z.object({
  organisationName: z.string()
    .min(3)
    .optional()
    .describe('Organization name (minimum 3 characters)'),
  personName: z.object({
    officialName: z.string().describe('Last name (required for person search)'),
    firstName: z.string().optional().describe('First name (optional)'),
  })
    .optional()
    .describe('Search by person name (for sole proprietorships)'),
  canton: cantonSchema.optional()
    .describe('Canton code (e.g., ZH, BE)'),
  legalForms: z.array(legalFormSchema)
    .optional()
    .describe('Array of legal form codes to filter by'),
  activeOnly: z.boolean()
    .optional()
    .default(true)
    .describe('Only return active companies'),
  maxResults: z.number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(30)
    .describe('Maximum number of results'),
});

/**
 * @typedef {Object} ValidateUidParams
 * @property {string} uid - UID to validate in format CHE-XXX.XXX.XXX
 */

/**
 * Validation schema for validate_uid tool.
 * Validates if a UID exists in the Swiss business register.
 * 
 * @type {z.ZodObject}
 * 
 * @example
 * validateUidSchema.parse({ uid: 'CHE-123.456.789' });
 */
export const validateUidSchema = z.object({
  uid: uidSchema
    .describe('UID to validate in format CHE-XXX.XXX.XXX'),
});

/**
 * @typedef {Object} ValidateVatParams
 * @property {string} vatNumber - VAT number to validate in format CHE-XXX.XXX.XXX
 */

/**
 * Validation schema for validate_vat_number tool.
 * Validates if a VAT number is valid and active.
 * 
 * @type {z.ZodObject}
 * 
 * @example
 * validateVatSchema.parse({ vatNumber: 'CHE-123.456.789' });
 */
export const validateVatSchema = z.object({
  vatNumber: uidSchema
    .describe('VAT number to validate in format CHE-XXX.XXX.XXX'),
});

/**
 * @typedef {Object} GetSogcByDateParams
 * @property {string} date - Date in format YYYY-MM-DD
 * @property {string} [canton] - Only publications of this cantonal registry
 * @property {string} [mutationType] - Only publications with this mutation type key
 * @property {number} [maxResults=50] - Page size (1-200)
 * @property {number} [offset=0] - Number of matching publications to skip
 * @property {boolean} [includeText=false] - Include the full publication text
 */

/**
 * Validation schema for get_daily_registrations tool.
 * Retrieves SOGC (Swiss Official Gazette of Commerce) publications for a date.
 * A single day holds ~1,000 publications, so results are filtered and paged.
 * 
 * @type {z.ZodObject}
 * 
 * @example
 * getSogcByDateSchema.parse({ date: '2024-11-13', canton: 'ZH', mutationType: 'status.neu' });
 */
export const getSogcByDateSchema = z.object({
  date: dateSchema
    .describe('Date in format YYYY-MM-DD'),
  canton: cantonSchema.optional()
    .describe('Only publications of this cantonal commercial registry (2-letter code, e.g. ZH)'),
  mutationType: z.string()
    .min(1)
    .optional()
    .describe('Only publications with this mutation type key, e.g. status.neu (new registration), status.loeschung (deletion), status.aufl (dissolution), adressaenderung, firmenaenderung (name change), kapitalaenderung, aenderungorgane (officers). A key also matches its sub-keys (status matches status.*).'),
  maxResults: z.number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe('Maximum number of publications to return (default: 50, max: 200)'),
  offset: z.number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe('Number of matching publications to skip, for paging (default: 0)'),
  includeText: z.boolean()
    .optional()
    .default(false)
    .describe('Include the full publication text (default: false; keep maxResults small when true)'),
});

/**
 * @typedef {Object} GetSogcByUidParams
 * @property {string} uid - Company UID in format CHE-XXX.XXX.XXX
 * @property {number} [maxResults=20] - Page size (1-200)
 * @property {number} [offset=0] - Number of publications to skip
 */

/**
 * Validation schema for get_company_publications tool.
 * Retrieves SOGC publications for a specific company, most recent first.
 * 
 * @type {z.ZodObject}
 * 
 * @example
 * getSogcByUidSchema.parse({ uid: 'CHE-123.456.789', maxResults: 10 });
 */
export const getSogcByUidSchema = z.object({
  uid: uidSchema
    .describe('Company UID in format CHE-XXX.XXX.XXX'),
  maxResults: z.number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(20)
    .describe('Maximum number of publications to return, most recent first (default: 20, max: 200)'),
  offset: z.number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe('Number of publications to skip, for paging (default: 0)'),
});

/**
 * @typedef {Object} DueDiligenceParams
 * @property {string} uid - Company UID in format CHE-XXX.XXX.XXX
 * @property {boolean} [includePublications=true] - Include SOGC publications
 */

/**
 * Validation schema for generate_due_diligence_report tool.
 * Generates comprehensive due diligence report combining multiple data sources.
 * 
 * @type {z.ZodObject}
 * 
 * @example
 * dueDiligenceSchema.parse({
 *   uid: 'CHE-123.456.789',
 *   includePublications: true
 * });
 */
export const dueDiligenceSchema = z.object({
  uid: uidSchema
    .describe('Company UID in format CHE-XXX.XXX.XXX'),
  includePublications: z.boolean()
    .optional()
    .default(true)
    .describe('Include recent SOGC publications in report (default: true)'),
});
