/**
 * Bug Condition Exploration Test - Semantic Duplicates Not Detected
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 * 
 * This test demonstrates the bug where semantically similar alerts are NOT deduplicated.
 * The bug condition is:
 * - Same event type (e.g., "Avalanche")
 * - Overlapping geographic regions (within 150km)
 * - Time proximity (within 24 hours)
 * - Different exact text (different content hashes)
 * 
 * EXPECTED OUTCOME: Test FAILS on unfixed code (both alerts inserted instead of deduplicated)
 * This failure CONFIRMS the bug exists.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { upsertAlert, NormalizedAlert } from './normalize.js';

// Mock the supabase client
vi.mock('./supabaseClient.js', () => {
  // In-memory store for testing
  const incidents: Map<string, { 
    id: string; 
    content_hash: string; 
    title: string; 
    description: string; 
    source: string; 
    created_at: string;
    location_lat: number | null;
    location_lng: number | null;
  }> = new Map();
  
  return {
    supabase: {
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: string) => {
            // Return chainable object that supports both .limit() and .gte()
            const chainable = {
              limit: (n: number) => {
                // Find by content_hash
                const found = Array.from(incidents.values()).filter(i => i.content_hash === value);
                return Promise.resolve({ data: found.length > 0 ? found : null, error: null });
              },
              gte: (col: string, val: string) => ({
                limit: (n: number) => {
                  // Find by source and filter by created_at
                  const found = Array.from(incidents.values()).filter(i => 
                    i.source === value && i.created_at >= val
                  );
                  return Promise.resolve({ data: found.length > 0 ? found : [], error: null });
                }
              })
            };
            return chainable;
          }
        }),
        insert: (data: any) => {
          incidents.set(data.id, { 
            id: data.id, 
            content_hash: data.content_hash,
            title: data.title || '',
            description: data.description || '',
            source: data.source || '',
            created_at: new Date().toISOString(),
            location_lat: data.location_lat || null,
            location_lng: data.location_lng || null
          });
          return Promise.resolve({ error: null });
        }
      }),
      // Expose for test cleanup
      __incidents: incidents,
      __clear: () => incidents.clear()
    }
  };
});

// Import the mock to access cleanup
import { supabase } from './supabaseClient.js';

// Helper to calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Event types for weather alerts
const EVENT_TYPES = [
  'Avalanche',
  'Flood Warning',
  'Winter Storm',
  'Tornado Watch',
  'Hurricane Warning',
  'Severe Thunderstorm'
];

// Geographic regions with coordinates (lat, lng)
// All region pairs are within 150km of each other (the OVERLAP_THRESHOLD from design)
const REGIONS = {
  // Idaho regions (within 150km)
  idahoPanhandle: { lat: 47.6, lng: -116.8, name: 'Idaho Panhandle' },
  northIdaho: { lat: 47.0, lng: -116.5, name: 'north Idaho' }, // ~70km from Panhandle
  coeurDAlene: { lat: 47.7, lng: -116.8, name: 'Coeur d\'Alene area' }, // ~11km from Panhandle
  
  // Illinois counties (adjacent, within 150km)
  cookCountyIL: { lat: 41.8, lng: -87.7, name: 'Cook County, IL' },
  dupageCountyIL: { lat: 41.8, lng: -88.1, name: 'DuPage County, IL' }, // ~30km from Cook
  lakeCountyIL: { lat: 42.3, lng: -87.9, name: 'Lake County, IL' }, // ~58km from Cook
  
  // California mountains (within 150km)
  sierraNevada: { lat: 38.5, lng: -120.0, name: 'Sierra Nevada region' },
  tahoeArea: { lat: 39.1, lng: -120.0, name: 'Lake Tahoe area' }, // ~67km from Sierra
  yosemiteArea: { lat: 37.9, lng: -119.5, name: 'Yosemite area' } // ~80km from Sierra
};

// Generator for semantically similar alert pairs (bug condition)
const semanticallySimilarAlertPairArb = fc.record({
  eventType: fc.constantFrom(...EVENT_TYPES),
  regionPair: fc.constantFrom(
    // Idaho overlapping regions (within 150km)
    [REGIONS.idahoPanhandle, REGIONS.northIdaho],
    [REGIONS.idahoPanhandle, REGIONS.coeurDAlene],
    // Illinois adjacent counties (within 150km)
    [REGIONS.cookCountyIL, REGIONS.dupageCountyIL],
    [REGIONS.cookCountyIL, REGIONS.lakeCountyIL],
    // California overlapping regions (within 150km)
    [REGIONS.sierraNevada, REGIONS.tahoeArea],
    [REGIONS.sierraNevada, REGIONS.yosemiteArea]
  ),
  titleVariation: fc.constantFrom(
    ['watch issued for', 'Advisory issued for'],
    ['Warning for', 'Alert for'],
    ['expected in', 'forecast for']
  ),
  descriptionSuffix: fc.string({ minLength: 10, maxLength: 50 }),
  hourOffset: fc.integer({ min: 0, max: 23 }) // Within 24 hours
}).map(({ eventType, regionPair, titleVariation, descriptionSuffix, hourOffset }) => {
  const [region1, region2] = regionPair;
  const variation1 = titleVariation[0];
  const variation2 = titleVariation[1];
  const baseTime = new Date('2024-01-15T12:00:00Z');
  
  const alert1: NormalizedAlert = {
    title: `${eventType} ${variation1} ${region1.name} due to weather conditions`,
    description: `A ${eventType.toLowerCase()} has been issued for the ${region1.name} area. ${descriptionSuffix}`,
    category: 'WEATHER',
    severity: 'HIGH',
    source: 'NWS',
    // No sourceUrl - forces hash to use title+description (different for each alert)
    locationLat: region1.lat,
    locationLng: region1.lng,
    verified: true,
    expiresAt: new Date(baseTime.getTime() + 48 * 60 * 60 * 1000).toISOString()
  };
  
  const alert2: NormalizedAlert = {
    title: `${eventType} ${variation2} ${region2.name} conditions expected`,
    description: `${eventType} conditions are expected in the ${region2.name}. Take precautions. ${descriptionSuffix}`,
    category: 'WEATHER',
    severity: 'HIGH',
    source: 'NWS',
    // No sourceUrl - forces hash to use title+description (different for each alert)
    locationLat: region2.lat,
    locationLng: region2.lng,
    verified: true,
    expiresAt: new Date(baseTime.getTime() + hourOffset * 60 * 60 * 1000 + 48 * 60 * 60 * 1000).toISOString()
  };
  
  return { alert1, alert2, eventType, region1, region2 };
});

describe('Bug Condition Exploration: Semantic Duplicates Not Detected', () => {
  beforeEach(() => {
    // Clear the in-memory store before each test
    (supabase as any).__clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 1: Fault Condition - Semantic Duplicates Not Detected
   * 
   * **Validates: Requirements 1.1, 1.2, 1.3**
   * 
   * This property test verifies that the EXPECTED behavior is:
   * - When two alerts have the same event type, overlapping regions, and time proximity
   * - The second alert should NOT be inserted (deduplicated)
   * 
   * On UNFIXED code, this test will FAIL because both alerts are inserted.
   * The failure confirms the bug exists.
   */
  it('should deduplicate semantically similar alerts (EXPECTED TO FAIL ON UNFIXED CODE)', async () => {
    await fc.assert(
      fc.asyncProperty(semanticallySimilarAlertPairArb, async ({ alert1, alert2, eventType, region1, region2 }) => {
        // Clear store for this iteration
        (supabase as any).__clear();
        
        // Verify bug condition holds: same event type, overlapping geography (within 150km), time proximity
        const distance = calculateDistance(region1.lat, region1.lng, region2.lat, region2.lng);
        expect(distance).toBeLessThan(150); // Regions are within OVERLAP_THRESHOLD (150km)
        
        // Both alerts have the same event type in their titles
        expect(alert1.title.toLowerCase()).toContain(eventType.toLowerCase());
        expect(alert2.title.toLowerCase()).toContain(eventType.toLowerCase());
        
        // Insert first alert
        const result1 = await upsertAlert(alert1);
        expect(result1.inserted).toBe(true);
        
        // Insert second alert - EXPECTED BEHAVIOR: should be deduplicated (inserted = false)
        const result2 = await upsertAlert(alert2);
        
        // This assertion encodes the EXPECTED behavior:
        // Semantically similar alerts should be deduplicated
        // On UNFIXED code, this will FAIL because result2.inserted will be true
        expect(result2.inserted).toBe(false);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Concrete test case 1: Two avalanche alerts for Idaho regions (within 150km)
   * 
   * **Validates: Requirements 1.1, 1.2**
   */
  it('should deduplicate avalanche alerts for Idaho regions (EXPECTED TO FAIL ON UNFIXED CODE)', async () => {
    const alert1: NormalizedAlert = {
      title: 'Avalanche watch issued for Idaho Panhandle due to heavy rain',
      description: 'An avalanche watch has been issued for the Idaho Panhandle region. Heavy rain and warm temperatures are expected to destabilize snowpack.',
      category: 'WEATHER',
      severity: 'HIGH',
      source: 'NWS',
      // No sourceUrl - forces hash to use title+description
      locationLat: 47.6,  // Idaho Panhandle
      locationLng: -116.8,
      verified: true
    };

    const alert2: NormalizedAlert = {
      title: 'Avalanche Advisory issued for north Idaho mountains',
      description: 'Avalanche conditions are expected in north Idaho. Backcountry travelers should exercise extreme caution.',
      category: 'WEATHER',
      severity: 'HIGH',
      source: 'NWS',
      // No sourceUrl - forces hash to use title+description
      locationLat: 47.0,  // North Idaho (~70km from Panhandle)
      locationLng: -116.5,
      verified: true
    };

    const result1 = await upsertAlert(alert1);
    expect(result1.inserted).toBe(true);

    const result2 = await upsertAlert(alert2);
    // EXPECTED: Second alert should be deduplicated (inserted = false)
    // ACTUAL on unfixed code: Both alerts inserted (inserted = true) - BUG!
    expect(result2.inserted).toBe(false);
  });

  /**
   * Concrete test case 2: Two flood warnings for adjacent IL counties
   * 
   * **Validates: Requirements 1.1, 1.2**
   */
  it('should deduplicate flood warnings for adjacent IL counties (EXPECTED TO FAIL ON UNFIXED CODE)', async () => {
    const alert1: NormalizedAlert = {
      title: 'Flood Warning for Cook County, IL',
      description: 'A flood warning has been issued for Cook County, Illinois. Heavy rainfall is expected to cause flooding in low-lying areas.',
      category: 'WEATHER',
      severity: 'HIGH',
      source: 'NWS',
      // No sourceUrl - forces hash to use title+description
      locationLat: 41.8,
      locationLng: -87.7,
      verified: true
    };

    const alert2: NormalizedAlert = {
      title: 'Flood Warning for DuPage County, IL',
      description: 'Flood conditions expected in DuPage County, Illinois. Residents near rivers and streams should prepare for potential flooding.',
      category: 'WEATHER',
      severity: 'HIGH',
      source: 'NWS',
      // No sourceUrl - forces hash to use title+description
      locationLat: 41.8,
      locationLng: -88.1,
      verified: true
    };

    const result1 = await upsertAlert(alert1);
    expect(result1.inserted).toBe(true);

    const result2 = await upsertAlert(alert2);
    // EXPECTED: Second alert should be deduplicated (inserted = false)
    // ACTUAL on unfixed code: Both alerts inserted (inserted = true) - BUG!
    expect(result2.inserted).toBe(false);
  });

  /**
   * Concrete test case 3: Two winter storm warnings for California mountains
   * 
   * **Validates: Requirements 1.1, 1.2**
   */
  it('should deduplicate winter storm warnings for California mountains (EXPECTED TO FAIL ON UNFIXED CODE)', async () => {
    const alert1: NormalizedAlert = {
      title: 'Winter Storm Warning for Northern California mountains',
      description: 'A winter storm warning is in effect for the Northern California mountains. Heavy snow and strong winds expected above 5000 feet.',
      category: 'WEATHER',
      severity: 'HIGH',
      source: 'NWS',
      sourceUrl: 'https://alerts.weather.gov',
      locationLat: 39.5,
      locationLng: -121.5,
      verified: true
    };

    const alert2: NormalizedAlert = {
      title: 'Winter Storm Warning for Sierra Nevada region',
      description: 'Winter storm conditions expected in the Sierra Nevada. Travel is strongly discouraged. Chain controls in effect.',
      category: 'WEATHER',
      severity: 'HIGH',
      source: 'NWS',
      sourceUrl: 'https://alerts.weather.gov',
      locationLat: 38.5,
      locationLng: -120.0,
      verified: true
    };

    const result1 = await upsertAlert(alert1);
    expect(result1.inserted).toBe(true);

    const result2 = await upsertAlert(alert2);
    // EXPECTED: Second alert should be deduplicated (inserted = false)
    // ACTUAL on unfixed code: Both alerts inserted (inserted = true) - BUG!
    expect(result2.inserted).toBe(false);
  });
});
