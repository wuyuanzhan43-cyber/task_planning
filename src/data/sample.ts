import { getTaskDate } from "../lib/task-date";
import type { Task } from "../types";

const now = new Date().toISOString();
const today = getTaskDate();

export const sampleTasks: Task[] = [
  {
    id: "task-thesis", title: "整理研究资料与论文提纲", description: "将本周的访谈资料整理为可引用的要点。", project: "毕业论文", tags: ["深度工作", "写作"], priority: "high", plannedDate: today, dueAt: "09:00", timeBlock: "morning", isFocus: true, estimateMinutes: 120, repeat: "none", createdAt: now,
    progress: [{ id: "progress-1", taskDate: today, content: "已整理两份访谈记录，下一步补齐研究框架。", completedToday: false, createdAt: now }],
    subtasks: [{ id: "sub-1", title: "提炼访谈要点", completed: true }, { id: "sub-2", title: "完善章节结构", completed: false }]
  },
  {
    id: "task-walk", title: "傍晚散步 30 分钟", project: "照顾自己", tags: ["健康"], priority: "low", plannedDate: today, dueAt: "18:00", timeBlock: "evening", isFocus: false, estimateMinutes: 30, repeat: "daily", createdAt: now,
    progress: [], subtasks: []
  },
  {
    id: "task-review", title: "完成项目需求复盘", project: "任务规划系统", tags: ["产品", "复盘"], priority: "medium", plannedDate: today, timeBlock: "afternoon", isFocus: false, estimateMinutes: 45, repeat: "weekly", createdAt: now,
    progress: [], subtasks: []
  }
];
