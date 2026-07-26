import { useMemo, useState } from "react";
import { CalendarDays, Check, MoreHorizontal, RotateCcw, Search, Trash2, X } from "lucide-react";
import { formatTaskDate, getTaskDate } from "../lib/task-date";
import { priorityLabel } from "../labels";
import type { Priority, Task } from "../types";

export function TasksView({ tasks, selectedDate, onSelectTask, onCompleteTasks, onDeleteTasks, onRescheduleTasks, onReopenTask }: { tasks: Task[]; selectedDate: string; onSelectTask: (taskId: string) => void; onCompleteTasks: (taskIds: string[]) => void; onDeleteTasks: (taskIds: string[], onConfirmed?: () => void) => void; onRescheduleTasks: (taskIds: string[], targetDate: string) => void; onReopenTask: (taskId: string) => void }) {
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
    onDeleteTasks(selectedIds, () => setSelectedIds([]));
  }
  return <section className="workspace-page tasks-workspace"><div className="tasks-heading"><div><p className="eyebrow">工作总览</p><h1>全部任务</h1></div><span>{visibleTasks.length} 项结果</span></div><div className="task-filters"><label className="task-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务、项目或标签" /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="active">进行中</option><option value="completed">已完成</option><option value="overdue">逾期</option><option value="all">全部状态</option></select><select value={priority} onChange={(event) => setPriority(event.target.value as Priority | "all")}><option value="all">全部优先级</option><option value="high">重要</option><option value="medium">正常</option><option value="low">轻缓</option></select><select value={project} onChange={(event) => setProject(event.target.value)}><option value="all">全部项目</option>{projects.map((name) => <option key={name} value={name}>{name}</option>)}</select><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">全部标签</option>{tags.map((name) => <option key={name} value={name}>{name}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="planned">按计划日期</option><option value="priority">按优先级</option><option value="created">按创建时间</option></select></div>{selectedIds.length > 0 && <div className="bulk-actions"><strong>已选 {selectedIds.length} 项</strong><button onClick={completeSelected}><Check size={15} />完成</button><button onClick={() => rescheduleSelected(getTaskDate())}><CalendarDays size={15} />移至今天</button><label><span>改期至</span><input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label><button onClick={() => rescheduleSelected(targetDate)} title="应用指定日期"><Check size={15} /></button><button className="bulk-delete" onClick={deleteSelected}><Trash2 size={15} />删除</button><button className="clear-selection" onClick={() => setSelectedIds([])} title="取消选择"><X size={16} /></button></div>}<div className="task-table"><div className="task-table-head"><label><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? [] : visibleTasks.map((task) => task.id))} aria-label="选择全部结果" /></label><span>任务</span><span>计划日</span><span>优先级</span><span>状态</span><span /></div>{visibleTasks.length ? visibleTasks.map((task) => <TaskManageRow key={task.id} task={task} selected={selected.has(task.id)} onToggle={() => toggleSelection(task.id)} onSelect={() => onSelectTask(task.id)} onComplete={() => { onCompleteTasks([task.id]); }} onReopen={() => onReopenTask(task.id)} />) : <div className="empty-workspace">没有符合当前筛选条件的任务。</div>}</div></section>;
}

function TaskManageRow({ task, selected, onToggle, onSelect, onComplete, onReopen }: { task: Task; selected: boolean; onToggle: () => void; onSelect: () => void; onComplete: () => void; onReopen: () => void }) {
  const isOverdue = !task.completedAt && task.repeat === "none" && task.plannedDate < getTaskDate();
  return <div className={`task-table-row ${selected ? "selected" : ""}`}><label><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`选择 ${task.title}`} /></label><button className="task-table-title" onClick={onSelect}><strong>{task.title}</strong><span>{task.project || "收集箱"}{task.tags.length ? ` · ${task.tags.join("、")}` : ""}</span></button><span>{formatTaskDate(task.plannedDate)}</span><span><i className={`priority-dot ${task.priority}`} />{priorityLabel[task.priority]}</span><span className={task.completedAt ? "status-completed" : isOverdue ? "status-overdue" : "status-active"}>{task.completedAt ? "已完成" : isOverdue ? "已逾期" : "进行中"}</span><div>{task.completedAt ? <button className="table-complete" title="恢复为进行中" onClick={onReopen}><RotateCcw size={15} /></button> : <button className="table-complete" title="完成原任务" onClick={onComplete}><Check size={16} /></button>}<button className="more-button" title="查看详情" onClick={onSelect}><MoreHorizontal size={18} /></button></div></div>;
}
