import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SettingsPageComponent } from './SettingsPageComponent';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('section=apps') }));
vi.mock('@/features/spaces', () => ({ SpaceGroupsManagerComponent: () => null, SpacePasswordsComponent: () => null }));
vi.mock('@/features/connected-apps', () => ({ ConnectedAppsComponent: () => <p>apps list</p> }));

it('shows a Connected apps tab that opens the section', () => {
  render(<SettingsPageComponent />);
  expect(screen.getByRole('link', { name: 'Connected apps' })).toHaveAttribute('href', '/preferences?section=apps');
  expect(screen.getByRole('link', { name: 'Connected apps' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('heading', { name: 'Connected apps' })).toBeInTheDocument();
  expect(screen.getByText('apps list')).toBeInTheDocument();
});
