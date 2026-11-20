import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NotebookPage } from '@/features/notebook';
import { SkillEditorComponent } from './SkillEditorComponent';

const { schedule, toast } = vi.hoisted(() => ({ schedule: vi.fn(), toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/features/notebook', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/notebook')>()),
  usePageAutosave: () => ({ schedule, status: 'saved', reload: vi.fn() }),
}));

const page: NotebookPage = {
  id: 'p1',
  title: 'deploy',
  content: { type: 'skill', description: 'Deploy stuff', body: 'run migrations' },
  createdAt: '',
  version: 3,
};

const round = (description: string, purpose: string) => ({
  name: 'deploy',
  description,
  body: '1. Run `pnpm run db:migrate`.',
  purpose,
  changes: ['Says when to use it'],
});

const fetchMock = vi.fn();

function renderEditor(canEdit = true, shown: NotebookPage = page) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SkillEditorComponent page={shown} spaceId="s1" canEdit={canEdit} />
    </QueryClientProvider>,
  );
}

const files = [
  { path: 'templates/Jenkinsfile', content: 'pipeline {}' },
  { path: 'templates/Dockerfile', content: 'FROM node:22' },
];
const withFiles: NotebookPage = { ...page, content: { type: 'skill', description: 'Deploy stuff', body: 'run migrations', frontmatter: 'model: opus', files } };

const sentBody = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body);

beforeEach(() => {
  schedule.mockClear();
  toast.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it('turns a typed name into a skill name, saves it as the title, and hints at a weak description', async () => {
  renderEditor();
  expect(screen.getByText(/Too short to trigger reliably/)).toBeInTheDocument();
  const name = screen.getByLabelText('Name');
  await userEvent.clear(name);
  await userEvent.type(name, 'Ship It');
  expect(name).toHaveValue('ship-it');
  expect(schedule).toHaveBeenLastCalledWith({ title: 'ship-it' });
});

it('saves description and instructions as the skill content', async () => {
  renderEditor();
  await userEvent.type(screen.getByLabelText('Instructions'), '!');
  expect(schedule).toHaveBeenLastCalledWith({ content: { type: 'skill', description: 'Deploy stuff', body: 'run migrations!', frontmatter: '', files: [] } });
});

it('improves, improves more from the round on screen, then uses it with Undo', async () => {
  fetchMock
    .mockResolvedValueOnce(new Response(JSON.stringify(round('Use when deploying.', 'Ships a release.')), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(round('Use when deploying or shipping.', 'Ships and checks a release.')), { status: 201 }));
  renderEditor();

  await userEvent.click(screen.getByRole('button', { name: 'Improve with AI' }));
  const panel = screen.getByRole('complementary', { name: 'Improve skill' });
  expect(await within(panel).findByText('Ships a release.')).toBeInTheDocument();
  expect(sentBody(0)).toEqual({ spaceId: 's1', skill: { name: 'deploy', description: 'Deploy stuff', body: 'run migrations' } });
  const compared = within(panel).getByRole('region', { name: 'Compared with yours' });
  expect([...compared.querySelectorAll('[data-kind="removed"]')].map((line) => line.textContent)).toContain('−Removed: run migrations');

  await userEvent.click(within(panel).getByRole('button', { name: 'Shorter' }));
  expect(await within(panel).findByText('Ships and checks a release.')).toBeInTheDocument();
  expect(sentBody(1)).toMatchObject({ skill: { description: 'Use when deploying.' }, instruction: 'Shorter' });
  await userEvent.click(within(panel).getByRole('button', { name: 'Round 1' }));
  expect(within(panel).getByText('Ships a release.')).toBeInTheDocument();

  await userEvent.click(within(panel).getByRole('button', { name: 'Use this version' }));
  expect(screen.queryByRole('complementary', { name: 'Improve skill' })).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^Description/)).toHaveValue('Use when deploying.');
  expect(schedule).toHaveBeenLastCalledWith({ content: { type: 'skill', description: 'Use when deploying.', body: '1. Run `pnpm run db:migrate`.', frontmatter: '', files: [] } });

  const undo = toast.mock.calls.at(-1)?.[1].action.onClick;
  undo();
  await waitFor(() => expect(screen.getByLabelText(/^Description/)).toHaveValue('Deploy stuff'));
  expect(schedule).toHaveBeenLastCalledWith({ content: { type: 'skill', description: 'Deploy stuff', body: 'run migrations', frontmatter: '', files: [] } });
});

it('lists an uploaded skill’s files, removes one with Undo, and downloads the folder', async () => {
  renderEditor(true, withFiles);
  expect(screen.getByRole('button', { name: 'Download folder (.zip)' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Files (2)' }));
  expect(within(screen.getByRole('list', { name: 'Files' })).getAllByRole('listitem')).toHaveLength(2);

  await userEvent.click(screen.getByRole('button', { name: 'Remove templates/Dockerfile' }));
  expect(schedule).toHaveBeenLastCalledWith({ content: expect.objectContaining({ frontmatter: 'model: opus', files: [files[0]] }) });
  toast.mock.calls.at(-1)?.[1].action.onClick();
  expect(schedule).toHaveBeenLastCalledWith({ content: expect.objectContaining({ files }) });
});

it('tells the AI the file paths, never their contents, and keeps the files when using a round', async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(round('Use when deploying.', 'Ships a release.')), { status: 201 }));
  renderEditor(true, withFiles);
  await userEvent.click(screen.getByRole('button', { name: 'Improve with AI' }));
  await screen.findByText('Ships a release.');
  expect(sentBody(0).skill.files).toEqual(['templates/Jenkinsfile', 'templates/Dockerfile']);
  expect(fetchMock.mock.calls[0][1].body).not.toContain('FROM node:22');
  await userEvent.click(screen.getByRole('button', { name: 'Use this version' }));
  expect(schedule).toHaveBeenLastCalledWith({ content: expect.objectContaining({ description: 'Use when deploying.', frontmatter: 'model: opus', files }) });
});

it('says when the AI is off and offers to try again', async () => {
  fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
  renderEditor();
  await userEvent.click(screen.getByRole('button', { name: 'Improve with AI' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('AI features are off on this server.');
  expect(screen.getByRole('button', { name: 'Use this version' })).toBeDisabled();
});

it('lets a viewer read and download but not edit or improve', () => {
  renderEditor(false);
  expect(screen.getByLabelText('Name')).toHaveAttribute('readonly');
  expect(screen.queryByRole('button', { name: 'Improve with AI' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Download SKILL.md/ })).toBeInTheDocument();
});
