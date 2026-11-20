import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkSite, checkWithRetry, isPublicUrl } from './check-site.ts';

let server: Server;
let base: string;
let flakyCalls = 0;
const allow = { allowAddress: () => true };

beforeAll(async () => {
  server = createServer((request, response) => {
    const path = request.url ?? '/';
    if (path === '/ok') return void response.writeHead(200, { 'Content-Type': 'text/html' }).end('<p>ok</p>');
    if (path.startsWith('/hop/')) {
      const left = Number(path.split('/')[2]);
      return void response.writeHead(302, { Location: left === 0 ? '/ok' : `/hop/${left - 1}` }).end();
    }
    if (path === '/slow') return void setTimeout(() => response.writeHead(200).end('late'), 120);
    if (path === '/fail') return void response.writeHead(503).end();
    if (path === '/missing') return void response.writeHead(404).end();
    if (path === '/to-private') return void response.writeHead(302, { Location: `${base}/ok` }).end();
    if (path === '/flaky') return void response.writeHead(flakyCalls++ === 0 ? 503 : 200).end();
    if (path === '/endless') {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      const timer = setInterval(() => response.write('x'.repeat(1024)), 5);
      return void response.on('close', () => clearInterval(timer));
    }
    if (path === '/silent') return; // never answers
    response.writeHead(500).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe('checkSite', () => {
  it('is up on 200 and measures the time', async () => {
    expect(await checkSite(`${base}/ok`, allow)).toMatchObject({ status: 'up', httpStatus: 200, error: null, responseMs: expect.any(Number) });
  });

  it('follows redirects to the final answer, and counts a 3xx left after three hops as an answer', async () => {
    expect(await checkSite(`${base}/hop/2`, allow)).toMatchObject({ status: 'up', httpStatus: 200 });
    expect(await checkSite(`${base}/hop/9`, allow)).toMatchObject({ status: 'up', httpStatus: 302 });
  });

  it('is slow when it answers after slowMs', async () => {
    expect(await checkSite(`${base}/slow`, { ...allow, slowMs: 50 })).toMatchObject({ status: 'slow', httpStatus: 200 });
  });

  it.each([
    ['/fail', { status: 'down', httpStatus: 503, responseMs: null, error: '503 Service Unavailable' }],
    ['/missing', { status: 'down', httpStatus: 404, responseMs: null, error: '404 Not Found' }],
  ])('is down on %s', async (path, expected) => {
    expect(await checkSite(`${base}${path}`, allow)).toEqual(expected);
  });

  it('is down after the timeout', async () => {
    expect(await checkSite(`${base}/silent`, { ...allow, timeoutMs: 100 })).toEqual({ status: 'down', responseMs: null, httpStatus: null, error: 'Timed out after 0.1 s' });
  });

  it('never reads the body, so an endless body is still up', async () => {
    expect(await checkSite(`${base}/endless`, { ...allow, timeoutMs: 500 })).toMatchObject({ status: 'up', httpStatus: 200 });
  });

  it('is down with a plain reason when nothing answers', async () => {
    expect((await checkSite('http://127.0.0.1:1/', allow)).error).toBe('Connection refused');
    expect((await checkSite('http://does-not-exist.invalid/', allow)).error).toBe('Address not found');
  });

  it('refuses private addresses, also behind a redirect', async () => {
    expect(await checkSite(`${base}/ok`)).toEqual({ status: 'down', responseMs: null, httpStatus: null, error: 'Not a public address' });
    let calls = 0;
    const onlyFirstHop = { allowAddress: () => calls++ === 0 };
    expect(await checkSite(`${base}/to-private`, onlyFirstHop)).toMatchObject({ status: 'down', error: 'Not a public address' });
  });
});

describe('checkWithRetry', () => {
  it('retries a down result once and keeps the second answer', async () => {
    expect(await checkWithRetry(`${base}/flaky`, { ...allow, retryDelayMs: 10 })).toMatchObject({ status: 'up', httpStatus: 200 });
    expect(await checkWithRetry(`${base}/fail`, { ...allow, retryDelayMs: 10 })).toMatchObject({ status: 'down', httpStatus: 503 });
  });
});

describe('isPublicUrl', () => {
  it('accepts only public http(s) URLs', async () => {
    expect(await isPublicUrl('ftp://example.com')).toBe(false);
    expect(await isPublicUrl('not a url')).toBe(false);
    expect(await isPublicUrl('http://127.0.0.1/')).toBe(false);
    expect(await isPublicUrl(`https://example.com/${'a'.repeat(2000)}`)).toBe(false);
    expect(await isPublicUrl('http://does-not-exist.invalid/', () => true)).toBe(false);
    expect(await isPublicUrl('http://localhost:4000/', () => true)).toBe(true);
  });
});
