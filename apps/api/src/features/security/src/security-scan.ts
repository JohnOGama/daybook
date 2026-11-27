import { BadRequestException } from '@nestjs/common';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { guardedLookup, isPublicAddress, REFUSED } from '../../../shared/utils/public-address.ts';
import type { Severity } from './security-types.ts';

// A passive surface scan: ordinary GET requests only, no cookies, no attack payloads. It reads what a browser would
// see (status, response headers, cookies, the page's HTML) and never probes other endpoints or injects anything.
// Every resolved address must pass isPublicAddress, checked in the socket lookup, so redirects and DNS rebinding
// can't reach a private host (shared with the jobs posting fetcher and the uptime checker).
// Findings are mapped to the OWASP Top 10 (2021) category their check belongs to.

export type Owasp = 'A01' | 'A02' | 'A03' | 'A04' | 'A05' | 'A06' | 'A07' | 'A08' | 'A09' | 'A10';

export type Surface = {
  url: string;
  https: boolean;
  status: number;
  headers: Record<string, string>;
  cookies: string[];
  title: string | null;
  body: string;
};

export type ScanFinding = { title: string; target: string; severity: Severity; cvss: number; description: string; owasp: Owasp };

const MAX_REDIRECTS = 3;
const MAX_BYTES = 256 * 1024;
const MAX_BODY = 120 * 1024;
const TIMEOUT_MS = 10_000;

// A synthetic CVSS (in tenths) for the deterministic checks, so the overview has a number to sort on.
const CVSS: Record<Severity, number> = { critical: 92, high: 75, medium: 55, low: 33, info: 12 };

const refused = () => new BadRequestException('That URL cannot be reached');

function parseUrl(link: string): URL {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    throw new BadRequestException('Enter a valid http(s) URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BadRequestException('Enter a valid http(s) URL');
  return url;
}

type Reply = { status: number; location: string | null; headers: Record<string, string>; cookies: string[]; body: string };

function fetchOnce(url: URL): Promise<Reply | null> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) return Promise.reject(refused());
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(url, { method: 'GET', headers: { 'User-Agent': 'Daybook-Security/1.0', Accept: 'text/html,text/plain' }, lookup: guardedLookup(isPublicAddress) });
    const timer = setTimeout(() => finish(null), TIMEOUT_MS);
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
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) if (typeof value === 'string') headers[key.toLowerCase()] = value;
      const cookies = (response.headers['set-cookie'] as string[] | undefined) ?? [];
      const location = response.headers.location ?? null;
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) finish({ status, location, headers, cookies, body: Buffer.concat(chunks).toString('utf8') });
        else chunks.push(chunk);
      });
      response.on('end', () => finish({ status, location, headers, cookies, body: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', () => finish(null));
    });
    request.end();
  });
}

const titleOf = (html: string): string | null => /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(html)?.[1].replace(/\s+/g, ' ').trim() || null;

export async function readSurface(link: string): Promise<Surface> {
  let url = parseUrl(link);
  for (let hop = 0; ; hop++) {
    const reply = await fetchOnce(url);
    if (!reply) throw new BadRequestException('That URL did not answer');
    if (reply.status >= 300 && reply.status < 400 && reply.location && hop < MAX_REDIRECTS) {
      const next = new URL(reply.location, url);
      if (next.protocol !== 'http:' && next.protocol !== 'https:') break;
      url = next;
      continue;
    }
    return { url: url.href, https: url.protocol === 'https:', status: reply.status, headers: reply.headers, cookies: reply.cookies, title: titleOf(reply.body), body: reply.body.slice(0, MAX_BODY) };
  }
  throw new BadRequestException('That URL did not answer');
}

const has = (surface: Surface, header: string) => header.toLowerCase() in surface.headers;
const finding = (surface: Surface, severity: Severity, owasp: Owasp, title: string, description: string): ScanFinding => ({ title, target: surface.url, severity, cvss: CVSS[severity], description, owasp });

// Nine passive phases, shown as a methodology panel in the UI. The order and ids are mirrored by the web's SCAN_PHASES.
export const PHASES = [
  { id: 'recon', label: 'Reconnaissance' },
  { id: 'transport', label: 'Transport & TLS' },
  { id: 'headers', label: 'Security headers' },
  { id: 'cors', label: 'CORS policy' },
  { id: 'cookies', label: 'Cookies & session' },
  { id: 'content', label: 'Page content' },
  { id: 'disclosure', label: 'Information disclosure' },
  { id: 'ai', label: 'AI analysis' },
  { id: 'report', label: 'Report' },
] as const;

