'use client';

import { Link2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useJobsSpaceId } from '../hooks/useJobs';
import { useJobsMutations } from '../hooks/useJobsMutations';
import { readPosting } from './jobs-api';
import { newJob, normalizeLink } from './jobs-math';
import type { Job } from './jobs-types';
import type { JobFormInitial } from './JobFormDialogComponent';

type AddFromLinkProps = {
  jobs: Job[];
  hasCv: boolean;
  onPending: (url: string | null) => void;
  onDuplicate: (job: Job) => void;
  onFallback: (initial: JobFormInitial) => void;
};

// Paste a posting's link: the AI reads it, and the job is only stored once its details are known.
export function AddFromLinkComponent({ jobs, hasCv, onPending, onDuplicate, onFallback }: AddFromLinkProps) {
  const spaceId = useJobsSpaceId() as string;
  const { addJob, recheckMatch } = useJobsMutations();
  const [link, setLink] = useState('');
  const [reading, setReading] = useState(false);
  const url = link.trim();
  const valid = /^https?:\/\/\S+\.\S+/i.test(url);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid || reading) return;
    const existing = jobs.find((job) => job.url && normalizeLink(job.url) === normalizeLink(url));
    if (existing) {
      toast(`Already added: ${existing.role} at ${existing.company}`);
      onDuplicate(existing);
      setLink('');
      return;
    }
    setReading(true);
    onPending(url);
    try {
      const result = await readPosting({ spaceId, url });
      if (result.ok) {
        const job = newJob({ ...result.posting, url });
        addJob.mutate(job);
        if (hasCv && job.description.trim()) recheckMatch.mutate(job.id);
      } else {
        onFallback({ url, reason: result.reason });
      }
      setLink('');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setReading(false);
      onPending(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Job posting link"
            type="url"
            inputMode="url"
            placeholder="Paste a job posting link"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={!valid || reading}>
          Add job
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">The AI fills in the role, company, salary and how well you match.</p>
    </form>
  );
}
