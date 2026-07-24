import { useEffect, useMemo, useState } from "react";
import {
  Archive, BarChart3, Bell, CalendarDays, Check, CheckCircle2, ChevronLeft,
  ChevronRight, Circle, Clock3, FolderKanban, ListTodo, MoreHorizontal,
  Plus, Search, Settings, Sparkles, Target, X
} from "lucide-react";
import { sampleTasks } from "./data/sample";
import { dateDiff, formatTaskDate, getTaskDate, toDateKey } from "./lib/task-date";
import { loadTasks, saveTasks } from "./lib/storage";
import type { Priority, RepeatRule, Task } from "./types";

type View = "today" | "calendar" | "tasks" | "projects" | "insights" | "settings";

const navigation: Array<{ id: View; label: string; icon: typeof CalendarDays }> = [
  { id: "today", label: "今日", icon: Sparkles },
  { id: "calendar", label: "日历", icon: CalendarDays },
  { id: "tasks", label: "全部任务", icon: ListTodo },
  { id: "projects", label: "项目", icon: FolderKanban },
  { id: "insights", label: "复盘与统计", icon: BarChart3 }
];

const priorityLabel: Record<Priority, string> = { high: "重要", medium: "正常", low: "轻缓" };
const repeatLabel: Record<RepeatRule, string> = { none: "不重复", daily: "每天", weekdays: "工作日", weekly: "每周", monthly: "每月" };

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

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = loadTasks();
    return saved.length > 0 ? saved : sampleTasks;
  });
  const [view, setView] = useState<View>("today");
  const [selectedDate, setSelectedDate] = useState(getTaskDate());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [progressText, setProgressText] = useState("");

  useEffect(() => saveTasks(tasks), [tasks]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const currentTasks = useMemo(
    () => tasks.filter((task) => !task.completedAt && isDueOn(task, selectedDate)),
    [tasks, selectedDate]
  );
  const carriedTasks = currentTasks.filter((task) => task.repeat === "none" && task.plannedDate < selectedDate);
  const plannedTasks = currentTasks.filter((task) => !carriedTasks.includes(task));
  const completedToday = tasks.filter((task) => task.completedAt?.slice(0, 10) === selectedDate).length;
  const completion = currentTasks.length ? Math.round((completedToday / (currentTasks.length + completedToday)) * 100) : 0;

  function updateTask(taskId: string, update: (task: Task) => Task) {
    setTasks((items) => items.map((task) => task.id === taskId ? update(task) : task));
  }

  function completeTask(taskId: string) {
    updateTask(taskId, (task) => ({ ...task, completedAt: new Date().toISOString() }));
    setSelectedTaskId(null);
  }

  function addProgress(taskId: string, completedToday: boolean) {
    const content = progressText.trim();
    if (!content) return;
    updateTask(taskId, (task) => ({
      ...task,
      progress: [...task.progress, { id: makeId("progress"), taskDate: selectedDate, content, completedToday, createdAt: new Date().toISOString() }]
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
      plannedDate: String(form.get("plannedDate") || selectedDate), estimateMinutes: Number(form.get("estimateMinutes") || 30),
      repeat: String(form.get("repeat") || "none") as RepeatRule, createdAt: new Date().toISOString(), progress: [], subtasks: []
    };
    setTasks((items) => [task, ...items]);
    setShowComposer(false);
    setSelectedTaskId(task.id);
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
            {carriedTasks.length > 0 && <TaskGroup title="从之前延续" subtitle="没有关系，今天可以重新安排它们。" icon={<Clock3 size={18} />} tasks={carriedTasks} selectedId={selectedTaskId} onSelect={setSelectedTaskId} onComplete={completeTask} selectedDate={selectedDate} />}
            <TaskGroup title="今日计划" subtitle="为今天留出一点空间和专注。" icon={<Sparkles size={18} />} tasks={plannedTasks} selectedId={selectedTaskId} onSelect={setSelectedTaskId} onComplete={completeTask} selectedDate={selectedDate} />
            <button className="quiet-add" onClick={() => setShowComposer(true)}><Plus size={17} />添加一件想完成的事</button>
          </section>
        ) : <WorkspaceView view={view} tasks={tasks} selectedDate={selectedDate} onSelectTask={setSelectedTaskId} />}
      </main>

      {selectedTask && <TaskDetail task={selectedTask} selectedDate={selectedDate} progressText={progressText} onProgressTextChange={setProgressText} onAddProgress={addProgress} onComplete={completeTask} onClose={() => setSelectedTaskId(null)} />}
      {showComposer && <TaskComposer selectedDate={selectedDate} onClose={() => setShowComposer(false)} onSubmit={createTask} />}
    </div>
  );
}

