import { RuleConfiguration, ruleConfiguration } from './ruleConfiguration.js';
import type { SafetyChecklist, KnownLocation } from './ruleConfiguration.js';
import type { RawAlert } from './aiFilter.js';
export type { RawAlert };

export type Category = 'CRIME' | 'WEATHER' | 'HEALTH' | 'SCAM' | 'CYBER' | 'OTHER';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ExtractedLocation {
  lat: number;
  lng: number;
  locationName: string;
}

export interface ProcessedAlert {
  category: Category;
  severity: Severity;
  checklist: SafetyChecklist;
  location?: ExtractedLocation;
  processedBy: 'fallback';
}

const VALID_CATEGORIES: Category[] = ['CRIME', 'WEATHER', 'HEALTH', 'SCAM', 'CYBER', 'OTHER'];

export class FallbackEngine {
  private config: RuleConfiguration;

  constructor(config: RuleConfiguration = ruleConfiguration) {
    this.config = config;
  }

  private static readonly SEVERITY_ORDER: Record<Severity, number> = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
  };

  private static readonly SEVERITY_FROM_ORDER: Severity[] = ['LOW', 'MEDIUM', 'HIGH'];

  assessSeverity(text: string, source: string): Severity {
    const lower = text.toLowerCase();
    const rules = this.config.getRules();
    const severityLevels: Severity[] = ['HIGH', 'MEDIUM', 'LOW'];

    let baseSeverity: Severity = 'MEDIUM';

    for (const level of severityLevels) {
      const keywords = rules.severity[level];
      if (keywords && keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        baseSeverity = level;
        break;
      }
    }

    const trusted = rules.sourceBoost.trustedSources ?? [];
    const isTrusted = trusted.some(
      (s) => s.toLowerCase() === source.toLowerCase()
    );

    if (isTrusted) {
      const idx = FallbackEngine.SEVERITY_ORDER[baseSeverity];
      const boosted = Math.min(idx + 1, 2);
      return FallbackEngine.SEVERITY_FROM_ORDER[boosted];
    }

    return baseSeverity;
  }

  generateChecklist(category: Category): SafetyChecklist {
    const rules = this.config.getRules();
    const checklist = rules.checklists[category];
    if (checklist && checklist.actionStep && Array.isArray(checklist.steps) && checklist.steps.length >= 3) {
      return checklist;
    }
    // Fallback to OTHER checklist if category checklist is missing or incomplete
    const fallback = rules.checklists['OTHER'];
    if (fallback && fallback.actionStep && Array.isArray(fallback.steps) && fallback.steps.length >= 3) {
      return fallback;
    }
    return {
      actionStep: 'Stay informed and follow guidance from local authorities.',
      steps: ['Monitor official news sources for updates', 'Follow instructions from emergency services', 'Share verified information with your community'],
    };
  }

  classifyCategory(text: string): Category {
    const lower = text.toLowerCase();
    const rules = this.config.getRules();
    let bestCategory: Category = 'OTHER';
    let bestCount = 0;

    for (const cat of VALID_CATEGORIES) {
      if (cat === 'OTHER') continue;
      const patterns = rules.categories[cat];
      if (!patterns) continue;

      let count = 0;
      for (const keyword of patterns) {
        if (lower.includes(keyword.toLowerCase())) {
          count++;
        }
      }

      if (count > bestCount) {
        bestCount = count;
        bestCategory = cat;
      }
    }

    return bestCategory;
  }

  extractLocation(text: string): ExtractedLocation | null {
    const lower = text.toLowerCase();
    const rules = this.config.getRules();
    const locations = rules.locations;
    if (!locations || !Array.isArray(locations)) return null;

    for (const loc of locations) {
      for (const name of loc.names) {
        const escaped = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
        if (pattern.test(lower)) {
          return {
            lat: loc.lat,
            lng: loc.lng,
            locationName: loc.displayName,
          };
        }
      }
    }

    return null;
  }

  processAlert(alert: RawAlert): ProcessedAlert {
    const text = `${alert.title} ${alert.description || ''}`.trim();
    const category = this.classifyCategory(text);
    const severity = this.assessSeverity(text, alert.source);
    const checklist = this.generateChecklist(category);
    const location = this.extractLocation(text) ?? undefined;

    return {
      category,
      severity,
      checklist,
      ...(location ? { location } : {}),
      processedBy: 'fallback',
    };
  }

}
