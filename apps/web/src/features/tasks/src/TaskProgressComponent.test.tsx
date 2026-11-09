import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SAMPLE_TASKS } from './sample-tasks';
import { TaskProgressComponent } from './TaskProgressComponent';

it('shows nothing for a day with no tasks', () => {
  const { container } = render(<TaskProgressComponent tasks={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it('reports progress and leaves out a zero high priority count', () => {
  const tasks = SAMPLE_TASKS.map((task) => ({ ...task, highPriority: false, finished: task.id === 'sample-1' }));
  render(<TaskProgressComponent tasks={tasks} />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  expect(screen.getByText('1 of 4 done')).toBeInTheDocument();
  expect(screen.queryByText(/high priority left/)).not.toBeInTheDocument();
});
