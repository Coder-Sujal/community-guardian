/**
 * CISA Known Exploited Vulnerabilities Fetcher
 * Fetches cybersecurity alerts from CISA KEV catalog (no API key required)
 * https://www.cisa.gov/known-exploited-vulnerabilities-catalog
 */

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

interface CISAVulnerability {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
  notes?: string;
}

interface CISACatalog {
  title: string;
  catalogVersion: string;
  dateReleased: string;
  count: number;
  vulnerabilities: CISAVulnerability[];
}

export interface FetchedAlert {
  external_id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  source: string;
  source_url: string;
  verified: boolean;
  ai_processed: boolean;
  expires_at: string;
}

/**
 * Fetch CISA Known Exploited Vulnerabilities
 * Returns first 10 items
 */
export async function fetchCISAAlerts(): Promise<FetchedAlert[]> {
  try {
    const response = await fetch(CISA_KEV_URL, {
      headers: {
        'User-Agent': 'CommunityGuardian/1.0',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[CISA] API error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json() as CISACatalog;
    const expires_at = new Date(Date.now() + 86400000).toISOString();

    return data.vulnerabilities.slice(0, 10).map((vuln) => ({
      external_id: vuln.cveID,
      title: `${vuln.cveID}: ${vuln.vulnerabilityName}`,
      description: vuln.shortDescription,
      category: 'cyber',
      severity: 'low',
      source: 'CISA',
      source_url: `https://nvd.nist.gov/vuln/detail/${vuln.cveID}`,
      verified: true,
      ai_processed: false,
      expires_at,
    }));
  } catch (error) {
    console.error('[CISA] Fetch error:', error);
    return [];
  }
}

export default fetchCISAAlerts;
