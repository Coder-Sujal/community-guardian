import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface RawIncident {
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  location?: { lat: number; lng: number };
}

export interface VerifiedIncident extends RawIncident {
  verified: boolean;
  aiConfidence: number | null;
  category: 'CRIME' | 'WEATHER' | 'HEALTH' | 'SCAM' | 'CYBER' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  summary?: string;
}

export async function verifyIncident(incident: RawIncident): Promise<VerifiedIncident> {
  if (!openai) {
    // Fallback: return unverified with best-guess category
    return {
      ...incident,
      verified: false,
      aiConfidence: null,
      category: guessCategory(incident.title + ' ' + incident.description),
      severity: 'MEDIUM',
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a safety incident verifier. Analyze the incident and return JSON with: verified (boolean), confidence (0-1), category (one of: CRIME, WEATHER, HEALTH, SCAM, CYBER, OTHER), severity (LOW, MEDIUM, or HIGH), and summary (brief one-line summary). Only return valid JSON, no extra text.',
        },
        {
          role: 'user',
          content: `Verify this safety incident:\nTitle: ${incident.title}\nDescription: ${incident.description}\nSource: ${incident.source}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 200,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      ...incident,
      verified: result.verified ?? true,
      aiConfidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
      category: validateCategory(result.category),
      severity: validateSeverity(result.severity),
      summary: result.summary,
    };
  } catch (error) {
    console.error('AI verification failed:', error);
    return {
      ...incident,
      verified: false,
      aiConfidence: null,
      category: guessCategory(incident.title + ' ' + incident.description),
      severity: 'MEDIUM',
    };
  }
}

function validateCategory(cat: string): VerifiedIncident['category'] {
  const valid = ['CRIME', 'WEATHER', 'HEALTH', 'SCAM', 'CYBER', 'OTHER'];
  return valid.includes(cat) ? (cat as VerifiedIncident['category']) : 'OTHER';
}

function validateSeverity(sev: string): VerifiedIncident['severity'] {
  const valid = ['LOW', 'MEDIUM', 'HIGH'];
  return valid.includes(sev) ? (sev as VerifiedIncident['severity']) : 'MEDIUM';
}

function guessCategory(text: string): VerifiedIncident['category'] {
  const lower = text.toLowerCase();
  if (/theft|robbery|assault|crime|police|arrest|murder|shooting/.test(lower)) return 'CRIME';
  if (/storm|weather|flood|hurricane|tornado|rain|snow/.test(lower)) return 'WEATHER';
  if (/health|flu|virus|disease|hospital|medical|outbreak/.test(lower)) return 'HEALTH';
  if (/scam|phishing|fraud|fake|impersonat/.test(lower)) return 'SCAM';
  if (/cyber|hack|breach|data|malware|ransomware/.test(lower)) return 'CYBER';
  return 'OTHER';
}
