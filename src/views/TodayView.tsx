import { useEffect, useRef, useState } from "react";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, GripVertical, Lightbulb, Plus, RotateCcw, Sparkles, Star, Trash2 } from "lucide-react";
import { formatTaskDate, toDateKey } from "../lib/task-date";
import { completedExecutionOn, isDueOn } from "../lib/schedule";
import { applyDayOrder, readDayOrder, reorderIds, writeDayOrder } from "../lib/day-order";
import { parseQuickAdd, type QuickAddResult } from "../lib/quick-add";
import { dateDiff } from "../lib/task-date";
import { shiftDate } from "../lib/schedule";
import { timeBlockLabel } from "../labels";
import { TaskGroup } from "../components/TaskList";
import { DailyReviewSection } from "../components/DailyReviewSection";
import type { DailyReview, Task, TimeBlock } from "../types";

export function TodayView({ tasks, loaded, selectedDate, todayKey, selectedTaskId, onSelectTask, onSelectDate, onComplete, onAddProgress, onReschedule, onToggleFocus, onAssignTimeBlock, onReopenTask, onUndoExecution, onOpenComposer, onDeleteTask, onCreateTomorrow, dailyReview, onSaveReview }: { tasks: Task[]; loaded: boolean; selectedDate: string; todayKey: string; selectedTaskId: string | null; onSelectTask: (id: string) => void; onSelectDate: (date: string) => void; onComplete: (id: string) => void; onAddProgress: (id: string, completedToday: boolean, content: string) => void; onReschedule: (taskId: string, targetDate: string) => void; onToggleFocus: (taskId: string, date?: string) => void; onAssignTimeBlock: (taskId: string, timeBlock: TimeBlock) => void; onReopenTask: (taskId: string) => void; onUndoExecution: (taskId: string) => void; onOpenComposer: () => void; onDeleteTask: (taskId: string) => void; onCreateTomorrow: (parsed: QuickAddResult) => void; dailyReview: DailyReview; onSaveReview: (reflection: string, tomorrowFocus: string) => void }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [dayOrder, setDayOrder] = useState<string[]>(() => readDayOrder(selectedDate));
  const [celebrate, setCelebrate] = useState(false);
  const celebratedRef = useRef<Set<string>>(new Set());
  useEffect(() => { setDayOrder(readDayOrder(selectedDate)); }, [selectedDate]);
  const currentTasks = tasks.filter((task) => !task.completedAt && isDueOn(task, selectedDate) && !(task.repeat !== "none" && completedExecutionOn(task, selectedDate)));
  const carriedTasks = currentTasks.filter((task) => task.repeat === "none" && task.plannedDate < selectedDate);
  const plannedTasks = applyDayOrder(currentTasks.filter((task) => !carriedTasks.includes(task)), dayOrder);
  function handleReorder(activeId: string, overId: string) {
    const next = reorderIds(plannedTasks.map((task) => task.id), activeId, overId);
    setDayOrder(next);
    writeDayOrder(selectedDate, next);
  }
  const completedTodayTasks = tasks.filter((task) => task.completedAt?.slice(0, 10) === selectedDate);
  const executedRepeatTasks = tasks.filter((task) => !task.completedAt && task.repeat !== "none" && completedExecutionOn(task, selectedDate));
  const completedCount = completedTodayTasks.length + executedRepeatTasks.length + tasks.filter((task) => !task.completedAt && task.repeat === "none" && completedExecutionOn(task, selectedDate) && !currentTasks.includes(task)).length;
  const totalToday = currentTasks.length + completedCount;
  const completion = totalToday ? Math.round((completedCount / totalToday) * 100) : 0;
  const focusTasks = currentTasks.filter((task) => task.isFocus);
  const plannedMinutes = currentTasks.reduce((total, task) => total + task.estimateMinutes, 0);
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(`${selectedDate}T12:00:00`);
    day.setDate(day.getDate() - 3 + index);
    return toDateKey(day);
  });
  function handleBlockDragEnd(event: DragEndEvent) {
    const target = event.over?.id ? String(event.over.id) : "";
    if (target.startsWith("block:")) onAssignTimeBlock(String(event.active.id), target.slice(6) as TimeBlock);
  }
  const allDone = loaded && totalToday > 0 && currentTasks.length === 0;
  useEffect(() => {
    if (allDone && !celebratedRef.current.has(selectedDate)) {
      celebratedRef.current.add(selectedDate);
      setCelebrate(true);
      const timer = window.setTimeout(() => setCelebrate(false), 2800);
      return () => window.clearTimeout(timer);
    }
  }, [allDone, selectedDate]);
  return <section className="today-page">
    <div className="intro-row">
      <div><p className="eyebrow">{selectedDate === todayKey ? "今天" : "查看任务日"}</p><h1>{selectedDate === todayKey ? "慢慢来，也在向前。" : formatTaskDate(selectedDate)}</h1><p className="intro-copy">把注意力留给真正重要的事情。你的任务日将在明天凌晨 4:00 结束。</p></div>
      <div className="date-switcher"><button className="icon-button" onClick={() => { const day = new Date(`${selectedDate}T12:00:00`); day.setDate(day.getDate() - 1); onSelectDate(toDateKey(day)); }} title="前一天"><ChevronLeft size={18} /></button><button className="date-pill" onClick={() => onSelectDate(todayKey)}>回到今天</button><button className="icon-button" onClick={() => { const day = new Date(`${selectedDate}T12:00:00`); day.setDate(day.getDate() + 1); onSelectDate(toDateKey(day)); }} title="后一天"><ChevronRight size={18} /></button></div>
    </div>
    {loaded && tasks.length === 0 && <div className="onboarding-card"><Sparkles size={22} /><div><strong>欢迎来到 dayflow</strong><p>从留下第一件想完成的事开始，任务会按照你的节奏被安排进每一天。按 N 或点击右侧按钮即可创建。</p></div><button className="primary-button" onClick={onOpenComposer}><Plus size={16} />创建第一个任务</button></div>}
    <div className="week-strip">
      {week.map((date) => { const day = new Date(`${date}T12:00:00`); return <button key={date} className={`day-cell ${date === selectedDate ? "selected" : ""}`} onClick={() => onSelectDate(date)}><span>{["日", "一", "二", "三", "四", "五", "六"][day.getDay()]}</span><b>{day.getDate()}</b><i className={tasks.some((task) => !task.completedAt && isDueOn(task, date)) ? "has-tasks" : ""} /></button>; })}
    </div>
    <div className="progress-overview"><div className="progress-ring" style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}><span>{completion}%</span></div><div><strong>今日节奏刚刚好</strong><span>已完成 {completedCount} 项，待投入 {currentTasks.length} 项</span></div><div className="overview-stat"><b>{Math.round(plannedMinutes / 60 * 10) / 10}h</b><span>预计专注</span></div><div className="overview-stat"><b>{carriedTasks.length}</b><span>延续事项</span></div></div>
    <section className="daily-focus"><div><p className="eyebrow">今日关键三件事</p><h2>重点与容量</h2><span>{plannedMinutes > 240 ? `已超出 ${Math.round((plannedMinutes - 240) / 60 * 10) / 10} 小时，建议调整。` : `已规划 ${Math.round(plannedMinutes / 60 * 10) / 10} / 4 小时。`}</span></div><div className="focus-slots">{[0, 1, 2].map((index) => { const task = focusTasks[index]; return task ? <button className="focus-slot filled" key={task.id} onClick={() => onToggleFocus(task.id)}><strong>{task.title}</strong><small>{task.estimateMinutes} 分钟</small></button> : <span className="focus-slot" key={index}>留给最重要的事</span>; })}</div><div className="focus-candidates">{currentTasks.filter((task) => !task.isFocus).slice(0, 5).map((task) => <button key={task.id} onClick={() => onToggleFocus(task.id)}><Plus size={13} />{task.title}</button>)}</div></section>
    <section className="time-block-plan"><div className="time-block-heading"><div><p className="eyebrow">把任务放进一天</p><h2>时间块</h2></div><span>拖拽任务卡片到合适的时段</span></div><DndContext onDragEnd={handleBlockDragEnd}><div className="time-block-grid four">{(["morning", "afternoon", "evening", "unscheduled"] as TimeBlock[]).map((block) => <TimeBlockColumn key={block} block={block} tasks={plannedTasks.filter((task) => task.timeBlock === block)} onSelectTask={onSelectTask} onAssignTimeBlock={onAssignTimeBlock} />)}</div></DndContext></section>
    {selectedDate === todayKey && <StalledInsight tasks={carriedTasks} selectedDate={selectedDate} onReschedule={onReschedule} onSelectTask={onSelectTask} onDelete={onDeleteTask} />}
    {carriedTasks.length > 0 && <TaskGroup title="逾期任务" subtitle="重新安排后，再从容地继续。" icon={<Clock3 size={18} />} tasks={carriedTasks} selectedId={selectedTaskId} onSelect={onSelectTask} onComplete={onComplete} onCompleteToday={(id, done) => onAddProgress(id, done, "")} onReschedule={selectedDate === todayKey ? onReschedule : undefined} selectedDate={selectedDate} />}
    <TaskGroup title="今日计划" subtitle="拖动左侧手柄可调整执行顺序。" icon={<Sparkles size={18} />} tasks={plannedTasks} selectedId={selectedTaskId} onSelect={onSelectTask} onComplete={onComplete} onCompleteToday={(id, done) => onAddProgress(id, done, "")} onReorder={handleReorder} selectedDate={selectedDate} />
    {(completedTodayTasks.length > 0 || executedRepeatTasks.length > 0) && <section className="completed-group"><button className="completed-toggle" onClick={() => setShowCompleted((open) => !open)}><CheckCircle2 size={17} /><span>今日已完成 · {completedTodayTasks.length + executedRepeatTasks.length}</span><ChevronDown size={16} className={showCompleted ? "open" : ""} /></button>{showCompleted && <div className="task-list">{completedTodayTasks.map((task) => <div className="task-row completed" key={task.id}><CheckCircle2 size={19} className="completed-mark" /><button className="task-row-main" onClick={() => onSelectTask(task.id)}><div className="task-line"><strong>{task.title}</strong></div><div className="task-meta"><span className={`priority-dot ${task.priority}`} />{task.project && <span>{task.project}</span>}<span>已完成原任务</span></div></button><button className="restore-button" title="恢复为进行中" onClick={() => onReopenTask(task.id)}><RotateCcw size={15} />恢复</button></div>)}{executedRepeatTasks.map((task) => <div className="task-row completed" key={task.id}><CheckCircle2 size={19} className="completed-mark" /><button className="task-row-main" onClick={() => onSelectTask(task.id)}><div className="task-line"><strong>{task.title}</strong></div><div className="task-meta"><span className={`priority-dot ${task.priority}`} />{task.project && <span>{task.project}</span>}<span>本次周期执行已完成</span></div></button><button className="restore-button" title="撤销今日执行" onClick={() => onUndoExecution(task.id)}><RotateCcw size={15} />撤销</button></div>)}</div>}</section>}
    <DailyReviewSection review={dailyReview} onSave={onSaveReview} />
    {selectedDate === todayKey && <TomorrowPlan tasks={tasks} selectedDate={selectedDate} onToggleFocus={onToggleFocus} onSelectTask={onSelectTask} onCreateTomorrow={onCreateTomorrow} />}
    <button className="quiet-add" onClick={onOpenComposer}><Plus size={17} />添加一件想完成的事</button>
    {celebrate && <CelebrationOverlay />}
  </section>;
}

