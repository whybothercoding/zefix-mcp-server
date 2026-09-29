/**
 * @fileoverview Vitest global setup file.
 * 
 * Configures test environment, loads environment variables,
 * and sets up global test utilities.
 * 
 * @module tests/setup
 */

import { config } from 'dotenv';

// Load environment variables from .env file BEFORE any test code runs
config();

// Set test-specific environment variables if needed
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error'; // Reduce log noise in tests

// CRITICAL: Clear CACHE_ENABLED from .env to allow tests to control it
// The .env file has CACHE_ENABLED=true, but tests expect false as default
// This must happen BEFORE any module imports config.js
delete process.env.CACHE_ENABLED;

// Ensure NODE_ENV is set to 'test' for config validation bypass
process.env.NODE_ENV = 'test';

// Global test timeout (can be overridden per test)
const DEFAULT_TEST_TIMEOUT = 10000;

// Export test utilities
export const TEST_TIMEOUT = DEFAULT_TEST_TIMEOUT;

/**
 * Common test data used across multiple test files.
 */
export const TEST_DATA = {
  // Valid UIDs for testing
  validUid: 'CHE-105.841.533', // Migros Bank AG
  validUidNumeric: '105841533',
  
  // Invalid UIDs for testing
  invalidUid: 'CHE-000.000.000',
  malformedUid: 'INVALID',
  
  // Company search data
  companyName: 'Migros',
  canton: 'ZH',
  
  // Date for SOGC testing
  testDate: '2025-01-15',
  
  // VAT number
  validVatNumber: 'CHE-105.841.533',
};

/**
 * Helper to create a delay for testing async operations.
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to suppress console output during tests.
 * Useful for testing error conditions without cluttering test output.
 * 
 * @returns {Object} Object with restore() method to restore console
 */
export const suppressConsole = () => {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };
  
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};
  
  return {
    restore: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    },
  };
};
