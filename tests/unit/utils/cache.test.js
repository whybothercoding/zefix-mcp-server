/**
 * @fileoverview Unit tests for cache utility.
 * Tests in-memory caching with TTL support.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { cache } from '../../../src/utils/cache.js';

describe('cache', () => {
  beforeEach(() => {
    // Clear cache before each test
    cache.clear();
    // Reset enabled state
    cache.enabled = true;
  });

  afterEach(() => {
    // Restore timers
    vi.useRealTimers();
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('test-key', 'test-value');
      const result = cache.get('test-key');
      expect(result).toBe('test-value');
    });

    it('should store complex objects', () => {
      const complexData = {
        uid: 'CHE-123.456.789',
        name: 'Test Company',
        nested: {
          field: 'value',
        },
      };
      cache.set('complex-key', complexData);
      const result = cache.get('complex-key');
      expect(result).toEqual(complexData);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should handle null values', () => {
      cache.set('null-key', null);
      const result = cache.get('null-key');
      expect(result).toBeNull();
    });

    it('should handle undefined values', () => {
      cache.set('undefined-key', undefined);
      const result = cache.get('undefined-key');
      expect(result).toBeUndefined();
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after default TTL', () => {
      vi.useFakeTimers();
      
      cache.set('expiring-key', 'expiring-value');
      
      // Should exist immediately
      expect(cache.get('expiring-key')).toBe('expiring-value');
      
      // Fast-forward time by default TTL + 1ms (3600 seconds = 3600000ms)
      vi.advanceTimersByTime(3600001);
      
      // Should be expired
      expect(cache.get('expiring-key')).toBeNull();
    });

    it('should respect custom TTL', () => {
      vi.useFakeTimers();
      
      // Set with 60 second TTL
      cache.set('custom-ttl-key', 'custom-value', 60);
      
      // Should exist immediately
      expect(cache.get('custom-ttl-key')).toBe('custom-value');
      
      // Fast-forward 59 seconds - should still exist
      vi.advanceTimersByTime(59000);
      expect(cache.get('custom-ttl-key')).toBe('custom-value');
      
      // Fast-forward 2 more seconds - should be expired
      vi.advanceTimersByTime(2000);
      expect(cache.get('custom-ttl-key')).toBeNull();
    });

    it('should not expire before TTL', () => {
      vi.useFakeTimers();
      
      cache.set('not-expired-key', 'not-expired-value');
      
      // Fast-forward time by less than TTL (4 minutes)
      vi.advanceTimersByTime(240000);
      
      // Should still exist
      expect(cache.get('not-expired-key')).toBe('not-expired-value');
    });
  });

  describe('delete', () => {
    it('should delete specific entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.delete('key1');
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should handle deleting non-existent keys', () => {
      expect(() => cache.delete('non-existent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });

    it('should allow setting new values after clear', () => {
      cache.set('old-key', 'old-value');
      cache.clear();
      cache.set('new-key', 'new-value');
      
      expect(cache.get('old-key')).toBeNull();
      expect(cache.get('new-key')).toBe('new-value');
    });
  });

  describe('enabled/disabled state', () => {
    it('should not cache when disabled', () => {
      cache.enabled = false;
      
      cache.set('disabled-key', 'disabled-value');
      const result = cache.get('disabled-key');
      
      expect(result).toBeNull();
    });

    it('should return null for all gets when disabled', () => {
      cache.set('enabled-key', 'enabled-value');
      
      cache.enabled = false;
      const result = cache.get('enabled-key');
      
      expect(result).toBeNull();
    });

    it('should resume caching when re-enabled', () => {
      cache.enabled = false;
      cache.set('disabled-key', 'disabled-value');
      
      cache.enabled = true;
      cache.set('enabled-key', 'enabled-value');
      
      expect(cache.get('disabled-key')).toBeNull();
      expect(cache.get('enabled-key')).toBe('enabled-value');
    });
  });

  describe('cache key patterns', () => {
    it('should handle company UID keys', () => {
      const uid = 'CHE-123.456.789';
      cache.set(`company:${uid}`, { name: 'Test Company' });
      
      const result = cache.get(`company:${uid}`);
      expect(result).toEqual({ name: 'Test Company' });
    });

    it('should handle search result keys', () => {
      cache.set('search:test-query', ['result1', 'result2']);
      
      const result = cache.get('search:test-query');
      expect(result).toEqual(['result1', 'result2']);
    });

    it('should handle validation keys', () => {
      cache.set('validation:CHE-123.456.789', { valid: true });
      
      const result = cache.get('validation:CHE-123.456.789');
      expect(result).toEqual({ valid: true });
    });
  });

  describe('edge cases', () => {
    it('should handle empty string keys', () => {
      cache.set('', 'empty-key-value');
      expect(cache.get('')).toBe('empty-key-value');
    });

    it('should handle keys with special characters', () => {
      const specialKey = 'key:with/special-chars_123.456';
      cache.set(specialKey, 'special-value');
      expect(cache.get(specialKey)).toBe('special-value');
    });

    it('should handle very long keys', () => {
      const longKey = 'a'.repeat(1000);
      cache.set(longKey, 'long-key-value');
      expect(cache.get(longKey)).toBe('long-key-value');
    });

    it('should handle large data objects', () => {
      const largeData = {
        items: Array(1000).fill({ id: 1, name: 'Item', data: 'x'.repeat(100) }),
      };
      cache.set('large-data', largeData);
      expect(cache.get('large-data')).toEqual(largeData);
    });
  });

  describe('multiple entries', () => {
    it('should handle multiple entries independently', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });

    it('should expire entries independently', () => {
      vi.useFakeTimers();
      
      cache.set('short-ttl', 'value1', 30);
      cache.set('long-ttl', 'value2', 120);
      
      // Fast-forward 60 seconds
      vi.advanceTimersByTime(60000);
      
      expect(cache.get('short-ttl')).toBeNull();
      expect(cache.get('long-ttl')).toBe('value2');
    });
  });

  describe('overwriting entries', () => {
    it('should overwrite existing entries', () => {
      cache.set('overwrite-key', 'original-value');
      cache.set('overwrite-key', 'new-value');
      
      expect(cache.get('overwrite-key')).toBe('new-value');
    });

    it('should reset TTL when overwriting', () => {
      vi.useFakeTimers();
      
      cache.set('reset-ttl-key', 'original', 60);
      
      // Fast-forward 50 seconds
      vi.advanceTimersByTime(50000);
      
      // Overwrite with new TTL
      cache.set('reset-ttl-key', 'updated', 60);
      
      // Fast-forward another 50 seconds (100 total)
      vi.advanceTimersByTime(50000);
      
      // Should still exist because TTL was reset
      expect(cache.get('reset-ttl-key')).toBe('updated');
    });
  });
});
