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

function showSettings(target: Space) {
  render(<SpaceSettingsComponent space={target} />);
  return screen.getByRole('switch', { name: 'Carry over unfinished tasks' });
}

beforeEach(() => vi.clearAllMocks());

it('shows the option right on the page and can turn it off', async () => {
  const toggle = showSettings(space);
  expect(toggle).toBeChecked();
  expect(toggle).toHaveAccessibleDescription(/Finished tasks stay/);
  await userEvent.click(toggle);
  expect(setCarryOver).toHaveBeenCalledWith({ id: 's1', carryOver: false });
});

it('shows carry over as off and can turn it back on', async () => {
  const toggle = showSettings({ ...space, carryOver: false });
  expect(toggle).not.toBeChecked();
  await userEvent.click(toggle);
  expect(setCarryOver).toHaveBeenCalledWith({ id: 's1', carryOver: true });
});
