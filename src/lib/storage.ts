import type { DailyReview, ProgressEntry, ProjectPlan, Task } from "../types";

const STORAGE_KEY = "dayflow.tasks.v1";
const REVIEW_STORAGE_KEY = "dayflow.daily-reviews.v1";
const PROJECT_STORAGE_KEY = "dayflow.project-plans.v1";

type SqlRow = Record<string, unknown>;

interface SqlDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T[]>;
}

interface SqlOperation {
  query: string;
  bindValues: unknown[];
}

let databasePromise: Promise<SqlDatabase> | null = null;

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function getDatabase(): Promise<SqlDatabase> {
  if (!databasePromise) {
    databasePromise = import("@tauri-apps/plugin-sql")
      .then(({ default: Database }) => Database.load("sqlite:dayflow.db") as Promise<SqlDatabase>)
      .catch((error) => {
        // 打开失败时不要缓存被拒绝的 Promise，否则“重试”永远拿到同一个失败结果
        databasePromise = null;
        throw error;
      });
  }
  return databasePromise;
}

async function executeTransaction(operations: SqlOperation[]): Promise<void> {
  await getDatabase();
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("execute_transaction", { operations });
}

/** 补全缺失字段：早期版本（localStorage 时代）的任务缺少后来新增的属性，直接写库会失败。 */
function normalizeTask(task: Partial<Task> & { id?: string; title?: string }): Task {
  return {
    id: String(task.id ?? `task-${Math.random().toString(36).slice(2)}`),
    title: String(task.title ?? "未命名任务"),
    description: task.description ? String(task.description) : undefined,
    project: task.project ? String(task.project) : "收集箱",
    tags: Array.isArray(task.tags) ? task.tags.map(String) : [],
    priority: task.priority === "high" || task.priority === "low" ? task.priority : "medium",
    plannedDate: typeof task.plannedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.plannedDate) ? task.plannedDate : new Date().toISOString().slice(0, 10),
    dueAt: task.dueAt ? String(task.dueAt) : undefined,
    timeBlock: task.timeBlock === "morning" || task.timeBlock === "afternoon" || task.timeBlock === "evening" ? task.timeBlock : "unscheduled",
    isFocus: Boolean(task.isFocus),
    estimateMinutes: Number.isFinite(Number(task.estimateMinutes)) ? Number(task.estimateMinutes) : 30,
    repeat: task.repeat === "daily" || task.repeat === "weekdays" || task.repeat === "weekly" || task.repeat === "monthly" ? task.repeat : "none",
    repeatConfig: task.repeatConfig && typeof task.repeatConfig === "object" ? task.repeatConfig : undefined,
    completedAt: task.completedAt ? String(task.completedAt) : undefined,
    deletedAt: task.deletedAt ? String(task.deletedAt) : undefined,
    progress: Array.isArray(task.progress) ? task.progress.filter((entry) => entry && entry.content !== undefined).map((entry, index) => ({
      id: String(entry.id ?? `progress-legacy-${index}`),
      taskDate: String(entry.taskDate ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      content: String(entry.content),
      completedToday: Boolean(entry.completedToday),
      createdAt: String(entry.createdAt ?? new Date().toISOString())
    })) : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.filter((subtask) => subtask && subtask.title !== undefined).map((subtask, index) => ({
      id: String(subtask.id ?? `subtask-legacy-${index}`),
      title: String(subtask.title),
      completed: Boolean(subtask.completed)
    })) : [],
    createdAt: String(task.createdAt ?? new Date().toISOString())
  };
}

function parseLocalTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Array<Partial<Task>> : [];
    return Array.isArray(parsed) ? parsed.filter((task) => task && task.title !== undefined).map(normalizeTask) : [];
  } catch {
    return [];
  }
}

function projectId(name: string): string {
  return `project:${encodeURIComponent(name || "收集箱")}`;
}

export function projectPlanId(name: string): string {
  return projectId(name);
}

