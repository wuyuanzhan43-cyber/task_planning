CREATE TABLE IF NOT EXISTS daily_reviews (
  task_date TEXT PRIMARY KEY NOT NULL,
  reflection TEXT NOT NULL DEFAULT '',
  tomorrow_focus TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
