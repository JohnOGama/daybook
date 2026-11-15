import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { JobsPageComponent } from './JobsPageComponent';
import type { Job, Jobs } from './jobs-types';

const { useJobs, mutations } = vi.hoisted(() => {
  const mutation = () => ({ mutate: vi.fn(), isPending: false });
  return {
    useJobs: vi.fn(),
    mutations: { saveCv: mutation(), addJob: mutation(), saveJob: mutation(), removeJob: mutation(), recheckMatch: mutation(), deleteJobWithUndo: vi.fn() },
  };
});

vi.mock('../hooks/useJobs', () => ({ useJobs, useJobsSpaceId: () => 's1' }));
vi.mock('../hooks/useJobsMutations', () => ({ useJobsMutations: () => mutations }));
vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Job hunt', tool: 'jobs' }),
  useSpaceAccess: () => ({ access: 'view', canEdit: false, isOwner: false }),
  PresenceAvatarsComponent: () => null,
  ViewOnlyBadgeComponent: () => <span>View only</span>,
}));
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-11-14' }));

const waiting: Job = {
  id: 'wait',
  role: 'Frontend Engineer',
  company: 'Acme',
  url: null,
  location: 'Remote',
  workMode: 'remote',
  salary: null,
  employmentType: null,
  postedOn: null,
  description: 'Build things.',
  notes: 'Ask about the team',
  status: 'applied',
  events: [{ kind: 'status', status: 'applied', day: '2026-11-01' }],
  nextStepDay: null,
  nextStepNote: null,
  match: { pct: 80, summary: 'Good fit.', skillsHave: ['React'], skillsMissing: [], matchedAt: '2026-11-11T09:00:00.000Z' },
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: '2026-11-01T09:00:00.000Z',
};
const saved: Job = { ...waiting, id: 'new', role: 'Backend Engineer', company: 'Globex', status: 'saved', events: [] };
const data: Jobs = { profile: { cvText: 'Five years of React.', cvUpdatedAt: '2026-11-01T00:00:00.000Z' }, jobs: [waiting, saved], aiEnabled: true };

beforeEach(() => vi.clearAllMocks());

it('shows a viewer the jobs and details but nothing to add, edit, tick or delete', async () => {
  useJobs.mockReturnValue({ data, isPending: false, isError: false });
  render(<JobsPageComponent />);
  expect(screen.getByText('View only')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Frontend Engineer' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Job posting link' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^(add|your cv|mark applied|follow up)/i })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Frontend Engineer' }));
  expect(await screen.findByText('Ask about the team')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^(job actions|recheck|check match|save|skip|not accepted)/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(mutations.saveJob.mutate).not.toHaveBeenCalled();
});
