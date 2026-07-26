import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { DailyReview } from "../types";

export function DailyReviewSection({ review, onSave }: { review: DailyReview; onSave: (reflection: string, tomorrowFocus: string) => void }) {
  const [reflection, setReflection] = useState(review.reflection);
  const [tomorrowFocus, setTomorrowFocus] = useState(review.tomorrowFocus);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setReflection(review.reflection);
    setTomorrowFocus(review.tomorrowFocus);
    setDirty(false);
  }, [review.taskDate, review.updatedAt, review.reflection, review.tomorrowFocus]);
  const saved = !dirty && Boolean(review.updatedAt);
  return <section className="daily-review"><div className="review-heading"><div><p className="eyebrow">一天的收尾</p><h2>每日复盘</h2><span>留下一点感受，让明天更从容。</span></div><button className="review-save" onClick={() => { onSave(reflection, tomorrowFocus); setDirty(false); }}>{saved ? <Check size={15} /> : null}{saved ? "已保存" : "保存复盘"}</button></div><div className="review-fields"><label><span>今天有哪些进展或困难？</span><textarea value={reflection} onChange={(event) => { setReflection(event.target.value); setDirty(true); }} placeholder="例如：上午专注度很好，下午被临时事项打断。" /></label><label><span>明天最想优先完成什么？</span><textarea value={tomorrowFocus} onChange={(event) => { setTomorrowFocus(event.target.value); setDirty(true); }} placeholder="给明天留下一件最重要的小事。" /></label></div></section>;
}
