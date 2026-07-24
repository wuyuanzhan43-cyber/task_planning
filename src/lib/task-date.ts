const TASK_DAY_START_HOUR = 4;

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getTaskDate(now = new Date()): string {
  const taskDate = new Date(now);
  if (taskDate.getHours() < TASK_DAY_START_HOUR) taskDate.setDate(taskDate.getDate() - 1);
  return toDateKey(taskDate);
}

export function formatTaskDate(dateKey: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${dateKey}T12:00:00`));
}

export function dateDiff(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

