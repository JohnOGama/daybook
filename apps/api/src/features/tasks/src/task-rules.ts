export function appearsOn(
  task: { plannedDay: string; completedOn: string | null },
  today: string,
): string {
  if (task.completedOn) return task.completedOn;
  return task.plannedDay < today ? today : task.plannedDay;
}
