import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Circle, FolderKanban, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { formatTaskDate } from "../lib/task-date";
import { describeRepeat } from "../lib/schedule";
import { Markdown } from "../lib/markdown";
import { openLink } from "../lib/open-link";
import type { Task } from "../types";

export function TaskDetail({ task, selectedDate, onAddProgress, onComplete, onReopen, onEdit, onDelete, onAddSubtask, onToggleSubtask, onDeleteSubtask, onClose }: { task: Task; selectedDate: string; onAddProgress: (taskId: string, completedToday: boolean, content: string) => void; onComplete: (taskId: string) => void; onReopen: (taskId: string) => void; onEdit: () => void; onDelete: (taskId: string) => void; onAddSubtask: (taskId: string, title: string) => void; onToggleSubtask: (taskId: string, subtaskId: string) => void; onDeleteSubtask: (taskId: string, subtaskId: string) => void; onClose: () => void }) {
  const entries = [...task.progress].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [progressText, setProgressText] = useState("");
  const completed = Boolean(task.completedAt);
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (panelRef.current && panelRef.current.contains(target)) return;
      // 点击弹窗、提醒面板、搜索、提示条等浮层时不关闭详情
      if (target.closest(".modal-backdrop, .confirm-dialog, .alert-panel, .alert-backdrop, .notification-wrap, .undo-toast, .save-error, .search-overlay")) return;
      onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [onClose]);
  function submitSubtask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddSubtask(task.id, subtaskTitle);
    setSubtaskTitle("");
  }
  function addProgress(completedToday: boolean) {
    onAddProgress(task.id, completedToday, progressText);
    setProgressText("");
  }
  return <aside className="detail-panel" ref={panelRef}><header><button className="icon-button" title="关闭详情" onClick={onClose}><X size={19} /></button><div className="detail-actions"><button className="icon-button" title="编辑任务" onClick={onEdit}><Pencil size={16} /></button><button className="icon-button danger-button" title="移入回收站" onClick={() => onDelete(task.id)}><Trash2 size={16} /></button>{completed ? <button className="detail-today" onClick={() => onReopen(task.id)}><RotateCcw size={15} />恢复为进行中</button> : <><button className="detail-today" onClick={() => addProgress(true)}><CheckCircle2 size={16} />完成今日执行</button><button className="detail-complete" onClick={() => onComplete(task.id)}><Check size={16} />完成原任务</button></>}</div></header><div className="detail-content"><div className="detail-project"><FolderKanban size={15} />{task.project || "收集箱"}</div><h2>{task.title}</h2>{completed && task.completedAt && <p className="detail-completed-note">已于 {formatTaskDate(task.completedAt.slice(0, 10))} 完成</p>}{task.description && <div className="detail-description"><Markdown text={task.description} onOpenLink={(url) => void openLink(url)} /></div>}<div className="detail-info"><div><span>任务日</span><strong>{formatTaskDate(task.plannedDate)}</strong></div><div><span>预计用时</span><strong>{task.estimateMinutes} 分钟</strong></div><div><span>重复</span><strong>{describeRepeat(task)}</strong></div></div><section className="subtasks"><div className="detail-section-title"><h3>子任务</h3><span>{task.subtasks.filter((item) => item.completed).length}/{task.subtasks.length}</span></div>{task.subtasks.length ? <div className="subtask-list">{task.subtasks.map((item) => <div className={`subtask ${item.completed ? "completed" : ""}`} key={item.id}><button className="subtask-toggle" title={item.completed ? "标记为未完成" : "标记为已完成"} onClick={() => onToggleSubtask(task.id, item.id)}>{item.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}</button><span>{item.title}</span><button className="subtask-delete" title="删除子任务" onClick={() => onDeleteSubtask(task.id, item.id)}><Trash2 size={14} /></button></div>)}</div> : <p className="empty-copy">还没有子任务。</p>}<form className="subtask-composer" onSubmit={submitSubtask}><input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="添加一个子任务" /><button type="submit" title="添加子任务"><Plus size={15} /></button></form></section><section className="progress-section"><div className="detail-section-title"><h3>每日进展</h3><span>{entries.length} 条记录</span></div><div className="progress-composer"><textarea value={progressText} onChange={(event) => setProgressText(event.target.value)} placeholder={`写下 ${formatTaskDate(selectedDate)} 的进展...`} /><div><span>记录不会自动完成原任务</span><button onClick={() => addProgress(false)}>添加进展</button></div></div><div className="timeline">{entries.length ? entries.map((entry) => <div className="timeline-entry" key={entry.id}><span className="timeline-dot" /><div><div className="timeline-date">{formatTaskDate(entry.taskDate)}{entry.completedToday && <em>今日完成</em>}</div><p>{entry.content}</p></div></div>) : <p className="empty-copy">从今天的一点进展开始吧。</p>}</div></section></div></aside>;
}
