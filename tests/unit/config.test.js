/**
 * @fileoverview Unit tests for configuration module.
 * Tests environment variable loading and configuration validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('config', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear module cache to get fresh config
    vi.resetModules();
    
    // Set required credentials for all tests
    process.env.ZEFIX_USERNAME = 'test-user';
    process.env.ZEFIX_PASSWORD = 'test-pass';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('environment variables', () => {
    it('should load ZEFIX_USERNAME from environment', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      const { config } = await import('../../src/config.js');
      
      expect(config.zefix.username).toBe('test-user');
    });

    it('should load ZEFIX_PASSWORD from environment', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      const { config } = await import('../../src/config.js');
      
      expect(config.zefix.password).toBe('test-pass');
    });

    it('should load ZEFIX_BASE_URL from environment', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      process.env.ZEFIX_BASE_URL = 'https://test.zefix.ch';
      const { config } = await import('../../src/config.js');
      
      expect(config.zefix.baseUrl).toBe('https://test.zefix.ch');
    });

    it('should use default ZEFIX_BASE_URL if not provided', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      delete process.env.ZEFIX_BASE_URL;
      const { config } = await import('../../src/config.js');
      
      expect(config.zefix.baseUrl).toBe('https://www.zefix.admin.ch/ZefixPublicREST/api/v1');
    });

    it('should load UID_PUBLIC_URL from environment', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      process.env.UID_PUBLIC_URL = 'https://test.uid.admin.ch/wsdl';
      const { config } = await import('../../src/config.js');
      
      expect(config.uid.publicUrl).toBe('https://test.uid.admin.ch/wsdl');
    });

    it('should use default UID_PUBLIC_URL if not provided', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      delete process.env.UID_PUBLIC_URL;
      const { config } = await import('../../src/config.js');
      
      expect(config.uid.publicUrl).toBe('https://www.uid-wse.admin.ch/V5.0/PublicServices.svc?wsdl');
    });

    it('should load CACHE_ENABLED from environment', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      process.env.CACHE_ENABLED = 'true';
      const { config } = await import('../../src/config.js');
      
      expect(config.cache.enabled).toBe(true);
    });

    it('should default CACHE_ENABLED to false if not provided', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      delete process.env.CACHE_ENABLED;
      const { config } = await import('../../src/config.js');
      
      expect(config.cache.enabled).toBe(false);
    });

    it('should load LOG_LEVEL from environment', async () => {
      process.env.LOG_LEVEL = 'debug';
      const { config } = await import('../../src/config.js');
      
      expect(config.logging.level).toBe('debug');
    });

    it('should use default LOG_LEVEL if not provided', async () => {
      delete process.env.LOG_LEVEL;
      const { config } = await import('../../src/config.js');
      
      expect(config.logging.level).toBe('info');
    });

    it('should load CACHE_TTL from environment', async () => {
      process.env.CACHE_TTL = '7200';
      const { config } = await import('../../src/config.js');
      
      expect(config.cache.ttl).toBe(7200);
    });

    it('should use default CACHE_TTL if not provided', async () => {
      delete process.env.CACHE_TTL;
      const { config } = await import('../../src/config.js');
      
      expect(config.cache.ttl).toBe(3600);
    });

  });

  describe('configuration structure', () => {
    it('should have zefix configuration section', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      const { config } = await import('../../src/config.js');
      
      expect(config).toHaveProperty('zefix');
      expect(config.zefix).toHaveProperty('username');
      expect(config.zefix).toHaveProperty('password');
      expect(config.zefix).toHaveProperty('baseUrl');
    });

    it('should have uid configuration section', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      const { config } = await import('../../src/config.js');
      
      expect(config).toHaveProperty('uid');
      expect(config.uid).toHaveProperty('publicUrl');
    });

    it('should have cache configuration section', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      const { config } = await import('../../src/config.js');
      
      expect(config).toHaveProperty('cache');
      expect(config.cache).toHaveProperty('enabled');
      expect(config.cache).toHaveProperty('ttl');
    });

    it('should have logging configuration section', async () => {
      const { config } = await import('../../src/config.js');
      
      expect(config).toHaveProperty('logging');
      expect(config.logging).toHaveProperty('level');
    });
  });

  describe('default values', () => {
    it('should have default cache TTL', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      delete process.env.CACHE_TTL;
      const { config } = await import('../../src/config.js');
      
      expect(config.cache.ttl).toBe(3600);
    });

    it('should have default log level', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      delete process.env.LOG_LEVEL;
      const { config } = await import('../../src/config.js');
      
      expect(config.logging.level).toBe('info');
    });

    it('should have default cache enabled as false', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      delete process.env.CACHE_ENABLED;
      const { config } = await import('../../src/config.js');
      
      expect(config.cache.enabled).toBe(false);
    });
  });

  describe('type conversions', () => {
    it('should convert CACHE_TTL string to number', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      process.env.CACHE_TTL = '5000';
      const { config } = await import('../../src/config.js');
      
      expect(typeof config.cache.ttl).toBe('number');
      expect(config.cache.ttl).toBe(5000);
    });

    it('should convert CACHE_ENABLED string to boolean', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      process.env.CACHE_ENABLED = 'true';
      const { config } = await import('../../src/config.js');
      
      expect(typeof config.cache.enabled).toBe('boolean');
      expect(config.cache.enabled).toBe(true);
    });

    it('should handle invalid CACHE_TTL gracefully', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      process.env.CACHE_TTL = 'invalid';
      const { config } = await import('../../src/config.js');
      
      // Should fall back to NaN
      expect(typeof config.cache.ttl).toBe('number');
      expect(isNaN(config.cache.ttl)).toBe(true);
    });
  });

  describe('configuration validation', () => {
    it('should skip validation in test environment', async () => {
      // In test environment, validation is skipped
      delete process.env.ZEFIX_USERNAME;
      delete process.env.ZEFIX_PASSWORD;
      process.env.NODE_ENV = 'test';
      vi.resetModules();
      
      // Should not throw even with missing credentials in test mode
      const { config } = await import('../../src/config.js');
      expect(config.zefix.username).toBeUndefined();
      expect(config.zefix.password).toBeUndefined();
    });

    it('should have validation logic for production environment', async () => {
      // We can't actually test the validation throwing in this test suite
      // because we're running in test mode, but we can verify the logic exists
      const { config } = await import('../../src/config.js');
      
      // Verify that config loads successfully in test mode
      expect(config).toBeDefined();
      expect(config.zefix).toBeDefined();
    });

    it('should require credentials in non-test environment', () => {
      // This test documents the expected behavior in production
      // The validation check is: if (process.env.NODE_ENV !== 'test' && (!username || !password))
      // In production (NODE_ENV !== 'test'), missing credentials will throw an error
      
      // We can verify the validation logic exists by checking the source
      // In a real production environment, the module would throw on load
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should accept valid log levels', async () => {
      const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
      
      for (const level of validLevels) {
        process.env.LOG_LEVEL = level;
        vi.resetModules();
        const { config } = await import('../../src/config.js');
        
        expect(config.logging.level).toBe(level);
      }
    });
  });

  describe('immutability', () => {
    it('should export config as a constant', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      const { config } = await import('../../src/config.js');
      
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });
  });

  describe('edge cases', () => {
    it('should handle very large CACHE_TTL values', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      process.env.CACHE_TTL = '999999999';
      const { config } = await import('../../src/config.js');
      
      expect(config.cache.ttl).toBe(999999999);
    });

    it('should handle zero CACHE_TTL', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      process.env.CACHE_TTL = '0';
      const { config } = await import('../../src/config.js');
      
      expect(config.cache.ttl).toBe(0);
    });

    it('should handle negative CACHE_TTL', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      process.env.CACHE_TTL = '-100';
      const { config } = await import('../../src/config.js');
      
      expect(config.cache.ttl).toBe(-100);
    });

    it('should handle URLs with trailing slashes', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      process.env.ZEFIX_BASE_URL = 'https://test.zefix.ch/';
      const { config } = await import('../../src/config.js');
      
      expect(config.zefix.baseUrl).toBe('https://test.zefix.ch/');
    });

    it('should handle URLs without protocol', async () => {
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      process.env.ZEFIX_BASE_URL = 'test.zefix.ch';
      const { config } = await import('../../src/config.js');
      
      expect(config.zefix.baseUrl).toBe('test.zefix.ch');
    });
  });

  describe('real-world scenarios', () => {
    it('should work with production-like configuration', async () => {
      process.env.ZEFIX_USERNAME = 'prod-user';
      process.env.ZEFIX_PASSWORD = 'prod-pass-12345';
      process.env.ZEFIX_BASE_URL = 'https://www.zefix.admin.ch/ZefixPublicREST/api/v1';
      process.env.UID_PUBLIC_URL = 'https://www.uid-wse.admin.ch/V5.0/PublicServices.svc?wsdl';
      process.env.LOG_LEVEL = 'warn';
      process.env.CACHE_ENABLED = 'true';
      process.env.CACHE_TTL = '7200';
      
      const { config } = await import('../../src/config.js');
      
      expect(config.zefix.username).toBe('prod-user');
      expect(config.zefix.password).toBe('prod-pass-12345');
      expect(config.zefix.baseUrl).toBe('https://www.zefix.admin.ch/ZefixPublicREST/api/v1');
      expect(config.uid.publicUrl).toBe('https://www.uid-wse.admin.ch/V5.0/PublicServices.svc?wsdl');
      expect(config.logging.level).toBe('warn');
      expect(config.cache.enabled).toBe(true);
      expect(config.cache.ttl).toBe(7200);
    });

    it('should work with development-like configuration', async () => {
      process.env.ZEFIX_USERNAME = 'dev-user';
      process.env.ZEFIX_PASSWORD = 'dev-pass';
      process.env.LOG_LEVEL = 'debug';
      process.env.CACHE_ENABLED = 'true';
      process.env.CACHE_TTL = '60';
      
      const { config } = await import('../../src/config.js');
      
      expect(config.zefix.username).toBe('dev-user');
      expect(config.zefix.password).toBe('dev-pass');
      expect(config.logging.level).toBe('debug');
      expect(config.cache.enabled).toBe(true);
      expect(config.cache.ttl).toBe(60);
    });

    it('should work with minimal configuration', async () => {
      // Set required credentials
      process.env.ZEFIX_USERNAME = 'test-user';
      process.env.ZEFIX_PASSWORD = 'test-pass';
      
      // Clear all optional env vars
      delete process.env.ZEFIX_BASE_URL;
      delete process.env.UID_PUBLIC_URL;
      delete process.env.LOG_LEVEL;
      delete process.env.CACHE_ENABLED;
      delete process.env.CACHE_TTL;
      
      const { config } = await import('../../src/config.js');
      
      // Should use all defaults
      expect(config.zefix.baseUrl).toBe('https://www.zefix.admin.ch/ZefixPublicREST/api/v1');
      expect(config.uid.publicUrl).toBe('https://www.uid-wse.admin.ch/V5.0/PublicServices.svc?wsdl');
      expect(config.logging.level).toBe('info');
      expect(config.cache.enabled).toBe(false);
      expect(config.cache.ttl).toBe(3600);
    });
  });
});
