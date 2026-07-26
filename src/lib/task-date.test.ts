import { describe, expect, it } from "vitest";
import { dateDiff, getTaskDate, toDateKey } from "./task-date";

describe("toDateKey", () => {
  it("格式化为 YYYY-MM-DD 并补零", () => {
    expect(toDateKey(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
    expect(toDateKey(new Date(2026, 11, 31, 12))).toBe("2026-12-31");
  });
});

describe("getTaskDate（凌晨 4:00 结算）", () => {
  it("凌晨 4 点前属于前一个任务日", () => {
    expect(getTaskDate(new Date(2026, 6, 26, 3, 59))).toBe("2026-07-25");
    expect(getTaskDate(new Date(2026, 6, 26, 0, 0))).toBe("2026-07-25");
  });
  it("凌晨 4 点及之后属于当天", () => {
    expect(getTaskDate(new Date(2026, 6, 26, 4, 0))).toBe("2026-07-26");
    expect(getTaskDate(new Date(2026, 6, 26, 23, 59))).toBe("2026-07-26");
  });
  it("月初凌晨回退能跨月", () => {
    expect(getTaskDate(new Date(2026, 7, 1, 2, 0))).toBe("2026-07-31");
  });
});

describe("dateDiff", () => {
  it("计算跨天数", () => {
    expect(dateDiff("2026-07-20", "2026-07-26")).toBe(6);
    expect(dateDiff("2026-07-26", "2026-07-20")).toBe(-6);
    expect(dateDiff("2026-07-26", "2026-07-26")).toBe(0);
  });
  it("跨月与跨年", () => {
    expect(dateDiff("2026-01-31", "2026-02-01")).toBe(1);
    expect(dateDiff("2025-12-31", "2026-01-01")).toBe(1);
  });
});
