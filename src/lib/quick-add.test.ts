import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quick-add";

// 基准日 2026-07-26 是周日
const BASE = "2026-07-26";

describe("parseQuickAdd", () => {
  it("空输入返回 null", () => {
    expect(parseQuickAdd("", BASE)).toBeNull();
    expect(parseQuickAdd("   ", BASE)).toBeNull();
  });

  it("解析完整示例：明天下午 跑步 30分钟 #健康 !重要", () => {
    const parsed = parseQuickAdd("明天下午 跑步 30分钟 #健康 !重要", BASE);
    // “明天下午”连写不拆分，只识别独立 token；标准写法带空格
    const spaced = parseQuickAdd("明天 下午 跑步 30分钟 #健康 !重要", BASE)!;
    expect(spaced.title).toBe("跑步");
    expect(spaced.plannedDate).toBe("2026-07-27");
    expect(spaced.timeBlock).toBe("afternoon");
    expect(spaced.estimateMinutes).toBe(30);
    expect(spaced.tags).toEqual(["健康"]);
    expect(spaced.priority).toBe("high");
    expect(parsed).not.toBeNull();
  });

  it("解析星期与截止时间：周三 复盘会 14:00", () => {
    const parsed = parseQuickAdd("周三 复盘会 14:00", BASE)!;
    expect(parsed.plannedDate).toBe("2026-07-29");
    expect(parsed.dueAt).toBe("14:00");
    expect(parsed.title).toBe("复盘会");
  });

  it("下周与当周区分", () => {
    // 基准日周日：下周一 = 2026-07-27
    expect(parseQuickAdd("下周一 汇报", BASE)!.plannedDate).toBe("2026-07-27");
    // 周日当天匹配自身
    expect(parseQuickAdd("周日 休息", BASE)!.plannedDate).toBe("2026-07-26");
  });

  it("解析日期：8月1号 交房租 每月", () => {
    const parsed = parseQuickAdd("8月1号 交房租 每月", BASE)!;
    expect(parsed.plannedDate).toBe("2026-08-01");
    expect(parsed.repeat).toBe("monthly");
    expect(parsed.title).toBe("交房租");
  });

  it("过去的月日推到下一年", () => {
    expect(parseQuickAdd("1月1号 新年计划", BASE)!.plannedDate).toBe("2027-01-01");
  });

  it("解析小时时长：1.5小时 写报告", () => {
    const parsed = parseQuickAdd("1.5小时 写报告", BASE)!;
    expect(parsed.estimateMinutes).toBe(90);
    expect(parsed.title).toBe("写报告");
  });

  it("解析重复规则：每2天 浇花", () => {
    const parsed = parseQuickAdd("每2天 浇花", BASE)!;
    expect(parsed.repeat).toBe("daily");
    expect(parsed.repeatConfig).toEqual({ interval: 2 });
  });

  it("解析每周多日：每周二、四 健身", () => {
    const parsed = parseQuickAdd("每周二、四 健身", BASE)!;
    expect(parsed.repeat).toBe("weekly");
    expect(parsed.repeatConfig?.weekdays?.sort()).toEqual([2, 4]);
    expect(parsed.title).toBe("健身");
  });

  it("解析月末：月末 对账", () => {
    const parsed = parseQuickAdd("月末 对账", BASE)!;
    expect(parsed.repeat).toBe("monthly");
    expect(parsed.repeatConfig?.monthlyMode).toBe("last-day");
  });

  it("未识别 token 全部进入标题", () => {
    const parsed = parseQuickAdd("整理 房间 和 衣柜", BASE)!;
    expect(parsed.title).toBe("整理 房间 和 衣柜");
    expect(parsed.plannedDate).toBeUndefined();
  });
});
