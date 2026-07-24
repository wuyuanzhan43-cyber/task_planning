CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#91ae95',
  archived_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  project_id TEXT REFERENCES projects(id),
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  planned_date TEXT NOT NULL,
  due_at TEXT,
  estimate_minutes INTEGER NOT NULL DEFAULT 0,
  repeat_rule TEXT NOT NULL DEFAULT 'none',
  repeat_config TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  PRIMARY KEY (task_id, name)
);

CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS task_progress_entries (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_date TEXT NOT NULL,
  content TEXT NOT NULL,
  completed_today INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_reviews (
  task_date TEXT PRIMARY KEY NOT NULL,
  reflection TEXT NOT NULL DEFAULT '',
  tomorrow_focus TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_planned_date ON tasks(planned_date);
CREATE INDEX IF NOT EXISTS idx_progress_task_date ON task_progress_entries(task_id, task_date);
