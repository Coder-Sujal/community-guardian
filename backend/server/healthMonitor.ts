/**
 * HealthMonitor - Tracks AI service (OpenAI) availability with timeout detection,
 * automatic retry, and background health check loop.
 *
 * Singleton pattern ensures shared status across all requests.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
import OpenAI from 'openai';

export interface AIServiceStatus {
  available: boolean;
  lastCheck: Date;
  lastError?: string;
  consecutiveFailures: number;
}

const HEALTH_CHECK_TIMEOUT_MS = 5_000; // 5 seconds (Req 1.1)
const RETRY_INTERVAL_MS = 60_000;      // 60 seconds (Req 1.5)

export class HealthMonitor {
  private status: AIServiceStatus = {
    available: true,
    lastCheck: new Date(),
    lastError: undefined,
    consecutiveFailures: 0,
  };

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private openai: OpenAI | null;

  constructor(openai?: OpenAI | null) {
    this.openai = openai !== undefined
      ? openai
      : (process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null);
  }

  /** Whether the AI service is currently considered available. */
  isAvailable(): boolean {
    return this.status.available;
  }

  /** Full status snapshot for the health API endpoint. */
  getStatus(): AIServiceStatus {
    return { ...this.status };
  }

  /**
   * Perform an immediate health check against the OpenAI API.
   *
   * - Uses a lightweight models.list() call with a 5-second timeout.
   * - Marks service unavailable on timeout or any error (Req 1.1, 1.2).
   * - Marks service available on success (Req 1.3).
   */
  async checkNow(): Promise<boolean> {
    if (!this.openai) {
      this.markUnavailable('No OpenAI API key configured');
      return false;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      await this.openai.models.list({ signal: controller.signal } as any);

      clearTimeout(timer);
      this.markAvailable();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.markUnavailable(message);
      return false;
    }
  }

  /**
   * Start the background health check loop.
   * Retries every 60 seconds while the service is unavailable (Req 1.5).
   * Also runs an initial check immediately.
   */
  start(): void {
    if (this.intervalId) return; // already running

    // Fire an initial check
    void this.checkNow();

    this.intervalId = setInterval(() => {
      void this.checkNow();
    }, RETRY_INTERVAL_MS);
  }

  /** Stop the background health check loop. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /* ---- internal helpers ---- */

  private markAvailable(): void {
    this.status = {
      available: true,
      lastCheck: new Date(),
      lastError: undefined,
      consecutiveFailures: 0,
    };
  }

  private markUnavailable(error: string): void {
    this.status = {
      available: false,
      lastCheck: new Date(),
      lastError: error,
      consecutiveFailures: this.status.consecutiveFailures + 1,
    };
  }
}

// Singleton instance for shared use across the application
export const healthMonitor = new HealthMonitor();
