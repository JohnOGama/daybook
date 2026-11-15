import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { followUp, moveTo, trailTo } from './jobs-math';
import { JobsPageComponent } from './JobsPageComponent';
import type { Job, JobEvent, Jobs, JobStatus, ReadPostingResult } from './jobs-types';

const { useJobs, mutations, api, toast } = vi.hoisted(() => {
  const mutation = () => ({ mutate: vi.fn(), isPending: false });
  return {
    useJobs: vi.fn(),
    mutations: { saveCv: mutation(), addJob: mutation(), saveJob: mutation(), removeJob: mutation(), recheckMatch: mutation(), deleteJobWithUndo: vi.fn() },
    api: { readPosting: vi.fn() },
    toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
  };
});

vi.mock('../hooks/useJobs', () => ({ useJobs, useJobsSpaceId: () => 's1' }));
vi.mock('../hooks/useJobsMutations', () => ({ useJobsMutations: () => mutations }));
vi.mock('./jobs-api', async (original) => ({ ...(await original<typeof import('./jobs-api')>()), ...api }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Job hunt', tool: 'jobs' }),
  useSpaceAccess: () => ({ access: 'edit', canEdit: true, isOwner: true }),
  PresenceAvatarsComponent: () => null,
  ViewOnlyBadgeComponent: () => null,
}));
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-11-14' }));

const TODAY = '2026-11-14';
const status = (value: JobStatus, day: string): JobEvent => ({ kind: 'status', status: value, day });

const job = (id: string, role: string, company: string, value: JobStatus, events: JobEvent[], extra: Partial<Job> = {}): Job => ({
  id,
  role,
  company,
  url: null,
  location: 'Remote',
  workMode: 'remote',
  salary: null,
  employmentType: null,
  postedOn: null,
  description: 'Build things.',
  notes: '',
  status: value,
  events,
  nextStepDay: null,
  nextStepNote: null,
  match: null,
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: '2026-11-01T09:00:00.000Z',
  ...extra,
});

const match = (pct: number) => ({ pct, summary: 'Strong fit on React.', skillsHave: ['React', 'TypeScript'], skillsMissing: ['GraphQL'], matchedAt: '2026-11-11T09:00:00.000Z' });

const acme = job('acme', 'Frontend Engineer', 'Acme', 'interviewing', [status('applied', '2026-11-04'), status('interviewing', '2026-11-10')], {
  url: 'https://acme.example/jobs/1',
  match: match(82),
  nextStepDay: '2026-11-19',
  nextStepNote: 'Interview 10:00',
});
const globex = job('globex', 'React Engineer', 'Globex', 'applied', [status('applied', '2026-11-03')], { match: match(71) });
const stark = job('stark', 'Full-stack Developer', 'Stark Labs', 'saved', [], { match: match(91) });
const initech = job('initech', 'UI Engineer', 'Initech', 'rejected', [status('applied', '2026-10-20'), status('rejected', '2026-11-09')]);
const hooli = job('hooli', 'Senior React Developer', 'Hooli', 'offer', [status('applied', '2026-10-25'), status('offer', '2026-11-12')]);
const wayne = job('wayne', 'Backend Engineer', 'Wayne', 'applied', [status('applied', '2026-11-12')]);
const ALL = [acme, globex, stark, initech, hooli, wayne];

const withCv: Jobs = { profile: { cvText: 'Five years of React.', cvUpdatedAt: '2026-11-01T00:00:00.000Z' }, jobs: ALL, aiEnabled: true };

const show = (data: Jobs = withCv) => {
  useJobs.mockReturnValue({ data, isPending: false, isError: false });
  render(<JobsPageComponent />);
};
const tile = (label: string) => within(screen.getByRole('region', { name: 'Overview' })).getByText(label).parentElement as HTMLElement;
const row = (company: string) => screen.getAllByRole('row').find((element) => element.textContent?.includes(company)) as HTMLElement;
const posting = { role: 'Platform Engineer', company: 'Umbrella', location: 'Remote', workMode: 'remote' as const, salary: null, employmentType: null, postedOn: null, description: 'Run our cloud.' };

