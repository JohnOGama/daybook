import { BadRequestException } from '@nestjs/common';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isPublicAddress, pageText, readPostingPage } from './posting-page.ts';

const POSTING_HTML = `<!doctype html><html><head><title>Frontend Engineer</title>
<style>.x { color: red }</style>
<script>window.secret = "tracking";</script>
<script type="application/ld+json">{"@type":"JobPosting","title":"Frontend Engineer"}</script>
<script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>
</head><body><noscript>Enable JS</noscript>
<h1>Frontend   Engineer</h1><p>Build &amp; ship our dashboard.</p></body></html>`;

let server: Server;
let base: string;
const allow = { allowAddress: () => true };

beforeAll(async () => {
  server = createServer((request, response) => {
    const path = request.url ?? '/';
    if (path === '/posting') return void response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(POSTING_HTML);
    if (path === '/long') return void response.writeHead(200, { 'Content-Type': 'text/plain' }).end('a'.repeat(40_000));
    if (path === '/linkedin') return void response.writeHead(999).end();
    if (path === '/forbidden') return void response.writeHead(403, { 'Content-Type': 'text/html' }).end('<p>No</p>');
    if (path === '/walled') return void response.writeHead(302, { Location: '/uas/login?session_redirect=x' }).end();
    if (path.startsWith('/uas/login')) return void response.writeHead(200, { 'Content-Type': 'text/html' }).end('<p>Sign in</p>');
    if (path.startsWith('/hop/')) {
      const left = Number(path.split('/')[2]);
      return void response.writeHead(302, { Location: left === 0 ? '/posting' : `/hop/${left - 1}` }).end();
    }
    if (path === '/image') return void response.writeHead(200, { 'Content-Type': 'image/png' }).end('png');
    if (path === '/huge') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      const chunk = 'x'.repeat(64 * 1024);
      for (let sent = 0; sent < 3 * 1024 * 1024; sent += chunk.length) response.write(chunk);
      return void response.end();
    }
    if (path === '/silent') return; // never answers
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe('readPostingPage', () => {
  it('returns the page as plain text with the JobPosting data, and nothing from scripts or styles', async () => {
    const page = await readPostingPage(`${base}/posting`, allow);
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.text).toContain('Frontend Engineer Build & ship our dashboard.');
    expect(page.text).not.toMatch(/secret|tracking|color: red|Enable JS/);
    expect(page.jsonLd).toContain('"JobPosting"');
    expect(page.jsonLd).not.toContain('Organization');
    expect(page.url).toBe(`${base}/posting`);
  });

  it('cuts a long page to 30,000 characters', async () => {
    const page = await readPostingPage(`${base}/long`, allow);
    expect(page.ok && page.text.length).toBe(30_000);
  });

  it('reports a login wall for status 999, 403 and a redirect to a sign-in page', async () => {
    for (const path of ['/linkedin', '/forbidden', '/walled']) {
      expect(await readPostingPage(`${base}${path}`, allow)).toEqual({ ok: false, reason: 'login' });
    }
  });

  it('follows up to three redirects and gives up after that', async () => {
    expect((await readPostingPage(`${base}/hop/2`, allow)).ok).toBe(true);
    expect(await readPostingPage(`${base}/hop/3`, allow)).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('refuses anything that is not a web page, too large, or too slow', async () => {
    expect(await readPostingPage(`${base}/image`, allow)).toEqual({ ok: false, reason: 'unreadable' });
    expect(await readPostingPage(`${base}/huge`, allow)).toEqual({ ok: false, reason: 'unreadable' });
    expect(await readPostingPage(`${base}/silent`, { ...allow, timeoutMs: 200 })).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('refuses local addresses and non-web links by default', async () => {
    await expect(readPostingPage(`${base}/posting`)).rejects.toThrow(BadRequestException);
    await expect(readPostingPage('file:///etc/passwd')).rejects.toThrow(BadRequestException);
  });
});

describe('isPublicAddress', () => {
  it('refuses loopback, private, link-local and shared addresses, in IPv4 and IPv6', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a00:1', '::']) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it('allows public addresses', () => {
    expect(isPublicAddress('93.184.216.34')).toBe(true);
    expect(isPublicAddress('2606:4700::1111')).toBe(true);
  });
});

describe('pageText', () => {
  it('ignores JSON-LD that is not a job posting', () => {
    expect(pageText('<script type="application/ld+json">{"@type":"WebSite"}</script><p>Hi</p>')).toEqual({ text: 'Hi', jsonLd: null });
  });
});
