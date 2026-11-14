'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { importSchema } from './dbml-model';
import type { Dialect, Problem } from './diagram-types';

type Format = 'dbml' | Dialect;
const FORMATS: { value: Format; label: string }[] = [
  { value: 'dbml', label: 'DBML' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mssql', label: 'SQL Server' },
];

type ImportDialogProps = { open: boolean; replacing: boolean; onClose: () => void; onImport: (dbml: string) => void };

export function ImportDialogComponent({ open, replacing, onClose, onImport }: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl">{open && <ImportForm replacing={replacing} onImport={onImport} />}</DialogContent>
    </Dialog>
  );
}

function ImportForm({ replacing, onImport }: { replacing: boolean; onImport: (dbml: string) => void }) {
  const [format, setFormat] = useState<Format>('postgres');
  const [text, setText] = useState('');
  const [problems, setProblems] = useState<Problem[]>([]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = importSchema(text, format);
    if (result.ok) onImport(result.dbml);
    else setProblems(result.problems);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Import a schema</DialogTitle>
        <DialogDescription>
          Paste DBML, or the CREATE TABLE statements from your database.{replacing ? ' This replaces the current diagram; you can undo it afterwards.' : ''}
        </DialogDescription>
      </DialogHeader>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Format"
        value={format}
        onValueChange={(next) => next && setFormat(next as Format)}
        className="flex-wrap"
      >
        {FORMATS.map(({ value, label }) => (
          <ToggleGroupItem key={value} value={value} className="px-3 text-xs">
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="schema-import" className="sr-only">
          Schema to import
        </Label>
        <Textarea
          id="schema-import"
          value={text}
          rows={14}
          spellCheck={false}
          placeholder={format === 'dbml' ? 'Table users {\n  id int [pk]\n}' : 'CREATE TABLE users (\n  id serial PRIMARY KEY\n);'}
          className="max-h-[50dvh] font-mono text-xs"
          onChange={(event) => {
            setText(event.target.value);
            setProblems([]);
          }}
        />
        {problems.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1 text-xs text-destructive">
            {problems.slice(0, 5).map(({ line, message }, index) => (
              <li key={index}>
                Line {line}: {message}
              </li>
            ))}
          </ul>
        )}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={!text.trim()}>
          Import
        </Button>
      </DialogFooter>
    </form>
  );
}
