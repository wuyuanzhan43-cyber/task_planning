import { describe, expect, it } from "vitest";
import { completedExecutionOn, computeStreak, dayExecutions, dayPlanned, daysInRange, describeRepeat, habitStats, habitStreak, isDueOn, monthEnd, monthStart, shiftDate, shiftMonth, timeDistribution, weekStart } from "./schedule";
import type { Task } from "../types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1", title: "测试任务", project: "测试", tags: [], priority: "medium",
    plannedDate: "2026-07-20", timeBlock: "unscheduled", isFocus: false, estimateMinutes: 30,
    repeat: "none", progress: [], subtasks: [], createdAt: "2026-07-20T08:00:00.000Z",
    ...overrides
  };
}

function executedOn(taskDate: string) {
  return { id: `p-${taskDate}`, taskDate, content: "done", completedToday: true, createdAt: `${taskDate}T20:00:00.000Z` };
}

describe("isDueOn", () => {
  it("计划日之前不到期", () => {
    expect(isDueOn(makeTask(), "2026-07-19")).toBe(false);
  });
  it("不重复任务从计划日起每天延续", () => {
    expect(isDueOn(makeTask(), "2026-07-20")).toBe(true);
    expect(isDueOn(makeTask(), "2026-07-25")).toBe(true);
  });
  it("每天重复", () => {
    const task = makeTask({ repeat: "daily" });
    expect(isDueOn(task, "2026-07-21")).toBe(true);
  });
  it("工作日重复跳过周末", () => {
    const task = makeTask({ repeat: "weekdays" });
    expect(isDueOn(task, "2026-07-24")).toBe(true);  // 周五
    expect(isDueOn(task, "2026-07-25")).toBe(false); // 周六
    expect(isDueOn(task, "2026-07-26")).toBe(false); // 周日
    expect(isDueOn(task, "2026-07-27")).toBe(true);  // 周一
  });
  it("每周重复匹配同一星期几", () => {
    const task = makeTask({ repeat: "weekly" }); // 2026-07-20 是周一
    expect(isDueOn(task, "2026-07-27")).toBe(true);
    expect(isDueOn(task, "2026-07-28")).toBe(false);
  });
  it("每月重复匹配同一号数", () => {
    const task = makeTask({ repeat: "monthly" });
    expect(isDueOn(task, "2026-08-20")).toBe(true);
    expect(isDueOn(task, "2026-08-21")).toBe(false);
  });
  it("回收站任务不再到期", () => {
    const task = makeTask({ deletedAt: "2026-07-21T10:00:00.000Z" });
    expect(isDueOn(task, "2026-07-22")).toBe(false);
  });
});

describe("isDueOn · repeatConfig 扩展规则", () => {
  it("每 N 天", () => {
    const task = makeTask({ repeat: "daily", repeatConfig: { interval: 3 } });
    expect(isDueOn(task, "2026-07-20")).toBe(true);
    expect(isDueOn(task, "2026-07-21")).toBe(false);
    expect(isDueOn(task, "2026-07-23")).toBe(true);
  });
  it("每两周（同星期几）", () => {
    const task = makeTask({ repeat: "weekly", repeatConfig: { interval: 2 } }); // 2026-07-20 周一
    expect(isDueOn(task, "2026-07-27")).toBe(false); // 下周一：隔 1 周
    expect(isDueOn(task, "2026-08-03")).toBe(true);  // 隔 2 周
  });
  it("每周指定多天", () => {
    const task = makeTask({ repeat: "weekly", repeatConfig: { weekdays: [2, 4] } });
    expect(isDueOn(task, "2026-07-21")).toBe(true);  // 周二
    expect(isDueOn(task, "2026-07-23")).toBe(true);  // 周四
    expect(isDueOn(task, "2026-07-22")).toBe(false); // 周三
  });
  it("每月最后一天", () => {
    const task = makeTask({ repeat: "monthly", repeatConfig: { monthlyMode: "last-day" }, plannedDate: "2026-07-31" });
    expect(isDueOn(task, "2026-07-31")).toBe(true);
    expect(isDueOn(task, "2026-08-31")).toBe(true);
    expect(isDueOn(task, "2026-08-30")).toBe(false);
    // 二月只有 28 天，月末应落在 2 月 28 日（2027 非闰年）
    expect(isDueOn(task, "2027-02-28")).toBe(true);
  });
  it("每 2 个月", () => {
    const task = makeTask({ repeat: "monthly", repeatConfig: { interval: 2 } });
    expect(isDueOn(task, "2026-08-20")).toBe(false);
    expect(isDueOn(task, "2026-09-20")).toBe(true);
  });
});

