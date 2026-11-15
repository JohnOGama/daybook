import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PipelineDotComponent } from './PipelineDotComponent';
import type { Space } from './space-types';

const space = (fields: Partial<Space>): Space => ({
  id: 's1',
  parentId: null,
  kind: 'space',
  title: 'Backend',
  tool: 'pipelines',
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
  ['passed', 'Backend, the last run passed', 'bg-status-done'],
  ['running', 'Backend, a stage is running', 'bg-status-progress'],
  ['failed', 'Backend, the last run failed', 'bg-destructive'],
] as const)('shows %s with the right colour and label', (status, label, tone) => {
  render(<PipelineDotComponent space={space({ pipelines: status })} />);
  expect(screen.getByRole('img', { name: label })).toHaveClass(tone);
});

it('pulses only while running, and only when motion is allowed', () => {
  const { rerender } = render(<PipelineDotComponent space={space({ pipelines: 'running' })} />);
  expect(screen.getByRole('img').className).toContain('motion-safe:animate-pulse');
  rerender(<PipelineDotComponent space={space({ pipelines: 'failed' })} />);
  expect(screen.getByRole('img').className).not.toContain('animate-pulse');
});

it('shows nothing without runs or for other tools', () => {
  const { container, rerender } = render(<PipelineDotComponent space={space({ pipelines: null })} />);
  expect(container).toBeEmptyDOMElement();
  rerender(<PipelineDotComponent space={space({ tool: 'list', pipelines: 'failed' })} />);
  expect(container).toBeEmptyDOMElement();
});
