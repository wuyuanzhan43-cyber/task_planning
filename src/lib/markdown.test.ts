import { describe, expect, it } from "vitest";
import { parseInline, splitBlocks } from "./markdown-parse";

describe("parseInline", () => {
  it("解析加粗、斜体与行内代码", () => {
    expect(parseInline("这是 **重点** 和 *强调* 与 `代码`")).toEqual([
      { type: "text", content: "这是 " },
      { type: "bold", content: "重点" },
      { type: "text", content: " 和 " },
      { type: "italic", content: "强调" },
      { type: "text", content: " 与 " },
      { type: "code", content: "代码" }
    ]);
  });
  it("解析 Markdown 链接与裸链接", () => {
    expect(parseInline("见 [文档](https://example.com/a) 或 https://example.com/b")).toEqual([
      { type: "text", content: "见 " },
      { type: "link", content: "文档", href: "https://example.com/a" },
      { type: "text", content: " 或 " },
      { type: "link", content: "https://example.com/b", href: "https://example.com/b" }
    ]);
  });
  it("纯文本原样返回", () => {
    expect(parseInline("没有任何标记")).toEqual([{ type: "text", content: "没有任何标记" }]);
  });
});

describe("splitBlocks", () => {
  it("区分段落与列表并合并连续列表项", () => {
    expect(splitBlocks("第一段\n- 事项一\n- 事项二\n\n第二段")).toEqual([
      { type: "paragraph", lines: ["第一段"] },
      { type: "list", lines: ["事项一", "事项二"] },
      { type: "paragraph", lines: ["第二段"] }
    ]);
  });
  it("跳过空行", () => {
    expect(splitBlocks("\n\n只有一行\n\n")).toEqual([{ type: "paragraph", lines: ["只有一行"] }]);
  });
});
