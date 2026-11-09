import { cn } from '@/shared/utils/cn';
import { STATUS_ACCENTS } from './task-types';

type IconStatus = keyof typeof STATUS_ACCENTS;

const PIE_PATHS: Partial<Record<IconStatus, string>> = {
  in_progress: 'M8 8V4.5A3.5 3.5 0 0 1 11.5 8Z',
  on_hold: 'M8 8V4.5A3.5 3.5 0 1 1 4.5 8Z',
};

export function StatusIconComponent({ status }: { status: IconStatus }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={cn('size-4 shrink-0', STATUS_ACCENTS[status])}>
      {status === 'completed' ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5 8.2 2 2 4-4.4" className="stroke-background" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <circle
          cx="8"
          cy="8"
          r="6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray={status === 'todo' ? '2.55 2.55' : undefined}
        />
      )}
      {PIE_PATHS[status] && <path d={PIE_PATHS[status]} fill="currentColor" />}
    </svg>
  );
}
