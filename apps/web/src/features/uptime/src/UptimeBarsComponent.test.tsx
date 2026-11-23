import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { UptimeBarsComponent } from './UptimeBarsComponent';

it('shows a card with the half hour and its result for the hovered bar only', async () => {
  render(<UptimeBarsComponent bars={['up', 'slow', 'down']} now={new Date(2026, 10, 16, 15, 0)} />);
  const [, slow] = screen.getByRole('img', { name: 'Last 24 hours' }).children;
  fireEvent.pointerEnter(slow);
  const card = await screen.findByRole('tooltip');
  expect(card).toHaveTextContent('Slow');
  expect(card).toHaveTextContent('2026');
  expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  fireEvent.pointerLeave(screen.getByRole('img', { name: 'Last 24 hours' }));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
