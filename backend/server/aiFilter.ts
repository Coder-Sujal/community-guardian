/**
 * AI Filter - OpenAI API integration for alert verification, categorization, safety checklists, and location extraction
 * Falls back gracefully to rule-based FallbackEngine when API is unavailable
 */
import OpenAI from 'openai';
import { supabase } from './supabaseClient.js';
import { healthMonitor } from './healthMonitor.js';
import { FallbackEngine } from './fallbackEngine.js';
import type { ProcessedAlert } from './fallbackEngine.js';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const fallbackEngine = new FallbackEngine();

export interface RawAlert {
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  location?: { lat: number; lng: number };
}

export interface FilteredAlert extends RawAlert {
  verified: boolean;
  aiConfidence: number | null;
  category: 'CRIME' | 'WEATHER' | 'HEALTH' | 'SCAM' | 'CYBER' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  summary?: string;
  actionStep?: string;
  steps?: string[];
  extractedLocation?: { lat: number; lng: number; locationName?: string };
  processedBy: 'ai' | 'fallback';
}

/**
 * Map a FallbackEngine ProcessedAlert to a FilteredAlert
 */
function mapProcessedToFiltered(alert: RawAlert, processed: ProcessedAlert): FilteredAlert {
  return {
    ...alert,
    verified: false,
    aiConfidence: null,
    category: processed.category,
    severity: processed.severity,
    actionStep: processed.checklist.actionStep,
    steps: processed.checklist.steps,
    extractedLocation: alert.location ? undefined : processed.location
      ? { lat: processed.location.lat, lng: processed.location.lng, locationName: processed.location.locationName }
      : undefined,
    processedBy: 'fallback',
  };
}
/**
 * Create an ultimate fallback response when both AI and FallbackEngine fail.
 * Returns alerts with minimal processing: unverified, OTHER category, MEDIUM severity.
 */
function createUltimateFallback(alert: RawAlert): FilteredAlert {
  return {
    ...alert,
    verified: false,
    aiConfidence: null,
    category: 'OTHER',
    severity: 'MEDIUM',
    actionStep: 'Stay informed and follow guidance from local authorities.',
    steps: [
      'Monitor official news sources for updates',
      'Follow instructions from emergency services',
      'Share verified information with your community',
    ],
    processedBy: 'fallback',
  };
}

/**
 * Filter and categorize an alert using OpenAI, with automatic fallback
 * to the rule-based FallbackEngine when AI is unavailable.
 * If both AI and FallbackEngine fail, returns an ultimate fallback with
 * unverified status, OTHER category, and MEDIUM severity.
 */
export async function filterAlert(alert: RawAlert): Promise<FilteredAlert> {
  // Check if AI is available via HealthMonitor and API key
  if (!openai || !healthMonitor.isAvailable()) {
    try {
      const processed = fallbackEngine.processAlert(alert);
      return mapProcessedToFiltered(alert, processed);
    } catch (fallbackError) {
      console.error('FallbackEngine also failed, using ultimate fallback:', fallbackError);
      return createUltimateFallback(alert);
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: `You are a safety alert verifier and advisor. Analyze the alert and return JSON with:
- verified (boolean): whether this appears to be a legitimate safety alert
- confidence (0-1): your confidence level
- category (one of: CRIME, WEATHER, HEALTH, SCAM, CYBER, OTHER)
- severity (LOW, MEDIUM, or HIGH)
- summary (brief one-line summary, max 100 chars)
- actionStep (string): ONE immediate action the user should take right now (max 80 chars, imperative tone)
- steps (array of 3-4 strings): numbered safety checklist items the user should follow
- location (object or null): If the alert mentions a specific city, area, or region, extract it as:
  - locationName (string): the name of the place mentioned (e.g., "Bengaluru", "Mumbai", "New York")
  - lat (number): approximate latitude of that location
  - lng (number): approximate longitude of that location
  If no specific location is mentioned or it's a nationwide/global alert, set location to null.

The actionStep should be the most urgent thing to do immediately.
The steps should be practical, actionable safety measures specific to this type of threat.
For location, use your knowledge of geography to provide accurate coordinates for the mentioned place.
Only return valid JSON.`,
        },
        {
          role: 'user',
          content: `Verify this safety alert, provide safety guidance, and extract location if mentioned:\nTitle: ${alert.title}\nDescription: ${alert.description}\nSource: ${alert.source}`,
        },
      ],
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    // Build extracted location if AI found one and alert doesn't already have location
    let extractedLocation: FilteredAlert['extractedLocation'] = undefined;
    if (!alert.location && result.location && typeof result.location.lat === 'number' && typeof result.location.lng === 'number') {
      extractedLocation = {
        lat: result.location.lat,
        lng: result.location.lng,
        locationName: result.location.locationName,
      };
    }

    return {
      ...alert,
      verified: result.verified ?? true,
      aiConfidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
      category: validateCategory(result.category),
      severity: validateSeverity(result.severity),
      summary: result.summary,
      actionStep: result.actionStep || undefined,
      steps: Array.isArray(result.steps) ? result.steps : undefined,
      extractedLocation,
      processedBy: 'ai',
    };
  } catch (error) {
    console.error('AI filter failed, routing to FallbackEngine:', error);
    try {
      const processed = fallbackEngine.processAlert(alert);
      return mapProcessedToFiltered(alert, processed);
    } catch (fallbackError) {
      console.error('FallbackEngine also failed, using ultimate fallback:', fallbackError);
      return createUltimateFallback(alert);
    }
  }
}

