import { describe, expect, it } from 'vitest';
import { cvssToTenths, formatCvss, riskOverview, sortFindings } from './security-math';
import type { FindingRow, FindingStatus, Severity } from './security-types';

const make = (id: string, severity: Severity, status: FindingStatus, createdAt = '2026-01-01T00:00:00.000Z'): FindingRow => ({
  id,
  title: id,
  target: null,
  severity,
  status,
  cvss: null,
  description: null,
  owasp: null,
  createdAt,
  updatedAt: createdAt,
});

describe('security-math', () => {
  it('counts only open findings (open + triaged) by severity and reports the worst', () => {
    const over = riskOverview([make('a', 'critical', 'open'), make('b', 'high', 'triaged'), make('c', 'critical', 'fixed'), make('d', 'low', 'accepted')]);
    expect(over.open).toBe(2);
    expect(over.bySeverity.critical).toBe(1);
    expect(over.bySeverity.high).toBe(1);
    expect(over.worst).toBe('critical');
  });

  it('sorts open before closed, then by severity, then newest', () => {
    const sorted = sortFindings([make('fixed-crit', 'critical', 'fixed'), make('open-low', 'low', 'open'), make('open-crit-old', 'critical', 'open', '2026-01-01T00:00:00.000Z'), make('open-crit-new', 'critical', 'open', '2026-02-01T00:00:00.000Z')]);
    expect(sorted.map((f) => f.id)).toEqual(['open-crit-new', 'open-crit-old', 'open-low', 'fixed-crit']);
  });

  it('formats CVSS from tenths and rounds input back to tenths', () => {
    expect(formatCvss(98)).toBe('9.8');
    expect(formatCvss(null)).toBe('—');
    expect(cvssToTenths(7.35)).toBe(74);
    expect(cvssToTenths(99)).toBe(100);
  });
});
