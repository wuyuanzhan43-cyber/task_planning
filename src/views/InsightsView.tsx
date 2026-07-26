import { useEffect, useMemo, useState } from "react";
import { CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileDown, LayoutGrid, TrendingUp } from "lucide-react";
import { formatTaskDate, getTaskDate } from "../lib/task-date";
import { completedExecutionOn, computeStreak, dayExecutions, dayPlanned, daysInRange, monthEnd, monthStart, shiftDate, shiftMonth, timeDistribution, weekStart } from "../lib/schedule";
import { buildReport } from "../lib/report";
import { loadDailyReviews } from "../lib/storage";
import type { DailyReview, Task } from "../types";

export function InsightsView({ tasks, selectedDate, onOpenDate }: { tasks: Task[]; selectedDate: string; onOpenDate: (date: string) => void }) {
  const [range, setRange] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(selectedDate);
  const start = range === "week" ? weekStart(anchor) : monthStart(anchor);
  const end = range === "week" ? shiftDate(start, 6) : monthEnd(anchor);
  const days = useMemo(() => daysInRange(start, end), [start, end]);
  const [reviews, setReviews] = useState<DailyReview[]>([]);
  const [distMode, setDistMode] = useState<"project" | "tag">("project");
  useEffect(() => { void loadDailyReviews(start, end).then(setReviews); }, [start, end]);

  const totals = days.map((date) => ({
    date,
    planned: dayPlanned(tasks, date),
    executions: dayExecutions(tasks, date),
    focusMinutes: tasks.filter((task) => completedExecutionOn(task, date) || task.completedAt?.slice(0, 10) === date).reduce((sum, task) => sum + task.estimateMinutes, 0)
  }));
  const plannedTotal = totals.reduce((sum, item) => sum + item.planned, 0);
  const completedTotal = totals.reduce((sum, item) => sum + item.executions, 0);
  const focusTotal = totals.reduce((sum, item) => sum + item.focusMinutes, 0);
  const completionRate = plannedTotal ? Math.min(100, Math.round(completedTotal / plannedTotal * 100)) : 0;
  const maxExecutions = Math.max(1, ...totals.map((item) => item.executions));

  const previousStart = range === "week" ? shiftDate(start, -7) : monthStart(shiftMonth(anchor, -1));
  const previousDays = daysInRange(previousStart, shiftDate(start, -1));
  const previousPlanned = previousDays.reduce((sum, date) => sum + dayPlanned(tasks, date), 0);
  const previousCompleted = previousDays.reduce((sum, date) => sum + dayExecutions(tasks, date), 0);
  const previousRate = previousPlanned ? Math.min(100, Math.round(previousCompleted / previousPlanned * 100)) : null;
  const rateDelta = previousRate === null ? null : completionRate - previousRate;

  const streak = computeStreak(tasks);
  const today = getTaskDate();
  const todayExecuted = dayExecutions(tasks, today) > 0;
  const heatmapStart = weekStart(shiftDate(today, -77));
  const heatmap = Array.from({ length: 84 }, (_, index) => {
    const date = shiftDate(heatmapStart, index);
    const future = date > today;
    return { date, future, executions: future ? 0 : dayExecutions(tasks, date) };
  });
  const maxHeat = Math.max(1, ...heatmap.map((item) => item.executions));

  const distribution = timeDistribution(tasks, days, distMode);
  const distTotal = distribution.reduce((sum, item) => sum + item.minutes, 0);
  const distTop = distribution.slice(0, 8);
  const period = range === "week" ? "周" : "月";
  const rangeLabel = range === "week" ? `${formatTaskDate(start)} 至 ${formatTaskDate(end)}` : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date(`${start}T12:00:00`));
  function moveAnchor(amount: number) {
    setAnchor(range === "week" ? shiftDate(anchor, amount * 7) : shiftMonth(anchor, amount));
  }

  function exportReport() {
    const markdown = buildReport({ periodName: period, rangeLabel, days, tasks, reviews });
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchorElement = document.createElement("a");
    anchorElement.href = url;
    anchorElement.download = `dayflow-${period}报-${start}.md`;
    anchorElement.click();
    URL.revokeObjectURL(url);
  }

  return <section className="workspace-page insights-workspace"><div className="calendar-toolbar"><div><p className="eyebrow">{rangeLabel}</p><h1>复盘与统计</h1></div><div className="calendar-controls"><div className="segmented-control">{(["week", "month"] as const).map((item) => <button key={item} className={range === item ? "selected" : ""} onClick={() => setRange(item)}>{item === "week" ? "周" : "月"}</button>)}</div><button className="icon-button" title={`上一${period}`} onClick={() => moveAnchor(-1)}><ChevronLeft size={18} /></button><button className="calendar-today" onClick={() => setAnchor(getTaskDate())}>本{period}</button><button className="icon-button" title={`下一${period}`} onClick={() => moveAnchor(1)}><ChevronRight size={18} /></button><button className="calendar-today report-export" title={`导出${period}报（Markdown）`} onClick={exportReport}><FileDown size={15} />导出{period}报</button></div></div><div className="insight-cards"><div><span><CheckCircle2 size={17} />完成率</span><strong>{completionRate}%</strong><small className={rateDelta === null ? "" : rateDelta >= 0 ? "delta-up" : "delta-down"}>{completedTotal} / {plannedTotal || 0} 次计划执行{rateDelta === null ? `，上一${period}暂无数据` : `，较上一${period} ${rateDelta >= 0 ? "+" : ""}${rateDelta}%`}</small></div><div><span><Clock3 size={17} />专注时长</span><strong>{Math.round(focusTotal / 60 * 10) / 10}h</strong><small>按已完成任务的预计时长计算</small></div><div><span><TrendingUp size={17} />连续执行</span><strong>{streak} 天</strong><small>{todayExecuted ? "今天已留下执行记录" : "今天还没有执行记录"}</small></div></div><section className="trend-panel"><div className="panel-heading"><div><h2>{range === "week" ? "本周" : "本月"}完成趋势</h2><p>任务日以凌晨 4:00 结算。</p></div><LayoutGrid size={18} /></div><div className={`trend-bars ${range === "month" ? "dense" : ""}`} style={{ gridTemplateColumns: `repeat(${totals.length}, 1fr)` }}>{totals.map((item, index) => <button className="trend-column" key={item.date} title={`查看 ${formatTaskDate(item.date)}`} onClick={() => onOpenDate(item.date)}><div className="bar-area"><i style={{ height: `${Math.max(8, item.executions / maxExecutions * 100)}%` }} /></div><strong>{item.executions}</strong><span>{range === "week" ? `${new Date(`${item.date}T12:00:00`).getDate()} 日` : index % 5 === 0 ? `${new Date(`${item.date}T12:00:00`).getDate()}` : ""}</span></button>)}</div></section><section className="dist-panel"><div className="panel-heading"><div><h2>时间去向</h2><p>按{distMode === "project" ? "项目" : "标签"}汇总这段时间的完成投入。</p></div><div className="segmented-control">{(["project", "tag"] as const).map((item) => <button key={item} className={distMode === item ? "selected" : ""} onClick={() => setDistMode(item)}>{item === "project" ? "项目" : "标签"}</button>)}</div></div>{distTop.length ? <div className="dist-list">{distTop.map((item) => <div className="dist-row" key={item.name}><span className="dist-name">{item.name}</span><div className="dist-bar"><i style={{ width: `${Math.max(3, Math.round(item.minutes / (distTop[0].minutes || 1) * 100))}%` }} /></div><span className="dist-value">{Math.round(item.minutes / 60 * 10) / 10}h · {distTotal ? Math.round(item.minutes / distTotal * 100) : 0}%</span></div>)}</div> : <p className="dist-empty">这段时间还没有完成记录。</p>}</section><section className="heatmap-panel"><div className="panel-heading"><div><h2>近 12 周执行热力图</h2><p>颜色越深，代表当天完成的执行越多。</p></div><TrendingUp size={18} /></div><div className="heatmap-grid">{heatmap.map((item) => <button key={item.date} disabled={item.future} className={`heat-cell ${item.future ? "future" : `level-${item.executions === 0 ? 0 : Math.max(1, Math.ceil(item.executions / maxHeat * 4))}`}`} title={`${formatTaskDate(item.date)} · ${item.executions} 次执行，点击查看当天`} onClick={() => onOpenDate(item.date)} />)}</div><div className="heatmap-legend"><span>少</span><i className="heat-cell level-0" /><i className="heat-cell level-1" /><i className="heat-cell level-2" /><i className="heat-cell level-3" /><i className="heat-cell level-4" /><span>多</span></div></section><section className="weekly-review"><div className="panel-heading"><div><h2>{period}内复盘摘录</h2><p>来自每日复盘中的真实记录。</p></div><CalendarRange size={18} /></div>{reviews.length ? <div className="review-list">{reviews.map((review) => <article key={review.taskDate}><span>{formatTaskDate(review.taskDate)}</span><p>{review.reflection || "这一天没有写下总结。"}</p>{review.tomorrowFocus && <small>明日重点：{review.tomorrowFocus}</small>}</article>)}</div> : <div className="empty-workspace">这段时间还没有复盘记录，今天结束前写下一句也很好。</div>}</section></section>;
}
