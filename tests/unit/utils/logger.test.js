/**
 * @fileoverview Unit tests for logger utility.
 * Tests Pino logger configuration and functionality.
 */

import { describe, it, expect, vi } from 'vitest';

// Create mock logger instance
const mockLogger = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(),
};

// Make child return a new mock logger with same methods
mockLogger.child.mockReturnValue({ ...mockLogger });

// Mock pino before importing logger
// The logger writes to STDERR via pino.destination(2)
vi.mock('pino', () => ({
  default: Object.assign(
    vi.fn(() => mockLogger),
    { destination: vi.fn(() => ({})) }
  ),
}));

// Import logger after mocking
const { logger } = await import('../../../src/utils/logger.js');

describe('logger', () => {

  describe('initialization', () => {
    it('should have all required log level methods', () => {
      expect(logger).toHaveProperty('trace');
      expect(logger).toHaveProperty('debug');
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('fatal');
      expect(logger).toHaveProperty('child');
    });
  });

  describe('log levels', () => {
    it('should have trace method', () => {
      expect(logger.trace).toBeDefined();
      expect(typeof logger.trace).toBe('function');
    });

    it('should have debug method', () => {
      expect(logger.debug).toBeDefined();
      expect(typeof logger.debug).toBe('function');
    });

    it('should have info method', () => {
      expect(logger.info).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('should have warn method', () => {
      expect(logger.warn).toBeDefined();
      expect(typeof logger.warn).toBe('function');
    });

    it('should have error method', () => {
      expect(logger.error).toBeDefined();
      expect(typeof logger.error).toBe('function');
    });

    it('should have fatal method', () => {
      expect(logger.fatal).toBeDefined();
      expect(typeof logger.fatal).toBe('function');
    });
  });

  describe('logging functionality', () => {
    it('should log info messages', () => {
      logger.info('Test info message');
      expect(mockLogger.info).toHaveBeenCalledWith('Test info message');
    });

    it('should log info messages with context', () => {
      const context = { userId: '123', action: 'login' };
      logger.info(context, 'User logged in');
      expect(mockLogger.info).toHaveBeenCalledWith(context, 'User logged in');
    });

    it('should log error messages', () => {
      logger.error('Test error message');
      expect(mockLogger.error).toHaveBeenCalledWith('Test error message');
    });

    it('should log error objects', () => {
      const error = new Error('Test error');
      logger.error({ err: error }, 'An error occurred');
      expect(mockLogger.error).toHaveBeenCalledWith({ err: error }, 'An error occurred');
    });

    it('should log warn messages', () => {
      logger.warn('Test warning message');
      expect(mockLogger.warn).toHaveBeenCalledWith('Test warning message');
    });

    it('should log debug messages', () => {
      logger.debug('Test debug message');
      expect(mockLogger.debug).toHaveBeenCalledWith('Test debug message');
    });

    it('should log trace messages', () => {
      logger.trace('Test trace message');
      expect(mockLogger.trace).toHaveBeenCalledWith('Test trace message');
    });

    it('should log fatal messages', () => {
      logger.fatal('Test fatal message');
      expect(mockLogger.fatal).toHaveBeenCalledWith('Test fatal message');
    });
  });

  describe('structured logging', () => {
    it('should support logging with multiple fields', () => {
      const logData = {
        uid: 'CHE-123.456.789',
        operation: 'search',
        duration: 150,
        success: true,
      };
      logger.info(logData, 'Company search completed');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        logData,
        'Company search completed'
      );
    });

    it('should handle nested objects', () => {
      const logData = {
        request: {
          method: 'GET',
          url: '/api/company',
          params: { uid: 'CHE-123.456.789' },
        },
        response: {
          status: 200,
          duration: 120,
        },
      };
      logger.info(logData, 'API request completed');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        logData,
        'API request completed'
      );
    });

    it('should handle arrays in log data', () => {
      const logData = {
        results: ['result1', 'result2', 'result3'],
        count: 3,
      };
      logger.info(logData, 'Search results');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        logData,
        'Search results'
      );
    });
  });

  describe('child logger', () => {
    it('should support creating child loggers', () => {
      expect(logger.child).toBeDefined();
      expect(typeof logger.child).toBe('function');
    });

    it('should create child logger with context', () => {
      const childContext = { module: 'zefix-client' };
      const childLogger = logger.child(childContext);
      
      expect(mockLogger.child).toHaveBeenCalledWith(childContext);
      expect(childLogger).toBeDefined();
    });

    it('should allow child logger to log messages', () => {
      const childLogger = logger.child({ module: 'test' });
      childLogger.info('Child logger message');
      
      expect(childLogger.info).toHaveBeenCalledWith('Child logger message');
    });
  });

  describe('error handling', () => {
    it('should handle Error objects correctly', () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      error.statusCode = 500;
      
      logger.error({ err: error }, 'Error occurred');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: error },
        'Error occurred'
      );
    });

    it('should handle errors with additional context', () => {
      const error = new Error('API request failed');
      const context = {
        err: error,
        url: 'https://api.example.com',
        method: 'GET',
        statusCode: 500,
      };
      
      logger.error(context, 'API request failed');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        context,
        'API request failed'
      );
    });

    it('should handle null values', () => {
      logger.info({ value: null }, 'Null value test');
      expect(mockLogger.info).toHaveBeenCalledWith(
        { value: null },
        'Null value test'
      );
    });

    it('should handle undefined values', () => {
      logger.info({ value: undefined }, 'Undefined value test');
      expect(mockLogger.info).toHaveBeenCalledWith(
        { value: undefined },
        'Undefined value test'
      );
    });
  });

  describe('common use cases', () => {
    it('should log API requests', () => {
      const requestData = {
        method: 'GET',
        url: '/api/v1/company/CHE-123.456.789',
        headers: { 'user-agent': 'test' },
      };
      
      logger.info(requestData, 'Incoming API request');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should log API responses', () => {
      const responseData = {
        statusCode: 200,
        duration: 150,
        path: '/api/v1/company/CHE-123.456.789',
      };
      
      logger.info(responseData, 'API response sent');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should log cache operations', () => {
      const cacheData = {
        key: 'company:CHE-123.456.789',
        ttl: 3600,
        hit: true,
      };
      
      logger.debug(cacheData, 'Cache hit');
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should log external API calls', () => {
      const apiCallData = {
        service: 'zefix',
        endpoint: '/search',
        duration: 250,
        success: true,
      };
      
      logger.info(apiCallData, 'External API call completed');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should log validation errors', () => {
      const validationData = {
        field: 'uid',
        value: 'invalid-uid',
        error: 'Invalid UID format',
      };
      
      logger.warn(validationData, 'Validation failed');
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('performance', () => {
    it('should handle high-frequency logging', () => {
      // Clear previous calls
      mockLogger.info.mockClear();
      
      for (let i = 0; i < 100; i++) {
        logger.info({ iteration: i }, `Log message ${i}`);
      }
      
      expect(mockLogger.info).toHaveBeenCalledTimes(100);
    });

    it('should handle large log objects', () => {
      const largeObject = {
        data: Array(1000).fill({ id: 1, name: 'Item', value: 'x'.repeat(100) }),
      };
      
      logger.info(largeObject, 'Large object logged');
      expect(mockLogger.info).toHaveBeenCalledWith(
        largeObject,
        'Large object logged'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty string messages', () => {
      logger.info('');
      expect(mockLogger.info).toHaveBeenCalledWith('');
    });

    it('should handle messages with special characters', () => {
      const message = 'Test with special chars: @#$%^&*()';
      logger.info(message);
      expect(mockLogger.info).toHaveBeenCalledWith(message);
    });

    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(10000);
      logger.info(longMessage);
      expect(mockLogger.info).toHaveBeenCalledWith(longMessage);
    });

    it('should handle circular references gracefully', () => {
      const obj = { name: 'test' };
      obj.self = obj; // Create circular reference
      
      // Pino should handle this internally
      expect(() => {
        logger.info({ data: obj }, 'Circular reference test');
      }).not.toThrow();
    });
  });
});
