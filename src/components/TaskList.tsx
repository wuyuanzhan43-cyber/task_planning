import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { Check, Circle, Clock3, GripVertical, MoreHorizontal } from "lucide-react";
import { dateDiff } from "../lib/task-date";
import { describeRepeat, shiftDate } from "../lib/schedule";
import type { Task } from "../types";

interface TaskGroupProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onComplete: (id: string) => void;
  onCompleteToday: (id: string, completedToday: boolean) => void;
  onReschedule?: (taskId: string, targetDate: string) => void;
  onReorder?: (activeId: string, overId: string) => void;
  selectedDate: string;
}

export function TaskGroup({ title, subtitle, icon, tasks, selectedId, onSelect, onComplete, onCompleteToday, onReschedule, onReorder, selectedDate }: TaskGroupProps) {
  const rows = tasks.length === 0
    ? <div className="empty-line">这里留一点空白给自己。</div>
    : tasks.map((task) => onReorder
      ? <ReorderableRow key={task.id} task={task} selected={selectedId === task.id} onSelect={onSelect} onComplete={onComplete} onCompleteToday={onCompleteToday} onReschedule={onReschedule} selectedDate={selectedDate} />
      : <TaskRow key={task.id} task={task} selected={selectedId === task.id} onSelect={onSelect} onComplete={onComplete} onCompleteToday={onCompleteToday} onReschedule={onReschedule} selectedDate={selectedDate} />);
  const list = <div className="task-list">{rows}</div>;
  return <section className="task-group"><div className="group-heading"><div className="group-title"><span>{icon}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div><span className="group-count">{tasks.length}</span></div>{onReorder ? <DndContext onDragEnd={(event: DragEndEvent) => { if (event.over && event.active.id !== event.over.id) onReorder(String(event.active.id), String(event.over.id)); }}>{list}</DndContext> : list}</section>;
}

function ReorderableRow(props: { task: Task; selected: boolean; onSelect: (id: string) => void; onComplete: (id: string) => void; onCompleteToday?: (id: string, completedToday: boolean) => void; onReschedule?: (taskId: string, targetDate: string) => void; selectedDate: string }) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: props.task.id });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: props.task.id });
  return <div ref={setDropRef} className={`reorder-row ${isOver ? "reorder-over" : ""} ${isDragging ? "reorder-dragging" : ""}`}><TaskRow {...props} handle={<span ref={setDragRef} className="drag-handle row-handle" title="拖拽调整顺序" {...listeners} {...attributes}><GripVertical size={14} /></span>} /></div>;
}

export function TaskRow({ task, selected, onSelect, onComplete, onCompleteToday, onReschedule, selectedDate, handle }: { task: Task; selected: boolean; onSelect: (id: string) => void; onComplete: (id: string) => void; onCompleteToday?: (id: string, completedToday: boolean) => void; onReschedule?: (taskId: string, targetDate: string) => void; selectedDate: string; handle?: React.ReactNode }) {
  const days = dateDiff(task.plannedDate, selectedDate);
  const canCompleteToday = task.repeat !== "none" || days > 0;
  return <div className={`task-row ${selected ? "selected" : ""}`}>{handle}<button className="check-button" title={canCompleteToday ? "完成今日执行" : "完成原任务"} onClick={() => { if (canCompleteToday) onCompleteToday?.(task.id, true); else onComplete(task.id); }}>{canCompleteToday ? <Check size={20} /> : <Circle size={20} />}</button><button className="task-row-main" onClick={() => onSelect(task.id)}><div className="task-line"><strong>{task.title}</strong>{task.repeat !== "none" && <span className="repeat-chip">{describeRepeat(task)}</span>}</div><div className="task-meta"><span className={`priority-dot ${task.priority}`} />{task.project && <span>{task.project}</span>}{task.estimateMinutes > 0 && <span><Clock3 size={13} />{task.estimateMinutes} 分钟</span>}{days > 0 && <span className="carry-label">已延续 {days} 天</span>}</div></button>{onReschedule && days > 0 && <div className="reschedule-actions"><button title="移至今天" onClick={() => onReschedule(task.id, selectedDate)}>今天</button><button title="移至明天" onClick={() => onReschedule(task.id, shiftDate(selectedDate, 1))}>明天</button><input aria-label="移至指定日期" type="date" value={task.plannedDate} min={selectedDate} onChange={(event) => onReschedule(task.id, event.target.value)} /></div>}<button className="more-button" onClick={() => onSelect(task.id)} title="查看详情"><MoreHorizontal size={19} /></button></div>;
}
