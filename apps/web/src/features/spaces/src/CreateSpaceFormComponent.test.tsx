import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { CreateSpaceFormComponent } from './CreateSpaceFormComponent';
import type { Space } from './space-types';

const { mutateAsync, push } = vi.hoisted(() => ({ mutateAsync: vi.fn(), push: vi.fn() }));

vi.mock('../hooks/useCreateSpace', () => ({ useCreateSpace: () => ({ mutateAsync }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const folder: Space = {
  id: 'team',
  parentId: null,
  kind: 'folder',
  title: 'Design Team',
  tool: null,
  createdAt: '',
  openToday: 0,
};
const onDone = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue({ id: 'new-id' });
});

const typeTitle = (title: string) => userEvent.type(screen.getByLabelText('Title'), title);
const create = () => userEvent.click(screen.getByRole('button', { name: 'Create' }));

it('creates a space with the List tool and opens it', async () => {
  render(<CreateSpaceFormComponent allowFolder onDone={onDone} />);
  await typeTitle('Home');
  await create();
  expect(mutateAsync).toHaveBeenCalledWith({ kind: 'space', title: 'Home', tool: 'list' });
  expect(push).toHaveBeenCalledWith('/list?space=new-id');
  expect(onDone).toHaveBeenCalled();
});

it('switching to Folder hides the tool and creates a folder without opening it', async () => {
  render(<CreateSpaceFormComponent allowFolder onDone={onDone} />);
  await userEvent.click(screen.getByRole('button', { name: 'Folder' }));
  expect(screen.queryByText('Tool')).not.toBeInTheDocument();
  await typeTitle('Team');
  await create();
  expect(mutateAsync).toHaveBeenCalledWith({ kind: 'folder', title: 'Team' });
  expect(push).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalled();
});

it('creates inside a folder with no switch', async () => {
  render(<CreateSpaceFormComponent parentFolder={folder} onDone={onDone} />);
  expect(screen.queryByRole('button', { name: 'Folder' })).not.toBeInTheDocument();
  await typeTitle('Requests');
  await create();
  expect(mutateAsync).toHaveBeenCalledWith({ kind: 'space', title: 'Requests', tool: 'list', parentId: 'team' });
});

it('has no switch on the first-time form', () => {
  render(<CreateSpaceFormComponent />);
  expect(screen.queryByRole('button', { name: 'Folder' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /List/, pressed: true })).toBeInTheDocument();
});

it('will not create with a blank title', async () => {
  render(<CreateSpaceFormComponent />);
  expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  await typeTitle('   ');
  expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
});

it('stays open when creating fails', async () => {
  mutateAsync.mockRejectedValueOnce(new Error('nope'));
  render(<CreateSpaceFormComponent allowFolder onDone={onDone} />);
  await typeTitle('Home');
  await create();
  expect(onDone).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
});

it('shows Cancel only when it can be cancelled', async () => {
  const onCancel = vi.fn();
  render(<CreateSpaceFormComponent allowFolder onCancel={onCancel} />);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalled();
});