function parseRepeatConfig(value: unknown): Task["repeatConfig"] {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(String(value)) as Task["repeatConfig"];
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function taskFromRow(row: SqlRow, tags: Map<string, string[]>, progress: Map<string, ProgressEntry[]>, subtasks: Map<string, Task["subtasks"]>): Task {
  const id = String(row.id);
  return {
    id,
    title: String(row.title),
    description: row.description ? String(row.description) : undefined,
    project: row.project_name ? String(row.project_name) : "收集箱",
    tags: tags.get(id) ?? [],
    priority: String(row.priority) as Task["priority"],
    plannedDate: String(row.planned_date),
    dueAt: row.due_at ? String(row.due_at) : undefined,
    timeBlock: (row.time_block ? String(row.time_block) : "unscheduled") as Task["timeBlock"],
    isFocus: Boolean(row.is_focus),
    estimateMinutes: Number(row.estimate_minutes),
    repeat: String(row.repeat_rule) as Task["repeat"],
    repeatConfig: parseRepeatConfig(row.repeat_config),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    deletedAt: row.deleted_at ? String(row.deleted_at) : undefined,
    progress: progress.get(id) ?? [],
    subtasks: subtasks.get(id) ?? [],
    createdAt: String(row.created_at)
  };
}

export async function loadTasks(): Promise<Task[]> {
  if (!isTauriRuntime()) return parseLocalTasks();

  const database = await getDatabase();
  const [taskRows, tagRows, progressRows, subtaskRows] = await Promise.all([
    database.select<SqlRow>("SELECT tasks.*, projects.name AS project_name FROM tasks LEFT JOIN projects ON projects.id = tasks.project_id ORDER BY tasks.created_at DESC"),
    database.select<SqlRow>("SELECT task_id, name FROM task_tags"),
    database.select<SqlRow>("SELECT id, task_id, task_date, content, completed_today, created_at FROM task_progress_entries ORDER BY created_at ASC"),
    database.select<SqlRow>("SELECT id, task_id, title, completed_at FROM subtasks ORDER BY position ASC")
  ]);

  const tags = new Map<string, string[]>();
  tagRows.forEach((row) => {
    const id = String(row.task_id);
    tags.set(id, [...(tags.get(id) ?? []), String(row.name)]);
  });
  const progress = new Map<string, ProgressEntry[]>();
  progressRows.forEach((row) => {
    const id = String(row.task_id);
    progress.set(id, [...(progress.get(id) ?? []), {
      id: String(row.id), taskDate: String(row.task_date), content: String(row.content),
      completedToday: Boolean(row.completed_today), createdAt: String(row.created_at)
    }]);
  });
  const subtasks = new Map<string, Task["subtasks"]>();
  subtaskRows.forEach((row) => {
    const id = String(row.task_id);
    subtasks.set(id, [...(subtasks.get(id) ?? []), {
      id: String(row.id), title: String(row.title), completed: Boolean(row.completed_at)
    }]);
  });
  const tasks = taskRows.map((row) => taskFromRow(row, tags, progress, subtasks));
  if (tasks.length === 0) {
    const legacyTasks = parseLocalTasks();
    if (legacyTasks.length > 0) {
      try {
        await saveTasks(legacyTasks);
      } catch (error) {
        // 旧数据迁移失败不应阻塞应用启动：先用内存中的数据运行，常规保存流程会重试并提示。
        console.error("[dayflow] 旧数据自动迁移失败（应用仍可使用）:", error);
      }
      return legacyTasks;
    }
  }
  return tasks;
}

export async function saveTasks(tasks: Task[], previousTasks: Task[] = []): Promise<void> {
  if (!isTauriRuntime()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return;
  }

  const previousById = new Map(previousTasks.map((task) => [task.id, task]));
  const currentIds = new Set(tasks.map((task) => task.id));
  const changedTasks = tasks.filter((task) => JSON.stringify(task) !== JSON.stringify(previousById.get(task.id)));
  const removedTaskIds = previousTasks.filter((task) => !currentIds.has(task.id)).map((task) => task.id);
  if (changedTasks.length === 0 && removedTaskIds.length === 0) return;

  const now = new Date().toISOString();
  const operations: SqlOperation[] = [];
  const add = (query: string, bindValues: unknown[] = []) => operations.push({ query, bindValues });
  for (const taskId of removedTaskIds) {
    add("DELETE FROM task_tags WHERE task_id = ?", [taskId]);
    add("DELETE FROM subtasks WHERE task_id = ?", [taskId]);
    add("DELETE FROM task_progress_entries WHERE task_id = ?", [taskId]);
    add("DELETE FROM tasks WHERE id = ?", [taskId]);
  }

  const projects = [...new Set(changedTasks.map((task) => task.project || "收集箱"))];
  for (const name of projects) {
    add(
      "INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name",
      [projectId(name), name, now]
    );
  }
  for (const task of changedTasks) {
    add("DELETE FROM task_tags WHERE task_id = ?", [task.id]);
    add("DELETE FROM subtasks WHERE task_id = ?", [task.id]);
    add("DELETE FROM task_progress_entries WHERE task_id = ?", [task.id]);
    add(
      "INSERT INTO tasks (id, title, description, project_id, priority, planned_date, due_at, time_block, is_focus, estimate_minutes, repeat_rule, repeat_config, completed_at, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description, project_id = excluded.project_id, priority = excluded.priority, planned_date = excluded.planned_date, due_at = excluded.due_at, time_block = excluded.time_block, is_focus = excluded.is_focus, estimate_minutes = excluded.estimate_minutes, repeat_rule = excluded.repeat_rule, repeat_config = excluded.repeat_config, completed_at = excluded.completed_at, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at",
      [task.id, task.title, task.description ?? null, projectId(task.project), task.priority, task.plannedDate, task.dueAt ?? null, task.timeBlock, task.isFocus ? 1 : 0, task.estimateMinutes, task.repeat, task.repeatConfig ? JSON.stringify(task.repeatConfig) : null, task.completedAt ?? null, task.deletedAt ?? null, task.createdAt, now]
    );
    for (const tag of new Set(task.tags)) {
      add("INSERT INTO task_tags (task_id, name) VALUES (?, ?)", [task.id, tag]);
    }
    for (const [position, subtask] of task.subtasks.entries()) {
      add("INSERT INTO subtasks (id, task_id, title, position, completed_at) VALUES (?, ?, ?, ?, ?)", [subtask.id, task.id, subtask.title, position, subtask.completed ? now : null]);
    }
    for (const entry of task.progress) {
      add("INSERT INTO task_progress_entries (id, task_id, task_date, content, completed_today, created_at) VALUES (?, ?, ?, ?, ?, ?)", [entry.id, task.id, entry.taskDate, entry.content, entry.completedToday ? 1 : 0, entry.createdAt]);
    }
  }
  await executeTransaction(operations);
}

export function usesSqlite(): boolean {
  return isTauriRuntime();
}

export async function loadDailyReview(taskDate: string): Promise<DailyReview> {
  const emptyReview: DailyReview = { taskDate, reflection: "", tomorrowFocus: "", updatedAt: "" };
  if (!isTauriRuntime()) {
    try {
      const reviews = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) ?? "{}") as Record<string, DailyReview>;
      return reviews[taskDate] ?? emptyReview;
    } catch {
      return emptyReview;
    }
  }
  const database = await getDatabase();
  const rows = await database.select<SqlRow>("SELECT task_date, reflection, tomorrow_focus, updated_at FROM daily_reviews WHERE task_date = ?", [taskDate]);
  if (!rows[0]) return emptyReview;
  return { taskDate, reflection: String(rows[0].reflection), tomorrowFocus: String(rows[0].tomorrow_focus), updatedAt: String(rows[0].updated_at) };
}

