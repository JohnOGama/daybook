import type { FindingRow, SecurityView } from './security-types';

const finding = (id: string, title: string, severity: FindingRow['severity'], status: FindingRow['status'], cvss: number | null, target: string, owasp: FindingRow['owasp']): FindingRow => ({
  id,
  title,
  target,
  severity,
  status,
  cvss,
  description: null,
  owasp,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

// Shapes for the loading skeleton; never shown as real data.
export const SAMPLE_SECURITY: SecurityView = {
  findings: [
    finding('sample-1', 'SQL injection in login form', 'critical', 'open', 98, 'https://app.example/login', 'A03'),
    finding('sample-2', 'Reflected XSS on search', 'high', 'triaged', 73, 'https://app.example/search', 'A03'),
    finding('sample-3', 'Missing Content-Security-Policy', 'medium', 'open', 51, 'app.example', 'A05'),
    finding('sample-4', 'Server version disclosed', 'low', 'fixed', 32, 'api.example', 'A06'),
  ],
};
