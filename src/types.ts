export type Priority = "high" | "medium" | "low";
export type Theme = "auto" | "sage" | "coral" | "coast" | "midnight";
export type RepeatRule = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type TimeBlock = "morning" | "afternoon" | "evening" | "unscheduled";

export interface RepeatConfig {
  /** 间隔：每 N 天 / N 周 / N 个月，默认 1 */
  interval?: number;
  /** weekly 模式下指定星期几（0=周日 ... 6=周六），空则沿用计划日的星期几 */
  weekdays?: number[];
  /** monthly 模式：同一号数或每月最后一天 */
  monthlyMode?: "date" | "last-day";
}

export interface ProgressEntry {
  id: string;
  taskDate: string;
  content: string;
  completedToday: boolean;
  createdAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  project: string;
  tags: string[];
  priority: Priority;
  plannedDate: string;
  dueAt?: string;
  timeBlock: TimeBlock;
  isFocus: boolean;
  estimateMinutes: number;
  repeat: RepeatRule;
  repeatConfig?: RepeatConfig;
  completedAt?: string;
  deletedAt?: string;
  progress: ProgressEntry[];
  subtasks: Subtask[];
  createdAt: string;
}

export interface Milestone { id: string; title: string; completed: boolean; }
export interface ProjectPlan { id: string; name: string; targetDate?: string; milestones: Milestone[]; }

export interface DailyReview {
  taskDate: string;
  reflection: string;
  tomorrowFocus: string;
  updatedAt: string;
}
