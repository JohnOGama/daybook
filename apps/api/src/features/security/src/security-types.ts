export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'open' | 'triaged' | 'fixed' | 'accepted';
// OWASP Top 10 (2021) category code, A01–A10; null when not classified.
export type Owasp = 'A01' | 'A02' | 'A03' | 'A04' | 'A05' | 'A06' | 'A07' | 'A08' | 'A09' | 'A10';

export type FindingRow = {
  id: string;
  title: string;
  target: string | null;
  severity: Severity;
  status: FindingStatus;
  // Base CVSS score in tenths (0–100, i.e. score×10); null when none is set.
  cvss: number | null;
  description: string | null;
  owasp: Owasp | null;
  createdAt: string;
  updatedAt: string;
};

export type SecurityView = { findings: FindingRow[] };

export type ScanPhase = { id: string; label: string; findings: number; status: 'done' | 'skipped' };
export type ScanResult = { target: string; phases: ScanPhase[]; findings: FindingRow[]; aiUsed: boolean };

export type FindingInput = { id: string; title: string; target?: string | null; severity: Severity; status?: FindingStatus; cvss?: number | null; description?: string | null; owasp?: Owasp | null };
export type FindingChanges = Partial<Omit<FindingInput, 'id'>>;