describe("timeDistribution", () => {
  const tasks: Task[] = [
    makeTask({ id: "a", project: "写作", tags: ["深度"], estimateMinutes: 60, completedAt: "2026-07-21T10:00:00.000Z" }),
    makeTask({ id: "b", project: "健康", tags: [], estimateMinutes: 30, repeat: "daily", progress: [executedOn("2026-07-21"), executedOn("2026-07-22")] }),
    makeTask({ id: "c", project: "写作", tags: ["深度", "写作"], estimateMinutes: 45, completedAt: "2026-07-22T10:00:00.000Z" })
  ];
  const days = ["2026-07-21", "2026-07-22"];
  it("按项目汇总分钟数并降序", () => {
    expect(timeDistribution(tasks, days, "project")).toEqual([
      { name: "写作", minutes: 105 },
      { name: "健康", minutes: 60 }
    ]);
  });
  it("按标签汇总（无标签归入未分类，多标签重复计入）", () => {
    const byTag = timeDistribution(tasks, days, "tag");
    expect(byTag.find((item) => item.name === "深度")?.minutes).toBe(105);
    expect(byTag.find((item) => item.name === "未分类")?.minutes).toBe(60);
    expect(byTag.find((item) => item.name === "写作")?.minutes).toBe(45);
  });
});

describe("describeRepeat", () => {
  it("描述各种规则", () => {
    expect(describeRepeat(makeTask())).toBe("不重复");
    expect(describeRepeat(makeTask({ repeat: "daily" }))).toBe("每天");
    expect(describeRepeat(makeTask({ repeat: "daily", repeatConfig: { interval: 3 } }))).toBe("每 3 天");
    expect(describeRepeat(makeTask({ repeat: "weekly", repeatConfig: { interval: 2 } }))).toBe("每两周");
    expect(describeRepeat(makeTask({ repeat: "weekly", repeatConfig: { weekdays: [4, 2] } }))).toBe("每周·二、四");
    expect(describeRepeat(makeTask({ repeat: "monthly", repeatConfig: { monthlyMode: "last-day" } }))).toBe("每月最后一天");
  });
});

describe("completedExecutionOn", () => {
  it("只认当日带完成标记的记录", () => {
    const task = makeTask({ progress: [executedOn("2026-07-21"), { id: "p2", taskDate: "2026-07-22", content: "note", completedToday: false, createdAt: "2026-07-22T10:00:00.000Z" }] });
    expect(completedExecutionOn(task, "2026-07-21")).toBe(true);
    expect(completedExecutionOn(task, "2026-07-22")).toBe(false);
    expect(completedExecutionOn(task, "2026-07-23")).toBe(false);
  });
});

