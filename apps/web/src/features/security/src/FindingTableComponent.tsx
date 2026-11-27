import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { cn } from '@/shared/utils/cn';
import { formatCvss, isOpen, OWASP_LABELS, SEVERITY_META, sortFindings, STATUS_META } from './security-math';
import type { FindingRow } from './security-types';

type FindingTableProps = { findings: FindingRow[]; canEdit: boolean; onEdit: (finding: FindingRow) => void; onDelete: (id: string) => void };

export function FindingTableComponent({ findings, canEdit, onEdit, onDelete }: FindingTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Severity</TableHead>
          <TableHead>Finding</TableHead>
          <TableHead className="hidden w-28 sm:table-cell">Status</TableHead>
          <TableHead className="w-16 text-right">CVSS</TableHead>
          {canEdit && <TableHead className="w-10" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortFindings(findings).map((finding) => {
          const open = isOpen(finding);
          return (
            <TableRow key={finding.id} className={cn(!open && 'opacity-60')}>
              <TableCell>
                <Badge className={cn('border-transparent', SEVERITY_META[finding.severity].badge)}>{SEVERITY_META[finding.severity].label}</Badge>
              </TableCell>
              <TableCell className="max-w-0 min-w-40">
                <span className="flex items-center gap-2">
                  {canEdit ? (
                    <button type="button" onClick={() => onEdit(finding)} className="truncate text-left font-semibold hover:underline">
                      {finding.title}
                    </button>
                  ) : (
                    <span className="truncate font-semibold">{finding.title}</span>
                  )}
                  {finding.owasp && (
                    <span className="shrink-0 rounded-md border px-1.5 text-[11px] font-normal text-muted-foreground" title={`OWASP ${finding.owasp}: ${OWASP_LABELS[finding.owasp]}`}>
                      {finding.owasp}
                    </span>
                  )}
                </span>
                {finding.target && <p className="truncate font-mono text-xs text-muted-foreground">{finding.target}</p>}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className={cn('size-1.5 rounded-full', STATUS_META[finding.status].dot)} aria-hidden />
                  {STATUS_META[finding.status].label}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCvss(finding.cvss)}</TableCell>
              {canEdit && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Options for ${finding.title}`}>
                        <MoreHorizontal aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(finding)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(finding.id)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