/**
 * Update an existing alert with AI analysis including safety checklist and location
 */
export async function updateAlertWithAI(alertId: string): Promise<boolean> {
  const { data: alert, error: fetchError } = await supabase
    .from('incidents')
    .select('*')
    .eq('id', alertId)
    .single();

  if (fetchError || !alert) {
    console.error('Alert not found:', alertId);
    return false;
  }

  // Pass existing location if available
  const existingLocation = alert.location_lat && alert.location_lng
    ? { lat: alert.location_lat, lng: alert.location_lng }
    : undefined;

  const filtered = await filterAlert({
    title: alert.title,
    description: alert.description,
    source: alert.source,
    sourceUrl: alert.source_url,
    location: existingLocation,
  });

  // Prepare update object
  const updateData: Record<string, any> = {
    verified: filtered.verified,
    ai_confidence: filtered.aiConfidence,
    category: filtered.category,
    severity: filtered.severity,
    action_step: filtered.actionStep || null,
    steps: filtered.steps ? JSON.stringify(filtered.steps) : null,
    ai_processed: true,
  };

  // Add extracted location if we found one and alert doesn't have location
  if (filtered.extractedLocation && !existingLocation) {
    updateData.location_lat = filtered.extractedLocation.lat;
    updateData.location_lng = filtered.extractedLocation.lng;
    console.log(`[AI] Extracted location for alert ${alertId}: ${filtered.extractedLocation.locationName} (${filtered.extractedLocation.lat}, ${filtered.extractedLocation.lng})`);
  }

  const { error: updateError } = await supabase
    .from('incidents')
    .update(updateData)
    .eq('id', alertId);

  if (updateError) {
    console.error('Update failed:', updateError);
    return false;
  }

  return true;
}

function validateCategory(cat: string): FilteredAlert['category'] {
  const valid = ['CRIME', 'WEATHER', 'HEALTH', 'SCAM', 'CYBER', 'OTHER'];
  return valid.includes(cat) ? (cat as FilteredAlert['category']) : 'OTHER';
}

function validateSeverity(sev: string): FilteredAlert['severity'] {
  const valid = ['LOW', 'MEDIUM', 'HIGH'];
  return valid.includes(sev) ? (sev as FilteredAlert['severity']) : 'MEDIUM';
}

function guessCategory(text: string): FilteredAlert['category'] {
  const lower = text.toLowerCase();
  if (/theft|robbery|assault|crime|police|arrest|murder|shooting/.test(lower)) return 'CRIME';
  if (/storm|weather|flood|hurricane|tornado|rain|snow|warning|advisory/.test(lower)) return 'WEATHER';
  if (/health|flu|virus|disease|hospital|medical|outbreak/.test(lower)) return 'HEALTH';
  if (/scam|phishing|fraud|fake|impersonat/.test(lower)) return 'SCAM';
  if (/cyber|hack|breach|data|malware|ransomware|vulnerability|exploit/.test(lower)) return 'CYBER';
  return 'OTHER';
}

function guessSeverity(text: string): FilteredAlert['severity'] {
  const lower = text.toLowerCase();
  if (/critical|severe|emergency|immediate|danger|extreme/.test(lower)) return 'HIGH';
  if (/warning|advisory|caution|moderate/.test(lower)) return 'MEDIUM';
  return 'LOW';
}

/**
 * Generate fallback safety checklist when AI is unavailable
 */
function generateFallbackChecklist(category: FilteredAlert['category'], title: string): { actionStep: string; steps: string[] } {
  const checklists: Record<FilteredAlert['category'], { actionStep: string; steps: string[] }> = {
    CRIME: {
      actionStep: 'Stay alert and avoid the affected area if possible.',
      steps: [
        'Report any suspicious activity to local police (dial 100)',
        'Avoid travelling alone in the affected area, especially after dark',
        'Share your live location with a trusted contact when going out',
        'Keep emergency contacts readily accessible on your phone',
      ],
    },
    WEATHER: {
      actionStep: 'Seek shelter immediately and stay indoors.',
      steps: [
        'Stay indoors and away from windows during severe weather',
        'Keep emergency supplies ready (flashlight, water, first aid)',
        'Monitor local news and weather updates regularly',
        'Avoid driving through flooded roads or areas with debris',
      ],
    },
    HEALTH: {
      actionStep: 'Follow health guidelines and consult a doctor if symptomatic.',
      steps: [
        'Wash hands frequently with soap for at least 20 seconds',
        'Wear a mask in crowded or enclosed spaces if advised',
        'Stay home if you feel unwell to avoid spreading illness',
        'Consult a healthcare professional if symptoms persist',
      ],
    },
    SCAM: {
      actionStep: 'Do not click any links or share personal information.',
      steps: [
        'Never share OTPs, passwords, or banking details with anyone',
        'Verify the sender through official channels before responding',
        'Report the scam to cybercrime helpline (dial 1930)',
        'Block and report suspicious numbers or email addresses',
      ],
    },
    CYBER: {
      actionStep: 'Update your software and change passwords immediately.',
      steps: [
        'Update all affected software and systems immediately',
        'Change passwords for potentially compromised accounts',
        'Enable two-factor authentication where available',
        'Run a full malware scan on your devices',
      ],
    },
    OTHER: {
      actionStep: 'Stay informed and follow official guidance.',
      steps: [
        'Monitor official news sources for updates',
        'Follow instructions from local authorities',
        'Keep emergency contacts readily available',
        'Share verified information with family and friends',
      ],
    },
  };

  return checklists[category] || checklists.OTHER;
}

