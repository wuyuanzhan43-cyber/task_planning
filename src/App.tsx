import { useEffect, useRef, useState } from "react";
import {
  BarChart3, CalendarDays, Clock3, FolderKanban, ListTodo,
  MoreHorizontal, Plus, Repeat, Search, Settings, Sparkles, Target, X
} from "lucide-react";
import { sampleTasks } from "./data/sample";
import { dateDiff, formatTaskDate, getTaskDate } from "./lib/task-date";
import { completedExecutionOn, isDueOn, makeId } from "./lib/schedule";
import { readAutoBackups, writeAutoBackup, type AutoBackup } from "./lib/backup";
import { notify } from "./lib/notify";
import type { QuickAddResult } from "./lib/quick-add";
import { readTemplates, writeTemplates, type TaskTemplate } from "./lib/templates";
import { loadAllDailyReviews, loadDailyReview, loadProjectPlans, loadTasks, replaceDailyReviews, saveDailyReview, saveProjectPlan, saveTasks } from "./lib/storage";
import { ConfirmDialog, type ConfirmRequest } from "./components/ConfirmDialog";
import { SearchOverlay, type CommandItem } from "./components/SearchOverlay";
import { TaskComposer } from "./components/TaskComposer";
import { TaskDetail } from "./components/TaskDetail";
import { NotificationCenter } from "./components/NotificationCenter";
import { TodayView } from "./views/TodayView";
import { CalendarView } from "./views/CalendarView";
import { TasksView } from "./views/TasksView";
import { ProjectsView } from "./views/ProjectsView";
import { InsightsView } from "./views/InsightsView";
import { HabitsView } from "./views/HabitsView";
import { SettingsView } from "./views/SettingsView";
import type { DailyReview, Priority, ProjectPlan, RepeatConfig, RepeatRule, Task, Theme, TimeBlock } from "./types";

type View = "today" | "calendar" | "tasks" | "projects" | "habits" | "insights" | "settings";
type Density = "comfortable" | "compact";
type LoadState = "loading" | "ready" | "error";
const THEME_KEY = "dayflow.theme.v1";
const PROFILE_KEY = "dayflow.profile-name.v1";
const DENSITY_KEY = "dayflow.density.v1";
const BACKUP_INTERVAL_MS = 60_000;

