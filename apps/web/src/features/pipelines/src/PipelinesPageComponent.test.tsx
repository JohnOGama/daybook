import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PipelineRun, PipelinesView } from './pipelines-types';
import { PipelinesPageComponent } from './PipelinesPageComponent';

const { usePipelines, usePipelineRun, access } = vi.hoisted(() => ({
  usePipelines: vi.fn(),
  usePipelineRun: vi.fn(),
  access: { value: { access: 'owner', canEdit: true, isOwner: true } },
}));

vi.mock('../hooks/usePipelines', () => ({ usePipelines, usePipelinesSpaceId: () => 's1' }));
vi.mock('../hooks/usePipelineRun', () => ({ usePipelineRun }));
vi.mock('./ConnectJenkinsDialogComponent', () => ({ ConnectJenkinsDialogComponent: () => null }));
vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Backend', tool: 'pipelines' }),
  useSpaceAccess: () => access.value,
  PresenceAvatarsComponent: () => null,
  ViewOnlyBadgeComponent: () => null,
}));

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const stage = (name: string, position: number, status: PipelineRun['stages'][number]['status'], extra: object = {}) => ({
  name,
  position,
  status,
  message: null,
  error: null,
  startedAt: ago(120_000 - position * 10_000),
  finishedAt: status === 'running' ? null : ago(110_000 - position * 10_000),
  ...extra,
});
const run = (fields: Partial<PipelineRun>): PipelineRun => ({
  id: 'r1',
  job: 'api-deploy',
  number: 142,
  status: 'running',
  url: 'https://jenkins.example.com/job/api-deploy/142/',
  branch: 'main',
  commit: 'a3f9c21',
  startedAt: ago(155_000),
  updatedAt: ago(4_000),
  finishedAt: null,
  finishReason: null,
  stages: [stage('Build', 0, 'passed'), stage('Deploy', 1, 'running', { message: 'Rolling out api: 3 of 6 instances' })],
  ...fields,
});
const failed = run({
  id: 'r2',
  number: 141,
  status: 'failed',
  updatedAt: ago(2_400_000),
  finishedAt: ago(2_400_000),
  stages: [stage('Build', 0, 'passed'), stage('Test', 1, 'failed', { message: '3 tests failed in auth.spec.ts', error: 'FAIL src/auth/auth.spec.ts\n  ✕ signs out every device' })],
});
const show = (view: PipelinesView) => {
  usePipelines.mockReturnValue({ data: view, isPending: false, isError: false });
  usePipelineRun.mockImplementation((id: string | null) => ({ data: [...view.recent, ...view.jobs.map((j) => j.latest)].find((r) => r.id === id) }));
  render(<PipelinesPageComponent />);
};

beforeEach(() => {
  vi.clearAllMocks();
  access.value = { access: 'owner', canEdit: true, isOwner: true };
});

it('shows a card per job with stage steps, the pending ones, and the latest message', () => {
  show({ jobs: [{ job: 'api-deploy', latest: run({}), expected: ['Build', 'Deploy', 'Smoke test'] }], recent: [run({})] });
  const card = screen.getByRole('region', { name: 'api-deploy, running' });
  const steps = within(card).getByRole('list', { name: 'Stages' });
  expect(within(steps).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('Build'), expect.stringContaining('Deploy'), expect.stringContaining('Smoke test')]);
  expect(within(card).getByText('Rolling out api: 3 of 6 instances')).toBeInTheDocument();
  expect(within(card).getByRole('link', { name: /Open in Jenkins/ })).toHaveAttribute('href', 'https://jenkins.example.com/job/api-deploy/142/');
});

it('marks a run with no report for 30 minutes as Stopped reporting', () => {
  const quiet = run({ updatedAt: ago(31 * 60_000) });
  show({ jobs: [{ job: 'api-deploy', latest: quiet, expected: [] }], recent: [quiet] });
  expect(screen.getByRole('region', { name: 'api-deploy, stopped reporting' })).toBeInTheDocument();
});

it('renders messages as text and only http links', () => {
  const hostile = run({ url: 'javascript:alert(1)', stages: [stage('Build', 0, 'running', { message: '<img src=x onerror=alert(1)>' })] });
  show({ jobs: [{ job: 'api-deploy', latest: hostile, expected: [] }], recent: [hostile] });
  expect(screen.getAllByText('<img src=x onerror=alert(1)>').length).toBeGreaterThan(0);
  expect(document.querySelector('img')).toBeNull();
  expect(screen.queryByRole('link', { name: /Open in Jenkins/ })).not.toBeInTheDocument();
});

it("opens the drawer with the failed stage's error, and later stages it never reached as skipped", async () => {
  show({ jobs: [{ job: 'api-deploy', latest: run({}), expected: ['Build', 'Test', 'Deploy'] }], recent: [run({}), failed] });
  await userEvent.click(screen.getByRole('button', { name: 'api-deploy #141' }));
  const drawer = await screen.findByRole('dialog');
  expect(within(drawer).getByText(/FAIL src\/auth\/auth.spec.ts/)).toBeInTheDocument();
  expect(within(drawer).getByText('3 tests failed in auth.spec.ts')).toBeInTheDocument();
  expect(within(drawer).getByText(/Skipped/)).toBeInTheDocument();
});

it('shows the empty state', () => {
  show({ jobs: [], recent: [] });
  expect(screen.getByText('No runs yet. Connect Jenkins to start.')).toBeInTheDocument();
});

it('a viewer sees no Connect Jenkins button; an editor and the owner do', () => {
  access.value = { access: 'view', canEdit: false, isOwner: false };
  show({ jobs: [], recent: [] });
  expect(screen.queryByRole('button', { name: /Connect Jenkins/ })).not.toBeInTheDocument();
});

it('shows a load failure', () => {
  usePipelines.mockReturnValue({ data: undefined, isPending: false, isError: true });
  usePipelineRun.mockReturnValue({ data: undefined });
  render(<PipelinesPageComponent />);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load these pipelines');
});
