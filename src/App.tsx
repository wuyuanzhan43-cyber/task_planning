import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive, BarChart3, Bell, CalendarDays, Check, CheckCircle2, ChevronLeft,
  ChevronRight, Circle, Clock3, FolderKanban, ListTodo, MoreHorizontal,
  Plus, Search, Settings, Sparkles, Target, X, CalendarRange, GripVertical,
  LayoutGrid, Pencil, Trash2, TrendingUp
} from "lucide-react";
import { sampleTasks } from "./data/sample";
import { dateDiff, formatTaskDate, getTaskDate, toDateKey } from "./lib/task-date";
import { loadAllDailyReviews, loadDailyReview, loadDailyReviews, loadTasks, replaceDailyReviews, saveDailyReview, saveTasks, usesSqlite } from "./lib/storage";
import type { DailyReview, Priority, RepeatRule, Task, TimeBlock } from "./types";

type View = "today" | "calendar" | "tasks" | "projects" | "insights" | "settings";
type Theme = "sage" | "coral" | "coast" | "midnight";
type UndoState = { label: string; tasks: Task[] } | null;
const AUTO_BACKUP_KEY = "dayflow.auto-backups.v1";
const THEME_KEY = "dayflow.theme.v1";

const navigation: Array<{ id: View; label: string; icon: typeof CalendarDays }> = [
  { id: "today", label: "今日", icon: Sparkles },
  { id: "calendar", label: "日历", icon: CalendarDays },
  { id: "tasks", label: "全部任务", icon: ListTodo },
  { id: "projects", label: "项目", icon: FolderKanban },
  { id: "insights", label: "复盘与统计", icon: BarChart3 }
];

const priorityLabel: Record<Priority, string> = { high: "重要", medium: "正常", low: "轻缓" };
const repeatLabel: Record<RepeatRule, string> = { none: "不重复", daily: "每天", weekdays: "工作日", weekly: "每周", monthly: "每月" };
const timeBlockLabel: Record<TimeBlock, string> = { morning: "上午", afternoon: "下午", evening: "晚上", unscheduled: "待安排" };

function isDueOn(task: Task, date: string): boolean {
  if (date < task.plannedDate) return false;
  if (task.repeat === "none") return true;
  const current = new Date(`${date}T12:00:00`);
  const start = new Date(`${task.plannedDate}T12:00:00`);
  if (task.repeat === "daily") return true;
  if (task.repeat === "weekdays") return current.getDay() > 0 && current.getDay() < 6;
  if (task.repeat === "weekly") return current.getDay() === start.getDay();
  return current.getDate() === start.getDate();
}

