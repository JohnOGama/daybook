import { Handle, type NodeProps, Position } from '@xyflow/react';
import { ExternalLink } from 'lucide-react';
import type { JobNode } from './pipeline-flow';
import { STATUS_LABELS } from './pipelines-types';
import { RunStatusComponent } from './RunStatusComponent';

// A job on the canvas: its newest run's status, where it came from, and the last message a stage sent.
export function JobNodeComponent({ data }: NodeProps<JobNode>) {
  return (
    <section aria-label={`${data.job}, ${STATUS_LABELS[data.status].toLowerCase()}`} className="flex size-full cursor-pointer flex-col gap-1.5 overflow-hidden rounded-2xl border bg-card p-3 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-base font-semibold">{data.job}</h2>
        <RunStatusComponent status={data.status} />
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {data.meta}
        {data.aborted && ' · Aborted'}
      </p>
      {data.link && (
        <a
          href={data.link}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="nodrag inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Open in Jenkins
          <ExternalLink className="size-3" aria-hidden />
        </a>
      )}
      {data.message && (
        <p className="line-clamp-2 text-[13px] break-words">
          <span className="text-muted-foreground">{data.message.stage} says </span>
          {data.message.text}
        </p>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} className="!size-2 !border-0 !bg-muted-foreground" />
    </section>
  );
}
