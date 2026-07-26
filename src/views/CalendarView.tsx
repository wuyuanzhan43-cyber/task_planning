import { useState } from "react";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { formatTaskDate, getTaskDate, toDateKey } from "../lib/task-date";
import { shiftDate, weekStart } from "../lib/schedule";
import type { Task } from "../types";

export type CalendarMode = "month" | "week" | "day";

function calendarDates(anchor: string, mode: CalendarMode): string[] {
  if (mode === "day") return [anchor];
  if (mode === "week") return Array.from({ length: 7 }, (_, index) => shiftDate(weekStart(anchor), index));
  const value = new Date(`${anchor}T12:00:00`);
  const first = new Date(value.getFullYear(), value.getMonth(), 1, 12);
  first.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(first);
    current.setDate(first.getDate() + index);
    return toDateKey(current);
  });
}

export function CalendarView({ tasks, selectedDate, onSelectDate, onSelectTask, onReschedule }: { tasks: Task[]; selectedDate: string; onSelectDate: (date: string) => void; onSelectTask: (taskId: string) => void; onReschedule: (taskId: string, targetDate: string) => void }) {
  const [mode, setMode] = useState<CalendarMode>("month");
  const dates = calendarDates(selectedDate, mode);
  const anchor = new Date(`${selectedDate}T12:00:00`);
  const heading = mode === "month" ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(anchor) : mode === "week" ? `${formatTaskDate(dates[0])} - ${formatTaskDate(dates[6])}` : formatTaskDate(selectedDate);
  const period = mode === "month" ? 30 : mode === "week" ? 7 : 1;
  function handleDragEnd(event: DragEndEvent) {
    const targetDate = event.over?.id ? String(event.over.id) : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) onReschedule(String(event.active.id), targetDate);
  }
  return <section className="workspace-page calendar-workspace"><div className="calendar-toolbar"><div><p className="eyebrow">拖拽任务即可调整计划日</p><h1>{heading}</h1></div><div className="calendar-controls"><div className="segmented-control">{(["month", "week", "day"] as CalendarMode[]).map((item) => <button key={item} className={mode === item ? "selected" : ""} onClick={() => setMode(item)}>{item === "month" ? "月" : item === "week" ? "周" : "日"}</button>)}</div><button className="icon-button" title="上一段时间" onClick={() => onSelectDate(shiftDate(selectedDate, -period))}><ChevronLeft size={18} /></button><button className="calendar-today" onClick={() => onSelectDate(getTaskDate())}>今天</button><button className="icon-button" title="下一段时间" onClick={() => onSelectDate(shiftDate(selectedDate, period))}><ChevronRight size={18} /></button></div></div><DndContext onDragEnd={handleDragEnd}><div className={`calendar-grid ${mode}`}><div className="calendar-weekdays">{["日", "一", "二", "三", "四", "五", "六"].slice(0, mode === "day" ? 1 : 7).map((day) => <span key={day}>周{day}</span>)}</div><div className="calendar-days">{dates.map((date) => <CalendarDayCell key={date} date={date} tasks={tasks.filter((task) => task.plannedDate === date && !task.completedAt)} selectedDate={selectedDate} currentMonth={anchor.getMonth()} mode={mode} onSelectDate={onSelectDate} onSelectTask={onSelectTask} />)}</div></div></DndContext></section>;
}

function CalendarDayCell({ date, tasks, selectedDate, currentMonth, mode, onSelectDate, onSelectTask }: { date: string; tasks: Task[]; selectedDate: string; currentMonth: number; mode: CalendarMode; onSelectDate: (date: string) => void; onSelectTask: (taskId: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const current = new Date(`${date}T12:00:00`);
  return <div ref={setNodeRef} className={`calendar-day ${isOver ? "drag-over" : ""} ${date === selectedDate ? "selected" : ""} ${mode === "month" && current.getMonth() !== currentMonth ? "outside" : ""}`}><button className="calendar-date" onClick={() => onSelectDate(date)}>{current.getDate()}</button><div className="calendar-task-stack">{tasks.map((task) => <CalendarTaskChip key={task.id} task={task} onSelectTask={onSelectTask} />)}</div></div>;
}

function CalendarTaskChip({ task, onSelectTask }: { task: Task; onSelectTask: (taskId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  return <button ref={setNodeRef} className={`calendar-task priority-${task.priority} ${isDragging ? "dragging" : ""}`} style={{ transform: CSS.Translate.toString(transform) }} onClick={() => onSelectTask(task.id)} {...listeners} {...attributes}><GripVertical size={12} /><span>{task.title}</span></button>;
}