function completedExecutionOn(task: Task, date: string): boolean {
  return task.progress.some((entry) => entry.taskDate === date && entry.completedToday);
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("today");
  const [selectedDate, setSelectedDate] = useState(getTaskDate());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [progressText, setProgressText] = useState("");
  const [dailyReview, setDailyReview] = useState<DailyReview>({ taskDate: selectedDate, reflection: "", tomorrowFocus: "", updatedAt: "" });
  const [reviewSaved, setReviewSaved] = useState(false);
  const [undo, setUndo] = useState<UndoState>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    return savedTheme === "coral" || savedTheme === "coast" || savedTheme === "midnight" ? savedTheme : "sage";
  });
  const savedTasksRef = useRef<Task[]>([]);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    void loadTasks().then((saved) => {
      const initialTasks = saved.length > 0 ? saved : (import.meta.env.DEV ? sampleTasks : []);
      savedTasksRef.current = initialTasks;
      setTasks(initialTasks);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const previousTasks = savedTasksRef.current;
    savedTasksRef.current = tasks;
    saveQueueRef.current = saveQueueRef.current
      .then(() => saveTasks(tasks, previousTasks))
      .catch(() => undefined);
  }, [loaded, tasks]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!loaded) return;
    try {
      const backups = JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY) ?? "[]") as Array<{ createdAt: string; tasks: Task[] }>;
      localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify([{ createdAt: new Date().toISOString(), tasks }, ...backups].slice(0, 5)));
    } catch { /* Backup is best effort and must not interrupt task saving. */ }
  }, [loaded, tasks]);

  useEffect(() => {
    setReviewSaved(false);
    void loadDailyReview(selectedDate).then(setDailyReview);
  }, [selectedDate]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const currentTasks = useMemo(
    () => tasks.filter((task) => !task.completedAt && isDueOn(task, selectedDate) && !(task.repeat !== "none" && completedExecutionOn(task, selectedDate))),
    [tasks, selectedDate]
  );
  const carriedTasks = currentTasks.filter((task) => task.repeat === "none" && task.plannedDate < selectedDate);
  const plannedTasks = currentTasks.filter((task) => !carriedTasks.includes(task));
  const completedToday = tasks.filter((task) =>
    task.completedAt?.slice(0, 10) === selectedDate || (task.repeat !== "none" && completedExecutionOn(task, selectedDate))
  ).length;
  const totalToday = currentTasks.length + completedToday;
  const completion = totalToday ? Math.round((completedToday / totalToday) * 100) : 0;
  const focusTasks = currentTasks.filter((task) => task.isFocus);
  const plannedMinutes = currentTasks.reduce((total, task) => total + task.estimateMinutes, 0);

  function updateTask(taskId: string, update: (task: Task) => Task) {
    setTasks((items) => items.map((task) => task.id === taskId ? update(task) : task));
  }

  function completeTask(taskId: string) {
    setUndo({ label: "已完成任务", tasks });
    updateTask(taskId, (task) => ({ ...task, completedAt: new Date().toISOString() }));
    setSelectedTaskId(null);
  }

  function completeTasks(taskIds: string[]) {
    setUndo({ label: `已完成 ${taskIds.length} 项任务`, tasks });
    const selected = new Set(taskIds);
    const completedAt = new Date().toISOString();
    setTasks((items) => items.map((task) => selected.has(task.id) && !task.completedAt ? { ...task, completedAt } : task));
  }

  function toggleFocus(taskId: string) {
    const focusCount = currentTasks.filter((task) => task.isFocus).length;
    updateTask(taskId, (task) => ({ ...task, isFocus: task.isFocus ? false : focusCount < 3 }));
  }

  function assignTimeBlock(taskId: string, timeBlock: TimeBlock) {
    updateTask(taskId, (task) => ({ ...task, timeBlock }));
  }

  function deleteTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !window.confirm(`确定删除“${task.title}”吗？此操作无法撤销。`)) return;
    setUndo({ label: "已删除任务", tasks });
    setTasks((items) => items.filter((item) => item.id !== taskId));
    setSelectedTaskId(null);
    setEditingTaskId(null);
  }

  function deleteTasks(taskIds: string[]) {
    const selected = new Set(taskIds);
    if (!selected.size || !window.confirm(`确定删除选中的 ${selected.size} 项任务吗？此操作无法撤销。`)) return false;
    setUndo({ label: `已删除 ${selected.size} 项任务`, tasks });
    setTasks((items) => items.filter((task) => !selected.has(task.id)));
    setSelectedTaskId((id) => id && selected.has(id) ? null : id);
    return true;
  }

  function saveTask(taskId: string, form: FormData) {
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    updateTask(taskId, (task) => ({
      ...task,
      title,
      description: String(form.get("description") || "").trim(),
      project: String(form.get("project") || "收集箱").trim() || "收集箱",
      tags: String(form.get("tags") || "").split("，").map((item) => item.trim()).filter(Boolean),
      priority: String(form.get("priority") || "medium") as Priority,
      plannedDate: String(form.get("plannedDate") || task.plannedDate),
      estimateMinutes: Number(form.get("estimateMinutes") || 0),
      repeat: String(form.get("repeat") || "none") as RepeatRule,
      dueAt: String(form.get("dueAt") || "") || undefined,
      timeBlock: String(form.get("timeBlock") || "unscheduled") as TimeBlock,
      isFocus: form.get("isFocus") === "on"
    }));
    setEditingTaskId(null);
  }

  function addSubtask(taskId: string, title: string) {
    const value = title.trim();
    if (!value) return;
    updateTask(taskId, (task) => ({ ...task, subtasks: [...task.subtasks, { id: makeId("subtask"), title: value, completed: false }] }));
  }

  function toggleSubtask(taskId: string, subtaskId: string) {
    updateTask(taskId, (task) => ({
      ...task,
      subtasks: task.subtasks.map((subtask) => subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask)
    }));
  }

  function deleteSubtask(taskId: string, subtaskId: string) {
    updateTask(taskId, (task) => ({ ...task, subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId) }));
  }

  function rescheduleTask(taskId: string, targetDate: string) {
    updateTask(taskId, (task) => {
      if (task.plannedDate === targetDate) return task;
      const changedAt = new Date().toISOString();
      return {
        ...task,
        plannedDate: targetDate,
        progress: [...task.progress, {
          id: makeId("progress"), taskDate: getTaskDate(),
          content: `计划从 ${formatTaskDate(task.plannedDate)} 调整至 ${formatTaskDate(targetDate)}。`,
          completedToday: false, createdAt: changedAt
        }]
      };
    });
  }

  function rescheduleTasks(taskIds: string[], targetDate: string) {
    setUndo({ label: `已调整 ${taskIds.length} 项任务`, tasks });
    const selected = new Set(taskIds);
    const changedAt = new Date().toISOString();
    setTasks((items) => items.map((task) => {
      if (!selected.has(task.id) || task.plannedDate === targetDate) return task;
      return {
        ...task,
        plannedDate: targetDate,
        progress: [...task.progress, {
          id: makeId("progress"), taskDate: getTaskDate(),
          content: `计划从 ${formatTaskDate(task.plannedDate)} 调整至 ${formatTaskDate(targetDate)}。`,
          completedToday: false, createdAt: changedAt
        }]
      };
    }));
  }

  function addProgress(taskId: string, completedToday: boolean) {
    const content = progressText.trim();
    updateTask(taskId, (task) => ({
      ...task,
      progress: [...task.progress, {
        id: makeId("progress"), taskDate: selectedDate,
        content: content || (task.repeat === "none" ? "完成今日执行，原任务继续保留。" : "完成本次周期执行。"),
        completedToday, createdAt: new Date().toISOString()
      }]
    }));
    setProgressText("");
  }

  function createTask(form: FormData) {
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    const task: Task = {
      id: makeId("task"), title, description: String(form.get("description") || "").trim(),
      project: String(form.get("project") || "收集箱"), tags: String(form.get("tags") || "").split("，").map((item) => item.trim()).filter(Boolean),
      priority: String(form.get("priority") || "medium") as Priority,
      plannedDate: String(form.get("plannedDate") || selectedDate), dueAt: String(form.get("dueAt") || "") || undefined,
      timeBlock: String(form.get("timeBlock") || "unscheduled") as TimeBlock, isFocus: form.get("isFocus") === "on", estimateMinutes: Number(form.get("estimateMinutes") || 30),
      repeat: String(form.get("repeat") || "none") as RepeatRule, createdAt: new Date().toISOString(), progress: [], subtasks: []
    };
    setTasks((items) => [task, ...items]);
    setShowComposer(false);
    setSelectedTaskId(task.id);
  }

  function persistDailyReview() {
    const review = { ...dailyReview, taskDate: selectedDate, updatedAt: new Date().toISOString() };
    setDailyReview(review);
    void saveDailyReview(review).then(() => setReviewSaved(true));
  }

  async function exportData() {
    const reviews = await loadAllDailyReviews();
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks, dailyReviews: reviews }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dayflow-backup-${getTaskDate()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    try {
      const data = JSON.parse(await file.text()) as { tasks?: Task[]; dailyReviews?: DailyReview[] };
      if (!Array.isArray(data.tasks)) throw new Error("invalid backup");
      setUndo({ label: "已导入备份", tasks });
      setTasks(data.tasks);
      if (Array.isArray(data.dailyReviews)) await replaceDailyReviews(data.dailyReviews);
    } catch { window.alert("无法读取备份文件，请选择 Dayflow 导出的 JSON 文件。"); }
  }

  function restoreUndo() {
    if (!undo) return;
    setTasks(undo.tasks);
    setUndo(null);
  }

  const todayKey = getTaskDate();
  const overdueCount = tasks.filter((task) => !task.completedAt && task.repeat === "none" && task.plannedDate < todayKey).length;
  const week = Array.from({ length: 7 }, (_, index) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() - 3 + index);
    return toDateKey(d);
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Target size={17} /></span><span>dayflow</span></div>
        <div className="workspace-label">我的空间</div>
        <nav className="navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button className={`nav-item ${view === id ? "active" : ""}`} key={id} onClick={() => setView(id)}>
              <Icon size={18} /><span>{label}</span>{id === "today" && overdueCount > 0 && <i>{overdueCount}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-card">
          <span className="soft-icon"><Clock3 size={16} /></span>
          <p>任务日于凌晨 4:00 结算</p>
          <span>未完成事项会温和地带入下一天</span>
        </div>
        <button className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><Settings size={18} /><span>设置</span></button>
        <div className="profile"><div className="avatar">Y</div><div><strong>沅展</strong><span>本地工作空间</span></div><MoreHorizontal size={18} /></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="crumb"><span>{view === "today" ? "每日规划" : navigation.find((item) => item.id === view)?.label ?? "设置"}</span><b>/</b><strong>{view === "today" ? formatTaskDate(selectedDate) : "总览"}</strong></div>
          <div className="topbar-actions"><button className="icon-button" title="搜索"><Search size={19} /></button><button className="icon-button notification" title="应用内提醒"><Bell size={19} /><i /></button><button className="primary-button" onClick={() => setShowComposer(true)}><Plus size={18} />新建任务</button></div>
        </header>

        {view === "today" ? (
          <section className="today-page">
            <div className="intro-row">
              <div><p className="eyebrow">{selectedDate === todayKey ? "今天" : "查看任务日"}</p><h1>{selectedDate === todayKey ? "慢慢来，也在向前。" : formatTaskDate(selectedDate)}</h1><p className="intro-copy">把注意力留给真正重要的事情。你的任务日将在明天凌晨 4:00 结束。</p></div>
              <div className="date-switcher"><button className="icon-button" onClick={() => { const d = new Date(`${selectedDate}T12:00:00`); d.setDate(d.getDate() - 1); setSelectedDate(toDateKey(d)); }} title="前一天"><ChevronLeft size={18} /></button><button className="date-pill" onClick={() => setSelectedDate(todayKey)}>回到今天</button><button className="icon-button" onClick={() => { const d = new Date(`${selectedDate}T12:00:00`); d.setDate(d.getDate() + 1); setSelectedDate(toDateKey(d)); }} title="后一天"><ChevronRight size={18} /></button></div>
            </div>
            <div className="week-strip">
              {week.map((date) => { const day = new Date(`${date}T12:00:00`); return <button key={date} className={`day-cell ${date === selectedDate ? "selected" : ""}`} onClick={() => setSelectedDate(date)}><span>{["日", "一", "二", "三", "四", "五", "六"][day.getDay()]}</span><b>{day.getDate()}</b><i className={tasks.some((task) => !task.completedAt && isDueOn(task, date)) ? "has-tasks" : ""} /></button>; })}
            </div>
            <div className="progress-overview"><div className="progress-ring" style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}><span>{completion}%</span></div><div><strong>今日节奏刚刚好</strong><span>已完成 {completedToday} 项，待投入 {currentTasks.length} 项</span></div><div className="overview-stat"><b>{Math.round(currentTasks.reduce((total, task) => total + task.estimateMinutes, 0) / 60 * 10) / 10}h</b><span>预计专注</span></div><div className="overview-stat"><b>{carriedTasks.length}</b><span>延续事项</span></div></div>
            <section className="daily-focus"><div><p className="eyebrow">今日关键三件事</p><h2>重点与容量</h2><span>{plannedMinutes > 240 ? `已超出 ${Math.round((plannedMinutes - 240) / 60 * 10) / 10} 小时，建议调整。` : `已规划 ${Math.round(plannedMinutes / 60 * 10) / 10} / 4 小时。`}</span></div><div className="focus-slots">{[0, 1, 2].map((index) => { const task = focusTasks[index]; return task ? <button className="focus-slot filled" key={task.id} onClick={() => toggleFocus(task.id)}><strong>{task.title}</strong><small>{task.estimateMinutes} 分钟</small></button> : <span className="focus-slot" key={index}>留给最重要的事</span>; })}</div><div className="focus-candidates">{currentTasks.filter((task) => !task.isFocus).slice(0, 5).map((task) => <button key={task.id} onClick={() => toggleFocus(task.id)}><Plus size={13} />{task.title}</button>)}</div></section>
            <section className="time-block-plan"><div className="time-block-heading"><div><p className="eyebrow">把任务放进一天</p><h2>时间块</h2></div><span>为任务分配更合适的时段</span></div><div className="time-block-grid">{(["morning", "afternoon", "evening"] as TimeBlock[]).map((block) => <section key={block}><h3>{timeBlockLabel[block]}</h3>{plannedTasks.filter((task) => task.timeBlock === block).map((task) => <div className="time-block-task" key={task.id}><button onClick={() => setSelectedTaskId(task.id)}>{task.dueAt && <em>{task.dueAt}</em>}{task.title}</button><select value={task.timeBlock} onChange={(event) => assignTimeBlock(task.id, event.target.value as TimeBlock)} aria-label={`调整 ${task.title} 的时间块`}><option value="morning">上午</option><option value="afternoon">下午</option><option value="evening">晚上</option><option value="unscheduled">待安排</option></select></div>)}{!plannedTasks.some((task) => task.timeBlock === block) && <p>暂未安排</p>}</section>)}</div></section>
            {carriedTasks.length > 0 && <TaskGroup title="逾期任务" subtitle="重新安排后，再从容地继续。" icon={<Clock3 size={18} />} tasks={carriedTasks} selectedId={selectedTaskId} onSelect={setSelectedTaskId} onComplete={completeTask} onCompleteToday={addProgress} onReschedule={selectedDate === todayKey ? rescheduleTask : undefined} selectedDate={selectedDate} />}
            <TaskGroup title="今日计划" subtitle="为今天留出一点空间和专注。" icon={<Sparkles size={18} />} tasks={plannedTasks} selectedId={selectedTaskId} onSelect={setSelectedTaskId} onComplete={completeTask} onCompleteToday={addProgress} selectedDate={selectedDate} />
            <DailyReviewSection review={dailyReview} onChange={setDailyReview} onSave={persistDailyReview} saved={reviewSaved} />
            <button className="quiet-add" onClick={() => setShowComposer(true)}><Plus size={17} />添加一件想完成的事</button>
          </section>
        ) : <WorkspaceView view={view} tasks={tasks} selectedDate={selectedDate} onSelectTask={setSelectedTaskId} onSelectDate={setSelectedDate} onReschedule={rescheduleTask} onCompleteTasks={completeTasks} onDeleteTasks={deleteTasks} onRescheduleTasks={rescheduleTasks} onExportData={exportData} onImportData={importData} theme={theme} onThemeChange={setTheme} />}
      </main>

      {selectedTask && <TaskDetail task={selectedTask} selectedDate={selectedDate} progressText={progressText} onProgressTextChange={setProgressText} onAddProgress={addProgress} onComplete={completeTask} onEdit={() => setEditingTaskId(selectedTask.id)} onDelete={deleteTask} onAddSubtask={addSubtask} onToggleSubtask={toggleSubtask} onDeleteSubtask={deleteSubtask} onClose={() => setSelectedTaskId(null)} />}
      {showComposer && <TaskComposer selectedDate={selectedDate} onClose={() => setShowComposer(false)} onSubmit={createTask} />}
      {editingTaskId && tasks.find((task) => task.id === editingTaskId) && <TaskComposer task={tasks.find((task) => task.id === editingTaskId)!} selectedDate={selectedDate} onClose={() => setEditingTaskId(null)} onSubmit={(form) => saveTask(editingTaskId, form)} />}
      {undo && <div className="undo-toast"><span>{undo.label}</span><button onClick={restoreUndo}>撤销</button><button title="关闭" onClick={() => setUndo(null)}><X size={15} /></button></div>}
    </div>
  );
}

