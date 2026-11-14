'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '../src/jobs-api';
import type { Job, JobFields, Jobs, Match } from '../src/jobs-types';
import { useJobsSpaceId } from './useJobs';

// Runs job requests one at a time, so editing a new job can't reach the server before the job exists.
const scope = { id: 'jobs' };

export function useJobsMutations() {
  const queryClient = useQueryClient();
  const spaceId = useJobsSpaceId() as string;
  const key = ['jobs', spaceId];

  // Patches the cached space straight away, and puts it back if the request fails.
  function useChange<T>(request: (input: T) => Promise<void>, apply: (data: Jobs, input: T) => Jobs) {
    return useMutation({
      scope,
      mutationFn: request,
      onMutate: async (input: T) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<Jobs>(key);
        if (previous) queryClient.setQueryData<Jobs>(key, apply(previous, input));
        return previous;
      },
      onError: (error: Error, _input, previous) => {
        if (previous) queryClient.setQueryData(key, previous);
        toast.error(error.message);
      },
    });
  }

  const patchJob = (data: Jobs, id: string, change: (job: Job) => Job): Jobs => ({ ...data, jobs: data.jobs.map((job) => (job.id === id ? change(job) : job)) });

  const saveCv = useChange<string | null>(
    (cvText) => api.saveCv({ spaceId, cvText }),
    (data, cvText) => ({ ...data, profile: { cvText, cvUpdatedAt: new Date().toISOString() } }),
  );

  const addJob = useChange<Job>(
    (job) => api.createJob({ spaceId, job }),
    (data, job) => ({ ...data, jobs: [job, ...data.jobs.filter(({ id }) => id !== job.id)] }),
  );

  const saveJob = useChange<{ id: string; changes: Partial<JobFields> }>(api.updateJob, (data, { id, changes }) =>
    patchJob(data, id, (job) => ({ ...job, ...changes, updatedAt: new Date().toISOString() })),
  );

  const removeJob = useChange<string>(api.deleteJob, (data, id) => ({ ...data, jobs: data.jobs.filter((job) => job.id !== id) }));

  // Not optimistic: the match only exists once the AI has answered.
  const recheckMatch = useMutation({
    scope,
    mutationFn: api.matchJob,
    onSuccess: (match: Match, id: string) => {
      const data = queryClient.getQueryData<Jobs>(key);
      if (data) queryClient.setQueryData<Jobs>(key, patchJob(data, id, (job) => ({ ...job, match })));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function deleteJobWithUndo(job: Job) {
    removeJob.mutate(job.id);
    toast('Job deleted', { action: { label: 'Undo', onClick: () => addJob.mutate(job) } });
  }

  return { saveCv, addJob, saveJob, removeJob, deleteJobWithUndo, recheckMatch };
}
