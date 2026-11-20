import { Handle, type NodeProps, Position } from '@xyflow/react';
import { cn } from '@/shared/utils/cn';
import type { StageNode } from './pipeline-flow';
import { StageIconComponent } from './RunStatusComponent';

const LOOK: Record<string, string> = {
  running: 'border-status-progress/60 bg-status-progress/10',
  failed: 'border-destructive/60 bg-destructive/10',
  pending: 'border-dashed text-muted-foreground',
};

// One stage on the canvas, with the same icons as the run drawer.
export function StageNodeComponent({ data }: NodeProps<StageNode>) {
  return (
    <div role="group" aria-label={`Stage ${data.name}`} className={cn('flex size-full cursor-pointer flex-col justify-center gap-1.5 rounded-xl border bg-popover px-3 shadow-lg', LOOK[data.icon])}>
      <Handle type="target" position={Position.Left} isConnectable={false} className="!size-2 !border-0 !bg-muted-foreground" />
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <StageIconComponent status={data.icon} />
        <span className="truncate">{data.name}</span>
      </span>
      <span className={cn('text-xs text-muted-foreground', data.running && 'text-status-progress')}>{data.detail}</span>
      <Handle type="source" position={Position.Right} isConnectable={false} className="!size-2 !border-0 !bg-muted-foreground" />
    </div>
  );
}
