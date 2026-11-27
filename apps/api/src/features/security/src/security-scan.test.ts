import { describe, expect, it } from 'vitest';
import { aiSignals, contentChecks, cookieChecks, corsChecks, disclosureChecks, headerChecks, type Surface, transportChecks } from './security-scan.ts';

const surface = (over: Partial<Surface> = {}): Surface => ({ url: 'https://app.example/', https: true, status: 200, headers: {}, cookies: [], title: 'App', body: '', ...over });
const titles = (list: { title: string }[]) => list.map((f) => f.title);

describe('security-scan checks', () => {
  it('flags plain HTTP as high and never also asks for HSTS', () => {
    const http = transportChecks(surface({ https: false, url: 'http://app.example/' }));
    expect(http).toHaveLength(1);
    expect(http[0].severity).toBe('high');
  });

  it('flags missing HSTS on HTTPS and tags it A02', () => {
    const missing = transportChecks(surface());
    expect(titles(missing)).toContain('Missing HSTS header');
    expect(missing[0].owasp).toBe('A02');
    expect(transportChecks(surface({ headers: { 'strict-transport-security': 'max-age=63072000; includeSubDomains' } }))).toHaveLength(0);
  });

  it('flags a weak HSTS policy and mixed content', () => {
    expect(titles(transportChecks(surface({ headers: { 'strict-transport-security': 'max-age=100' } })))).toContain('Weak HSTS policy');
    expect(titles(transportChecks(surface({ headers: { 'strict-transport-security': 'max-age=63072000; includeSubDomains' }, body: '<img src="http://cdn.example/a.png">' })))).toContain('Mixed content on an HTTPS page');
  });

  it('flags an over-permissive CORS policy', () => {
    expect(corsChecks(surface({ headers: { 'access-control-allow-origin': '*' } }))[0]).toMatchObject({ severity: 'medium', owasp: 'A05' });
    expect(corsChecks(surface({ headers: { 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'true' } }))[0]).toMatchObject({ severity: 'high', owasp: 'A01' });
    expect(corsChecks(surface({ headers: { 'access-control-allow-origin': 'https://trusted.example' } }))).toHaveLength(0);
  });

  it('flags a weak CSP and missing COOP/CORP', () => {
    const found = titles(headerChecks(surface({ headers: { 'content-security-policy': "default-src 'self' 'unsafe-inline'" } })));
    expect(found).toContain('Weak Content-Security-Policy');
    expect(found).toEqual(expect.arrayContaining(['No Cross-Origin-Opener-Policy', 'No Cross-Origin-Resource-Policy']));
  });

  it('flags an insecure password form from the page HTML', () => {
    const found = contentChecks(surface({ https: true, body: '<form action="http://app.example/login"><input type="password" name="p"></form>' }));
    expect(titles(found)).toEqual(expect.arrayContaining(['Form submits over plain HTTP', 'Password sent without TLS']));
    expect(found.find((f) => f.title === 'Password sent without TLS')?.severity).toBe('high');
  });

  it('flags missing CSP, clickjacking, nosniff, referrer and permissions policy', () => {
    const found = titles(headerChecks(surface()));
    expect(found).toEqual(expect.arrayContaining(['Missing Content-Security-Policy', 'No clickjacking protection', 'MIME sniffing not disabled', 'No Referrer-Policy', 'No Permissions-Policy']));
  });

  it('accepts a CSP frame-ancestors as clickjacking protection', () => {
    const found = titles(headerChecks(surface({ headers: { 'content-security-policy': "frame-ancestors 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'geolocation=()' } })));
    expect(found).not.toContain('No clickjacking protection');
    expect(found).not.toContain('Missing Content-Security-Policy');
  });

  it('flags insecure cookies by flag', () => {
    const found = titles(cookieChecks(surface({ cookies: ['sid=abc; Path=/'] })));
    expect(found).toEqual(expect.arrayContaining(['Cookie "sid" missing Secure', 'Cookie "sid" missing HttpOnly', 'Cookie "sid" missing SameSite']));
    expect(cookieChecks(surface({ cookies: ['sid=abc; Secure; HttpOnly; SameSite=Lax'] }))).toHaveLength(0);
  });

  it('flags server and tech version disclosure', () => {
    const found = titles(disclosureChecks(surface({ headers: { server: 'nginx/1.21.0', 'x-powered-by': 'Express' } })));
    expect(found.some((t) => t.startsWith('Server version disclosed'))).toBe(true);
    expect(found.some((t) => t.startsWith('Technology disclosed'))).toBe(true);
  });

  it('builds AI signals from safe metadata only (no body)', () => {
    const signals = aiSignals(surface({ cookies: ['sid=abc; Secure; HttpOnly'], headers: { server: 'nginx' } }));
    expect(signals).toMatchObject({ url: 'https://app.example/', https: true, server: 'nginx' });
    expect(signals.cookieFlags).toEqual(['Secure, HttpOnly']);
    expect(JSON.stringify(signals)).not.toContain('abc');
  });
});