const navigation: Array<{ id: View; label: string; icon: typeof CalendarDays }> = [
  { id: "today", label: "今日", icon: Sparkles },
  { id: "calendar", label: "日历", icon: CalendarDays },
  { id: "tasks", label: "全部任务", icon: ListTodo },
  { id: "projects", label: "项目", icon: FolderKanban },
  { id: "habits", label: "习惯打卡", icon: Repeat },
  { id: "insights", label: "复盘与统计", icon: BarChart3 }
];

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadErrorDetail, setLoadErrorDetail] = useState("");
  const [view, setView] = useState<View>("today");
  const [selectedDate, setSelectedDate] = useState(getTaskDate());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [todayKey, setTodayKey] = useState(getTaskDate());
  const [clockTick, setClockTick] = useState(0);
  const [plans, setPlans] = useState<ProjectPlan[]>([]);
  const [profileName, setProfileName] = useState(() => localStorage.getItem(PROFILE_KEY) || "沅展");
  const [templates, setTemplates] = useState<TaskTemplate[]>(() => readTemplates());
  const [density, setDensity] = useState<Density>(() => localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable");
  const [dailyReview, setDailyReview] = useState<DailyReview>({ taskDate: selectedDate, reflection: "", tomorrowFocus: "", updatedAt: "" });
  const [undoStack, setUndoStack] = useState<Array<{ label: string; tasks: Task[] }>>([]);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    return savedTheme === "auto" || savedTheme === "sage" || savedTheme === "coral" || savedTheme === "coast" || savedTheme === "midnight" ? savedTheme : "auto";
  });
  const persistedRef = useRef<Task[]>([]);
  const saveQueueRef = useRef(Promise.resolve());
  const lastBackupRef = useRef(0);
  const notifiedRef = useRef<Set<string>>(new Set());
  const notifySeededRef = useRef(false);
  const loaded = loadState === "ready";

  function loadInitialTasks() {
    setLoadState("loading");
    void loadTasks().then((saved) => {
      const cutoff = getTaskDate();
      const kept = saved.filter((task) => !task.deletedAt || dateDiff(task.deletedAt.slice(0, 10), cutoff) < 30);
      const initialTasks = saved.length > 0 ? kept : (import.meta.env.DEV ? sampleTasks : []);
      persistedRef.current = saved;
      setTasks(initialTasks);
      setLoadState("ready");
    }).catch((error) => {
      console.error("[dayflow] 数据加载失败:", error);
      setLoadErrorDetail(typeof error === "string" ? error : String((error as Error)?.message ?? error));
      setLoadState("error");
    });
  }

  useEffect(loadInitialTasks, []);
  useEffect(() => { void loadProjectPlans().then(setPlans).catch(() => undefined); }, []);

  useEffect(() => {
    if (!loaded) return;
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      const previous = persistedRef.current;
      if (tasks === previous) return;
      try {
        await saveTasks(tasks, previous);
        persistedRef.current = tasks;
        setSaveError(false);
      } catch {
        setSaveError(true);
      }
    });
  }, [loaded, tasks, saveAttempt]);

  useEffect(() => {
    if (!loaded) return;
    const now = Date.now();
    if (now - lastBackupRef.current < BACKUP_INTERVAL_MS && readAutoBackups().length > 0) return;
    lastBackupRef.current = now;
    writeAutoBackup(tasks);
  }, [loaded, tasks]);

  const resolvedTheme = theme === "auto" ? (systemDark ? "midnight" : "sage") : theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme, resolvedTheme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, profileName);
  }, [profileName]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem(DENSITY_KEY, density);
  }, [density]);

  useEffect(() => {
    void loadDailyReview(selectedDate).then(setDailyReview);
  }, [selectedDate]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
        event.preventDefault();
        restoreUndo();
        return;
      }
      if (event.key === "Escape") {
        if (searchOpen) return;
        if (confirmRequest) { setConfirmRequest(null); return; }
        if (showAlerts) { setShowAlerts(false); return; }
        if (showComposer) { setShowComposer(false); return; }
        if (editingTaskId) { setEditingTaskId(null); return; }
        if (selectedTaskId) { setSelectedTaskId(null); return; }
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setShowComposer(true);
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        setView("today");
        setSelectedDate(getTaskDate());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen, confirmRequest, showAlerts, showComposer, editingTaskId, selectedTaskId, undoStack]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick((tick) => tick + 1);
      const next = getTaskDate();
      if (next !== todayKey) {
        setTodayKey(next);
        setSelectedDate((date) => date === todayKey ? next : date);
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [todayKey]);

  useEffect(() => {
    if (!showUndoToast) return;
    const timer = window.setTimeout(() => setShowUndoToast(false), 8_000);
    return () => window.clearTimeout(timer);
  }, [showUndoToast, undoStack.length]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  function updateTask(taskId: string, update: (task: Task) => Task) {
    setTasks((items) => items.map((task) => task.id === taskId ? update(task) : task));
  }

  function completeTask(taskId: string) {
    pushUndo("已完成任务");
    updateTask(taskId, (task) => ({ ...task, completedAt: new Date().toISOString() }));
    setSelectedTaskId(null);
  }

  function completeTasks(taskIds: string[]) {
    pushUndo(`已完成 ${taskIds.length} 项任务`);
    const selected = new Set(taskIds);
    const completedAt = new Date().toISOString();
    setTasks((items) => items.map((task) => selected.has(task.id) && !task.completedAt ? { ...task, completedAt } : task));
  }

  function reopenTask(taskId: string) {
    pushUndo("已恢复任务");
    updateTask(taskId, (task) => ({ ...task, completedAt: undefined }));
  }

  function undoExecution(taskId: string) {
    pushUndo("已撤销今日执行");
    updateTask(taskId, (task) => ({ ...task, progress: task.progress.filter((entry) => !(entry.taskDate === selectedDate && entry.completedToday)) }));
  }

  function toggleFocus(taskId: string, date = selectedDate) {
    const focusCount = tasks.filter((task) => task.id !== taskId && !task.completedAt && !task.deletedAt && task.isFocus && isDueOn(task, date)).length;
    updateTask(taskId, (task) => ({ ...task, isFocus: task.isFocus ? false : focusCount < 3 }));
  }

  function assignTimeBlock(taskId: string, timeBlock: TimeBlock) {
    updateTask(taskId, (task) => ({ ...task, timeBlock }));
  }

  function deleteTask(taskId: string) {
    pushUndo("已移入回收站");
    const deletedAt = new Date().toISOString();
    updateTask(taskId, (task) => ({ ...task, deletedAt }));
    setSelectedTaskId((id) => id === taskId ? null : id);
    setEditingTaskId((id) => id === taskId ? null : id);
  }

  function deleteTasks(taskIds: string[], onConfirmed?: () => void) {
    const selected = new Set(taskIds);
    if (!selected.size) return;
    setConfirmRequest({
      title: "批量删除任务",
      message: `将选中的 ${selected.size} 项任务移入回收站？30 天内可在“设置 → 回收站”中找回。`,
      confirmLabel: "移入回收站",
      danger: true,
      onConfirm: () => {
        pushUndo(`已删除 ${selected.size} 项任务`);
        const deletedAt = new Date().toISOString();
        setTasks((items) => items.map((task) => selected.has(task.id) ? { ...task, deletedAt } : task));
        setSelectedTaskId((id) => id && selected.has(id) ? null : id);
        onConfirmed?.();
      }
    });
  }

  function restoreTask(taskId: string) {
    updateTask(taskId, (task) => ({ ...task, deletedAt: undefined }));
  }

  function purgeTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    setConfirmRequest({
      title: "彻底删除",
      message: `将永久删除“${task?.title ?? "该任务"}”及其全部进展记录，此操作无法恢复。`,
      confirmLabel: "彻底删除",
      danger: true,
      onConfirm: () => setTasks((items) => items.filter((item) => item.id !== taskId))
    });
  }

  function emptyTrash() {
    const count = tasks.filter((task) => task.deletedAt).length;
    if (!count) return;
    setConfirmRequest({
      title: "清空回收站",
      message: `将永久删除回收站中的 ${count} 项任务，此操作无法恢复。`,
      confirmLabel: "清空",
      danger: true,
      onConfirm: () => setTasks((items) => items.filter((task) => !task.deletedAt))
    });
  }

  function saveTask(taskId: string, form: FormData, repeatConfig?: RepeatConfig) {
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    const existing = tasks.find((task) => task.id === taskId);
    const plannedDate = String(form.get("plannedDate") || existing?.plannedDate || selectedDate);
    const otherFocusCount = tasks.filter((task) => task.id !== taskId && !task.completedAt && !task.deletedAt && task.isFocus && isDueOn(task, plannedDate)).length;
    updateTask(taskId, (task) => ({
      ...task,
      title,
      description: String(form.get("description") || "").trim(),
      project: String(form.get("project") || "收集箱").trim() || "收集箱",
      tags: String(form.get("tags") || "").split("，").map((item) => item.trim()).filter(Boolean),
      priority: String(form.get("priority") || "medium") as Priority,
      plannedDate,
      estimateMinutes: Number(form.get("estimateMinutes") || 0),
      repeat: String(form.get("repeat") || "none") as RepeatRule,
      repeatConfig,
      dueAt: String(form.get("dueAt") || "") || undefined,
      timeBlock: String(form.get("timeBlock") || "unscheduled") as TimeBlock,
      isFocus: form.get("isFocus") === "on" && (task.isFocus || otherFocusCount < 3)
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
    pushUndo(`已调整 ${taskIds.length} 项任务`);
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

  function addProgress(taskId: string, completedToday: boolean, content: string) {
    const trimmed = content.trim();
    updateTask(taskId, (task) => ({
      ...task,
      progress: [...task.progress, {
        id: makeId("progress"), taskDate: selectedDate,
        content: trimmed || (task.repeat === "none" ? "完成今日执行，原任务继续保留。" : "完成本次周期执行。"),
        completedToday, createdAt: new Date().toISOString()
      }]
    }));
  }

  function createTask(form: FormData, repeatConfig?: RepeatConfig) {
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    const plannedDate = String(form.get("plannedDate") || selectedDate);
    const focusCount = tasks.filter((task) => !task.completedAt && !task.deletedAt && task.isFocus && isDueOn(task, plannedDate)).length;
    const task: Task = {
      id: makeId("task"), title, description: String(form.get("description") || "").trim(),
      project: String(form.get("project") || "收集箱"), tags: String(form.get("tags") || "").split("，").map((item) => item.trim()).filter(Boolean),
      priority: String(form.get("priority") || "medium") as Priority,
      plannedDate, dueAt: String(form.get("dueAt") || "") || undefined,
      timeBlock: String(form.get("timeBlock") || "unscheduled") as TimeBlock, isFocus: form.get("isFocus") === "on" && focusCount < 3, estimateMinutes: Number(form.get("estimateMinutes") || 30),
      repeat: String(form.get("repeat") || "none") as RepeatRule, repeatConfig, createdAt: new Date().toISOString(), progress: [], subtasks: []
    };
    setTasks((items) => [task, ...items]);
    setShowComposer(false);
    setSelectedTaskId(task.id);
  }

  function createQuickTask(parsed: QuickAddResult, select = true) {
    if (!parsed.title) return;
    const task: Task = {
      id: makeId("task"), title: parsed.title, description: "",
      project: "收集箱", tags: parsed.tags,
      priority: parsed.priority ?? "medium",
      plannedDate: parsed.plannedDate ?? selectedDate, dueAt: parsed.dueAt,
      timeBlock: parsed.timeBlock ?? "unscheduled", isFocus: false,
      estimateMinutes: parsed.estimateMinutes ?? 30,
      repeat: parsed.repeat ?? "none", repeatConfig: parsed.repeatConfig,
      createdAt: new Date().toISOString(), progress: [], subtasks: []
    };
    setTasks((items) => [task, ...items]);
    if (select) {
      setShowComposer(false);
      setSelectedTaskId(task.id);
    }
  }

  function saveTemplateFromForm(form: FormData, repeatConfig?: RepeatConfig) {
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    const template: TaskTemplate = {
      id: makeId("template"), name: title, title,
      description: String(form.get("description") || "").trim() || undefined,
      project: String(form.get("project") || "收集箱").trim() || "收集箱",
      tags: String(form.get("tags") || "").split("，").map((item) => item.trim()).filter(Boolean),
      priority: String(form.get("priority") || "medium") as Priority,
      timeBlock: String(form.get("timeBlock") || "unscheduled") as TimeBlock,
      estimateMinutes: Number(form.get("estimateMinutes") || 30),
      repeat: String(form.get("repeat") || "none") as RepeatRule,
      repeatConfig,
      dueAt: String(form.get("dueAt") || "") || undefined
    };
    const next = [template, ...templates.filter((item) => item.name !== template.name)].slice(0, 20);
    setTemplates(next);
    writeTemplates(next);
  }

  function deleteTemplate(templateId: string) {
    const next = templates.filter((template) => template.id !== templateId);
    setTemplates(next);
    writeTemplates(next);
  }

  function applyTemplate(template: TaskTemplate) {
    const task: Task = {
      id: makeId("task"), title: template.title, description: template.description ?? "",
      project: template.project, tags: template.tags, priority: template.priority,
      plannedDate: selectedDate, dueAt: template.dueAt, timeBlock: template.timeBlock,
      isFocus: false, estimateMinutes: template.estimateMinutes,
      repeat: template.repeat, repeatConfig: template.repeatConfig,
      createdAt: new Date().toISOString(), progress: [], subtasks: []
    };
    setTasks((items) => [task, ...items]);
    setShowComposer(false);
    setSelectedTaskId(task.id);
  }

  function batchCreate(parsedLines: QuickAddResult[]) {
    if (!parsedLines.length) return;
    const createdAt = new Date().toISOString();
    const newTasks = parsedLines.map((parsed) => ({
      id: makeId("task"), title: parsed.title, description: "",
      project: "收集箱", tags: parsed.tags, priority: parsed.priority ?? "medium" as Priority,
      plannedDate: parsed.plannedDate ?? selectedDate, dueAt: parsed.dueAt,
      timeBlock: parsed.timeBlock ?? "unscheduled" as TimeBlock, isFocus: false,
      estimateMinutes: parsed.estimateMinutes ?? 30,
      repeat: parsed.repeat ?? "none" as RepeatRule, repeatConfig: parsed.repeatConfig,
      createdAt, progress: [], subtasks: []
    } satisfies Task));
    pushUndo(`已批量创建 ${newTasks.length} 项任务`);
    setTasks((items) => [...newTasks, ...items]);
    setShowComposer(false);
  }

  function persistDailyReview(reflection: string, tomorrowFocus: string) {
    const review = { taskDate: selectedDate, reflection, tomorrowFocus, updatedAt: new Date().toISOString() };
    setDailyReview(review);
    void saveDailyReview(review).catch(() => setSaveError(true));
  }

  function savePlan(plan: ProjectPlan) {
    setPlans((current) => [...current.filter((item) => item.id !== plan.id), plan]);
    void saveProjectPlan(plan).catch(() => setSaveError(true));
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

  async function importFile(file: File) {
    try {
      const data = JSON.parse(await file.text()) as { tasks?: Task[]; dailyReviews?: DailyReview[] };
      if (!Array.isArray(data.tasks)) throw new Error("invalid backup");
      const importedTasks = data.tasks;
      const importedReviews = Array.isArray(data.dailyReviews) ? data.dailyReviews : null;
      setConfirmRequest({
        title: "导入备份",
        message: `备份中包含 ${importedTasks.length} 项任务${importedReviews ? `、${importedReviews.length} 条复盘` : ""}，导入后将替换当前全部数据。确定继续吗？`,
        confirmLabel: "导入并替换",
        danger: true,
        onConfirm: () => {
          pushUndo("已导入备份");
          setTasks(importedTasks);
          if (importedReviews) void replaceDailyReviews(importedReviews).catch(() => setSaveError(true));
        }
      });
    } catch {
      setConfirmRequest({ title: "导入失败", message: "无法读取备份文件，请选择 Dayflow 导出的 JSON 文件。", confirmLabel: "知道了", onConfirm: () => undefined });
    }
  }

  function restoreBackup(backup: AutoBackup) {
    setConfirmRequest({
      title: "恢复自动快照",
      message: `将任务数据恢复到 ${new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(backup.createdAt))} 的状态（${backup.tasks.length} 项任务），当前数据将被替换。`,
      confirmLabel: "恢复",
      danger: true,
      onConfirm: () => {
        pushUndo("已恢复快照");
        setTasks(backup.tasks);
      }
    });
  }

  function pushUndo(label: string) {
    setUndoStack((stack) => [...stack.slice(-19), { label, tasks }]);
    setShowUndoToast(true);
  }

  function restoreUndo() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setTasks(last.tasks);
    setUndoStack((stack) => stack.slice(0, -1));
    if (undoStack.length <= 1) setShowUndoToast(false);
  }

  const activeTasks = tasks.filter((task) => !task.deletedAt);
  const trashTasks = tasks.filter((task) => task.deletedAt).sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  const overdueTasks = activeTasks.filter((task) => !task.completedAt && task.repeat === "none" && task.plannedDate < todayKey);
  const overdueCount = overdueTasks.length;
  const dueTodayTasks = activeTasks
    .filter((task) => !task.completedAt && task.dueAt && isDueOn(task, todayKey) && !completedExecutionOn(task, todayKey))
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  const upcomingMilestones = plans
    .filter((plan) => plan.targetDate && plan.milestones.some((milestone) => !milestone.completed))
    .map((plan) => ({ plan, days: dateDiff(todayKey, plan.targetDate ?? todayKey) }))
    .filter((item) => item.days <= 7)
    .sort((a, b) => a.days - b.days);
  const reviewPending = selectedDate === todayKey && new Date().getHours() >= 20 && !dailyReview.reflection.trim() && !dailyReview.tomorrowFocus.trim();

  useEffect(() => {
    if (!loaded) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (!notifySeededRef.current) {
      notifySeededRef.current = true;
      for (const task of dueTodayTasks) if (task.dueAt && task.dueAt <= hhmm) notifiedRef.current.add(`${todayKey}:${task.id}`);
      if (now.getHours() >= 20) notifiedRef.current.add(`${todayKey}:review`);
      return;
    }
    for (const task of dueTodayTasks) {
      const key = `${todayKey}:${task.id}`;
      if (task.dueAt && task.dueAt <= hhmm && !notifiedRef.current.has(key)) {
        notifiedRef.current.add(key);
        void notify("任务截止提醒", `「${task.title}」的截止时间是 ${task.dueAt}。`);
      }
    }
    const reviewKey = `${todayKey}:review`;
    if (reviewPending && !notifiedRef.current.has(reviewKey)) {
      notifiedRef.current.add(reviewKey);
      void notify("每日复盘", "今天还没有写复盘，留下一句也很好。");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockTick, loaded]);

  function openDate(date: string) {
    setSelectedDate(date);
    setView("today");
  }

  const commands: CommandItem[] = [
    ...navigation.map(({ id, label }) => ({ id: `go-${id}`, label: `跳转：${label}`, keywords: `view go ${id}`, run: () => setView(id) })),
    { id: "go-settings", label: "跳转：设置", keywords: "view go settings", run: () => setView("settings") },
    { id: "new-task", label: "新建任务", hint: "快捷键 N", keywords: "new create add", run: () => setShowComposer(true) },
    { id: "back-today", label: "回到今天", hint: "快捷键 T", keywords: "today now", run: () => { setView("today"); setSelectedDate(getTaskDate()); } },
    { id: "theme-auto", label: "主题：跟随系统", keywords: "theme auto", run: () => setTheme("auto") },
    { id: "theme-sage", label: "主题：自然绿", keywords: "theme sage green", run: () => setTheme("sage") },
    { id: "theme-coral", label: "主题：明亮珊瑚", keywords: "theme coral", run: () => setTheme("coral") },
    { id: "theme-coast", label: "主题：冷静海岸", keywords: "theme coast blue", run: () => setTheme("coast") },
    { id: "theme-midnight", label: "主题：深夜高对比", keywords: "theme midnight dark 深色 暗", run: () => setTheme("midnight") },
    { id: "toggle-density", label: density === "compact" ? "切换为舒适密度" : "切换为紧凑密度", keywords: "density compact 密度", run: () => setDensity(density === "compact" ? "comfortable" : "compact") },
    { id: "export-backup", label: "导出备份", keywords: "export backup json", run: () => void exportData() }
  ];

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
        <div className="profile"><div className="avatar">{profileName.trim().charAt(0) || "我"}</div><div><strong>{profileName.trim() || "未命名"}</strong><span>本地工作空间</span></div><MoreHorizontal size={18} /></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="crumb"><span>{view === "today" ? "每日规划" : navigation.find((item) => item.id === view)?.label ?? "设置"}</span><b>/</b><strong>{view === "today" ? formatTaskDate(selectedDate) : "总览"}</strong></div>
          <div className="topbar-actions"><button className="icon-button" title="搜索（Ctrl+K）" onClick={() => setSearchOpen(true)}><Search size={19} /></button><NotificationCenter open={showAlerts} onToggle={() => setShowAlerts((open) => !open)} onClose={() => setShowAlerts(false)} todayKey={todayKey} overdueTasks={overdueTasks} dueTodayTasks={dueTodayTasks} upcomingMilestones={upcomingMilestones} reviewPending={reviewPending} onOpenTask={setSelectedTaskId} onGoProjects={() => setView("projects")} onGoToday={() => setView("today")} /><button className="primary-button" onClick={() => setShowComposer(true)}><Plus size={18} />新建任务</button></div>
        </header>

        {loadState === "error" ? (
          <section className="load-error"><div><h1>数据加载失败</h1><p>没能打开本地数据库。你的数据文件仍在本机（%APPDATA%\com.dayflow.planner\dayflow.db），未被删除。</p>{loadErrorDetail && <pre className="load-error-detail">{loadErrorDetail}</pre>}<button className="primary-button" onClick={loadInitialTasks}>重新加载</button></div></section>
        ) : view === "today" ? (
          <TodayView tasks={activeTasks} loaded={loaded} selectedDate={selectedDate} todayKey={todayKey} selectedTaskId={selectedTaskId} onSelectTask={setSelectedTaskId} onSelectDate={setSelectedDate} onComplete={completeTask} onAddProgress={addProgress} onReschedule={rescheduleTask} onToggleFocus={toggleFocus} onAssignTimeBlock={assignTimeBlock} onReopenTask={reopenTask} onUndoExecution={undoExecution} onOpenComposer={() => setShowComposer(true)} onDeleteTask={deleteTask} onCreateTomorrow={(parsed) => createQuickTask(parsed, false)} dailyReview={dailyReview} onSaveReview={persistDailyReview} />
        ) : view === "calendar" ? (
          <CalendarView tasks={activeTasks} selectedDate={selectedDate} onSelectDate={setSelectedDate} onSelectTask={setSelectedTaskId} onReschedule={rescheduleTask} />
        ) : view === "tasks" ? (
          <TasksView tasks={activeTasks} selectedDate={selectedDate} onSelectTask={setSelectedTaskId} onCompleteTasks={completeTasks} onDeleteTasks={deleteTasks} onRescheduleTasks={rescheduleTasks} onReopenTask={reopenTask} />
        ) : view === "projects" ? (
          <ProjectsView tasks={activeTasks} onSelectTask={setSelectedTaskId} plans={plans} onSavePlan={savePlan} />
        ) : view === "habits" ? (
          <HabitsView tasks={activeTasks} onSelectTask={setSelectedTaskId} onOpenDate={openDate} />
        ) : view === "insights" ? (
          <InsightsView tasks={activeTasks} selectedDate={selectedDate} onOpenDate={openDate} />
        ) : (
          <SettingsView onExportData={exportData} onImportFile={(file) => void importFile(file)} theme={theme} onThemeChange={setTheme} profileName={profileName} onProfileNameChange={setProfileName} onRestoreBackup={restoreBackup} trashTasks={trashTasks} onRestoreTask={restoreTask} onPurgeTask={purgeTask} onEmptyTrash={emptyTrash} density={density} onDensityChange={setDensity} />
        )}
      </main>

      {selectedTask && <TaskDetail task={selectedTask} selectedDate={selectedDate} onAddProgress={addProgress} onComplete={completeTask} onReopen={reopenTask} onEdit={() => setEditingTaskId(selectedTask.id)} onDelete={deleteTask} onAddSubtask={addSubtask} onToggleSubtask={toggleSubtask} onDeleteSubtask={deleteSubtask} onClose={() => setSelectedTaskId(null)} />}
      {searchOpen && <SearchOverlay tasks={activeTasks} commands={commands} onClose={() => setSearchOpen(false)} onOpenTask={(task) => { setSelectedTaskId(task.id); setSearchOpen(false); }} />}
      {showComposer && <TaskComposer selectedDate={selectedDate} onClose={() => setShowComposer(false)} onSubmit={createTask} onQuickCreate={createQuickTask} templates={templates} onApplyTemplate={applyTemplate} onSaveTemplate={saveTemplateFromForm} onDeleteTemplate={deleteTemplate} onBatchCreate={batchCreate} />}
      {editingTaskId && tasks.find((task) => task.id === editingTaskId) && <TaskComposer task={tasks.find((task) => task.id === editingTaskId)!} selectedDate={selectedDate} onClose={() => setEditingTaskId(null)} onSubmit={(form, repeatConfig) => saveTask(editingTaskId, form, repeatConfig)} />}
      {confirmRequest && <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />}
      {saveError && <div className="save-error"><span>数据保存失败，最近的修改可能尚未写入本地。</span><button onClick={() => setSaveAttempt((attempt) => attempt + 1)}>重试</button></div>}
      {showUndoToast && undoStack.length > 0 && <div className="undo-toast"><span>{undoStack[undoStack.length - 1].label}{undoStack.length > 1 ? ` · Ctrl+Z 可连续撤销 ${undoStack.length} 步` : ""}</span><button onClick={restoreUndo}>撤销</button><button title="关闭" onClick={() => setShowUndoToast(false)}><X size={15} /></button></div>}
    </div>
  );
}

export default App;
