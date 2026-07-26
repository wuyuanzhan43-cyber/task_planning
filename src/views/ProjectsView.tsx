import { useState } from "react";
import { CheckCircle2, Circle, Flag, FolderKanban, Plus, Trash2 } from "lucide-react";
import { dateDiff, formatTaskDate, getTaskDate } from "../lib/task-date";
import { makeId } from "../lib/schedule";
import { projectPlanId } from "../lib/storage";
import type { ProjectPlan, Task } from "../types";

export function ProjectsView({ tasks, onSelectTask, plans, onSavePlan }: { tasks: Task[]; onSelectTask: (taskId: string) => void; plans: ProjectPlan[]; onSavePlan: (plan: ProjectPlan) => void }) {
  const [milestoneDrafts, setMilestoneDrafts] = useState<Record<string, string>>({});
  const projects = [...new Set(tasks.map((task) => task.project || "收集箱"))].map((project) => {
    const items = tasks.filter((task) => (task.project || "收集箱") === project);
    const completed = items.filter((task) => task.completedAt).length;
    const active = items.filter((task) => !task.completedAt);
    return { project, items, completed, active, percent: items.length ? Math.round(completed / items.length * 100) : 0, nextDate: active.map((task) => task.plannedDate).sort()[0] };
  });
  function planFor(name: string): ProjectPlan {
    return plans.find((plan) => plan.name === name) ?? { id: projectPlanId(name), name, milestones: [] };
  }
  function updatePlan(name: string, update: (plan: ProjectPlan) => ProjectPlan) {
    onSavePlan(update(planFor(name)));
  }
  function addMilestone(name: string) {
    const title = (milestoneDrafts[name] ?? "").trim();
    if (!title) return;
    updatePlan(name, (plan) => ({ ...plan, milestones: [...plan.milestones, { id: makeId("milestone"), title, completed: false }] }));
    setMilestoneDrafts((drafts) => ({ ...drafts, [name]: "" }));
  }
  return <section className="workspace-page projects-workspace"><p className="eyebrow">按项目观察推进节奏</p><h1>项目</h1><div className="project-summary"><div><strong>{projects.length}</strong><span>进行中的项目</span></div><div><strong>{tasks.filter((task) => !task.completedAt).length}</strong><span>待完成任务</span></div><div><strong>{tasks.filter((task) => task.completedAt).length}</strong><span>已完成任务</span></div></div><div className="project-progress-list">{projects.map((item, index) => {
    const plan = planFor(item.project);
    const milestonesDone = plan.milestones.filter((milestone) => milestone.completed).length;
    const daysToTarget = plan.targetDate ? dateDiff(getTaskDate(), plan.targetDate) : null;
    return <section className="project-progress" key={item.project}><div className={`project-symbol project-${index % 3}`}><FolderKanban size={20} /></div><div className="project-main"><div className="project-topline"><div><h3>{item.project}</h3><p>{item.completed} / {item.items.length} 项任务已完成{item.nextDate ? `，下一计划 ${formatTaskDate(item.nextDate)}` : ""}</p></div><strong>{item.percent}%</strong></div><div className="project-progress-bar"><i style={{ width: `${item.percent}%` }} /></div><div className="project-task-links">{item.active.slice(0, 3).map((task) => <button key={task.id} onClick={() => onSelectTask(task.id)}><span className={`priority-dot ${task.priority}`} />{task.title}</button>)}{item.active.length > 3 && <span>还有 {item.active.length - 3} 项</span>}</div><div className="project-milestones"><div className="milestone-heading"><span><Flag size={13} />里程碑 {milestonesDone}/{plan.milestones.length}{daysToTarget !== null && <em className="milestone-target-note">{daysToTarget >= 0 ? `距目标 ${daysToTarget} 天` : `已超期 ${-daysToTarget} 天`}</em>}</span><label>目标日期<input type="date" value={plan.targetDate ?? ""} onChange={(event) => updatePlan(item.project, (current) => ({ ...current, targetDate: event.target.value || undefined }))} /></label></div>{plan.milestones.length ? <div className="milestone-list">{plan.milestones.map((milestone) => <div className={`milestone ${milestone.completed ? "completed" : ""}`} key={milestone.id}><button title={milestone.completed ? "标记为未完成" : "标记为已完成"} onClick={() => updatePlan(item.project, (current) => ({ ...current, milestones: current.milestones.map((entry) => entry.id === milestone.id ? { ...entry, completed: !entry.completed } : entry) }))}>{milestone.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}</button><span>{milestone.title}</span><button className="milestone-delete" title="删除里程碑" onClick={() => updatePlan(item.project, (current) => ({ ...current, milestones: current.milestones.filter((entry) => entry.id !== milestone.id) }))}><Trash2 size={13} /></button></div>)}</div> : <p className="milestone-empty">为这个项目立下几个阶段性目标吧。</p>}<form className="milestone-composer" onSubmit={(event) => { event.preventDefault(); addMilestone(item.project); }}><input value={milestoneDrafts[item.project] ?? ""} onChange={(event) => setMilestoneDrafts((drafts) => ({ ...drafts, [item.project]: event.target.value }))} placeholder="添加里程碑，例如：完成初稿" /><button type="submit" title="添加里程碑"><Plus size={14} /></button></form></div></div></section>;
  })}</div></section>;
}