export async function saveDailyReview(review: DailyReview): Promise<void> {
  if (!isTauriRuntime()) {
    const reviews = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) ?? "{}") as Record<string, DailyReview>;
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify({ ...reviews, [review.taskDate]: review }));
    return;
  }
  const database = await getDatabase();
  await database.execute(
    "INSERT INTO daily_reviews (task_date, reflection, tomorrow_focus, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(task_date) DO UPDATE SET reflection = excluded.reflection, tomorrow_focus = excluded.tomorrow_focus, updated_at = excluded.updated_at",
    [review.taskDate, review.reflection, review.tomorrowFocus, review.updatedAt]
  );
}

export async function loadDailyReviews(fromDate: string, toDate: string): Promise<DailyReview[]> {
  if (!isTauriRuntime()) {
    try {
      const reviews = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) ?? "{}") as Record<string, DailyReview>;
      return Object.values(reviews).filter((review) => review.taskDate >= fromDate && review.taskDate <= toDate).sort((a, b) => a.taskDate.localeCompare(b.taskDate));
    } catch {
      return [];
    }
  }
  const database = await getDatabase();
  const rows = await database.select<SqlRow>("SELECT task_date, reflection, tomorrow_focus, updated_at FROM daily_reviews WHERE task_date BETWEEN ? AND ? ORDER BY task_date ASC", [fromDate, toDate]);
  return rows.map((row) => ({ taskDate: String(row.task_date), reflection: String(row.reflection), tomorrowFocus: String(row.tomorrow_focus), updatedAt: String(row.updated_at) }));
}

