import { BadRequestException } from '@nestjs/common';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { guardedLookup, isPublicAddress, REFUSED } from '../../../shared/utils/public-address.ts';

export { isPublicAddress };

export type PostingPage = { ok: true; url: string; text: string; jsonLd: string | null } | { ok: false; reason: 'login' | 'unreadable' };
type Options = { allowAddress?: (ip: string) => boolean; timeoutMs?: number };

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 30_000;
const MAX_JSON_LD = 10_000;
const LOGIN_STATUSES = new Set([401, 403, 999]);
const LOGIN_PATH = /login|signin|sign-in|authwall|checkpoint/i;
const UNREADABLE: PostingPage = { ok: false, reason: 'unreadable' };
const LOGIN: PostingPage = { ok: false, reason: 'login' };

const refused = () => new BadRequestException('That link cannot be read');

function parseLink(link: string): URL {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw refused();
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw refused();
  return url;
}

type Reply = { status: number; location: string | null; body: string | null };

function fetchOnce(url: URL, allow: (ip: string) => boolean, timeoutMs: number): Promise<Reply | null> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !allow(host)) return Promise.reject(refused());
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Daybook/1.0', Accept: 'text/html,text/plain' },
      lookup: guardedLookup(allow),
    });
    const timer = setTimeout(() => finish(null), timeoutMs);
    function finish(reply: Reply | null) {
      clearTimeout(timer);
      request.destroy();
      resolve(reply);
    }
    request.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === REFUSED) reject(refused());
      else resolve(null);
    });
    request.on('response', (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location ?? null;
      const readable = status >= 200 && status < 300 && /^text\/(html|plain)\b/i.test(response.headers['content-type'] ?? '');
      if (!readable) return finish({ status, location, body: null });
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) finish(null);
        else chunks.push(chunk);
      });
      response.on('end', () => finish({ status, location, body: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', () => finish(null));
    });
    request.end();
  });
}

// Fetches a job posting with no cookies, following at most three redirects, and says when a site wants a login instead.
export async function readPostingPage(link: string, options: Options = {}): Promise<PostingPage> {
  const allow = options.allowAddress ?? isPublicAddress;
  const timeoutMs = options.timeoutMs ?? 10_000;
  let url = parseLink(link);
  for (let hop = 0; ; hop++) {
    const reply = await fetchOnce(url, allow, timeoutMs);
    if (!reply) return UNREADABLE;
    if (LOGIN_STATUSES.has(reply.status)) return LOGIN;
    if (reply.status >= 300 && reply.status < 400 && reply.location) {
      if (hop === MAX_REDIRECTS) return UNREADABLE;
      const next = new URL(reply.location, url);
      if (next.protocol !== 'http:' && next.protocol !== 'https:') return UNREADABLE;
      if (LOGIN_PATH.test(next.pathname)) return LOGIN;
      url = next;
      continue;
    }
    if (reply.body === null) return UNREADABLE;
    return { ok: true, url: url.href, ...pageText(reply.body) };
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? whole;
    const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });

// The readable text of a page, plus any JobPosting structured data it carries.
export function pageText(html: string): { text: string; jsonLd: string | null } {
  const jobBlocks = [...html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim())
    .filter((block) => /"@type"\s*:\s*(\[[^\]]*)?"JobPosting"/.test(block));
  const text = decode(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT);
  return { text, jsonLd: jobBlocks.length > 0 ? jobBlocks.join('\n').slice(0, MAX_JSON_LD) : null };
}
