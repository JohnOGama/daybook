import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { guardedLookup, isPublicAddress, REFUSED } from '../../../shared/utils/public-address.ts';

export type UptimeStatus = 'up' | 'slow' | 'down';
export type CheckResult = { status: UptimeStatus; responseMs: number | null; httpStatus: number | null; error: string | null };
export type CheckOptions = { allowAddress?: (ip: string) => boolean; timeoutMs?: number; slowMs?: number; retryDelayMs?: number };

const TIMEOUT_MS = 10_000;
const SLOW_MS = 2_000;
const RETRY_DELAY_MS = 5_000;
const MAX_REDIRECTS = 3;
const URL_MAX = 2_000;
const USER_AGENT = 'Daybook-Uptime/1.0';
const NOT_PUBLIC = 'Not a public address';
const REASONS: Record<string, string> = {
  [REFUSED]: NOT_PUBLIC,
  ECONNREFUSED: 'Connection refused',
  ENOTFOUND: 'Address not found',
  EAI_AGAIN: 'Address not found',
};

type Answer = { status: number; location: string | null };

const down = (error: string, httpStatus: number | null = null): CheckResult => ({ status: 'down', responseMs: null, httpStatus, error });

function webUrl(link: string): URL | null {
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

// One request, judged on its status line alone: the body is never read, so a slow or endless page can't hold a check up.
function answerOf(url: URL, allow: (ip: string) => boolean, deadline: number, timeoutMs: number): Promise<Answer> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !allow(host)) return Promise.reject(new Error(NOT_PUBLIC));
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(url, { method: 'GET', headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, lookup: guardedLookup(allow), agent: false });
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs / 1000} s`));
      request.destroy();
    }, Math.max(0, deadline - Date.now()));
    request.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new Error(REASONS[error.code ?? ''] ?? 'Could not connect'));
    });
    request.on('response', (response) => {
      clearTimeout(timer);
      resolve({ status: response.statusCode ?? 0, location: response.headers.location ?? null });
      request.destroy();
    });
    request.end();
  });
}

// Up is a 200–399 answer within the timeout, after following at most three redirects; slow is the same over slowMs.
export async function checkSite(link: string, options: CheckOptions = {}): Promise<CheckResult> {
  const allow = options.allowAddress ?? isPublicAddress;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const first = webUrl(link);
  if (!first) return down('Not a web address');
  let url: URL = first;
  const started = performance.now();
  const deadline = Date.now() + timeoutMs;
  try {
    for (let hop = 0; ; hop++) {
      const answer = await answerOf(url, allow, deadline, timeoutMs);
      const next: URL | null = answer.status >= 300 && answer.status < 400 && answer.location ? webUrl(new URL(answer.location, url).href) : null;
      if (next && hop < MAX_REDIRECTS) {
        url = next;
        continue;
      }
      if (answer.status < 200 || answer.status >= 400) return down(`${answer.status} ${http.STATUS_CODES[answer.status] ?? 'Error'}`, answer.status);
      const responseMs = Math.round(performance.now() - started);
      return { status: responseMs > (options.slowMs ?? SLOW_MS) ? 'slow' : 'up', responseMs, httpStatus: answer.status, error: null };
    }
  } catch (error) {
    return down(error instanceof Error ? error.message : 'Could not connect');
  }
}

// A down result gets one more try after a pause, so a single blip never turns a site red.
export async function checkWithRetry(link: string, options: CheckOptions = {}): Promise<CheckResult> {
  const first = await checkSite(link, options);
  if (first.status !== 'down') return first;
  await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? RETRY_DELAY_MS));
  return checkSite(link, options);
}

// Whether a URL may be watched at all: http(s), not too long, and every address its host resolves to is public.
export async function isPublicUrl(link: string, allowAddress: (ip: string) => boolean = isPublicAddress): Promise<boolean> {
  const url = webUrl(link);
  if (!url || link.length > URL_MAX) return false;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return allowAddress(host);
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every(({ address }) => allowAddress(address));
  } catch {
    return false;
  }
}
