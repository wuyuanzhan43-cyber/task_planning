export type Priority = "high" | "medium" | "low";
export type RepeatRule = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type TimeBlock = "morning" | "afternoon" | "evening" | "unscheduled";

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
  completedAt?: string;
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