function TaskGroup({ title, subtitle, icon, tasks, selectedId, onSelect, onComplete, selectedDate }: { title: string; subtitle: string; icon: React.ReactNode; tasks: Task[]; selectedId: string | null; onSelect: (id: string) => void; onComplete: (id: string) => void; selectedDate: string }) {
  return <section className="task-group"><div className="group-heading"><div className="group-title"><span>{icon}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div><span className="group-count">{tasks.length}</span></div><div className="task-list">{tasks.length === 0 ? <div className="empty-line">这里留一点空白给自己。</div> : tasks.map((task) => <TaskRow key={task.id} task={task} selected={selectedId === task.id} onSelect={onSelect} onComplete={onComplete} selectedDate={selectedDate} />)}</div></section>;
}

function TaskRow({ task, selected, onSelect, onComplete, selectedDate }: { task: Task; selected: boolean; onSelect: (id: string) => void; onComplete: (id: string) => void; selectedDate: string }) {
  const days = dateDiff(task.plannedDate, selectedDate);
  return <div className={`task-row ${selected ? "selected" : ""}`}><button className="check-button" title="完成原任务" onClick={() => onComplete(task.id)}><Circle size={20} /></button><button className="task-row-main" onClick={() => onSelect(task.id)}><div className="task-line"><strong>{task.title}</strong>{task.repeat !== "none" && <span className="repeat-chip">{repeatLabel[task.repeat]}</span>}</div><div className="task-meta"><span className={`priority-dot ${task.priority}`} />{task.project && <span>{task.project}</span>}{task.estimateMinutes > 0 && <span><Clock3 size={13} />{task.estimateMinutes} 分钟</span>}{days > 0 && <span className="carry-label">已延续 {days} 天</span>}</div></button><button className="more-button" onClick={() => onSelect(task.id)} title="查看详情"><MoreHorizontal size={19} /></button></div>;
}

function TaskDetail({ task, selectedDate, progressText, onProgressTextChange, onAddProgress, onComplete, onClose }: { task: Task; selectedDate: string; progressText: string; onProgressTextChange: (value: string) => void; onAddProgress: (taskId: string, completedToday: boolean) => void; onComplete: (taskId: string) => void; onClose: () => void }) {
  const entries = [...task.progress].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <aside className="detail-panel"><header><button className="icon-button" title="关闭详情" onClick={onClose}><X size={19} /></button><button className="detail-complete" onClick={() => onComplete(task.id)}><Check size={16} />完成原任务</button></header><div className="detail-content"><div className="detail-project"><FolderKanban size={15} />{task.project || "收集箱"}</div><h2>{task.title}</h2>{task.description && <p className="detail-description">{task.description}</p>}<div className="detail-info"><div><span>任务日</span><strong>{formatTaskDate(task.plannedDate)}</strong></div><div><span>预计用时</span><strong>{task.estimateMinutes} 分钟</strong></div><div><span>重复</span><strong>{repeatLabel[task.repeat]}</strong></div></div><section className="subtasks"><div className="detail-section-title"><h3>子任务</h3><span>{task.subtasks.filter((item) => item.completed).length}/{task.subtasks.length}</span></div>{task.subtasks.length ? task.subtasks.map((item) => <div className="subtask" key={item.id}>{item.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}<span>{item.title}</span></div>) : <p className="empty-copy">还没有子任务。</p>}</section><section className="progress-section"><div className="detail-section-title"><h3>每日进展</h3><span>{entries.length} 条记录</span></div><div className="progress-composer"><textarea value={progressText} onChange={(event) => onProgressTextChange(event.target.value)} placeholder={`写下 ${formatTaskDate(selectedDate)} 的进展...`} /><div><span>记录不会自动完成原任务</span><button onClick={() => onAddProgress(task.id, false)}>添加进展</button></div></div><div className="timeline">{entries.length ? entries.map((entry) => <div className="timeline-entry" key={entry.id}><span className="timeline-dot" /><div><div className="timeline-date">{formatTaskDate(entry.taskDate)}{entry.completedToday && <em>今日完成</em>}</div><p>{entry.content}</p></div></div>) : <p className="empty-copy">从今天的一点进展开始吧。</p>}</div></section></div></aside>;
}