function TaskGroup({ title, subtitle, icon, tasks, selectedId, onSelect, onComplete, onCompleteToday, onReschedule, selectedDate }: { title: string; subtitle: string; icon: React.ReactNode; tasks: Task[]; selectedId: string | null; onSelect: (id: string) => void; onComplete: (id: string) => void; onCompleteToday: (id: string, completedToday: boolean) => void; onReschedule?: (taskId: string, targetDate: string) => void; selectedDate: string }) {
  return <section className="task-group"><div className="group-heading"><div className="group-title"><span>{icon}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div><span className="group-count">{tasks.length}</span></div><div className="task-list">{tasks.length === 0 ? <div className="empty-line">这里留一点空白给自己。</div> : tasks.map((task) => <TaskRow key={task.id} task={task} selected={selectedId === task.id} onSelect={onSelect} onComplete={onComplete} onCompleteToday={onCompleteToday} onReschedule={onReschedule} selectedDate={selectedDate} />)}</div></section>;
}

function TaskRow({ task, selected, onSelect, onComplete, onCompleteToday, onReschedule, selectedDate }: { task: Task; selected: boolean; onSelect: (id: string) => void; onComplete: (id: string) => void; onCompleteToday?: (id: string, completedToday: boolean) => void; onReschedule?: (taskId: string, targetDate: string) => void; selectedDate: string }) {
  const days = dateDiff(task.plannedDate, selectedDate);
  const canCompleteToday = task.repeat !== "none" || days > 0;
  return <div className={`task-row ${selected ? "selected" : ""}`}><button className="check-button" title={canCompleteToday ? "完成今日执行" : "完成原任务"} onClick={() => { if (canCompleteToday) onCompleteToday?.(task.id, true); else onComplete(task.id); }}>{canCompleteToday ? <Check size={20} /> : <Circle size={20} />}</button><button className="task-row-main" onClick={() => onSelect(task.id)}><div className="task-line"><strong>{task.title}</strong>{task.repeat !== "none" && <span className="repeat-chip">{repeatLabel[task.repeat]}</span>}</div><div className="task-meta"><span className={`priority-dot ${task.priority}`} />{task.project && <span>{task.project}</span>}{task.estimateMinutes > 0 && <span><Clock3 size={13} />{task.estimateMinutes} 分钟</span>}{days > 0 && <span className="carry-label">已延续 {days} 天</span>}</div></button>{onReschedule && days > 0 && <div className="reschedule-actions"><button title="移至今天" onClick={() => onReschedule(task.id, selectedDate)}>今天</button><button title="移至明天" onClick={() => onReschedule(task.id, shiftDate(selectedDate, 1))}>明天</button><input aria-label="移至指定日期" type="date" value={task.plannedDate} min={selectedDate} onChange={(event) => onReschedule(task.id, event.target.value)} /></div>}<button className="more-button" onClick={() => onSelect(task.id)} title="查看详情"><MoreHorizontal size={19} /></button></div>;
}

