import { describe, expect, it } from "vitest";
import { buildReport } from "./report";
import { daysInRange } from "./schedule";
import type { Task } from "../types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1", title: "写周报", project: "工作", tags: [], priority: "medium",
    plannedDate: "2026-07-20", timeBlock: "unscheduled", isFocus: false, estimateMinutes: 60,
    repeat: "none", progress: [], subtasks: [], createdAt: "2026-07-20T08:00:00.000Z",
    ...overrides
  };
}

describe("buildReport", () => {
  const days = daysInRange("2026-07-20", "2026-07-26");
  const tasks = [makeTask({ completedAt: "2026-07-21T10:00:00.000Z" })];
  const reviews = [{ taskDate: "2026-07-21", reflection: "上午专注度不错", tomorrowFocus: "继续推进", updatedAt: "2026-07-21T22:00:00.000Z" }];

  it("包含标题、总览与每日记录", () => {
    const markdown = buildReport({ periodName: "周", rangeLabel: "7月20日 至 7月26日", days, tasks, reviews });
    expect(markdown).toContain("# Dayflow 周报");
    expect(markdown).toContain("完成率：");
    expect(markdown).toContain("- [x] 写周报");
    expect(markdown).toContain("> 复盘：上午专注度不错");
    expect(markdown).toContain("> 明日重点：继续推进");
  });

  it("没有记录的日子给出占位文案", () => {
    const markdown = buildReport({ periodName: "周", rangeLabel: "范围", days, tasks: [], reviews: [] });
    expect(markdown).toContain("_没有完成记录_");
  });
});
