/**
 * @fileoverview Simple in-memory cache implementation with TTL support.
 * Used to cache API responses and reduce external API calls.
 * 
 * @module utils/cache
 */

import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * Simple in-memory cache with time-to-live (TTL) support.
 * 
 * Provides a lightweight caching mechanism for API responses to:
 * - Reduce external API calls
 * - Improve response times
 * - Respect API rate limits
 * - Reduce costs for metered APIs
 * 
 * **Features:**
 * - Configurable TTL per entry or global default
 * - Automatic expiration of stale entries
 * - Enable/disable via configuration
 * - Debug logging for cache operations
 * 
 * **Configuration:**
 * - `config.cache.enabled` - Enable/disable caching
 * - `config.cache.ttl` - Default TTL in seconds
 * 
 * @class
 * @example
 * import { cache } from './utils/cache.js';
 * 
 * // Set a value with default TTL
 * cache.set('company:CHE-123.456.789', companyData);
 * 
 * // Get a value
 * const data = cache.get('company:CHE-123.456.789');
 * 
 * // Set with custom TTL (in seconds)
 * cache.set('temp:data', tempData, 60);
 * 
 * // Clear all cache
 * cache.clear();
 */
class SimpleCache {
  /**
   * Create a new cache instance.
   * 
   * Initializes the cache with configuration from config.js.
   * 
   * @constructor
   */
  constructor() {
    this.cache = new Map();
    this.enabled = config.cache.enabled;
    this.ttl = config.cache.ttl * 1000; // Convert to milliseconds
  }

  /**
   * Store a value in the cache with TTL.
   * 
   * If caching is disabled, this method does nothing.
   * Values are automatically expired after TTL.
   * 
   * @param {string} key - Cache key (should be unique and descriptive)
   * @param {*} value - Value to cache (any serializable data)
   * @param {number|null} [customTtl=null] - Custom TTL in seconds (overrides default)
   * 
   * @returns {void}
   * 
   * @example
   * // Use default TTL from config
   * cache.set('company:CHE-123.456.789', companyData);
   * 
   * @example
   * // Use custom TTL (60 seconds)
   * cache.set('temp:search-results', results, 60);
   */
  set(key, value, customTtl = null) {
    if (!this.enabled) return;

    const ttl = customTtl ? customTtl * 1000 : this.ttl;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, {
      value,
      expiresAt,
    });

    logger.debug({ key, ttl: ttl / 1000 }, 'Cache set');
  }

  /**
   * Retrieve a value from the cache.
   * 
   * Returns null if:
   * - Caching is disabled
   * - Key doesn't exist
   * - Entry has expired
   * 
   * Expired entries are automatically deleted.
   * 
   * @param {string} key - Cache key to retrieve
   * 
   * @returns {*|null} Cached value or null if not found/expired
   * 
   * @example
   * const data = cache.get('company:CHE-123.456.789');
   * if (data) {
   *   // Use cached data
   * } else {
   *   // Fetch from API
   * }
   */
  get(key) {
    if (!this.enabled) return null;

    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      logger.debug({ key }, 'Cache expired');
      return null;
    }

    logger.debug({ key }, 'Cache hit');
    return item.value;
  }

  /**
   * Clear all entries from the cache.
   * 
   * Useful for:
   * - Testing
   * - Forcing fresh data
   * - Memory management
   * 
   * @returns {void}
   * 
   * @example
   * cache.clear();
   */
  clear() {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Delete a specific entry from the cache.
   * 
   * @param {string} key - Cache key to delete
   * 
   * @returns {void}
   * 
   * @example
   * // Invalidate specific entry
   * cache.delete('company:CHE-123.456.789');
   */
  delete(key) {
    this.cache.delete(key);
    logger.debug({ key }, 'Cache entry deleted');
  }
}

/**
 * Singleton cache instance.
 * 
 * Import and use this instance throughout the application.
 * 
 * @type {SimpleCache}
 * 
 * @example
 * import { cache } from './utils/cache.js';
 * 
 * cache.set('key', 'value');
 * const value = cache.get('key');
 */
export const cache = new SimpleCache();