function StalledInsight({ tasks, selectedDate, onReschedule, onSelectTask, onDelete }: { tasks: Task[]; selectedDate: string; onReschedule: (taskId: string, targetDate: string) => void; onSelectTask: (id: string) => void; onDelete: (taskId: string) => void }) {
  const stalled = tasks
    .filter((task) => dateDiff(task.plannedDate, selectedDate) >= 3)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
    .slice(0, 3);
  if (!stalled.length) return null;
  return <section className="stalled-card"><div className="stalled-heading"><Lightbulb size={17} /><div><h2>积压洞察</h2><p>这几件事卡了一阵子。也许拆小一点、挪个时间，或者坦然放手。</p></div></div><div className="stalled-list">{stalled.map((task) => <div className="stalled-item" key={task.id}><button className="stalled-title" onClick={() => onSelectTask(task.id)}><strong>{task.title}</strong><em>已延 {dateDiff(task.plannedDate, selectedDate)} 天</em></button><div className="stalled-actions"><button onClick={() => onReschedule(task.id, shiftDate(selectedDate, 1))}>排到明天</button><button onClick={() => onSelectTask(task.id)}>拆成小步</button><button className="stalled-drop" onClick={() => onDelete(task.id)}><Trash2 size={12} />放手</button></div></div>)}</div></section>;
}

