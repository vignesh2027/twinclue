import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { silentLog, type Log } from '../obs/log.js';

export type AuthRole = 'bot' | 'a' | 'b';
export interface TwitchToken { access_token: string; refresh_token: string; expires_at: number; scope: string[]; token_type: string; login?: string; user_id?: string }
export interface TokenIdentity { login: string; userId: string; scopes: string[]; expiresIn: number }
export interface TokenStatus { present: boolean; valid: boolean; login?: string; checkedAt?: number; error?: string }

const TokenSchema = z.object({ access_token: z.string(), refresh_token: z.string(), expires_at: z.number(), scope: z.array(z.string()), token_type: z.string(), login: z.string().optional(), user_id: z.string().optional() });
const TokenMapSchema = z.record(z.string(), TokenSchema);
const TokenResponseSchema = z.object({ access_token: z.string(), refresh_token: z.string(), expires_in: z.number(), scope: z.array(z.string()).optional(), token_type: z.string() });
const ValidateSchema = z.object({ login: z.string(), user_id: z.string(), scopes: z.array(z.string()).nullable().optional(), expires_in: z.number() });

/** Least privilege: the bot reads chat over EventSub and posts round messages. Shared Chat events need no scope. */
export const ROLE_SCOPES: Record<AuthRole, string[]> = { bot: ['user:read:chat', 'user:write:chat'], a: ['channel:read:redemptions'], b: ['channel:read:redemptions'] };

export interface TokenStoreConfig { path?: string; clientId: string; clientSecret: string; fetcher?: typeof fetch; now?: () => number; log?: Log }

export class TokenStore {
  private tokens: Partial<Record<AuthRole, TwitchToken>> = {};
  private readonly refreshing = new Map<AuthRole, Promise<TwitchToken>>();
  private writes: Promise<void> = Promise.resolve();
  readonly status: Record<AuthRole, TokenStatus> = { bot: { present: false, valid: false }, a: { present: false, valid: false }, b: { present: false, valid: false } };
  readonly path: string;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly log: Log;

  constructor(private readonly config: TokenStoreConfig) {
    this.path = config.path ?? 'data/tokens.json';
    this.fetcher = config.fetcher ?? fetch;
    this.now = config.now ?? Date.now;
    this.log = config.log ?? silentLog;
  }

  async load(): Promise<void> {
    try {
      this.tokens = TokenMapSchema.parse(JSON.parse(await readFile(this.path, 'utf8'))) as Partial<Record<AuthRole, TwitchToken>>;
      await chmod(this.path, 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    for (const role of ['bot', 'a', 'b'] as const) this.status[role].present = Boolean(this.tokens[role]);
  }

  get(role: AuthRole): TwitchToken | undefined { return this.tokens[role]; }

  /**
   * Writes the token file with mode 0600 through a temp file, so a crash never leaves a half-written file.
   * Writes are queued, so two quick sign-ins cannot race on the temp file and the last one always lands.
   */
  put(role: AuthRole, token: TwitchToken): Promise<void> {
    this.tokens[role] = token;
    this.status[role].present = true;
    const write = this.writes.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      const temp = `${this.path}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`;
      await writeFile(temp, JSON.stringify(this.tokens, null, 2), { encoding: 'utf8', mode: 0o600 });
      await chmod(temp, 0o600);
      await rename(temp, this.path);
    });
    this.writes = write.catch(() => undefined);
    return write;
  }

  /** A token with at least a minute left, refreshed if needed. Concurrent callers share one refresh. */
  async valid(role: AuthRole): Promise<TwitchToken> {
    const token = this.tokens[role];
    if (!token) throw new Error(`No Twitch token for ${role}. Authorise it from the control panel.`);
    if (token.expires_at - this.now() > 60_000) return token;
    return this.refresh(role);
  }

  refresh(role: AuthRole): Promise<TwitchToken> {
    const inFlight = this.refreshing.get(role);
    if (inFlight) return inFlight;
    const promise = this.doRefresh(role).finally(() => this.refreshing.delete(role));
    this.refreshing.set(role, promise);
    return promise;
  }

  private async doRefresh(role: AuthRole): Promise<TwitchToken> {
    const token = this.tokens[role];
    if (!token) throw new Error(`No Twitch token for ${role}.`);
    const response = await this.fetcher('https://id.twitch.tv/oauth2/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token, client_id: this.config.clientId, client_secret: this.config.clientSecret }).toString(),
    });
    if (!response.ok) {
      this.status[role] = { ...this.status[role], valid: false, error: `Twitch refused the token refresh (${response.status}). Authorise the ${role} account again.` };
      this.log.warn({ event: 'token_refresh_failed', role, status: response.status }, 'Twitch token refresh failed.');
      throw new Error(`Twitch token refresh failed (${response.status}).`);
    }
    const data = TokenResponseSchema.parse(await response.json());
    const refreshed: TwitchToken = { ...token, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: this.now() + data.expires_in * 1000, scope: data.scope ?? token.scope, token_type: data.token_type };
    await this.put(role, refreshed);
    this.log.info({ event: 'token_refreshed', role }, 'Twitch token refreshed.');
    return refreshed;
  }

  /** Twitch asks apps to validate tokens at start and hourly. A 401 triggers one refresh and a second check. */
  async validate(role: AuthRole): Promise<TokenIdentity | undefined> {
    const token = this.tokens[role];
    if (!token) { this.status[role] = { present: false, valid: false }; return undefined; }
    try {
      let identity = await validateAccessToken(token.access_token, this.fetcher);
      if (!identity) identity = await validateAccessToken((await this.refresh(role)).access_token, this.fetcher);
      if (!identity) throw new Error('Twitch says the token is no longer valid.');
      this.status[role] = { present: true, valid: true, login: identity.login, checkedAt: this.now() };
      return identity;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.status[role] = { present: true, valid: false, checkedAt: this.now(), error: message };
      this.log.warn({ event: 'token_invalid', role, reason: message }, 'Twitch token validation failed.');
      return undefined;
    }
  }
}

