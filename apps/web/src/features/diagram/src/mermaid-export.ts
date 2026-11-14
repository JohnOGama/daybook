import type { DiagramModel, RefKind } from './diagram-types';

const MARKS: Record<RefKind, string> = { manyToOne: '}o--||', oneToMany: '||--o{', oneToOne: '||--||', manyToMany: '}o--o{' };

// Mermaid names are letters, digits and underscores: `public.users` becomes `public_users`, `varchar(255)` becomes `varchar_255`.
const safe = (name: string) => name.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'unnamed';

// An `erDiagram` block that GitHub, GitLab and Notion draw.
export function toMermaid({ tables, refs }: DiagramModel): string {
  const referring = new Set(refs.map(({ from }) => `${from.table}\u0000${from.column}`));
  const entities = tables.map(({ name, columns }) => {
    const rows = columns.map((column) => {
      const keys = [column.pk && 'PK', referring.has(`${name}\u0000${column.name}`) && 'FK', column.unique && !column.pk && 'UK'].filter(Boolean).join(', ');
      return `    ${safe(column.type)} ${safe(column.name)}${keys ? ` ${keys}` : ''}`;
    });
    return [`  ${safe(name)} {`, ...rows, '  }'].join('\n');
  });
  const links = refs.map(({ from, to, kind }) => `  ${safe(from.table)} ${MARKS[kind]} ${safe(to.table)} : "${from.column.replace(/"/g, "'")}"`);
  return ['erDiagram', ...entities, ...links].join('\n') + '\n';
}