function DailyReviewSection({ review, onChange, onSave, saved }: { review: DailyReview; onChange: (review: DailyReview) => void; onSave: () => void; saved: boolean }) {
  return <section className="daily-review"><div className="review-heading"><div><p className="eyebrow">一天的收尾</p><h2>每日复盘</h2><span>留下一点感受，让明天更从容。</span></div><button className="review-save" onClick={onSave}>{saved ? <Check size={15} /> : null}{saved ? "已保存" : "保存复盘"}</button></div><div className="review-fields"><label><span>今天有哪些进展或困难？</span><textarea value={review.reflection} onChange={(event) => onChange({ ...review, reflection: event.target.value })} placeholder="例如：上午专注度很好，下午被临时事项打断。" /></label><label><span>明天最想优先完成什么？</span><textarea value={review.tomorrowFocus} onChange={(event) => onChange({ ...review, tomorrowFocus: event.target.value })} placeholder="给明天留下一件最重要的小事。" /></label></div></section>;
}

function TaskDetail({ task, selectedDate, progressText, onProgressTextChange, onAddProgress, onComplete, onEdit, onDelete, onAddSubtask, onToggleSubtask, onDeleteSubtask, onClose }: { task: Task; selectedDate: string; progressText: string; onProgressTextChange: (value: string) => void; onAddProgress: (taskId: string, completedToday: boolean) => void; onComplete: (taskId: string) => void; onEdit: () => void; onDelete: (taskId: string) => void; onAddSubtask: (taskId: string, title: string) => void; onToggleSubtask: (taskId: string, subtaskId: string) => void; onDeleteSubtask: (taskId: string, subtaskId: string) => void; onClose: () => void }) {
  const entries = [...task.progress].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [subtaskTitle, setSubtaskTitle] = useState("");
  function submitSubtask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddSubtask(task.id, subtaskTitle);
    setSubtaskTitle("");
  }
  return <aside className="detail-panel"><header><button className="icon-button" title="关闭详情" onClick={onClose}><X size={19} /></button><div className="detail-actions"><button className="icon-button" title="编辑任务" onClick={onEdit}><Pencil size={16} /></button><button className="icon-button danger-button" title="删除任务" onClick={() => onDelete(task.id)}><Trash2 size={16} /></button><button className="detail-today" onClick={() => onAddProgress(task.id, true)}><CheckCircle2 size={16} />完成今日执行</button><button className="detail-complete" onClick={() => onComplete(task.id)}><Check size={16} />完成原任务</button></div></header><div className="detail-content"><div className="detail-project"><FolderKanban size={15} />{task.project || "收集箱"}</div><h2>{task.title}</h2>{task.description && <p className="detail-description">{task.description}</p>}<div className="detail-info"><div><span>任务日</span><strong>{formatTaskDate(task.plannedDate)}</strong></div><div><span>预计用时</span><strong>{task.estimateMinutes} 分钟</strong></div><div><span>重复</span><strong>{repeatLabel[task.repeat]}</strong></div></div><section className="subtasks"><div className="detail-section-title"><h3>子任务</h3><span>{task.subtasks.filter((item) => item.completed).length}/{task.subtasks.length}</span></div>{task.subtasks.length ? <div className="subtask-list">{task.subtasks.map((item) => <div className={`subtask ${item.completed ? "completed" : ""}`} key={item.id}><button className="subtask-toggle" title={item.completed ? "标记为未完成" : "标记为已完成"} onClick={() => onToggleSubtask(task.id, item.id)}>{item.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}</button><span>{item.title}</span><button className="subtask-delete" title="删除子任务" onClick={() => onDeleteSubtask(task.id, item.id)}><Trash2 size={14} /></button></div>)}</div> : <p className="empty-copy">还没有子任务。</p>}<form className="subtask-composer" onSubmit={submitSubtask}><input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="添加一个子任务" /><button type="submit" title="添加子任务"><Plus size={15} /></button></form></section><section className="progress-section"><div className="detail-section-title"><h3>每日进展</h3><span>{entries.length} 条记录</span></div><div className="progress-composer"><textarea value={progressText} onChange={(event) => onProgressTextChange(event.target.value)} placeholder={`写下 ${formatTaskDate(selectedDate)} 的进展...`} /><div><span>记录不会自动完成原任务</span><button onClick={() => onAddProgress(task.id, false)}>添加进展</button></div></div><div className="timeline">{entries.length ? entries.map((entry) => <div className="timeline-entry" key={entry.id}><span className="timeline-dot" /><div><div className="timeline-date">{formatTaskDate(entry.taskDate)}{entry.completedToday && <em>今日完成</em>}</div><p>{entry.content}</p></div></div>) : <p className="empty-copy">从今天的一点进展开始吧。</p>}</div></section></div></aside>;
}

