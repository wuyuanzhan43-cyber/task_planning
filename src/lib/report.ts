import { formatTaskDate } from "./task-date";
import { completedExecutionOn, computeStreak, dayExecutions, dayPlanned } from "./schedule";
import type { DailyReview, Task } from "../types";

export function buildReport({ periodName, rangeLabel, days, tasks, reviews }: { periodName: string; rangeLabel: string; days: string[]; tasks: Task[]; reviews: DailyReview[] }): string {
  const plannedTotal = days.reduce((sum, date) => sum + dayPlanned(tasks, date), 0);
  const completedTotal = days.reduce((sum, date) => sum + dayExecutions(tasks, date), 0);
  const rate = plannedTotal ? Math.min(100, Math.round(completedTotal / plannedTotal * 100)) : 0;
  const focusMinutes = days.reduce((sum, date) => sum + tasks.filter((task) => completedExecutionOn(task, date) || task.completedAt?.slice(0, 10) === date).reduce((total, task) => total + task.estimateMinutes, 0), 0);
  const reviewByDate = new Map(reviews.map((review) => [review.taskDate, review]));

  const lines: string[] = [];
  lines.push(`# Dayflow ${periodName}报 · ${rangeLabel}`);
  lines.push("");
  lines.push("## 总览");
  lines.push("");
  lines.push(`- 完成率：${rate}%（${completedTotal} / ${plannedTotal} 次计划执行）`);
  lines.push(`- 专注时长：约 ${Math.round(focusMinutes / 60 * 10) / 10} 小时（按已完成任务预估时长）`);
  lines.push(`- 连续执行：${computeStreak(tasks, days[days.length - 1])} 天`);
  lines.push("");
  lines.push("## 每日完成");
  lines.push("");
  for (const date of days) {
    const done = tasks.filter((task) => task.completedAt?.slice(0, 10) === date).map((task) => task.title);
    const executed = tasks.filter((task) => !task.completedAt && completedExecutionOn(task, date)).map((task) => `${task.title}（周期执行）`);
    const items = [...done, ...executed];
    lines.push(`### ${formatTaskDate(date)}`);
    lines.push("");
    if (items.length) {
      for (const item of items) lines.push(`- [x] ${item}`);
    } else {
      lines.push("_没有完成记录_");
    }
    const review = reviewByDate.get(date);
    if (review && (review.reflection.trim() || review.tomorrowFocus.trim())) {
      if (review.reflection.trim()) lines.push(`> 复盘：${review.reflection.trim()}`);
      if (review.tomorrowFocus.trim()) lines.push(`> 明日重点：${review.tomorrowFocus.trim()}`);
    }
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push("_由 Dayflow 自动生成_");
  return lines.join("\n");
}
