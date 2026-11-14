import { BadRequestException } from '@nestjs/common';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

export type PostingPage = { ok: true; url: string; text: string; jsonLd: string | null } | { ok: false; reason: 'login' | 'unreadable' };
type Options = { allowAddress?: (ip: string) => boolean; timeoutMs?: number };

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 30_000;
const MAX_JSON_LD = 10_000;
const LOGIN_STATUSES = new Set([401, 403, 999]);
const LOGIN_PATH = /login|signin|sign-in|authwall|checkpoint/i;
const REFUSED = 'EREFUSED_ADDRESS';
const UNREADABLE: PostingPage = { ok: false, reason: 'unreadable' };
const LOGIN: PostingPage = { ok: false, reason: 'login' };

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6');
}

// Only addresses on the public internet: the server must never be talked into calling itself or its neighbours.
export function isPublicAddress(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];
  if (mapped) return isPublicAddress(mapped);
  const family = isIP(ip);
  if (family === 0) return false;
  return !blocked.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

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

// Checks the address each connection actually uses, so redirects and DNS tricks can't reach a private address.
function guardedLookup(allow: (ip: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
      if (error) return callback(error, '', 0);
      if (addresses.length === 0 || addresses.some(({ address }) => !allow(address))) {
        return callback(Object.assign(new Error('Address refused'), { code: REFUSED }), '', 0);
      }
      if (options.all) return (callback as unknown as (error: null, all: LookupAddress[]) => void)(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
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
