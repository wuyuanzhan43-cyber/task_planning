import { useEffect, useMemo, useState } from "react";
import { Command, Search, X } from "lucide-react";
import { formatTaskDate } from "../lib/task-date";
import type { Task } from "../types";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  keywords: string;
  run: () => void;
}

export function SearchOverlay({ tasks, commands = [], onClose, onOpenTask }: { tasks: Task[]; commands?: CommandItem[]; onClose: () => void; onOpenTask: (task: Task) => void }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const taskMatches = useMemo(() => {
    if (!normalized) return [];
    return tasks
      .filter((task) => [task.title, task.description ?? "", task.project, ...task.tags].some((value) => value.toLocaleLowerCase().includes(normalized)))
      .sort((a, b) => Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)) || b.plannedDate.localeCompare(a.plannedDate))
      .slice(0, 20);
  }, [tasks, normalized]);
  const commandMatches = useMemo(() => {
    if (!normalized) return commands;
    return commands.filter((command) => `${command.label} ${command.keywords}`.toLocaleLowerCase().includes(normalized));
  }, [commands, normalized]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  function runCommand(command: CommandItem) {
    command.run();
    onClose();
  }
  function submitFirst() {
    if (normalized && taskMatches.length > 0) { onOpenTask(taskMatches[0]); return; }
    if (commandMatches.length > 0) runCommand(commandMatches[0]);
  }
  return <div className="modal-backdrop search-backdrop" role="presentation" onClick={onClose}><div className="search-overlay" onClick={(event) => event.stopPropagation()}><label className="search-input"><Search size={17} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务，或输入命令（如：主题、导出、日历）..." onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitFirst(); } }} /><button onClick={onClose} title="关闭搜索"><X size={16} /></button></label><div className="search-results">{normalized && (taskMatches.length ? <div className="search-section"><p>任务</p>{taskMatches.map((task) => <button key={task.id} className="search-result" onClick={() => onOpenTask(task)}><span className={`priority-dot ${task.priority}`} /><div><strong>{task.title}</strong><span>{task.project || "收集箱"} · {formatTaskDate(task.plannedDate)}{task.tags.length ? ` · ${task.tags.join("、")}` : ""}</span></div><em className={task.completedAt ? "done" : ""}>{task.completedAt ? "已完成" : "进行中"}</em></button>)}</div> : <p className="search-empty">没有找到匹配的任务。</p>)}{commandMatches.length > 0 && <div className="search-section"><p>命令</p>{commandMatches.map((command) => <button key={command.id} className="search-result command" onClick={() => runCommand(command)}><Command size={14} /><div><strong>{command.label}</strong>{command.hint && <span>{command.hint}</span>}</div></button>)}</div>}{!normalized && commandMatches.length === 0 && <p className="search-empty">输入关键词搜索任务，或直接执行命令。</p>}</div><footer><span>Ctrl / ⌘ + K 打开</span><span>Enter 执行第一项 · Esc 关闭</span></footer></div></div>;
}