export async function loadAllDailyReviews(): Promise<DailyReview[]> {
  if (!isTauriRuntime()) {
    try { return Object.values(JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) ?? "{}") as Record<string, DailyReview>); } catch { return []; }
  }
  const database = await getDatabase();
  const rows = await database.select<SqlRow>("SELECT task_date, reflection, tomorrow_focus, updated_at FROM daily_reviews ORDER BY task_date ASC");
  return rows.map((row) => ({ taskDate: String(row.task_date), reflection: String(row.reflection), tomorrowFocus: String(row.tomorrow_focus), updatedAt: String(row.updated_at) }));
}

export async function replaceDailyReviews(reviews: DailyReview[]): Promise<void> {
  if (!isTauriRuntime()) {
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(Object.fromEntries(reviews.map((review) => [review.taskDate, review]))));
    return;
  }
  await executeTransaction([
    { query: "DELETE FROM daily_reviews", bindValues: [] },
    ...reviews.map((review) => ({
      query: "INSERT INTO daily_reviews (task_date, reflection, tomorrow_focus, updated_at) VALUES (?, ?, ?, ?)",
      bindValues: [review.taskDate, review.reflection, review.tomorrowFocus, review.updatedAt]
    }))
  ]);
}

export async function loadProjectPlans(): Promise<ProjectPlan[]> {
  if (!isTauriRuntime()) {
    try { return JSON.parse(localStorage.getItem(PROJECT_STORAGE_KEY) ?? "[]") as ProjectPlan[]; } catch { return []; }
  }
  const database = await getDatabase();
  const rows = await database.select<SqlRow>("SELECT id, name, target_date, milestones_json FROM projects ORDER BY name ASC");
  return rows.map((row) => ({ id: String(row.id), name: String(row.name), targetDate: row.target_date ? String(row.target_date) : undefined, milestones: JSON.parse(String(row.milestones_json ?? "[]")) }));
}

export async function saveProjectPlan(plan: ProjectPlan): Promise<void> {
  if (!isTauriRuntime()) {
    const current = await loadProjectPlans();
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify([...current.filter((item) => item.id !== plan.id), plan]));
    return;
  }
  const database = await getDatabase();
  await database.execute("INSERT INTO projects (id, name, target_date, milestones_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, target_date = excluded.target_date, milestones_json = excluded.milestones_json", [plan.id, plan.name, plan.targetDate ?? null, JSON.stringify(plan.milestones), new Date().toISOString()]);
}
