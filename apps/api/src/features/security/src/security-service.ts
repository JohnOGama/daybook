import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { BudgetAiService } from '../../budget/index.ts';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { securityFindings } from '../../../shared/db/schema.ts';
import { aiSignals, contentChecks, cookieChecks, corsChecks, disclosureChecks, headerChecks, readSurface, type ScanFinding, transportChecks } from './security-scan.ts';
import type { FindingChanges, FindingInput, FindingRow, ScanResult, SecurityView } from './security-types.ts';

const MAX_FINDINGS = 500;

const cvssToTenths = (score: number | null): number | null => (score === null ? null : Math.max(0, Math.min(100, Math.round(score * 10))));

type FindingRecord = typeof securityFindings.$inferSelect;
const owned = (ownerId: string, id: string) => and(eq(securityFindings.id, id), eq(securityFindings.userId, ownerId));

const toRow = (row: FindingRecord): FindingRow => ({
  id: row.id,
  title: row.title,
  target: row.target,
  severity: row.severity as FindingRow['severity'],
  status: row.status as FindingRow['status'],
  cvss: row.cvss,
  description: row.description,
  owasp: (row.owasp as FindingRow['owasp']) ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

// Plain owner-scoped CRUD: findings are entered or imported, never produced by a scan. Totals and the risk overview
// are worked out in the browser (security-math.ts), so the service only stores and checks ownership.
@Injectable()
export class SecurityService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(BudgetAiService) private readonly ai: BudgetAiService,
  ) {}

  // A passive scan: fetch the target over safe GETs, run the deterministic checks, optionally let the AI add more,
  // then store every result as an open finding. The phases mirror the real check groups so the UI can show progress.
  async scan(ownerId: string, spaceId: string, url: string): Promise<ScanResult> {
    const surface = await readSurface(url);
    const groups: { id: string; label: string; findings: ScanFinding[] }[] = [
      { id: 'recon', label: 'Reconnaissance', findings: [] },
      { id: 'transport', label: 'Transport & TLS', findings: transportChecks(surface) },
      { id: 'headers', label: 'Security headers', findings: headerChecks(surface) },
      { id: 'cors', label: 'CORS policy', findings: corsChecks(surface) },
      { id: 'cookies', label: 'Cookies & session', findings: cookieChecks(surface) },
      { id: 'content', label: 'Page content', findings: contentChecks(surface) },
      { id: 'disclosure', label: 'Information disclosure', findings: disclosureChecks(surface) },
    ];
    const aiUsed = this.ai.enabled;
    const aiFindings = (await this.ai.analyzeSurface(aiSignals(surface))).map(
      (f): ScanFinding => ({ title: f.title, target: surface.url, severity: f.severity, cvss: cvssToTenths(f.cvss) ?? 0, description: f.recommendation, owasp: f.owasp ?? 'A05' }),
    );

    const [{ existing }] = await this.db.select({ existing: count() }).from(securityFindings).where(eq(securityFindings.spaceId, spaceId));
    const room = Math.max(0, MAX_FINDINGS - existing);
    const all = [...groups.flatMap((g) => g.findings), ...aiFindings].slice(0, room);
    const inserted = all.length
      ? await this.db
          .insert(securityFindings)
          .values(all.map((f) => ({ id: crypto.randomUUID(), spaceId, userId: ownerId, title: f.title, target: f.target, severity: f.severity, status: 'open', cvss: f.cvss, description: f.description, owasp: f.owasp })))
          .returning()
      : [];

    // Per-phase counts map AI findings onto the ai phase; the rest keep their group. Only inserted findings are counted.
    const kept = new Set(inserted.map((row) => `${row.title}::${row.severity}`));
    const countKept = (list: ScanFinding[]) => list.filter((f) => kept.has(`${f.title}::${f.severity}`)).length;
    const phases = [
      ...groups.map((g) => ({ id: g.id, label: g.label, findings: countKept(g.findings), status: 'done' as const })),
      { id: 'ai', label: 'AI analysis', findings: countKept(aiFindings), status: aiUsed ? ('done' as const) : ('skipped' as const) },
      { id: 'report', label: 'Report', findings: inserted.length, status: 'done' as const },
    ];
    return { target: surface.url, phases, findings: inserted.map(toRow), aiUsed };
  }

  async load(ownerId: string, spaceId: string): Promise<SecurityView> {
    const rows = await this.db
      .select()
      .from(securityFindings)
      .where(and(eq(securityFindings.spaceId, spaceId), eq(securityFindings.userId, ownerId)))
      .orderBy(desc(securityFindings.createdAt), asc(securityFindings.id));
    return { findings: rows.map(toRow) };
  }

  async create(ownerId: string, spaceId: string, input: FindingInput): Promise<FindingRow> {
    const [{ findings }] = await this.db.select({ findings: count() }).from(securityFindings).where(eq(securityFindings.spaceId, spaceId));
    if (findings >= MAX_FINDINGS) throw new BadRequestException(`A space holds at most ${MAX_FINDINGS} findings`);
    const [row] = await this.db
      .insert(securityFindings)
      .values({ id: input.id, spaceId, userId: ownerId, title: input.title, target: input.target ?? null, severity: input.severity, status: input.status ?? 'open', cvss: input.cvss ?? null, description: input.description ?? null, owasp: input.owasp ?? null })
      .returning();
    return toRow(row);
  }

  async update(ownerId: string, id: string, changes: FindingChanges): Promise<FindingRow> {
    const [row] = await this.db
      .update(securityFindings)
      .set({ ...changes, updatedAt: new Date() })
      .where(owned(ownerId, id))
      .returning();
    if (!row) throw new NotFoundException('Finding not found');
    return toRow(row);
  }

  async remove(ownerId: string, id: string): Promise<void> {
    await this.db.delete(securityFindings).where(owned(ownerId, id));
  }
}
