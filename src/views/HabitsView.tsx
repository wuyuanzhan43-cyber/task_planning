import { Flame, Repeat } from "lucide-react";
import { formatTaskDate, getTaskDate } from "../lib/task-date";
import { daysInRange, describeRepeat, habitDoneOn, habitStats, habitStreak, isDueOn, monthStart, shiftDate } from "../lib/schedule";
import type { Task } from "../types";

export function HabitsView({ tasks, onSelectTask, onOpenDate }: { tasks: Task[]; onSelectTask: (taskId: string) => void; onOpenDate: (date: string) => void }) {
  const today = getTaskDate();
  const habits = tasks.filter((task) => task.repeat !== "none" && !task.completedAt);
  const stripDays = Array.from({ length: 28 }, (_, index) => shiftDate(today, index - 27));
  const monthDays = daysInRange(monthStart(today), today);
  return <section className="workspace-page habits-workspace"><p className="eyebrow">重复任务的坚持记录</p><h1>习惯打卡</h1>{habits.length === 0 ? <div className="empty-workspace">还没有重复任务。创建任务时把"重复"设为每天、每周等，它就会出现在这里。</div> : <div className="habit-list">{habits.map((habit) => {
    const streak = habitStreak(habit, today);
    const { due, done } = habitStats(habit, monthDays);
    const rate = due ? Math.round(done / due * 100) : 0;
    return <section className="habit-card" key={habit.id}><div className="habit-heading"><button className="habit-title" onClick={() => onSelectTask(habit.id)}><span className={`priority-dot ${habit.priority}`} /><strong>{habit.title}</strong><em>{describeRepeat(habit)}</em></button><div className="habit-stats"><span className="habit-streak"><Flame size={14} />{streak} 天连续</span><span>本月 {done}/{due} · {rate}%</span></div></div><div className="habit-strip">{stripDays.map((date) => {
      const dueDay = isDueOn(habit, date);
      const doneDay = dueDay && habitDoneOn(habit, date);
      const status = !dueDay ? "off" : doneDay ? "done" : date === today ? "pending" : "miss";
      return <button key={date} className={`habit-cell ${status}`} title={`${formatTaskDate(date)}${!dueDay ? " · 无需执行" : doneDay ? " · 已完成" : date === today ? " · 今天，等待完成" : " · 未完成"}`} onClick={() => onOpenDate(date)} />;
    })}</div><div className="habit-strip-legend"><span>{formatTaskDate(stripDays[0])}</span><span>{formatTaskDate(today)}</span></div></section>;
  })}</div>}{habits.length > 0 && <p className="habit-footnote"><Repeat size={13} />点击任意格子可跳转到那一天查看详情；连续天数只统计到期日，非到期日不会打断连续。</p>}</section>;
}
