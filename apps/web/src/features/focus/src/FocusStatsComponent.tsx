import { SectionCardComponent, StatTileComponent } from '@/features/budget';
import { cn } from '@/shared/utils/cn';
import { byTask, formatMinutes, lastWeek, minutesByDay } from './focus-math';
import type { FocusSession } from './focus-types';

const TOP_TASKS = 5;

const weekday = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const clockTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// Today's sessions and focus time, the last 7 days as bars, and where the week's focus went.
export function FocusStatsComponent({ sessions, today }: { sessions: FocusSession[]; today: string }) {
  const todays = sessions.filter((session) => session.day === today);
  const todayMinutes = todays.reduce((total, session) => total + session.minutes, 0);
  const week = minutesByDay(sessions, lastWeek(today));
  const weekMinutes = week.reduce((total, { minutes }) => total + minutes, 0);
  const most = Math.max(...week.map(({ minutes }) => minutes), 1);
  const tasks = byTask(sessions).slice(0, TOP_TASKS);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTileComponent label="Sessions today" value={String(todays.length)} />
        <StatTileComponent label="Focus today" value={formatMinutes(todayMinutes)} />
      </div>

      <SectionCardComponent title="Last 7 days" action={<span className="text-xs text-muted-foreground tabular-nums">{formatMinutes(weekMinutes)}</span>}>
        <div role="img" aria-label={`Focus minutes per day: ${week.map(({ day, minutes }) => `${weekday(day)} ${minutes}`).join(', ')}`} className="flex h-28 items-end gap-2 px-4 pb-4">
          {week.map(({ day, minutes }) => (
            <div key={day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <div className={cn('w-full max-w-8 rounded-md', minutes > 0 ? 'bg-foreground' : 'bg-muted', day === today && minutes > 0 && 'bg-signal')} style={{ height: `${Math.max((minutes / most) * 100, 4)}%` }} />
              <span className={cn('text-[11px] text-muted-foreground', day === today && 'font-semibold text-foreground')}>{weekday(day)}</span>
            </div>
          ))}
        </div>
      </SectionCardComponent>

      {/* Only once some session has a task; until then every row would read "No task". */}
      {tasks.some((task) => task.key !== '') && (
        <SectionCardComponent title="This week by task">
          <ul className="flex flex-col px-2 pb-2">
            {tasks.map((task) => (
              <li key={task.key} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm">
                <span className={cn('min-w-0 truncate', task.key === '' && 'text-muted-foreground')}>{task.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatMinutes(task.minutes)} · {task.count}×
                </span>
              </li>
            ))}
          </ul>
        </SectionCardComponent>
      )}

      <SectionCardComponent title="Today">
        {todays.length > 0 ? (
          <ol className="flex flex-col px-2 pb-2">
            {[...todays].reverse().map((session) => (
              <li key={session.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm">
                <span className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">{clockTime(session.startedAt)}</span>
                <span className={cn('min-w-0 flex-1 truncate', !session.taskTitle && 'text-muted-foreground')}>{session.taskTitle ?? 'Focus session'}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{session.minutes} min</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No sessions yet today. Press Start to begin one.</p>
        )}
      </SectionCardComponent>
    </div>
  );
}
