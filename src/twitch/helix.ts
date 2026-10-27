import type { AuthRole, TokenStore } from './auth.js';

export interface HelixResponse { status: number; body: unknown; headers: Headers }
export interface HelixCallOptions {
  /** False hands a 429 straight back, for callers that keep their own rate-limit window (the chat sender). */
  retryRateLimit?: boolean;
}
export interface HelixApi { call(method: 'GET' | 'POST' | 'DELETE', path: string, role: AuthRole, body?: unknown, options?: HelixCallOptions): Promise<HelixResponse> }
export interface HelixConfig { clientId: string; tokens: Pick<TokenStore, 'valid' | 'refresh'>; fetcher?: typeof fetch; timeoutMs?: number; retries?: number; sleep?: (ms: number) => Promise<void>; now?: () => number }

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Seconds until Twitch's Ratelimit-Reset (a Unix epoch in seconds), capped so a bad header cannot stall us. */
export function rateLimitWaitMs(headers: Headers, now = Date.now(), capMs = 30_000): number {
  const reset = Number(headers.get('ratelimit-reset'));
  if (!Number.isFinite(reset) || reset <= 0) return 1_000;
  return Math.min(capMs, Math.max(250, reset * 1000 - now));
}

/**
 * Helix with a timeout per request, retries with backoff on 5xx, network errors and 429 (waiting for
 * Ratelimit-Reset), and one token refresh then retry on 401. HTTP statuses are returned, never thrown, so each
 * caller decides what a 4xx means.
 */
export class TwitchHelix implements HelixApi {
  private readonly sleep: (ms: number) => Promise<void>;
  constructor(private readonly config: HelixConfig) { this.sleep = config.sleep ?? defaultSleep; }

  async call(method: 'GET' | 'POST' | 'DELETE', path: string, role: AuthRole, body?: unknown, options: HelixCallOptions = {}): Promise<HelixResponse> {
    const retries = this.config.retries ?? 3;
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const token = await this.config.tokens.valid(role);
      let response: Response;
      try {
        response = await (this.config.fetcher ?? fetch)(`https://api.twitch.tv/helix${path}`, {
          method, signal: AbortSignal.timeout(this.config.timeoutMs ?? 8_000),
          headers: { 'client-id': this.config.clientId, authorization: `Bearer ${token.access_token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch (error) {
        if (attempt >= retries) throw new Error(`Twitch did not answer ${method} ${path}: ${error instanceof Error ? error.message : String(error)}`);
        await this.sleep(Math.min(8_000, 500 * 2 ** attempt));
        continue;
      }
      if (response.status === 401 && !refreshed) { refreshed = true; await this.config.tokens.refresh(role); continue; }
      const retryable = response.status >= 500 || (response.status === 429 && options.retryRateLimit !== false);
      if (retryable && attempt < retries) {
        await this.sleep(response.status === 429 ? rateLimitWaitMs(response.headers, (this.config.now ?? Date.now)()) : Math.min(8_000, 500 * 2 ** attempt));
        continue;
      }
      const text = await response.text();
      let parsed: unknown;
      try { parsed = text ? JSON.parse(text) : undefined; } catch { parsed = text; }
      return { status: response.status, body: parsed, headers: response.headers };
    }
  }

  async userId(login: string | undefined, role: AuthRole): Promise<string> {
    const result = await this.call('GET', `/users${login ? `?login=${encodeURIComponent(login)}` : ''}`, role);
    if (result.status !== 200) throw new Error(`Twitch user lookup failed (${result.status}).`);
    const id = (result.body as { data?: Array<{ id: string }> }).data?.[0]?.id;
    if (!id) throw new Error(`Twitch user ${login ?? 'for this token'} was not found.`);
    return id;
  }
}