function TaskComposer({ selectedDate, onClose, onSubmit }: { selectedDate: string; onClose: () => void; onSubmit: (form: FormData) => void }) {
  return <div className="modal-backdrop" role="presentation"><form className="task-composer" onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }}><header><div><p className="eyebrow">新的安排</p><h2>留下一件想完成的事</h2></div><button type="button" className="icon-button" onClick={onClose} title="关闭"><X size={19} /></button></header><label className="large-field"><span>任务名称</span><input name="title" autoFocus placeholder="例如：整理本周会议笔记" /></label><label><span>补充说明</span><textarea name="description" placeholder="为它写一点上下文..." /></label><div className="form-grid"><label><span>项目</span><input name="project" defaultValue="收集箱" /></label><label><span>计划任务日</span><input name="plannedDate" type="date" defaultValue={selectedDate} /></label><label><span>优先级</span><select name="priority" defaultValue="medium"><option value="high">重要</option><option value="medium">正常</option><option value="low">轻缓</option></select></label><label><span>重复</span><select name="repeat" defaultValue="none"><option value="none">不重复</option><option value="daily">每天</option><option value="weekdays">工作日</option><option value="weekly">每周</option><option value="monthly">每月</option></select></label><label><span>预计分钟</span><input name="estimateMinutes" type="number" min="0" defaultValue="30" /></label><label><span>标签（用中文逗号分隔）</span><input name="tags" placeholder="工作，深度专注" /></label></div><footer><button type="button" className="text-button" onClick={onClose}>取消</button><button className="primary-button" type="submit"><Plus size={17} />创建任务</button></footer></form></div>;
}

function WorkspaceView({ view, tasks, selectedDate, onSelectTask }: { view: Exclude<View, "today">; tasks: Task[]; selectedDate: string; onSelectTask: (id: string) => void }) {
  const activeTasks = tasks.filter((task) => !task.completedAt);
  const title: Record<Exclude<View, "today">, string> = { calendar: "日历", tasks: "全部任务", projects: "项目", insights: "复盘与统计", settings: "设置" };
  if (view === "settings") return <section className="workspace-page"><p className="eyebrow">偏好设置</p><h1>让系统配合你的节奏。</h1><div className="settings-list"><div><div><Clock3 size={18} /><span>任务日结算时间</span></div><strong>北京时间 04:00</strong></div><div><div><Archive size={18} /><span>数据存储</span></div><strong>本地数据库（准备接入）</strong></div><div><div><CheckCircle2 size={18} /><span>应用版本</span></div><strong>v0.1.0</strong></div></div></section>;
  return <section className="workspace-page"><p className="eyebrow">{view === "calendar" ? formatTaskDate(selectedDate) : "工作总览"}</p><h1>{title[view]}</h1>{view === "projects" ? <div className="project-grid">{["毕业论文", "任务规划系统", "照顾自己"].map((project, index) => { const projectTasks = activeTasks.filter((task) => task.project === project); return <button className="project-card" key={project}><span className={`project-symbol project-${index}`}><FolderKanban size={20} /></span><h3>{project}</h3><p>{projectTasks.length} 项进行中</p><div className="mini-progress"><i style={{ width: `${[64, 42, 78][index]}%` }} /></div></button>; })}</div> : <div className="workspace-list">{activeTasks.length ? activeTasks.map((task) => <TaskRow key={task.id} task={task} selected={false} onSelect={onSelectTask} onComplete={() => undefined} selectedDate={selectedDate} />) : <div className="empty-workspace">还没有任务，先为今天留下一件小事吧。</div>}</div>}</section>;
}

export default App;
