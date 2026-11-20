import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { Space } from './space-types';
import { UptimeDotComponent } from './UptimeDotComponent';

const space = (fields: Partial<Space>): Space => ({
  id: 's1',
  parentId: null,
  kind: 'space',
  title: 'My sites',
  tool: 'uptime',
  carryOver: true,
  locked: false,
  createdAt: '',
  openToday: 0,
  access: 'owner',
  shared: false,
  ownerId: 'me',
  ownerName: null,
  ...fields,
});

it.each([
  ['down', 'My sites, a site is down', 'bg-destructive'],
  ['slow', 'My sites, a site is slow', 'bg-signal'],
  ['up', 'My sites, all sites are up', 'bg-status-done'],
] as const)('shows %s with the right colour and label', (status, label, tone) => {
  render(<UptimeDotComponent space={space({ uptime: status })} />);
  expect(screen.getByRole('img', { name: label })).toHaveClass(tone);
});

it('shows nothing without a status or for another tool', () => {
  const { container } = render(
    <>
      <UptimeDotComponent space={space({ uptime: null })} />
      <UptimeDotComponent space={space({ tool: 'list', uptime: 'down' })} />
    </>,
  );
  expect(container).toBeEmptyDOMElement();
});