function TaskComposer({ task, selectedDate, onClose, onSubmit }: { task?: Task; selectedDate: string; onClose: () => void; onSubmit: (form: FormData) => void }) {
  const editing = Boolean(task);
  return <div className="modal-backdrop" role="presentation"><form className="task-composer" onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }}><header><div><p className="eyebrow">{editing ? "调整安排" : "新的安排"}</p><h2>{editing ? "编辑任务" : "留下一件想完成的事"}</h2></div><button type="button" className="icon-button" onClick={onClose} title="关闭"><X size={19} /></button></header><label className="large-field"><span>任务名称</span><input name="title" autoFocus defaultValue={task?.title} placeholder="例如：整理本周会议笔记" /></label><label><span>补充说明</span><textarea name="description" defaultValue={task?.description} placeholder="为它写一点上下文..." /></label><div className="form-grid"><label><span>项目</span><input name="project" defaultValue={task?.project ?? "收集箱"} /></label><label><span>计划任务日</span><input name="plannedDate" type="date" defaultValue={task?.plannedDate ?? selectedDate} /></label><label><span>优先级</span><select name="priority" defaultValue={task?.priority ?? "medium"}><option value="high">重要</option><option value="medium">正常</option><option value="low">轻缓</option></select></label><label><span>重复</span><select name="repeat" defaultValue={task?.repeat ?? "none"}><option value="none">不重复</option><option value="daily">每天</option><option value="weekdays">工作日</option><option value="weekly">每周</option><option value="monthly">每月</option></select></label><label><span>预计分钟</span><input name="estimateMinutes" type="number" min="0" defaultValue={task?.estimateMinutes ?? 30} /></label><label><span>标签（用中文逗号分隔）</span><input name="tags" defaultValue={task?.tags.join("，")} placeholder="工作，深度专注" /></label></div><footer><button type="button" className="text-button" onClick={onClose}>取消</button><button className="primary-button" type="submit">{editing ? <Pencil size={16} /> : <Plus size={17} />}{editing ? "保存修改" : "创建任务"}</button></footer></form></div>;
}