/** Returns the identity for a token, or undefined when Twitch answers 401. Other failures throw. */
export async function validateAccessToken(accessToken: string, fetcher: typeof fetch = fetch): Promise<TokenIdentity | undefined> {
  const response = await fetcher('https://id.twitch.tv/oauth2/validate', { headers: { authorization: `OAuth ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (response.status === 401) return undefined;
  if (!response.ok) throw new Error(`Twitch token validation failed (${response.status}).`);
  const data = ValidateSchema.parse(await response.json());
  return { login: data.login, userId: data.user_id, scopes: data.scopes ?? [], expiresIn: data.expires_in };
}

/** POST /oauth2/revoke. Returns whether Twitch confirmed the revocation; never throws. */
export async function revokeToken(clientId: string, token: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetcher('https://id.twitch.tv/oauth2/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ client_id: clientId, token }).toString() });
    return response.ok;
  } catch { return false; }
}

export interface AuthRoutesConfig {
  clientId: string; clientSecret: string; publicUrl: string; store: TokenStore;
  /** The Twitch login each role must sign in as. A different account is refused and its token is discarded. */
  expectedLogin: (role: AuthRole) => string | undefined;
  requireAdmin: preHandlerHookHandler;
  roles?: AuthRole[]; fetcher?: typeof fetch; now?: () => number; log?: Log;
  onAuthorized?: (role: AuthRole) => void | Promise<void>;
}

const STATE_TTL_MS = 10 * 60_000;
const page = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>body{font:16px system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:32rem;padding:2rem}</style></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);

export function registerAuthRoutes(app: FastifyInstance, config: AuthRoutesConfig): void {
  const states = new Map<string, { role: AuthRole; expiresAt: number }>();
  const fetcher = config.fetcher ?? fetch;
  const now = config.now ?? Date.now;
  const log = config.log ?? silentLog;
  const roles = config.roles ?? ['bot'];
  const callbackUrl = `${config.publicUrl.replace(/\/$/, '')}/auth/callback`;

  app.post('/auth/start', { preHandler: config.requireAdmin }, async (request, reply) => {
    const role = (request.body as { role?: string } | undefined)?.role ?? 'bot';
    if (!roles.includes(role as AuthRole)) return reply.code(400).send({ error: `role must be one of: ${roles.join(', ')}` });
    for (const [key, entry] of states) if (entry.expiresAt <= now()) states.delete(key);
    if (states.size >= 100) return reply.code(429).send({ error: 'Too many sign-ins in progress. Wait a few minutes.' });
    const state = randomBytes(24).toString('hex');
    states.set(state, { role: role as AuthRole, expiresAt: now() + STATE_TTL_MS });
    const url = `https://id.twitch.tv/oauth2/authorize?${new URLSearchParams({ client_id: config.clientId, redirect_uri: callbackUrl, response_type: 'code', scope: ROLE_SCOPES[role as AuthRole].join(' '), state, force_verify: 'true' })}`;
    return { url, expectedLogin: config.expectedLogin(role as AuthRole) ?? null };
  });

  app.get('/auth/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    reply.type('text/html; charset=utf-8');
    if (query.error || !query.code || !query.state) return reply.code(400).send(page('Not connected', 'Twitch authorisation was not completed. Start again from the control panel.'));
    const entry = states.get(query.state);
    states.delete(query.state);
    if (!entry || entry.expiresAt <= now()) return reply.code(400).send(page('Link expired', 'This sign-in link expired or was already used. Start again from the control panel.'));
    const response = await fetcher('https://id.twitch.tv/oauth2/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code: query.code, grant_type: 'authorization_code', redirect_uri: callbackUrl }).toString(),
    });
    if (!response.ok) return reply.code(502).send(page('Not connected', 'Twitch did not accept the sign-in. Try again in a minute.'));
    const data = TokenResponseSchema.parse(await response.json());
    const identity = await validateAccessToken(data.access_token, fetcher);
    const expected = config.expectedLogin(entry.role)?.toLowerCase();
    if (!identity || (expected && identity.login.toLowerCase() !== expected)) {
      // Revoke before discarding, so a token for the wrong account does not stay valid at Twitch.
      const revoked = await revokeToken(config.clientId, data.access_token, fetcher);
      log.warn({ event: 'oauth_identity_mismatch', role: entry.role, expected, actual: identity?.login, revoked }, 'OAuth sign-in used the wrong Twitch account; token revoked and discarded.');
      return reply.code(403).send(page('Wrong Twitch account', `This role must sign in as ${escapeHtml(expected ?? 'the configured account')}, but Twitch signed in ${escapeHtml(identity?.login ?? 'an unknown account')}. Log out of Twitch or use a private window, then try again.`));
    }
    await config.store.put(entry.role, { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: now() + data.expires_in * 1000, scope: data.scope ?? [], token_type: data.token_type, login: identity.login, user_id: identity.userId });
    config.store.status[entry.role] = { present: true, valid: true, login: identity.login, checkedAt: now() };
    log.info({ event: 'oauth_authorized', role: entry.role, login: identity.login }, 'Twitch account authorised.');
    await config.onAuthorized?.(entry.role);
    return page('Connected', `Signed in as ${escapeHtml(identity.login)}. You can close this tab and return to the control panel.`);
  });
}
