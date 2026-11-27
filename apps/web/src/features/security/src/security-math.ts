import type { FindingRow, FindingStatus, Owasp, Severity } from './security-types';

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
export const STATUSES: FindingStatus[] = ['open', 'triaged', 'fixed', 'accepted'];
export const OWASP_CODES: Owasp[] = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10'];

// OWASP Top 10 (2021) category names.
export const OWASP_LABELS: Record<Owasp, string> = {
  A01: 'Broken Access Control',
  A02: 'Cryptographic Failures',
  A03: 'Injection',
  A04: 'Insecure Design',
  A05: 'Security Misconfiguration',
  A06: 'Vulnerable & Outdated Components',
  A07: 'Identification & Authentication Failures',
  A08: 'Software & Data Integrity Failures',
  A09: 'Security Logging & Monitoring Failures',
  A10: 'Server-Side Request Forgery (SSRF)',
};

// A finding still counts against the risk overview until it is fixed or formally accepted.
const OPEN = new Set<FindingStatus>(['open', 'triaged']);
export const isOpen = (finding: Pick<FindingRow, 'status'>): boolean => OPEN.has(finding.status);

const SEVERITY_RANK: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

export const SEVERITY_META: Record<Severity, { label: string; badge: string }> = {
  critical: { label: 'Critical', badge: 'bg-destructive text-white' },
  high: { label: 'High', badge: 'bg-destructive/10 text-destructive' },
  medium: { label: 'Medium', badge: 'bg-signal/15 text-signal' },
  low: { label: 'Low', badge: 'bg-status-progress/10 text-status-progress' },
  info: { label: 'Info', badge: 'bg-muted text-muted-foreground' },
};

export const STATUS_META: Record<FindingStatus, { label: string; dot: string }> = {
  open: { label: 'Open', dot: 'bg-destructive' },
  triaged: { label: 'Triaged', dot: 'bg-signal' },
  fixed: { label: 'Fixed', dot: 'bg-status-done' },
  accepted: { label: 'Accepted', dot: 'bg-muted-foreground' },
};

export type RiskOverview = { open: number; bySeverity: Record<Severity, number>; worst: Severity | null };

// Counts open findings (open + triaged) by severity, and the worst open severity for the headline.
export function riskOverview(findings: FindingRow[]): RiskOverview {
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  let open = 0;
  let worst: Severity | null = null;
  for (const finding of findings) {
    if (!isOpen(finding)) continue;
    open += 1;
    bySeverity[finding.severity] += 1;
    if (!worst || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[worst]) worst = finding.severity;
  }
  return { open, bySeverity, worst };
}

// Sorts open first, then by severity, then newest; a stable view for the table.
export function sortFindings(findings: FindingRow[]): FindingRow[] {
  return [...findings].sort((a, b) => {
    if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
    if (a.severity !== b.severity) return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    return b.createdAt.localeCompare(a.createdAt);
  });
}

// CVSS is stored in tenths; show one decimal. Input (0.0–10.0) rounds back to tenths.
export const formatCvss = (cvss: number | null): string => (cvss === null ? '—' : (cvss / 10).toFixed(1));
export const cvssToTenths = (score: number): number => Math.max(0, Math.min(100, Math.round(score * 10)));
