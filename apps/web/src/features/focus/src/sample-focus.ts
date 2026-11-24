import { addDays } from '@/shared/utils/date-formatter';
import { DEFAULT_SETTINGS, type FocusView } from './focus-types';

// Shapes for the loading skeleton only; never shown as real data.
export function sampleFocus(today: string): FocusView {
  const session = (index: number, day: string, taskTitle: string) => ({ id: `sample-${index}`, day, startedAt: `${day}T09:00:00.000Z`, minutes: 25, taskId: null, taskTitle });
  return {
    settings: DEFAULT_SETTINGS,
    sessions: [session(1, addDays(today, -2), 'Sample task one'), session(2, addDays(today, -1), 'Sample task two'), session(3, today, 'Sample task one')],
  };
}
