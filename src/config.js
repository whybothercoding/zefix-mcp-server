/**
 * @fileoverview Application configuration management.
 * Loads environment variables and validates required credentials.
 * 
 * @module config
 */

import dotenv from 'dotenv';

// Only load .env if not in test environment
// Tests manage environment variables through setup.js
if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

/**
 * Application configuration object.
 * 
 * Loads configuration from environment variables with sensible defaults.
 * Validates that required Zefix credentials are present.
 * 
 * **Environment Variables:**
 * 
 * **Zefix API (Required):**
 * - `ZEFIX_USERNAME` - Zefix API username (required)
 * - `ZEFIX_PASSWORD` - Zefix API password (required)
 * - `ZEFIX_BASE_URL` - Zefix API base URL (optional, defaults to production)
 * 
 * **UID Webservice (Optional):**
 * - `UID_PUBLIC_URL` - UID Webservice WSDL URL (optional, defaults to production)
 * 
 * **Caching (Optional):**
 * - `CACHE_ENABLED` - Enable in-memory caching ('true'/'false', default: false)
 * - `CACHE_TTL` - Cache time-to-live in seconds (default: 3600)
 * 
 * **Logging (Optional):**
 * - `LOG_LEVEL` - Pino log level (trace/debug/info/warn/error/fatal, default: 'info')
 * 
 * @type {Object}
 * 
 * @property {Object} zefix - Zefix API configuration
 * @property {string} zefix.username - Zefix API username
 * @property {string} zefix.password - Zefix API password
 * @property {string} zefix.baseUrl - Zefix API base URL
 * 
 * @property {Object} uid - UID Webservice configuration
 * @property {string} uid.publicUrl - UID Webservice WSDL URL
 * 
 * @property {Object} cache - Caching configuration
 * @property {boolean} cache.enabled - Whether caching is enabled
 * @property {number} cache.ttl - Cache TTL in seconds
 * 
 * @property {Object} logging - Logging configuration
 * @property {string} logging.level - Log level (trace/debug/info/warn/error/fatal)
 * 
 * @throws {Error} If ZEFIX_USERNAME or ZEFIX_PASSWORD are not set
 * 
 * @example
 * import { config } from './config.js';
 * 
 * // Access Zefix credentials
 * const { username, password } = config.zefix;
 * 
 * @example
 * // Check if caching is enabled
 * if (config.cache.enabled) {
 *   console.log(`Cache TTL: ${config.cache.ttl} seconds`);
 * }
 * 
 * @example
 * // Get log level
 * console.log(`Logging at level: ${config.logging.level}`);
 */
export const config = {
  zefix: {
    username: process.env.ZEFIX_USERNAME,
    password: process.env.ZEFIX_PASSWORD,
    baseUrl: process.env.ZEFIX_BASE_URL || 'https://www.zefix.admin.ch/ZefixPublicREST/api/v1',
  },
  uid: {
    publicUrl: process.env.UID_PUBLIC_URL || 'https://www.uid-wse.admin.ch/V5.0/PublicServices.svc?wsdl',
  },
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

/**
 * Validate required Zefix credentials on module load.
 * 
 * Ensures that ZEFIX_USERNAME and ZEFIX_PASSWORD are set in environment
 * variables. Throws an error if either is missing, preventing the
 * application from starting with invalid configuration.
 * 
 * Skip validation in test environment to allow tests to control credentials.
 * 
 * @throws {Error} If ZEFIX_USERNAME or ZEFIX_PASSWORD are not set
 */
if (process.env.NODE_ENV !== 'test' && (!config.zefix.username || !config.zefix.password)) {
  throw new Error('ZEFIX_USERNAME and ZEFIX_PASSWORD must be set in .env file');
}
