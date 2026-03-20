import { readFileSync, watch, type FSWatcher } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SafetyChecklist {
  actionStep: string;
  steps: string[];
}

export interface KnownLocation {
  names: string[];
  lat: number;
  lng: number;
  displayName: string;
}

export interface RuleSet {
  categories: Record<string, string[]>;
  severity: { HIGH: string[]; MEDIUM: string[]; LOW: string[] };
  sourceBoost: { trustedSources: string[] };
  checklists: Record<string, SafetyChecklist>;
  locations: KnownLocation[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, 'fallback-rules.json');

const DEFAULT_RULES: RuleSet = {
  categories: {
    CRIME: ['theft', 'robbery', 'assault', 'crime', 'police', 'arrest', 'murder', 'shooting'],
    WEATHER: ['storm', 'weather', 'flood', 'hurricane', 'tornado', 'rain', 'cyclone'],
    HEALTH: ['health', 'flu', 'virus', 'disease', 'hospital', 'outbreak', 'pandemic'],
    SCAM: ['scam', 'phishing', 'fraud', 'fake', 'impersonat', 'lottery'],
    CYBER: ['cyber', 'hack', 'breach', 'malware', 'ransomware', 'vulnerability'],
    OTHER: [],
  },
  severity: {
    HIGH: ['critical', 'severe', 'emergency', 'immediate', 'danger', 'extreme', 'fatal', 'deadly'],
    MEDIUM: ['warning', 'advisory', 'caution', 'moderate', 'alert'],
    LOW: ['minor', 'low', 'routine', 'informational'],
  },
  sourceBoost: { trustedSources: ['CISA', 'RBI', 'CDC', 'WHO', 'NWS', 'FBI'] },
  checklists: {
    CRIME: { actionStep: 'Stay alert and avoid the affected area.', steps: ['Report suspicious activity to police', 'Avoid the area', 'Share location with a contact'] },
    WEATHER: { actionStep: 'Monitor weather updates.', steps: ['Stock essential supplies', 'Secure outdoor objects', 'Identify nearest shelter'] },
    HEALTH: { actionStep: 'Follow health advisories.', steps: ['Wash hands frequently', 'Avoid crowded places', 'Consult a doctor if symptomatic'] },
    SCAM: { actionStep: 'Do not respond to suspicious messages.', steps: ['Verify sender through official channels', 'Never share passwords or OTPs', 'Report to cyber crime authorities'] },
    CYBER: { actionStep: 'Disconnect affected systems.', steps: ['Change compromised passwords', 'Run antivirus scan', 'Enable two-factor authentication'] },
    OTHER: { actionStep: 'Stay informed and follow local guidance.', steps: ['Monitor official news', 'Follow emergency instructions', 'Share verified information'] },
  },
  locations: [
    { names: ['bengaluru', 'bangalore'], lat: 12.9716, lng: 77.5946, displayName: 'Bengaluru' },
    { names: ['mumbai', 'bombay'], lat: 19.076, lng: 72.8777, displayName: 'Mumbai' },
    { names: ['delhi', 'new delhi'], lat: 28.6139, lng: 77.209, displayName: 'Delhi' },
    { names: ['chennai', 'madras'], lat: 13.0827, lng: 80.2707, displayName: 'Chennai' },
  ],
};

export class RuleConfiguration {
  private rules: RuleSet;
  private watcher: FSWatcher | null = null;
  private configPath: string;

  constructor(configPath: string = CONFIG_PATH) {
    this.configPath = configPath;
    this.rules = this.loadRules();
  }

  getRules(): RuleSet {
    return this.rules;
  }

  reload(): void {
    this.rules = this.loadRules();
  }

  isValid(data?: unknown): boolean {
    const obj = data ?? this.rules;
    if (!obj || typeof obj !== 'object') return false;
    const r = obj as Record<string, unknown>;

    if (!r.categories || typeof r.categories !== 'object') return false;
    if (!r.severity || typeof r.severity !== 'object') return false;
    if (!r.sourceBoost || typeof r.sourceBoost !== 'object') return false;
    if (!r.checklists || typeof r.checklists !== 'object') return false;
    if (!Array.isArray(r.locations)) return false;

    const sev = r.severity as Record<string, unknown>;
    if (!Array.isArray(sev.HIGH) || !Array.isArray(sev.MEDIUM) || !Array.isArray(sev.LOW)) return false;

    const sb = r.sourceBoost as Record<string, unknown>;
    if (!Array.isArray(sb.trustedSources)) return false;

    return true;
  }

  startWatching(): void {
    if (this.watcher) return;
    try {
      this.watcher = watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          console.log('[RuleConfiguration] Config file changed, reloading...');
          this.reload();
        }
      });
    } catch (err) {
      console.warn('[RuleConfiguration] Could not watch config file:', err);
    }
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private loadRules(): RuleSet {
    try {
      const raw = readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (this.isValid(parsed)) {
        return parsed as RuleSet;
      }
      console.warn('[RuleConfiguration] Invalid config, using default rules');
      return DEFAULT_RULES;
    } catch (err) {
      console.warn('[RuleConfiguration] Could not load config, using default rules:', err);
      return DEFAULT_RULES;
    }
  }
}

// Singleton instance for shared use
export const ruleConfiguration = new RuleConfiguration();
