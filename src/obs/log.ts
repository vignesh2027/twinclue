import type { FastifyServerOptions } from 'fastify';

/** The subset of Fastify's pino logger that the components use. Messages are structured: (fields, message). */
export interface Log {
  info(fields: object, message?: string): void;
  warn(fields: object, message?: string): void;
  error(fields: object, message?: string): void;
  debug(fields: object, message?: string): void;
}

export const silentLog: Log = { info() {}, warn() {}, error() {}, debug() {} };

/** Query strings carry overlay keys, OAuth codes and states, so request URLs are logged without them. */
export function stripQuery(url: string | undefined): string {
  if (!url) return '';
  const index = url.indexOf('?');
  return index === -1 ? url : `${url.slice(0, index)}?[redacted]`;
}

const SECRET_KEYS = ['access_token', 'refresh_token', 'client_secret', 'token', 'code', 'state', 'authorization', 'adminToken', 'key', 'k'];

export function loggerOptions(stream?: NodeJS.WritableStream): NonNullable<FastifyServerOptions['logger']> {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [...SECRET_KEYS, ...SECRET_KEYS.map(key => `*.${key}`), 'req.headers.authorization', 'req.headers.cookie', 'headers.authorization'],
      censor: '[redacted]',
    },
    serializers: {
      req(request: { method?: string; url?: string; ip?: string }) {
        return { method: request.method, url: stripQuery(request.url), ip: request.ip };
      },
    },
    ...(stream ? { stream } : {}),
  } as NonNullable<FastifyServerOptions['logger']>;
}
