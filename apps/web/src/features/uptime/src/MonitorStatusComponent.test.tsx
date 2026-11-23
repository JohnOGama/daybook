import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { MonitorStatusComponent } from './MonitorStatusComponent';

it('says how fast the site answered, in seconds, on hover', async () => {
  render(<MonitorStatusComponent status="up" paused={false} responseMs={397} error={null} />);
  await userEvent.hover(screen.getByText('Up'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Responded in 0.4 s');
});

it('gives the reason on a down site, and nothing on a paused one', async () => {
  const { unmount } = render(<MonitorStatusComponent status="down" paused={false} responseMs={null} error="502 Bad Gateway" />);
  await userEvent.hover(screen.getByText('Down'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('502 Bad Gateway');
  unmount();

  render(<MonitorStatusComponent status="up" paused responseMs={397} error={null} />);
  await userEvent.hover(screen.getByText('Paused'));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
