export function appearsOn(
  task: { plannedDay: string; completedOn: string | null },
  today: string,
  carryOver = true,
): string {
  if (task.completedOn) return task.completedOn;
  return carryOver && task.plannedDay < today ? today : task.plannedDay;
}