async function pasteLink(url: string) {
  await userEvent.type(screen.getByRole('textbox', { name: 'Job posting link' }), url);
  await userEvent.click(screen.getByRole('button', { name: 'Add job' }));
}

beforeEach(() => vi.clearAllMocks());

it('counts jobs by status and filters by tab and search', async () => {
  show();
  expect(screen.getByRole('tab', { name: 'All 6' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Applied 2' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Not accepted 1' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Applied 2' }));
  expect(screen.getAllByRole('row')).toHaveLength(3);
  await userEvent.click(screen.getByRole('tab', { name: 'All 6' }));
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search jobs' }), 'acme');
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(row('Acme')).toBeDefined();
});

it('shows the overview tiles', () => {
  show();
  expect(within(tile('Applied this week')).getByText('1')).toBeInTheDocument();
  expect(within(tile('Waiting on a reply')).getByText('2')).toBeInTheDocument();
  expect(within(tile('Interviewing')).getByText(/Next: Acme/)).toBeInTheDocument();
  expect(within(tile('Reply rate')).getByText('60%')).toBeInTheDocument();
});

it('nudges a quiet application and moves jobs on from the row', async () => {
  show();
  expect(within(row('Globex')).getByText('11 days, no reply')).toBeInTheDocument();
  await userEvent.click(within(row('Globex')).getByRole('button', { name: 'Follow up' }));
  expect(mutations.saveJob.mutate).toHaveBeenCalledWith({ id: 'globex', changes: followUp(globex, TODAY) });
  expect(within(row('Wayne')).queryByText(/no reply/)).not.toBeInTheDocument();
  await userEvent.click(within(row('Stark Labs')).getByRole('button', { name: 'Mark applied' }));
  expect(mutations.saveJob.mutate).toHaveBeenCalledWith({ id: 'stark', changes: moveTo(stark, 'applied', TODAY) });
  expect(within(row('Acme')).getByText('82%')).toBeInTheDocument();
});

it('hides the link box and the match column when AI is off', () => {
  show({ ...withCv, aiEnabled: false });
  expect(screen.queryByRole('textbox', { name: 'Job posting link' })).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: /Match/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add manually' })).toBeInTheDocument();
});

it('reads a pasted link, adds the job as Saved and checks the match', async () => {
  let resolve: (result: ReadPostingResult) => void = () => {};
  api.readPosting.mockReturnValue(new Promise<ReadPostingResult>((done) => (resolve = done)));
  show();
  await pasteLink('https://umbrella.example/jobs/9');
  expect(screen.getByText('Reading the posting…')).toBeInTheDocument();
  expect(api.readPosting).toHaveBeenCalledWith({ spaceId: 's1', url: 'https://umbrella.example/jobs/9' });
  resolve({ ok: true, posting });
  await vi.waitFor(() => expect(mutations.addJob.mutate).toHaveBeenCalled());
  const added = mutations.addJob.mutate.mock.calls[0][0] as Job;
  expect(added).toMatchObject({ ...posting, url: 'https://umbrella.example/jobs/9', status: 'saved', events: [], match: null, notes: '' });
  expect(mutations.recheckMatch.mutate).toHaveBeenCalledWith(added.id);
  expect(screen.queryByText('Reading the posting…')).not.toBeInTheDocument();
});

it('does not ask for a match without a CV', async () => {
  api.readPosting.mockResolvedValue({ ok: true, posting });
  show({ ...withCv, profile: { cvText: null, cvUpdatedAt: null } });
  await pasteLink('https://umbrella.example/jobs/9');
  await vi.waitFor(() => expect(mutations.addJob.mutate).toHaveBeenCalled());
  expect(mutations.recheckMatch.mutate).not.toHaveBeenCalled();
});

it('falls back to the form when a site needs a login', async () => {
  api.readPosting.mockResolvedValue({ ok: false, reason: 'login' });
  show();
  await pasteLink('https://www.linkedin.com/jobs/view/1');
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByText('This site needs a login to view the posting. Paste the job description instead.')).toBeInTheDocument();
  expect(dialog.getByLabelText('Link')).toHaveValue('https://www.linkedin.com/jobs/view/1');
  expect(screen.queryByText('Reading the posting…')).not.toBeInTheDocument();
  expect(mutations.addJob.mutate).not.toHaveBeenCalled();
});

it('does not add the same posting twice', async () => {
  show();
  await pasteLink('https://ACME.example/jobs/1/?utm_source=li');
  expect(api.readPosting).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith('Already added: Frontend Engineer at Acme');
});

it('adds a job by hand with the trail up to the chosen status', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: 'Add manually' }));
  const dialog = within(await screen.findByRole('dialog'));
  const add = dialog.getByRole('button', { name: 'Add job' });
  expect(add).toBeDisabled();
  await userEvent.type(dialog.getByLabelText('Role'), 'Data Analyst');
  await userEvent.type(dialog.getByLabelText('Company'), 'Wonka');
  await userEvent.click(dialog.getByRole('radio', { name: 'Interviewing' }));
  fireEvent.change(dialog.getByLabelText('Date'), { target: { value: '2026-11-12' } });
  await userEvent.click(add);
  expect(mutations.addJob.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ role: 'Data Analyst', company: 'Wonka', status: 'interviewing', events: trailTo('interviewing', '2026-11-12'), match: null }),
  );
});

