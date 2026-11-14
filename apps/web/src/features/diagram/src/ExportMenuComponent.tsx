'use client';

import { ChevronDown, Download } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

export type ExportKind = 'dbml' | 'mermaid' | 'postgres' | 'mysql' | 'mssql' | 'png' | 'svg' | 'copy';

const GROUPS: { label: string; items: { kind: ExportKind; name: string; hint: string }[] }[] = [
  {
    label: 'Diagram code',
    items: [
      { kind: 'dbml', name: 'DBML', hint: 'dbdiagram.io, dbdocs' },
      { kind: 'mermaid', name: 'Mermaid', hint: 'GitHub, Notion' },
    ],
  },
  {
    label: 'SQL CREATE TABLE',
    items: [
      { kind: 'postgres', name: 'PostgreSQL', hint: '.sql' },
      { kind: 'mysql', name: 'MySQL', hint: '.sql' },
      { kind: 'mssql', name: 'SQL Server', hint: '.sql' },
    ],
  },
  {
    label: 'Image',
    items: [
      { kind: 'png', name: 'PNG', hint: 'docs, slides' },
      { kind: 'svg', name: 'SVG', hint: 'sharp at any size' },
    ],
  },
];

export function ExportMenuComponent({ disabled, onExport }: { disabled: boolean; onExport: (kind: ExportKind) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download aria-hidden />
          Export
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {GROUPS.map(({ label, items }) => (
          <DropdownMenuGroup key={label}>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{label}</DropdownMenuLabel>
            {items.map(({ kind, name, hint }) => (
              <DropdownMenuItem key={kind} disabled={disabled} onSelect={() => onExport(kind)} className="justify-between">
                {name}
                <span className="text-xs text-muted-foreground">{hint}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </DropdownMenuGroup>
        ))}
        <DropdownMenuItem disabled={disabled} onSelect={() => onExport('copy')}>
          Copy DBML
        </DropdownMenuItem>
        {disabled && <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">Fix the problems in the code to export.</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