function TomorrowPlan({ tasks, selectedDate, onToggleFocus, onSelectTask, onCreateTomorrow }: { tasks: Task[]; selectedDate: string; onToggleFocus: (taskId: string, date?: string) => void; onSelectTask: (id: string) => void; onCreateTomorrow: (parsed: QuickAddResult) => void }) {
  const [text, setText] = useState("");
  const tomorrow = shiftDate(selectedDate, 1);
  const tomorrowTasks = tasks.filter((task) => !task.completedAt && isDueOn(task, tomorrow) && !(task.repeat !== "none" && completedExecutionOn(task, tomorrow)));
  const focusCount = tomorrowTasks.filter((task) => task.isFocus).length;
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseQuickAdd(text, tomorrow);
    if (!parsed?.title) return;
    onCreateTomorrow({ ...parsed, plannedDate: parsed.plannedDate ?? tomorrow });
    setText("");
  }
  return <section className="tomorrow-plan"><div className="tomorrow-heading"><div><p className="eyebrow">为明天铺路</p><h2>明日预备</h2><span>{formatTaskDate(tomorrow)} · 已选重点 {focusCount}/3</span></div><span className="tomorrow-count">{tomorrowTasks.length} 项待办</span></div>{tomorrowTasks.length ? <div className="tomorrow-list">{tomorrowTasks.slice(0, 8).map((task) => <div className="tomorrow-item" key={task.id}><button className={`tomorrow-star ${task.isFocus ? "on" : ""}`} title={task.isFocus ? "取消明日重点" : "设为明日重点"} onClick={() => onToggleFocus(task.id, tomorrow)} disabled={!task.isFocus && focusCount >= 3}><Star size={15} /></button><button className="tomorrow-title" onClick={() => onSelectTask(task.id)}><span>{task.title}</span><small>{task.estimateMinutes} 分钟</small></button></div>)}{tomorrowTasks.length > 8 && <p className="tomorrow-more">还有 {tomorrowTasks.length - 8} 项，可在日历中查看。</p>}</div> : <p className="tomorrow-empty">明天还是一张白纸，先安排一件最重要的事吧。</p>}<form className="tomorrow-composer" onSubmit={submit}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="为明天添加一件事，支持快速添加语法（如：上午 写方案 1小时）" /><button type="submit" title="添加到明天"><Plus size={15} /></button></form></section>;
}

