import { parseInline, splitBlocks, type InlineSegment } from "./markdown-parse";

function InlineRun({ segments, onOpenLink }: { segments: InlineSegment[]; onOpenLink: (url: string) => void }) {
  return <>{segments.map((segment, index) => {
    if (segment.type === "bold") return <strong key={index}>{segment.content}</strong>;
    if (segment.type === "italic") return <em key={index}>{segment.content}</em>;
    if (segment.type === "code") return <code key={index}>{segment.content}</code>;
    if (segment.type === "link") return <a key={index} href={segment.href} onClick={(event) => { event.preventDefault(); if (segment.href) onOpenLink(segment.href); }}>{segment.content}</a>;
    return <span key={index}>{segment.content}</span>;
  })}</>;
}

export function Markdown({ text, onOpenLink }: { text: string; onOpenLink: (url: string) => void }) {
  const blocks = splitBlocks(text);
  return <div className="markdown-body">{blocks.map((block, index) => block.type === "list"
    ? <ul key={index}>{block.lines.map((line, lineIndex) => <li key={lineIndex}><InlineRun segments={parseInline(line)} onOpenLink={onOpenLink} /></li>)}</ul>
    : <p key={index}><InlineRun segments={parseInline(block.lines[0])} onOpenLink={onOpenLink} /></p>
  )}</div>;
}