it('saves the CV from its dialog', async () => {
  show({ ...withCv, profile: { cvText: null, cvUpdatedAt: null } });
  expect(row('Wayne')).toHaveTextContent('Add your CV');
  expect(row('Stark Labs')).toHaveTextContent('91%');
  await userEvent.click(screen.getByRole('button', { name: 'Add your CV' }));
  const dialog = within(await screen.findByRole('dialog'));
  await userEvent.type(dialog.getByLabelText('Your CV'), 'Five years of React.');
  await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
  expect(mutations.saveCv.mutate).toHaveBeenCalledWith('Five years of React.');
});

it('labels the CV button once a CV is saved', () => {
  show();
  expect(screen.getByRole('button', { name: 'Your CV' })).toBeInTheDocument();
});

it('shows an empty job hunt without broken numbers', () => {
  show({ profile: { cvText: null, cvUpdatedAt: null }, jobs: [], aiEnabled: true });
  expect(screen.getByText('No jobs yet. Paste a link above or add one by hand.')).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/NaN|Infinity|undefined/);
});

const panel = () => within(screen.getByRole('dialog'));
const open = async (role: string) => userEvent.click(screen.getByRole('button', { name: role }));

it('opens a job in the side panel with a link to the posting', async () => {
  show();
  await open('Frontend Engineer');
  expect(panel().getByRole('heading', { name: 'Frontend Engineer' })).toBeInTheDocument();
  const link = panel().getByRole('link', { name: /Open posting/ });
  expect(link).toHaveAttribute('href', 'https://acme.example/jobs/1');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noreferrer');
});

it('selects the existing job when its link is pasted again', async () => {
  show();
  await pasteLink('https://acme.example/jobs/1');
  expect(panel().getByRole('heading', { name: 'Frontend Engineer' })).toBeInTheDocument();
});

it('moves a job through its statuses, on the chosen day', async () => {
  show();
  await open('Frontend Engineer');
  await userEvent.click(panel().getByRole('radio', { name: 'Offer' }));
  expect(mutations.saveJob.mutate).toHaveBeenLastCalledWith({ id: 'acme', changes: moveTo(acme, 'offer', TODAY) });
  const date = panel().getByLabelText('Status date');
  expect(date).toHaveAttribute('max', TODAY);
  fireEvent.change(date, { target: { value: '2026-11-10' } });
  await userEvent.click(panel().getByRole('button', { name: 'Not accepted' }));
  expect(mutations.saveJob.mutate).toHaveBeenLastCalledWith({ id: 'acme', changes: moveTo(acme, 'rejected', '2026-11-10') });
});

it('asks for the next step when moving to Interviewing', async () => {
  show();
  await open('React Engineer');
  await userEvent.click(panel().getByRole('radio', { name: 'Interviewing' }));
  expect(mutations.saveJob.mutate).not.toHaveBeenCalled();
  fireEvent.change(panel().getByLabelText('Next step date'), { target: { value: '2026-11-19' } });
  await userEvent.type(panel().getByLabelText('Next step note'), 'Interview 10:00');
  await userEvent.click(panel().getByRole('button', { name: 'Save' }));
  expect(mutations.saveJob.mutate).toHaveBeenCalledWith({
    id: 'globex',
    changes: { ...moveTo(globex, 'interviewing', TODAY), nextStepDay: '2026-11-19', nextStepNote: 'Interview 10:00' },
  });
});

