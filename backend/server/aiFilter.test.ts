/**
 * Unit tests for ultimate fallback handling in aiFilter.ts
 *
 * Tests that when both AI service and FallbackEngine fail,
 * the system returns alerts with minimal processing:
 * unverified, OTHER category, MEDIUM severity.
 *
 * Validates: Requirement 8.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RawAlert } from './aiFilter.js';

// Mock healthMonitor before importing aiFilter
vi.mock('./healthMonitor.js', () => ({
  healthMonitor: {
    isAvailable: vi.fn().mockReturnValue(false),
    getStatus: vi.fn().mockReturnValue({ available: false, lastCheck: new Date(), consecutiveFailures: 5 }),
    checkNow: vi.fn().mockResolvedValue(false),
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

// Mock supabaseClient to avoid real DB connections
vi.mock('./supabaseClient.js', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  },
}));

// Mock FallbackEngine to simulate failure
vi.mock('./fallbackEngine.js', () => {
  class MockFallbackEngine {
    processAlert() {
      throw new Error('FallbackEngine failure');
    }
  }
  return { FallbackEngine: MockFallbackEngine };
});

// Mock OpenAI - no API key available
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => null),
}));

describe('Ultimate Fallback Handling', () => {
  const sampleAlert: RawAlert = {
    title: 'Test Alert',
    description: 'A test alert description',
    source: 'TestSource',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return unverified status when both AI and FallbackEngine fail', async () => {
    const { filterAlert } = await import('./aiFilter.js');
    const result = await filterAlert(sampleAlert);
    expect(result.verified).toBe(false);
  });

  it('should return OTHER category when both AI and FallbackEngine fail', async () => {
    const { filterAlert } = await import('./aiFilter.js');
    const result = await filterAlert(sampleAlert);
    expect(result.category).toBe('OTHER');
  });

  it('should return MEDIUM severity when both AI and FallbackEngine fail', async () => {
    const { filterAlert } = await import('./aiFilter.js');
    const result = await filterAlert(sampleAlert);
    expect(result.severity).toBe('MEDIUM');
  });

  it('should return processedBy fallback when both AI and FallbackEngine fail', async () => {
    const { filterAlert } = await import('./aiFilter.js');
    const result = await filterAlert(sampleAlert);
    expect(result.processedBy).toBe('fallback');
  });

  it('should return null aiConfidence when both AI and FallbackEngine fail', async () => {
    const { filterAlert } = await import('./aiFilter.js');
    const result = await filterAlert(sampleAlert);
    expect(result.aiConfidence).toBeNull();
  });

  it('should preserve original alert fields in ultimate fallback', async () => {
    const { filterAlert } = await import('./aiFilter.js');
    const result = await filterAlert(sampleAlert);
    expect(result.title).toBe(sampleAlert.title);
    expect(result.description).toBe(sampleAlert.description);
    expect(result.source).toBe(sampleAlert.source);
  });

  it('should include safety steps in ultimate fallback', async () => {
    const { filterAlert } = await import('./aiFilter.js');
    const result = await filterAlert(sampleAlert);
    expect(result.actionStep).toBeDefined();
    expect(typeof result.actionStep).toBe('string');
    expect(result.steps).toBeDefined();
    expect(Array.isArray(result.steps)).toBe(true);
    expect(result.steps!.length).toBeGreaterThanOrEqual(3);
  });
});

describe('createUltimateFallback', () => {
  it('should return correct minimal processing fields', async () => {
    const { createUltimateFallback } = await import('./aiFilter.js');
    const alert: RawAlert = {
      title: 'Emergency Alert',
      description: 'Something happened',
      source: 'CISA',
    };
    const result = createUltimateFallback(alert);

    expect(result.verified).toBe(false);
    expect(result.category).toBe('OTHER');
    expect(result.severity).toBe('MEDIUM');
    expect(result.aiConfidence).toBeNull();
    expect(result.processedBy).toBe('fallback');
    expect(result.title).toBe('Emergency Alert');
    expect(result.source).toBe('CISA');
  });
});
