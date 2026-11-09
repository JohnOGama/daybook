import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SpaceSettingsComponent } from './SpaceSettingsComponent';
import type { Space } from './space-types';

const { setCarryOver } = vi.hoisted(() => ({ setCarryOver: vi.fn() }));
vi.mock('../hooks/useSetCarryOver', () => ({ useSetCarryOver: () => ({ mutate: setCarryOver }) }));

const space: Space = {
  id: 's1',
  parentId: null,
  kind: 'space',
  title: 'Home',
  tool: 'list',
  carryOver: true,
  createdAt: '',
  openToday: 0,
};

async function openSettings(target: Space) {
  render(<SpaceSettingsComponent space={target} />);
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
  return screen.findByRole('switch', { name: 'Carry over unfinished tasks' });
}

beforeEach(() => vi.clearAllMocks());

it('stays hidden until Settings is clicked', () => {
  render(<SpaceSettingsComponent space={space} />);
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});

it('can turn carry over off', async () => {
  const toggle = await openSettings(space);
  expect(toggle).toBeChecked();
  await userEvent.click(toggle);
  expect(setCarryOver).toHaveBeenCalledWith({ id: 's1', carryOver: false });
});

it('shows carry over as off and can turn it back on', async () => {
  const toggle = await openSettings({ ...space, carryOver: false });
  expect(toggle).not.toBeChecked();
  await userEvent.click(toggle);
  expect(setCarryOver).toHaveBeenCalledWith({ id: 's1', carryOver: true });
});
