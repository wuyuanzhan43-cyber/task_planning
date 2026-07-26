import { dateDiff, getTaskDate, toDateKey } from "./task-date";
import type { Task } from "../types";

export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

type Repeatable = Pick<Task, "repeat" | "repeatConfig" | "plannedDate">;

export function isDueOn(task: Task, date: string): boolean {
  if (task.deletedAt) return false;
  if (date < task.plannedDate) return false;
  if (task.repeat === "none") return true;
  const config = task.repeatConfig ?? {};
  const interval = Math.max(1, Math.floor(config.interval ?? 1));
  const current = new Date(`${date}T12:00:00`);
  const start = new Date(`${task.plannedDate}T12:00:00`);
  if (task.repeat === "daily") return dateDiff(task.plannedDate, date) % interval === 0;
  if (task.repeat === "weekdays") return current.getDay() > 0 && current.getDay() < 6;
  if (task.repeat === "weekly") {
    const weekDiff = Math.round(dateDiff(weekStart(task.plannedDate), weekStart(date)) / 7);
    if (weekDiff % interval !== 0) return false;
    const weekdays = config.weekdays && config.weekdays.length > 0 ? config.weekdays : [start.getDay()];
    return weekdays.includes(current.getDay());
  }
  const monthsBetween = (current.getFullYear() - start.getFullYear()) * 12 + (current.getMonth() - start.getMonth());
  if (monthsBetween % interval !== 0) return false;
  if (config.monthlyMode === "last-day") return date === monthEnd(date);
  return current.getDate() === start.getDate();
}

export function describeRepeat(task: Repeatable): string {
  const names = ["日", "一", "二", "三", "四", "五", "六"];
  const config = task.repeatConfig ?? {};
  const interval = Math.max(1, Math.floor(config.interval ?? 1));
  switch (task.repeat) {
    case "none": return "不重复";
    case "weekdays": return "工作日";
    case "daily": return interval === 1 ? "每天" : `每 ${interval} 天`;
    case "weekly": {
      const base = interval === 1 ? "每周" : interval === 2 ? "每两周" : `每 ${interval} 周`;
      const dayText = config.weekdays && config.weekdays.length > 0 ? [...config.weekdays].sort((a, b) => a - b).map((day) => names[day] ?? "").join("、") : "";
      return dayText ? `${base}·${dayText}` : base;
    }
    case "monthly": {
      if (config.monthlyMode === "last-day") return interval === 1 ? "每月最后一天" : `每 ${interval} 个月的月末`;
      return interval === 1 ? "每月" : `每 ${interval} 个月`;
    }
  }
}

export function completedExecutionOn(task: Task, date: string): boolean {
  return task.progress.some((entry) => entry.taskDate === date && entry.completedToday);
}

export function shiftDate(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return toDateKey(value);
}

export function weekStart(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  const offset = value.getDay() === 0 ? -6 : 1 - value.getDay();
  value.setDate(value.getDate() + offset);
  return toDateKey(value);
}

export function monthStart(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  return toDateKey(new Date(value.getFullYear(), value.getMonth(), 1, 12));
}

export function monthEnd(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  return toDateKey(new Date(value.getFullYear(), value.getMonth() + 1, 0, 12));
}

export function shiftMonth(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00`);
  return toDateKey(new Date(value.getFullYear(), value.getMonth() + amount, 1, 12));
}

export function daysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  let current = start;
  while (current <= end && days.length < 370) {
    days.push(current);
    current = shiftDate(current, 1);
  }
  return days;
}

export function dayExecutions(tasks: Task[], date: string): number {
  return tasks.filter((task) => completedExecutionOn(task, date)).length
    + tasks.filter((task) => task.completedAt?.slice(0, 10) === date).length;
}

export function dayPlanned(tasks: Task[], date: string): number {
  return tasks.filter((task) => isDueOn(task, date) && (!task.completedAt || task.completedAt.slice(0, 10) >= date)).length;
}

export function habitDoneOn(task: Task, date: string): boolean {
  return completedExecutionOn(task, date) || task.completedAt?.slice(0, 10) === date;
}

/** 单个重复任务的连续打卡天数（只数到期日；今天到期但未打卡不打断连续）。 */
export function habitStreak(task: Task, today = getTaskDate()): number {
  let date = today;
  if (isDueOn(task, date) && !habitDoneOn(task, date)) date = shiftDate(date, -1);
  let streak = 0;
  let guard = 0;
  while (guard < 730 && date >= task.plannedDate) {
    if (isDueOn(task, date)) {
      if (!habitDoneOn(task, date)) break;
      streak += 1;
    }
    date = shiftDate(date, -1);
    guard += 1;
  }
  return streak;
}

/** 统计一段日期内某任务的到期次数与完成次数。 */
export function habitStats(task: Task, days: string[]): { due: number; done: number } {
  let due = 0;
  let done = 0;
  for (const date of days) {
    if (!isDueOn(task, date)) continue;
    due += 1;
    if (habitDoneOn(task, date)) done += 1;
  }
  return { due, done };
}

/** 一段日期内的时间分布：按项目或标签汇总已完成执行的预估分钟数。 */
export function timeDistribution(tasks: Task[], days: string[], mode: "project" | "tag"): Array<{ name: string; minutes: number }> {
  const totals = new Map<string, number>();
  for (const date of days) {
    for (const task of tasks) {
      if (!(completedExecutionOn(task, date) || task.completedAt?.slice(0, 10) === date)) continue;
      const keys = mode === "project" ? [task.project || "收集箱"] : (task.tags.length ? task.tags : ["未分类"]);
      for (const key of keys) totals.set(key, (totals.get(key) ?? 0) + task.estimateMinutes);
    }
  }
  return [...totals.entries()].map(([name, minutes]) => ({ name, minutes })).sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, "zh-CN"));
}

export function computeStreak(tasks: Task[], today = getTaskDate()): number {
  let date = today;
  if (dayExecutions(tasks, date) === 0) date = shiftDate(date, -1);
  let streak = 0;
  while (streak < 3650 && dayExecutions(tasks, date) > 0) {
    streak += 1;
    date = shiftDate(date, -1);
  }
  return streak;
}
