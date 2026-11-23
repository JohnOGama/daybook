import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppearanceSettingsComponent } from './AppearanceSettingsComponent';

const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn() }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme }) }));

it('marks the current theme and switches to the one picked', async () => {
  render(<AppearanceSettingsComponent />);
  expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'false');
  await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  expect(setTheme).toHaveBeenCalledWith('dark');
});
