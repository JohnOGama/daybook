import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { AssistantPanelComponent } from './AssistantPanelComponent';

async function openPanel() {
  render(<AssistantPanelComponent />);
  await userEvent.click(screen.getByRole('button', { name: 'Assistant' }));
}
const reply = { timeout: 3000 };

it('shows only the button until it is clicked', async () => {
  render(<AssistantPanelComponent />);
  expect(screen.queryByRole('log')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Assistant' }));
  expect(screen.getByRole('log')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Close assistant' }));
  expect(screen.queryByRole('log')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Assistant' })).toHaveFocus();
});

it('answers a suggested question and then hides the suggestions', async () => {
  await openPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Plan my day' }));
  expect(screen.getByRole('status', { name: 'Assistant is replying' })).toBeInTheDocument();
  expect(await screen.findByText(/Here is a sample plan/, {}, reply)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Summarize my week' })).not.toBeInTheDocument();
});

it('sends a typed message, clears the box and says it is only a preview', async () => {
  await openPanel();
  const box = screen.getByRole('textbox', { name: 'Message the assistant' });
  await userEvent.type(box, 'Move my meeting{Enter}');
  expect(screen.getByText('Move my meeting')).toBeInTheDocument();
  expect(box).toHaveValue('');
  expect(await screen.findByText(/only a preview/, {}, reply)).toBeInTheDocument();
});
