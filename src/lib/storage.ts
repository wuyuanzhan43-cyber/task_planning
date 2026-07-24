import type { DailyReview, ProgressEntry, Task } from "../types";

const STORAGE_KEY = "dayflow.tasks.v1";
const REVIEW_STORAGE_KEY = "dayflow.daily-reviews.v1";

type SqlRow = Record<string, unknown>;

interface SqlDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T[]>;
}

let databasePromise: Promise<SqlDatabase> | null = null;

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function getDatabase(): Promise<SqlDatabase> {
  if (!databasePromise) {
    databasePromise = import("@tauri-apps/plugin-sql")
      .then(({ default: Database }) => Database.load("sqlite:dayflow.db") as Promise<SqlDatabase>);
  }
  return databasePromise;
}

function parseLocalTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as Task[] : [];
  } catch {
    return [];
  }
}

function projectId(name: string): string {
  return `project:${encodeURIComponent(name || "收集箱")}`;
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
    estimateMinutes: Number(row.estimate_minutes),
    repeat: String(row.repeat_rule) as Task["repeat"],
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
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
      await saveTasks(legacyTasks);
      return legacyTasks;
    }
  }
  return tasks;
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  if (!isTauriRuntime()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return;
  }

  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.execute("BEGIN TRANSACTION");
  try {
    await database.execute("DELETE FROM task_tags");
    await database.execute("DELETE FROM subtasks");
    await database.execute("DELETE FROM task_progress_entries");
    await database.execute("DELETE FROM tasks");

    const projects = [...new Set(tasks.map((task) => task.project || "收集箱"))];
    for (const name of projects) {
      await database.execute(
        "INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name",
        [projectId(name), name, now]
      );
    }
    for (const task of tasks) {
      await database.execute(
        "INSERT INTO tasks (id, title, description, project_id, priority, planned_date, due_at, estimate_minutes, repeat_rule, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [task.id, task.title, task.description ?? null, projectId(task.project), task.priority, task.plannedDate, task.dueAt ?? null, task.estimateMinutes, task.repeat, task.completedAt ?? null, task.createdAt, now]
      );
      for (const tag of task.tags) {
        await database.execute("INSERT INTO task_tags (task_id, name) VALUES (?, ?)", [task.id, tag]);
      }
      for (const [position, subtask] of task.subtasks.entries()) {
        await database.execute("INSERT INTO subtasks (id, task_id, title, position, completed_at) VALUES (?, ?, ?, ?, ?)", [subtask.id, task.id, subtask.title, position, subtask.completed ? now : null]);
      }
      for (const entry of task.progress) {
        await database.execute("INSERT INTO task_progress_entries (id, task_id, task_date, content, completed_today, created_at) VALUES (?, ?, ?, ?, ?, ?)", [entry.id, task.id, entry.taskDate, entry.content, entry.completedToday ? 1 : 0, entry.createdAt]);
      }
    }
    await database.execute("COMMIT");
  } catch (error) {
    await database.execute("ROLLBACK");
    throw error;
  }
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