// A02 Cryptographic Failures: TLS, HSTS and mixed content.
export function transportChecks(surface: Surface): ScanFinding[] {
  const out: ScanFinding[] = [];
  if (!surface.https) {
    out.push(finding(surface, 'high', 'A02', 'Served over plain HTTP', 'The page is served without TLS, so traffic and any credentials can be read or altered in transit. Serve the site over HTTPS and redirect HTTP to HTTPS.'));
    return out;
  }
  const hsts = surface.headers['strict-transport-security'];
  if (!hsts) {
    out.push(finding(surface, 'medium', 'A02', 'Missing HSTS header', 'No Strict-Transport-Security header, so a first request can be downgraded to HTTP. Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.'));
  } else {
    const maxAge = Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? 0);
    if (maxAge < 15_552_000 || !/includeSubDomains/i.test(hsts)) out.push(finding(surface, 'info', 'A02', 'Weak HSTS policy', 'The Strict-Transport-Security max-age is short or omits includeSubDomains, which narrows the protection. Use `max-age=31536000; includeSubDomains`.'));
  }
  if (/(?:src|href|action)\s*=\s*["']http:\/\//i.test(surface.body)) out.push(finding(surface, 'medium', 'A02', 'Mixed content on an HTTPS page', 'The page references resources over plain `http://`, which browsers may block or which can be tampered with in transit. Load every resource over HTTPS.'));
  return out;
}

// A05 Security Misconfiguration: the OWASP Secure Headers set and CSP strength.
export function headerChecks(surface: Surface): ScanFinding[] {
  const out: ScanFinding[] = [];
  const csp = surface.headers['content-security-policy'] ?? '';
  if (!csp) out.push(finding(surface, 'medium', 'A05', 'Missing Content-Security-Policy', 'No CSP, so the page has no defence-in-depth against cross-site scripting or data injection. Add a Content-Security-Policy that restricts script, style and frame sources.'));
  else if (/unsafe-inline|unsafe-eval/i.test(csp)) out.push(finding(surface, 'low', 'A05', 'Weak Content-Security-Policy', "The CSP allows `unsafe-inline` or `unsafe-eval`, which largely defeats its XSS protection. Replace them with nonces or hashes."));
  if (!has(surface, 'x-frame-options') && !/frame-ancestors/i.test(csp)) out.push(finding(surface, 'low', 'A05', 'No clickjacking protection', 'Neither X-Frame-Options nor a CSP frame-ancestors directive is set, so the page can be framed by other sites. Add `X-Frame-Options: DENY` or a `frame-ancestors` directive.'));
  if ((surface.headers['x-content-type-options'] ?? '').toLowerCase() !== 'nosniff') out.push(finding(surface, 'low', 'A05', 'MIME sniffing not disabled', 'No `X-Content-Type-Options: nosniff`, so browsers may interpret responses as a different content type. Add the header.'));
  if (!has(surface, 'referrer-policy')) out.push(finding(surface, 'info', 'A05', 'No Referrer-Policy', 'Without a Referrer-Policy, full URLs may leak to third parties in the Referer header. Add e.g. `Referrer-Policy: strict-origin-when-cross-origin`.'));
  if (!has(surface, 'permissions-policy')) out.push(finding(surface, 'info', 'A05', 'No Permissions-Policy', 'No Permissions-Policy, so powerful browser features are not explicitly restricted. Consider adding one to lock down camera, microphone and geolocation.'));
  if (!has(surface, 'cross-origin-opener-policy')) out.push(finding(surface, 'info', 'A05', 'No Cross-Origin-Opener-Policy', 'Without COOP the page shares a browsing context group with cross-origin openers, weakening isolation. Add `Cross-Origin-Opener-Policy: same-origin`.'));
  if (!has(surface, 'cross-origin-resource-policy')) out.push(finding(surface, 'info', 'A05', 'No Cross-Origin-Resource-Policy', 'Without CORP the resource can be embedded cross-origin. Add `Cross-Origin-Resource-Policy: same-origin` where appropriate.'));
  return out;
}

// A01 Broken Access Control / A05: an over-permissive CORS policy.
export function corsChecks(surface: Surface): ScanFinding[] {
  const origin = surface.headers['access-control-allow-origin'];
  if (!origin) return [];
  const credentials = (surface.headers['access-control-allow-credentials'] ?? '').toLowerCase() === 'true';
  if (origin.trim() === '*' && credentials) return [finding(surface, 'high', 'A01', 'CORS allows any origin with credentials', 'Access-Control-Allow-Origin is `*` together with Allow-Credentials, which browsers reject but signals a dangerously open policy; a reflected origin would let any site read authenticated responses. Allow only specific trusted origins.')];
  if (origin.trim() === '*') return [finding(surface, 'medium', 'A05', 'CORS allows any origin', 'Access-Control-Allow-Origin is `*`, so any site can read this response. Restrict it to the origins that actually need access.')];
  return [];
}

// A07 Identification and Authentication Failures / A05: cookie flags and prefixes.
export function cookieChecks(surface: Surface): ScanFinding[] {
  const out: ScanFinding[] = [];
  for (const raw of surface.cookies) {
    const name = raw.split('=')[0]?.trim() || 'a cookie';
    const flags = raw.toLowerCase();
    if (surface.https && !flags.includes('secure')) out.push(finding(surface, 'medium', 'A07', `Cookie "${name}" missing Secure`, 'The cookie has no Secure flag, so it can be sent over plain HTTP. Add `Secure` so it is only sent over HTTPS.'));
    if (!flags.includes('httponly')) out.push(finding(surface, 'low', 'A07', `Cookie "${name}" missing HttpOnly`, 'Without HttpOnly the cookie is readable from JavaScript, widening the impact of any XSS. Add `HttpOnly` unless the client needs to read it.'));
    if (!flags.includes('samesite')) out.push(finding(surface, 'low', 'A07', `Cookie "${name}" missing SameSite`, 'No SameSite attribute, which weakens CSRF protection. Set `SameSite=Lax` or `Strict`.'));
    const lower = name.toLowerCase();
    if (lower.startsWith('__host-') && (!flags.includes('secure') || !/path=\/(;|$|\s)/.test(flags) || flags.includes('domain='))) out.push(finding(surface, 'low', 'A05', `Cookie "${name}" breaks the __Host- prefix rules`, 'A `__Host-` cookie must be Secure, have Path=/ and no Domain attribute. Fix the attributes or drop the prefix.'));
    else if (lower.startsWith('__secure-') && !flags.includes('secure')) out.push(finding(surface, 'low', 'A05', `Cookie "${name}" breaks the __Secure- prefix rules`, 'A `__Secure-` cookie must carry the Secure attribute. Add it or drop the prefix.'));
  }
  return out;
}

// A02 / A07: insecure form submission seen in the page's own HTML.
export function contentChecks(surface: Surface): ScanFinding[] {
  const out: ScanFinding[] = [];
  const forms = [...surface.body.matchAll(/<form\b[^>]*>/gi)].map((m) => m[0]);
  const insecureAction = forms.some((tag) => /action\s*=\s*["']http:\/\//i.test(tag));
  if (insecureAction) out.push(finding(surface, 'medium', 'A02', 'Form submits over plain HTTP', 'A form on the page posts to an `http://` URL, so its data is sent in clear text. Point the form action at an HTTPS URL.'));
  const hasPassword = /<input\b[^>]*type\s*=\s*["']password["']/i.test(surface.body);
  if (hasPassword && (!surface.https || insecureAction)) out.push(finding(surface, 'high', 'A07', 'Password sent without TLS', 'The page collects a password but the page or its form is not fully HTTPS, so credentials can be captured in transit. Serve the page and submit the form over HTTPS only.'));
  return out;
}

// A06 Vulnerable and Outdated Components: software and version banners.
export function disclosureChecks(surface: Surface): ScanFinding[] {
  const out: ScanFinding[] = [];
  const hasVersion = /\d/;
  const server = surface.headers.server;
  if (server && hasVersion.test(server)) out.push(finding(surface, 'info', 'A06', `Server version disclosed: ${server}`, 'The Server header reveals software and a version, which helps an attacker match known CVEs. Remove the version from the header.'));
  const powered = surface.headers['x-powered-by'];
  if (powered) out.push(finding(surface, 'info', 'A06', `Technology disclosed: ${powered}`, 'The X-Powered-By header reveals the backend technology. Remove it to reduce fingerprinting.'));
  const aspnet = surface.headers['x-aspnet-version'] ?? surface.headers['x-aspnetmvc-version'];
  if (aspnet) out.push(finding(surface, 'low', 'A06', `Framework version disclosed: ${aspnet}`, 'An ASP.NET version header is exposed, pinpointing the framework version for CVE matching. Remove `X-AspNet-Version` / `X-AspNetMvc-Version`.'));
  const generator = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*\d[^"']*)["']/i.exec(surface.body)?.[1];
  if (generator) out.push(finding(surface, 'info', 'A06', `Generator disclosed: ${generator.slice(0, 80)}`, 'A `generator` meta tag names the CMS or tool and its version. Remove it to reduce fingerprinting.'));
  return out;
}

// The only thing sent to the AI: safe, observed metadata. Never the page body or anything the user typed.
export function aiSignals(surface: Surface): Record<string, unknown> {
  return {
    url: surface.url,
    https: surface.https,
    status: surface.status,
    securityHeaders: {
      hsts: surface.headers['strict-transport-security'] ?? null,
      csp: surface.headers['content-security-policy'] ?? null,
      xFrameOptions: surface.headers['x-frame-options'] ?? null,
      xContentTypeOptions: surface.headers['x-content-type-options'] ?? null,
      referrerPolicy: surface.headers['referrer-policy'] ?? null,
      permissionsPolicy: surface.headers['permissions-policy'] ?? null,
      coop: surface.headers['cross-origin-opener-policy'] ?? null,
      corp: surface.headers['cross-origin-resource-policy'] ?? null,
    },
    cors: { allowOrigin: surface.headers['access-control-allow-origin'] ?? null, allowCredentials: surface.headers['access-control-allow-credentials'] ?? null },
    server: surface.headers.server ?? null,
    xPoweredBy: surface.headers['x-powered-by'] ?? null,
    cookieFlags: surface.cookies.map((c) => c.split(';').slice(1).map((f) => f.trim().split('=')[0]).join(', ')),
    hasPasswordInput: /<input\b[^>]*type\s*=\s*["']password["']/i.test(surface.body),
    title: surface.title,
  };
}
