export interface InlineSegment {
  type: "text" | "bold" | "italic" | "code" | "link";
  content: string;
  href?: string;
}

const INLINE_PATTERN = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))|(https?:\/\/[^\s<>")]+)/g;

/** 把一行文本解析为内联片段（纯函数，可测试）。 */
export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ type: "text", content: text.slice(lastIndex, index) });
    const token = match[0];
    if (token.startsWith("`")) segments.push({ type: "code", content: token.slice(1, -1) });
    else if (token.startsWith("**")) segments.push({ type: "bold", content: token.slice(2, -2) });
    else if (token.startsWith("[")) {
      const closing = token.indexOf("](");
      segments.push({ type: "link", content: token.slice(1, closing), href: token.slice(closing + 2, -1) });
    } else if (token.startsWith("*")) segments.push({ type: "italic", content: token.slice(1, -1) });
    else segments.push({ type: "link", content: token, href: token });
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length) segments.push({ type: "text", content: text.slice(lastIndex) });
  return segments;
}

export interface MarkdownBlock {
  type: "paragraph" | "list";
  lines: string[];
}

/** 把多行文本切分为段落与列表块（纯函数，可测试）。 */
export function splitBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    const isListItem = /^[-*]\s+/.test(line.trim());
    const previous = blocks[blocks.length - 1];
    if (isListItem) {
      const content = line.trim().replace(/^[-*]\s+/, "");
      if (previous?.type === "list") previous.lines.push(content);
      else blocks.push({ type: "list", lines: [content] });
    } else {
      blocks.push({ type: "paragraph", lines: [line.trim()] });
    }
  }
  return blocks;
}
