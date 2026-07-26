import { describe, expect, it } from "vitest";
import { applyDayOrder, reorderIds } from "./day-order";

describe("reorderIds", () => {
  it("把元素移动到目标之前", () => {
    expect(reorderIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(reorderIds(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
  });
  it("无效输入保持不变", () => {
    expect(reorderIds(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(reorderIds(["a", "b"], "x", "a")).toEqual(["a", "b"]);
    expect(reorderIds(["a", "b"], "a", "x")).toEqual(["a", "b"]);
  });
});

describe("applyDayOrder", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("按保存顺序排列", () => {
    expect(applyDayOrder(items, ["c", "a", "b"]).map((item) => item.id)).toEqual(["c", "a", "b"]);
  });
  it("未记录的元素保持原有相对顺序排在最后", () => {
    expect(applyDayOrder(items, ["c"]).map((item) => item.id)).toEqual(["c", "a", "b"]);
  });
  it("空顺序返回原数组", () => {
    expect(applyDayOrder(items, []).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
  it("忽略已不存在的 id", () => {
    expect(applyDayOrder(items, ["x", "b", "y", "a"]).map((item) => item.id)).toEqual(["b", "a", "c"]);
  });
});
