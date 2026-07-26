import type { Priority, RepeatRule, TimeBlock } from "./types";

export const priorityLabel: Record<Priority, string> = { high: "重要", medium: "正常", low: "轻缓" };
export const repeatLabel: Record<RepeatRule, string> = { none: "不重复", daily: "每天", weekdays: "工作日", weekly: "每周", monthly: "每月" };
export const timeBlockLabel: Record<TimeBlock, string> = { morning: "上午", afternoon: "下午", evening: "晚上", unscheduled: "待安排" };
export const APP_VERSION = "0.8.0";