it('lists the history newest first, ending with the day it was added', async () => {
  show();
  await open('Frontend Engineer');
  const items = within(panel().getByRole('list', { name: 'History' })).getAllByRole('listitem');
  expect(items.map((item) => item.textContent)).toEqual([expect.stringContaining('Interviewing'), expect.stringContaining('Applied'), expect.stringContaining('Added')]);
});

it('shows the match as an AI estimate and rechecks it on request', async () => {
  show({ ...withCv, profile: { cvText: 'cv', cvUpdatedAt: '2026-11-12T00:00:00.000Z' } });
  await open('Frontend Engineer');
  expect(panel().getByText('82%')).toBeInTheDocument();
  expect(panel().getByText('Strong fit on React.')).toBeInTheDocument();
  expect(panel().getByText('AI estimate')).toBeInTheDocument();
  expect(within(panel().getByRole('list', { name: 'Skills you have' })).getByText('React')).toBeInTheDocument();
  expect(within(panel().getByRole('list', { name: 'Skills to show' })).getByText('GraphQL')).toBeInTheDocument();
  expect(panel().getByText('CV changed since this match')).toBeInTheDocument();
  await userEvent.click(panel().getByRole('button', { name: 'Recheck' }));
  expect(mutations.recheckMatch.mutate).toHaveBeenCalledWith('acme');
});

it('explains why there is no match instead of offering one', async () => {
  show({ ...withCv, jobs: [{ ...wayne, description: '' }, stark] });
  await open('Backend Engineer');
  expect(panel().getByText('Add a job description to see how well it matches.')).toBeInTheDocument();
  expect(panel().queryByRole('button', { name: 'Recheck' })).not.toBeInTheDocument();
});

it('offers to add a CV in the match card, and has no match card with AI off', async () => {
  show({ ...withCv, profile: { cvText: null, cvUpdatedAt: null } });
  await open('Backend Engineer');
  expect(panel().getByRole('button', { name: 'Add your CV' })).toBeInTheDocument();
  vi.clearAllMocks();
  cleanup();
  show({ ...withCv, aiEnabled: false });
  await open('Frontend Engineer');
  expect(panel().queryByText('AI estimate')).not.toBeInTheDocument();
});

it('saves an edited detail when leaving the field', async () => {
  show();
  await open('Frontend Engineer');
  await userEvent.type(panel().getByLabelText('Salary'), '$150k');
  await userEvent.tab();
  expect(mutations.saveJob.mutate).toHaveBeenCalledWith({ id: 'acme', changes: { salary: '$150k' } });
});

it('autosaves notes once typing stops', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  show();
  await user.click(screen.getByRole('button', { name: 'Frontend Engineer' }));
  await user.type(panel().getByLabelText('Notes'), 'Ask about team');
  expect(mutations.saveJob.mutate).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(800);
  expect(mutations.saveJob.mutate).toHaveBeenCalledTimes(1);
  expect(mutations.saveJob.mutate).toHaveBeenCalledWith({ id: 'acme', changes: { notes: 'Ask about team' } });
  vi.useRealTimers();
});

it('shows CV tailoring as coming next, and deletes with Undo', async () => {
  show();
  await open('Frontend Engineer');
  expect(panel().getByRole('button', { name: /Tailor/ })).toBeDisabled();
  expect(panel().getByText('Coming next')).toBeInTheDocument();
  await userEvent.click(panel().getByRole('button', { name: 'Job actions' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
  expect(mutations.deleteJobWithUndo).toHaveBeenCalledWith(acme);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('closes the panel with Escape, but not while its menu is open', async () => {
  show();
  await open('Frontend Engineer');
  await userEvent.click(panel().getByRole('button', { name: 'Job actions' }));
  await screen.findByRole('menu');
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await vi.waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
