import type { Priority, RepeatConfig, RepeatRule, TimeBlock } from "../types";

const TEMPLATE_KEY = "dayflow.task-templates.v1";

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description?: string;
  project: string;
  tags: string[];
  priority: Priority;
  timeBlock: TimeBlock;
  estimateMinutes: number;
  repeat: RepeatRule;
  repeatConfig?: RepeatConfig;
  dueAt?: string;
}

export function readTemplates(): TaskTemplate[] {
  try {
    const templates = JSON.parse(localStorage.getItem(TEMPLATE_KEY) ?? "[]") as TaskTemplate[];
    return Array.isArray(templates) ? templates : [];
  } catch {
    return [];
  }
}

export function writeTemplates(templates: TaskTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates.slice(0, 20)));
  } catch { /* 模板保存失败不影响主流程 */ }
}