const CONFETTI_COLORS = ["#52765c", "#d8877f", "#d1a866", "#64819b", "#94b5a0", "#c35f55"];

function CelebrationOverlay() {
  const pieces = Array.from({ length: 30 }, (_, index) => ({
    left: (index * 37 + 13) % 100,
    delay: ((index * 53) % 40) / 100,
    duration: 1.6 + ((index * 29) % 80) / 100,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    tilt: ((index * 71) % 360)
  }));
  return <div className="celebration-overlay" aria-hidden="true"><div className="celebration-toast"><Sparkles size={17} />今日任务全部完成，漂亮！</div>{pieces.map((piece, index) => <i key={index} style={{ left: `${piece.left}%`, animationDelay: `${piece.delay}s`, animationDuration: `${piece.duration}s`, background: piece.color, transform: `rotate(${piece.tilt}deg)` }} />)}</div>;
}

function TimeBlockColumn({ block, tasks, onSelectTask, onAssignTimeBlock }: { block: TimeBlock; tasks: Task[]; onSelectTask: (id: string) => void; onAssignTimeBlock: (taskId: string, timeBlock: TimeBlock) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `block:${block}` });
  return <section ref={setNodeRef} className={isOver ? "drag-over" : ""}><h3>{timeBlockLabel[block]}</h3>{tasks.map((task) => <TimeBlockChip key={task.id} task={task} onSelectTask={onSelectTask} onAssignTimeBlock={onAssignTimeBlock} />)}{tasks.length === 0 && <p>{block === "unscheduled" ? "拖到这里表示待安排" : "暂未安排"}</p>}</section>;
}

function TimeBlockChip({ task, onSelectTask, onAssignTimeBlock }: { task: Task; onSelectTask: (id: string) => void; onAssignTimeBlock: (taskId: string, timeBlock: TimeBlock) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  return <div ref={setNodeRef} className={`time-block-task draggable ${isDragging ? "dragging" : ""}`} style={{ transform: CSS.Translate.toString(transform) }}><span className="drag-handle" title="拖拽调整时段" {...listeners} {...attributes}><GripVertical size={12} /></span><button onClick={() => onSelectTask(task.id)}>{task.dueAt && <em>{task.dueAt}</em>}{task.title}</button><select value={task.timeBlock} onChange={(event) => onAssignTimeBlock(task.id, event.target.value as TimeBlock)} aria-label={`调整 ${task.title} 的时间块`}><option value="morning">上午</option><option value="afternoon">下午</option><option value="evening">晚上</option><option value="unscheduled">待安排</option></select></div>;
}