/**
 * Extract location from text using known city names (fallback when AI unavailable)
 */
function extractLocationFromText(text: string): FilteredAlert['extractedLocation'] | undefined {
  const lower = text.toLowerCase();

  // Common cities with their coordinates
  const knownLocations: Array<{ names: string[]; lat: number; lng: number; displayName: string }> = [
    // India
    { names: ['bengaluru', 'bangalore'], lat: 12.9716, lng: 77.5946, displayName: 'Bengaluru' },
    { names: ['mumbai', 'bombay'], lat: 19.0760, lng: 72.8777, displayName: 'Mumbai' },
    { names: ['delhi', 'new delhi'], lat: 28.6139, lng: 77.2090, displayName: 'Delhi' },
    { names: ['chennai', 'madras'], lat: 13.0827, lng: 80.2707, displayName: 'Chennai' },
    { names: ['kolkata', 'calcutta'], lat: 22.5726, lng: 88.3639, displayName: 'Kolkata' },
    { names: ['hyderabad'], lat: 17.3850, lng: 78.4867, displayName: 'Hyderabad' },
    { names: ['pune', 'poona'], lat: 18.5204, lng: 73.8567, displayName: 'Pune' },
    { names: ['ahmedabad'], lat: 23.0225, lng: 72.5714, displayName: 'Ahmedabad' },
    { names: ['jaipur'], lat: 26.9124, lng: 75.7873, displayName: 'Jaipur' },
    { names: ['lucknow'], lat: 26.8467, lng: 80.9462, displayName: 'Lucknow' },
    // US
    { names: ['new york', 'nyc', 'manhattan'], lat: 40.7128, lng: -74.0060, displayName: 'New York' },
    { names: ['los angeles', 'la'], lat: 34.0522, lng: -118.2437, displayName: 'Los Angeles' },
    { names: ['chicago'], lat: 41.8781, lng: -87.6298, displayName: 'Chicago' },
    { names: ['houston'], lat: 29.7604, lng: -95.3698, displayName: 'Houston' },
    { names: ['san francisco', 'sf'], lat: 37.7749, lng: -122.4194, displayName: 'San Francisco' },
    { names: ['seattle'], lat: 47.6062, lng: -122.3321, displayName: 'Seattle' },
    { names: ['miami'], lat: 25.7617, lng: -80.1918, displayName: 'Miami' },
    { names: ['boston'], lat: 42.3601, lng: -71.0589, displayName: 'Boston' },
    // UK
    { names: ['london'], lat: 51.5074, lng: -0.1278, displayName: 'London' },
    { names: ['manchester'], lat: 53.4808, lng: -2.2426, displayName: 'Manchester' },
    { names: ['birmingham'], lat: 52.4862, lng: -1.8904, displayName: 'Birmingham' },
    { names: ['liverpool'], lat: 53.4084, lng: -2.9916, displayName: 'Liverpool' },
    // Other major cities
    { names: ['singapore'], lat: 1.3521, lng: 103.8198, displayName: 'Singapore' },
    { names: ['tokyo'], lat: 35.6762, lng: 139.6503, displayName: 'Tokyo' },
    { names: ['sydney'], lat: -33.8688, lng: 151.2093, displayName: 'Sydney' },
    { names: ['dubai'], lat: 25.2048, lng: 55.2708, displayName: 'Dubai' },
    { names: ['hong kong'], lat: 22.3193, lng: 114.1694, displayName: 'Hong Kong' },
  ];

  for (const loc of knownLocations) {
    for (const name of loc.names) {
      // Match whole word only using word boundaries
      const regex = new RegExp(`\\b${name}\\b`, 'i');
      if (regex.test(lower)) {
        return {
          lat: loc.lat,
          lng: loc.lng,
          locationName: loc.displayName,
        };
      }
    }
  }

  return undefined;
}

export { guessCategory, guessSeverity, generateFallbackChecklist, extractLocationFromText, createUltimateFallback };