describe("日期区间工具", () => {
  it("weekStart 以周一为一周开始", () => {
    expect(weekStart("2026-07-26")).toBe("2026-07-20"); // 周日归属上周一
    expect(weekStart("2026-07-20")).toBe("2026-07-20");
    expect(weekStart("2026-07-22")).toBe("2026-07-20");
  });
  it("monthStart / monthEnd 处理大小月与闰年", () => {
    expect(monthStart("2026-07-15")).toBe("2026-07-01");
    expect(monthEnd("2026-07-15")).toBe("2026-07-31");
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29"); // 闰年
  });
  it("shiftMonth 跨年", () => {
    expect(shiftMonth("2026-01-15", -1)).toBe("2025-12-01");
    expect(shiftMonth("2026-12-15", 1)).toBe("2027-01-01");
  });
  it("shiftDate 与 daysInRange", () => {
    expect(shiftDate("2026-07-31", 1)).toBe("2026-08-01");
    const days = daysInRange("2026-07-30", "2026-08-02");
    expect(days).toEqual(["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"]);
  });
});

describe("每日统计", () => {
  const tasks: Task[] = [
    makeTask({ id: "a", plannedDate: "2026-07-20", completedAt: "2026-07-21T10:00:00.000Z" }),
    makeTask({ id: "b", plannedDate: "2026-07-21" }),
    makeTask({ id: "c", plannedDate: "2026-07-20", repeat: "daily", progress: [executedOn("2026-07-21")] })
  ];
  it("dayExecutions 统计完成原任务与周期执行", () => {
    expect(dayExecutions(tasks, "2026-07-21")).toBe(2);
    expect(dayExecutions(tasks, "2026-07-20")).toBe(0);
  });
  it("dayPlanned 排除更早完成的任务", () => {
    expect(dayPlanned(tasks, "2026-07-21")).toBe(3); // a 当天完成仍计入当天计划
    expect(dayPlanned(tasks, "2026-07-22")).toBe(2); // a 已在前一天完成，不再计入
  });
});

describe("habitStreak / habitStats", () => {
  it("每天的习惯：连续打卡计数", () => {
    const habit = makeTask({ repeat: "daily", progress: [executedOn("2026-07-24"), executedOn("2026-07-25"), executedOn("2026-07-26")] });
    expect(habitStreak(habit, "2026-07-26")).toBe(3);
  });
  it("非到期日不打断连续（每周任务）", () => {
    // 每周一，7-13 与 7-20 都打了卡，7-26（周日）查看
    const habit = makeTask({ repeat: "weekly", plannedDate: "2026-07-13", progress: [executedOn("2026-07-13"), executedOn("2026-07-20")] });
    expect(habitStreak(habit, "2026-07-26")).toBe(2);
  });
  it("今天到期未打卡不打断，从上一个到期日往前数", () => {
    const habit = makeTask({ repeat: "daily", progress: [executedOn("2026-07-24"), executedOn("2026-07-25")] });
    expect(habitStreak(habit, "2026-07-26")).toBe(2);
  });
  it("habitStats 统计到期与完成", () => {
    const habit = makeTask({ repeat: "daily", plannedDate: "2026-07-20", progress: [executedOn("2026-07-20"), executedOn("2026-07-22")] });
    expect(habitStats(habit, ["2026-07-19", "2026-07-20", "2026-07-21", "2026-07-22"])).toEqual({ due: 3, done: 2 });
  });
});

describe("computeStreak", () => {
  it("连续有执行记录的天数", () => {
    const tasks = [makeTask({ repeat: "daily", progress: [executedOn("2026-07-24"), executedOn("2026-07-25"), executedOn("2026-07-26")] })];
    expect(computeStreak(tasks, "2026-07-26")).toBe(3);
  });
  it("今天还没执行时不打断连续，从昨天往前数", () => {
    const tasks = [makeTask({ repeat: "daily", progress: [executedOn("2026-07-24"), executedOn("2026-07-25")] })];
    expect(computeStreak(tasks, "2026-07-26")).toBe(2);
  });
  it("中断后归零重计", () => {
    const tasks = [makeTask({ repeat: "daily", progress: [executedOn("2026-07-20"), executedOn("2026-07-26")] })];
    expect(computeStreak(tasks, "2026-07-26")).toBe(1);
  });
  it("完全没有记录时为 0", () => {
    expect(computeStreak([makeTask()], "2026-07-26")).toBe(0);
  });
});