function shiftDate(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return toDateKey(value);
}

function weekStart(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  const offset = value.getDay() === 0 ? -6 : 1 - value.getDay();
  value.setDate(value.getDate() + offset);
  return toDateKey(value);
}

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

type CalendarMode = "month" | "week" | "day";

function WorkspaceView({ view, tasks, selectedDate, onSelectTask, onSelectDate, onReschedule, onCompleteTasks, onDeleteTasks, onRescheduleTasks, onExportData, onImportData, theme, onThemeChange }: { view: Exclude<View, "today">; tasks: Task[]; selectedDate: string; onSelectTask: (id: string) => void; onSelectDate: (date: string) => void; onReschedule: (taskId: string, targetDate: string) => void; onCompleteTasks: (taskIds: string[]) => void; onDeleteTasks: (taskIds: string[]) => boolean; onRescheduleTasks: (taskIds: string[], targetDate: string) => void; onExportData: () => Promise<void>; onImportData: (file: File) => Promise<void>; theme: Theme; onThemeChange: (theme: Theme) => void }) {
  if (view === "settings") return <SettingsWorkspace onExportData={onExportData} onImportData={onImportData} theme={theme} onThemeChange={onThemeChange} />;
  if (view === "calendar") return <CalendarWorkspace tasks={tasks} selectedDate={selectedDate} onSelectDate={onSelectDate} onSelectTask={onSelectTask} onReschedule={onReschedule} />;
  if (view === "projects") return <ProjectsWorkspace tasks={tasks} onSelectTask={onSelectTask} />;
  if (view === "insights") return <InsightsWorkspace tasks={tasks} selectedDate={selectedDate} />;
  return <TasksWorkspace tasks={tasks} selectedDate={selectedDate} onSelectTask={onSelectTask} onCompleteTasks={onCompleteTasks} onDeleteTasks={onDeleteTasks} onRescheduleTasks={onRescheduleTasks} />;
}

function SettingsWorkspace({ onExportData, onImportData, theme, onThemeChange }: { onExportData: () => Promise<void>; onImportData: (file: File) => Promise<void>; theme: Theme; onThemeChange: (theme: Theme) => void }) {
  const themes: Array<{ id: Theme; name: string; note: string }> = [{ id: "sage", name: "自然绿", note: "安静、平衡" }, { id: "coral", name: "明亮珊瑚", note: "温暖、有活力" }, { id: "coast", name: "冷静海岸", note: "清晰、专注" }, { id: "midnight", name: "深夜高对比", note: "沉浸、醒目" }];
  return <section className="workspace-page settings-workspace"><p className="eyebrow">偏好设置</p><h1>让系统配合你的节奏。</h1><section className="theme-panel"><div><p className="eyebrow">界面外观</p><h2>选择主题</h2><span>颜色会立即应用并在下次启动时保留。</span></div><div className="theme-grid">{themes.map((item) => <button key={item.id} className={`theme-option theme-${item.id} ${theme === item.id ? "selected" : ""}`} onClick={() => onThemeChange(item.id)}><span className="theme-swatches"><i /><i /><i /></span><strong>{item.name}</strong><small>{item.note}</small>{theme === item.id && <Check size={16} />}</button>)}</div></section><div className="settings-list"><div><div><Clock3 size={18} /><span>任务日结算时间</span></div><strong>北京时间 04:00</strong></div><div><div><Archive size={18} /><span>数据存储</span></div><strong>{usesSqlite() ? "SQLite 本地数据库" : "浏览器本地存储（预览模式）"}</strong></div><div><div><CheckCircle2 size={18} /><span>应用版本</span></div><strong>v0.3.0</strong></div></div><section className="backup-panel"><div><p className="eyebrow">数据安全</p><h2>备份与恢复</h2><span>每次任务变更会在本机保留最近 5 份自动快照。</span></div><div className="backup-actions"><button className="primary-button" onClick={() => void onExportData()}><Archive size={16} />导出备份</button><label className="import-button"><span>导入备份</span><input type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImportData(file); event.currentTarget.value = ""; }} /></label></div></section></section>;
}

