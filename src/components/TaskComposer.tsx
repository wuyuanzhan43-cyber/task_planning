import { useMemo, useState } from "react";
import { ClipboardList, Pencil, Plus, Save, Sparkles, X } from "lucide-react";
import { formatTaskDate } from "../lib/task-date";
import { describeRepeat } from "../lib/schedule";
import { parseQuickAdd, type QuickAddResult } from "../lib/quick-add";
import { timeBlockLabel, priorityLabel } from "../labels";
import type { TaskTemplate } from "../lib/templates";
import type { RepeatConfig, RepeatRule, Task } from "../types";

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

export function TaskComposer({ task, selectedDate, onClose, onSubmit, onQuickCreate, templates = [], onApplyTemplate, onSaveTemplate, onDeleteTemplate, onBatchCreate }: { task?: Task; selectedDate: string; onClose: () => void; onSubmit: (form: FormData, repeatConfig?: RepeatConfig) => void; onQuickCreate?: (parsed: QuickAddResult) => void; templates?: TaskTemplate[]; onApplyTemplate?: (template: TaskTemplate) => void; onSaveTemplate?: (form: FormData, repeatConfig?: RepeatConfig) => void; onDeleteTemplate?: (templateId: string) => void; onBatchCreate?: (parsedLines: QuickAddResult[]) => void }) {
  const editing = Boolean(task);
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState("");
  const batchParsed = useMemo(() => batchText.split("\n").map((line) => parseQuickAdd(line, selectedDate)).filter((parsed): parsed is QuickAddResult => Boolean(parsed?.title)), [batchText, selectedDate]);
  const [repeat, setRepeat] = useState<RepeatRule>(task?.repeat ?? "none");
  const [interval, setIntervalValue] = useState(task?.repeatConfig?.interval ?? 1);
  const [weekdays, setWeekdays] = useState<number[]>(task?.repeatConfig?.weekdays ?? []);
  const [monthlyMode, setMonthlyMode] = useState<"date" | "last-day">(task?.repeatConfig?.monthlyMode ?? "date");
  const [quickText, setQuickText] = useState("");
  const parsed = useMemo(() => parseQuickAdd(quickText, selectedDate), [quickText, selectedDate]);

  function buildRepeatConfig(): RepeatConfig | undefined {
    if (repeat === "none" || repeat === "weekdays") return undefined;
    const config: RepeatConfig = {};
    const normalized = Math.max(1, Math.floor(Number(interval) || 1));
    if (normalized > 1) config.interval = normalized;
    if (repeat === "weekly" && weekdays.length > 0) config.weekdays = [...weekdays].sort((a, b) => a - b);
    if (repeat === "monthly" && monthlyMode === "last-day") config.monthlyMode = "last-day";
    return Object.keys(config).length > 0 ? config : undefined;
  }

  function submitQuick() {
    if (!parsed?.title || !onQuickCreate) return;
    onQuickCreate(parsed);
  }

  return <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="task-composer" onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget), buildRepeatConfig()); }}><header><div><p className="eyebrow">{editing ? "调整安排" : "新的安排"}</p><h2>{editing ? "编辑任务" : "留下一件想完成的事"}</h2></div><button type="button" className="icon-button" onClick={onClose} title="关闭"><X size={19} /></button></header>
    {!editing && onQuickCreate && !batchMode && <div className="quick-add"><div className="quick-add-input"><Sparkles size={15} /><input autoFocus value={quickText} onChange={(event) => setQuickText(event.target.value)} placeholder="快速添加：明天下午 跑步 30分钟 #健康 !重要 每周二、四" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitQuick(); } }} /><button type="button" disabled={!parsed?.title} onClick={submitQuick}>快速创建</button><button type="button" className="quick-mode-toggle" title="批量导入多行任务" onClick={() => setBatchMode(true)}><ClipboardList size={14} />批量</button></div>{parsed && quickText.trim() && <div className="quick-preview">{parsed.title ? <b>{parsed.title}</b> : <i>请补充任务名称</i>}{parsed.plannedDate && <span>{formatTaskDate(parsed.plannedDate)}</span>}{parsed.timeBlock && <span>{timeBlockLabel[parsed.timeBlock]}</span>}{parsed.dueAt && <span>截止 {parsed.dueAt}</span>}{parsed.estimateMinutes !== undefined && <span>{parsed.estimateMinutes} 分钟</span>}{parsed.priority && <span>{priorityLabel[parsed.priority]}</span>}{parsed.repeat && <span>{describeRepeat({ repeat: parsed.repeat, repeatConfig: parsed.repeatConfig, plannedDate: parsed.plannedDate ?? selectedDate })}</span>}{parsed.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}</div>}
    {!editing && batchMode && <div className="quick-add batch"><div className="batch-heading"><span><ClipboardList size={14} />批量导入 · 每行一个任务，支持快速添加语法</span><button type="button" onClick={() => setBatchMode(false)}>返回单条</button></div><textarea autoFocus value={batchText} onChange={(event) => setBatchText(event.target.value)} placeholder={"明天 整理会议纪要 30分钟\n周五 提交周报 !重要\n每天 傍晚散步 #健康"} /><div className="batch-footer"><span>{batchParsed.length ? `将创建 ${batchParsed.length} 项任务` : "粘贴或输入多行任务"}</span><button type="button" disabled={!batchParsed.length} onClick={() => onBatchCreate?.(batchParsed)}>批量创建</button></div></div>}
    {!editing && templates.length > 0 && !batchMode && <div className="template-row"><span className="template-label">模板</span>{templates.map((template) => <span className="template-chip" key={template.id}><button type="button" title={`用模板「${template.name}」创建任务`} onClick={() => onApplyTemplate?.(template)}>{template.name}</button><button type="button" className="template-delete" title="删除模板" onClick={() => onDeleteTemplate?.(template.id)}><X size={11} /></button></span>)}</div>}
    <label className="large-field"><span>任务名称</span><input name="title" autoFocus={editing || !onQuickCreate} defaultValue={task?.title} placeholder="例如：整理本周会议笔记" /></label><label><span>补充说明</span><textarea name="description" defaultValue={task?.description} placeholder="为它写一点上下文..." /></label><div className="form-grid"><label><span>项目</span><input name="project" defaultValue={task?.project ?? "收集箱"} /></label><label><span>计划任务日</span><input name="plannedDate" type="date" defaultValue={task?.plannedDate ?? selectedDate} /></label><label><span>优先级</span><select name="priority" defaultValue={task?.priority ?? "medium"}><option value="high">重要</option><option value="medium">正常</option><option value="low">轻缓</option></select></label><label><span>重复</span><select name="repeat" value={repeat} onChange={(event) => setRepeat(event.target.value as RepeatRule)}><option value="none">不重复</option><option value="daily">每天</option><option value="weekdays">工作日</option><option value="weekly">每周</option><option value="monthly">每月</option></select></label><label><span>预计分钟</span><input name="estimateMinutes" type="number" min="0" defaultValue={task?.estimateMinutes ?? 30} /></label><label><span>标签（用中文逗号分隔）</span><input name="tags" defaultValue={task?.tags.join("，")} placeholder="工作，深度专注" /></label><label><span>截止时间（可选）</span><input name="dueAt" type="time" defaultValue={task?.dueAt ?? ""} /></label><label><span>时间块</span><select name="timeBlock" defaultValue={task?.timeBlock ?? "unscheduled"}><option value="unscheduled">待安排</option><option value="morning">上午</option><option value="afternoon">下午</option><option value="evening">晚上</option></select></label></div>
    {(repeat === "daily" || repeat === "weekly" || repeat === "monthly") && <div className="repeat-config"><label className="repeat-interval"><span>间隔</span><input type="number" min="1" value={interval} onChange={(event) => setIntervalValue(Number(event.target.value) || 1)} /><span>{repeat === "daily" ? "天" : repeat === "weekly" ? "周" : "个月"}</span></label>{repeat === "weekly" && <div className="weekday-picker">{WEEKDAY_NAMES.map((name, index) => <button type="button" key={index} className={weekdays.includes(index) ? "on" : ""} onClick={() => setWeekdays((current) => current.includes(index) ? current.filter((day) => day !== index) : [...current, index])}>{name}</button>)}<small>{weekdays.length === 0 ? "不选则沿用计划日的星期几" : ""}</small></div>}{repeat === "monthly" && <select className="monthly-mode" value={monthlyMode} onChange={(event) => setMonthlyMode(event.target.value as "date" | "last-day")}><option value="date">每月同一号数</option><option value="last-day">每月最后一天</option></select>}</div>}
    <label className="checkbox-field"><input type="checkbox" name="isFocus" defaultChecked={task?.isFocus} /><span>设为今日重点（每天最多展示 3 项）</span></label><footer>{!editing && onSaveTemplate && <button type="button" className="text-button save-template" title="把当前表单内容存为模板" onClick={(event) => { const formElement = (event.currentTarget as HTMLButtonElement).closest("form"); if (formElement) onSaveTemplate(new FormData(formElement), buildRepeatConfig()); }}><Save size={14} />存为模板</button>}<button type="button" className="text-button" onClick={onClose}>取消</button><button className="primary-button" type="submit">{editing ? <Pencil size={16} /> : <Plus size={17} />}{editing ? "保存修改" : "创建任务"}</button></footer></form></div>;
}
