import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { ArrowUpRight, Diamond, KeyRound } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/shared/utils/cn';
import { HEADER_HEIGHT, ROW_HEIGHT, TABLE_WIDTH } from './diagram-layout';
import type { ColumnRef, Table } from './diagram-types';

export type TableNodeData = { table: Table; fresh: boolean; pointsTo: Record<string, ColumnRef> };
export type TableNode = Node<TableNodeData, 'table'>;

// Every column has a source and a target handle on each side; an edge picks the sides facing the other table.
export const handleId = (kind: 's' | 't', side: 'l' | 'r', column: string) => `${kind}-${side}-${column}`;

const hidden = '!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent';

function ColumnIcon({ pk, unique, target }: { pk: boolean; unique: boolean; target: ColumnRef | undefined }) {
  if (pk) return <KeyRound aria-label="Primary key" className="size-3 text-signal" />;
  if (target) return <ArrowUpRight aria-label={`Points to ${target.table}.${target.column}`} className="size-3 text-muted-foreground" />;
  if (unique) return <Diamond aria-label="Unique" className="size-3 text-muted-foreground" />;
  return <span aria-hidden className="size-3" />;
}

function TableNode({ data: { table, fresh, pointsTo }, selected }: NodeProps<TableNode>) {
  return (
    <div
      role="group"
      aria-label={`Table ${table.name}`}
      style={{ width: TABLE_WIDTH }}
      className={cn(
        'overflow-hidden rounded-lg border bg-card text-card-foreground dark:shadow-lg dark:shadow-black/50',
        fresh && 'border-signal ring-3 ring-signal/15',
        selected && 'border-foreground',
      )}
    >
      <div style={{ height: HEADER_HEIGHT }} className="flex items-center justify-between gap-2 border-b bg-secondary px-2.5 text-[13px] font-semibold">
        <span className="truncate">{table.name}</span>
        {fresh && <span className="rounded bg-signal px-1 text-[10px] font-semibold text-black">NEW</span>}
      </div>
      {table.columns.map((column, index) => {
        const top = HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2;
        return (
          <div key={column.name} style={{ height: ROW_HEIGHT }} className="flex items-center gap-1.5 border-t border-border/40 px-2.5 text-xs first-of-type:border-t-0">
            <ColumnIcon pk={column.pk} unique={column.unique} target={pointsTo[column.name]} />
            <span className="min-w-0 flex-1 truncate">{column.name}</span>
            <span className="truncate font-mono text-[11px] text-muted-foreground">{column.type}</span>
            {(['l', 'r'] as const).map((side) => (
              <span key={side}>
                <Handle id={handleId('s', side, column.name)} type="source" position={side === 'l' ? Position.Left : Position.Right} isConnectable={false} style={{ top }} className={hidden} />
                <Handle id={handleId('t', side, column.name)} type="target" position={side === 'l' ? Position.Left : Position.Right} isConnectable={false} style={{ top }} className={hidden} />
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export const TableNodeComponent = memo(TableNode);