function TasksWorkspace({ tasks, selectedDate, onSelectTask, onCompleteTasks, onDeleteTasks, onRescheduleTasks }: { tasks: Task[]; selectedDate: string; onSelectTask: (taskId: string) => void; onCompleteTasks: (taskIds: string[]) => void; onDeleteTasks: (taskIds: string[]) => boolean; onRescheduleTasks: (taskIds: string[], targetDate: string) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"active" | "completed" | "overdue" | "all">("active");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [project, setProject] = useState("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<"planned" | "priority" | "created">("planned");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState(selectedDate);
  const projects = [...new Set(tasks.map((task) => task.project || "收集箱"))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const tags = [...new Set(tasks.flatMap((task) => task.tags))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    return tasks.filter((task) => {
      const isOverdue = !task.completedAt && task.repeat === "none" && task.plannedDate < getTaskDate();
      const matchesQuery = !normalizedQuery || [task.title, task.description ?? "", task.project, ...task.tags].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      const matchesStatus = status === "all" || (status === "active" && !task.completedAt) || (status === "completed" && Boolean(task.completedAt)) || (status === "overdue" && isOverdue);
      return matchesQuery && matchesStatus && (priority === "all" || task.priority === priority) && (project === "all" || task.project === project) && (tag === "all" || task.tags.includes(tag));
    }).sort((a, b) => {
      if (sort === "priority") return priorityOrder[a.priority] - priorityOrder[b.priority] || a.plannedDate.localeCompare(b.plannedDate);
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      return a.plannedDate.localeCompare(b.plannedDate) || priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [tasks, query, status, priority, project, tag, sort]);
  const selected = new Set(selectedIds);
  const allVisibleSelected = visibleTasks.length > 0 && visibleTasks.every((task) => selected.has(task.id));
  function toggleSelection(taskId: string) {
    setSelectedIds((ids) => ids.includes(taskId) ? ids.filter((id) => id !== taskId) : [...ids, taskId]);
  }
  function rescheduleSelected(date: string) {
    if (!selectedIds.length || !date) return;
    onRescheduleTasks(selectedIds, date);
    setSelectedIds([]);
  }
  function completeSelected() {
    onCompleteTasks(selectedIds);
    setSelectedIds([]);
  }
  function deleteSelected() {
    if (onDeleteTasks(selectedIds)) setSelectedIds([]);
  }
  return <section className="workspace-page tasks-workspace"><div className="tasks-heading"><div><p className="eyebrow">工作总览</p><h1>全部任务</h1></div><span>{visibleTasks.length} 项结果</span></div><div className="task-filters"><label className="task-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务、项目或标签" /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="active">进行中</option><option value="completed">已完成</option><option value="overdue">逾期</option><option value="all">全部状态</option></select><select value={priority} onChange={(event) => setPriority(event.target.value as Priority | "all")}><option value="all">全部优先级</option><option value="high">重要</option><option value="medium">正常</option><option value="low">轻缓</option></select><select value={project} onChange={(event) => setProject(event.target.value)}><option value="all">全部项目</option>{projects.map((name) => <option key={name} value={name}>{name}</option>)}</select><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">全部标签</option>{tags.map((name) => <option key={name} value={name}>{name}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="planned">按计划日期</option><option value="priority">按优先级</option><option value="created">按创建时间</option></select></div>{selectedIds.length > 0 && <div className="bulk-actions"><strong>已选 {selectedIds.length} 项</strong><button onClick={completeSelected}><Check size={15} />完成</button><button onClick={() => rescheduleSelected(getTaskDate())}><CalendarDays size={15} />移至今天</button><label><span>改期至</span><input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label><button onClick={() => rescheduleSelected(targetDate)} title="应用指定日期"><Check size={15} /></button><button className="bulk-delete" onClick={deleteSelected}><Trash2 size={15} />删除</button><button className="clear-selection" onClick={() => setSelectedIds([])} title="取消选择"><X size={16} /></button></div>}<div className="task-table"><div className="task-table-head"><label><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? [] : visibleTasks.map((task) => task.id))} aria-label="选择全部结果" /></label><span>任务</span><span>计划日</span><span>优先级</span><span>状态</span><span /></div>{visibleTasks.length ? visibleTasks.map((task) => <TaskManageRow key={task.id} task={task} selected={selected.has(task.id)} onToggle={() => toggleSelection(task.id)} onSelect={() => onSelectTask(task.id)} onComplete={() => { onCompleteTasks([task.id]); }} />) : <div className="empty-workspace">没有符合当前筛选条件的任务。</div>}</div></section>;
}

function TaskManageRow({ task, selected, onToggle, onSelect, onComplete }: { task: Task; selected: boolean; onToggle: () => void; onSelect: () => void; onComplete: () => void }) {
  const isOverdue = !task.completedAt && task.repeat === "none" && task.plannedDate < getTaskDate();
  return <div className={`task-table-row ${selected ? "selected" : ""}`}><label><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`选择 ${task.title}`} /></label><button className="task-table-title" onClick={onSelect}><strong>{task.title}</strong><span>{task.project || "收集箱"}{task.tags.length ? ` · ${task.tags.join("、")}` : ""}</span></button><span>{formatTaskDate(task.plannedDate)}</span><span><i className={`priority-dot ${task.priority}`} />{priorityLabel[task.priority]}</span><span className={task.completedAt ? "status-completed" : isOverdue ? "status-overdue" : "status-active"}>{task.completedAt ? "已完成" : isOverdue ? "已逾期" : "进行中"}</span><div>{!task.completedAt && <button className="table-complete" title="完成原任务" onClick={onComplete}><Check size={16} /></button>}<button className="more-button" title="查看详情" onClick={onSelect}><MoreHorizontal size={18} /></button></div></div>;
}

function CalendarWorkspace({ tasks, selectedDate, onSelectDate, onSelectTask, onReschedule }: { tasks: Task[]; selectedDate: string; onSelectDate: (date: string) => void; onSelectTask: (taskId: string) => void; onReschedule: (taskId: string, targetDate: string) => void }) {
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

function ProjectsWorkspace({ tasks, onSelectTask }: { tasks: Task[]; onSelectTask: (taskId: string) => void }) {
  const projects = [...new Set(tasks.map((task) => task.project || "收集箱"))].map((project) => {
    const items = tasks.filter((task) => (task.project || "收集箱") === project);
    const completed = items.filter((task) => task.completedAt).length;
    const active = items.filter((task) => !task.completedAt);
    return { project, items, completed, active, percent: items.length ? Math.round(completed / items.length * 100) : 0, nextDate: active.map((task) => task.plannedDate).sort()[0] };
  });
  return <section className="workspace-page projects-workspace"><p className="eyebrow">按项目观察推进节奏</p><h1>项目</h1><div className="project-summary"><div><strong>{projects.length}</strong><span>进行中的项目</span></div><div><strong>{tasks.filter((task) => !task.completedAt).length}</strong><span>待完成任务</span></div><div><strong>{tasks.filter((task) => task.completedAt).length}</strong><span>已完成任务</span></div></div><div className="project-progress-list">{projects.map((item, index) => <section className="project-progress" key={item.project}><div className={`project-symbol project-${index % 3}`}><FolderKanban size={20} /></div><div className="project-main"><div className="project-topline"><div><h3>{item.project}</h3><p>{item.completed} / {item.items.length} 项任务已完成{item.nextDate ? `，下一计划 ${formatTaskDate(item.nextDate)}` : ""}</p></div><strong>{item.percent}%</strong></div><div className="project-progress-bar"><i style={{ width: `${item.percent}%` }} /></div><div className="project-task-links">{item.active.slice(0, 3).map((task) => <button key={task.id} onClick={() => onSelectTask(task.id)}><span className={`priority-dot ${task.priority}`} />{task.title}</button>)}{item.active.length > 3 && <span>还有 {item.active.length - 3} 项</span>}</div></div></section>)}</div></section>;
}

function InsightsWorkspace({ tasks, selectedDate }: { tasks: Task[]; selectedDate: string }) {
  const start = weekStart(selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
  const [reviews, setReviews] = useState<DailyReview[]>([]);
  useEffect(() => { void loadDailyReviews(days[0], days[6]).then(setReviews); }, [days[0], days[6]]);
  const totals = days.map((date) => {
    const planned = tasks.filter((task) => !task.completedAt && isDueOn(task, date)).length;
    const executions = tasks.filter((task) => completedExecutionOn(task, date)).length + tasks.filter((task) => task.completedAt?.slice(0, 10) === date).length;
    const focusMinutes = tasks.filter((task) => completedExecutionOn(task, date) || task.completedAt?.slice(0, 10) === date).reduce((sum, task) => sum + task.estimateMinutes, 0);
    return { date, planned, executions: Math.min(executions, planned || executions), focusMinutes };
  });
  const plannedTotal = totals.reduce((sum, item) => sum + item.planned, 0);
  const completedTotal = totals.reduce((sum, item) => sum + item.executions, 0);
  const focusTotal = totals.reduce((sum, item) => sum + item.focusMinutes, 0);
  const maxExecutions = Math.max(1, ...totals.map((item) => item.executions));
  return <section className="workspace-page insights-workspace"><p className="eyebrow">{formatTaskDate(days[0])} 至 {formatTaskDate(days[6])}</p><h1>复盘与统计</h1><div className="insight-cards"><div><span><CheckCircle2 size={17} />完成率</span><strong>{plannedTotal ? Math.round(completedTotal / plannedTotal * 100) : 0}%</strong><small>{completedTotal} / {plannedTotal || 0} 次计划执行</small></div><div><span><Clock3 size={17} />专注时长</span><strong>{Math.round(focusTotal / 60 * 10) / 10}h</strong><small>按已完成任务的预计时长计算</small></div><div><span><TrendingUp size={17} />连续执行</span><strong>{totals.filter((item) => item.executions > 0).length} 天</strong><small>这一周留下了执行记录</small></div></div><section className="trend-panel"><div className="panel-heading"><div><h2>本周完成趋势</h2><p>任务日以凌晨 4:00 结算。</p></div><LayoutGrid size={18} /></div><div className="trend-bars">{totals.map((item) => <div className="trend-column" key={item.date}><div className="bar-area"><i style={{ height: `${Math.max(8, item.executions / maxExecutions * 100)}%` }} /></div><strong>{item.executions}</strong><span>{new Date(`${item.date}T12:00:00`).getDate()} 日</span></div>)}</div></section><section className="weekly-review"><div className="panel-heading"><div><h2>周复盘摘录</h2><p>来自每日复盘中的真实记录。</p></div><CalendarRange size={18} /></div>{reviews.length ? <div className="review-list">{reviews.map((review) => <article key={review.taskDate}><span>{formatTaskDate(review.taskDate)}</span><p>{review.reflection || "这一天没有写下总结。"}</p>{review.tomorrowFocus && <small>明日重点：{review.tomorrowFocus}</small>}</article>)}</div> : <div className="empty-workspace">本周还没有复盘记录，今天结束前写下一句也很好。</div>}</section></section>;
}

export default App;
