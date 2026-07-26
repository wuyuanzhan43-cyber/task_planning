import { shiftDate, weekStart } from "./schedule";
import type { Priority, RepeatConfig, RepeatRule, TimeBlock } from "../types";

export interface QuickAddResult {
  title: string;
  plannedDate?: string;
  timeBlock?: TimeBlock;
  estimateMinutes?: number;
  tags: string[];
  priority?: Priority;
  dueAt?: string;
  repeat?: RepeatRule;
  repeatConfig?: RepeatConfig;
}

const WEEKDAY_MAP: Record<string, number> = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0 };

function nextWeekday(baseDate: string, weekday: number, nextWeek: boolean): string {
  if (nextWeek) {
    const monday = shiftDate(weekStart(baseDate), 7);
    return shiftDate(monday, weekday === 0 ? 6 : weekday - 1);
  }
  const baseDay = new Date(`${baseDate}T12:00:00`).getDay();
  return shiftDate(baseDate, (weekday - baseDay + 7) % 7);
}

function resolveMonthDay(baseDate: string, month: number, day: number): string {
  const year = Number(baseDate.slice(0, 4));
  const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (candidate >= baseDate) return candidate;
  return `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function resolveDay(baseDate: string, day: number): string {
  const year = Number(baseDate.slice(0, 4));
  const month = Number(baseDate.slice(5, 7));
  const candidate = `${baseDate.slice(0, 8)}${String(day).padStart(2, "0")}`;
  if (candidate >= baseDate) return candidate;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 解析自然语言快速添加输入，例如：「明天下午 跑步 30分钟 #健康 !重要 每周二」 */
export function parseQuickAdd(input: string, baseDate: string): QuickAddResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const result: QuickAddResult = { title: "", tags: [] };
  const titleParts: string[] = [];

  for (const token of trimmed.split(/\s+/)) {
    let match: RegExpMatchArray | null;
    if (token.startsWith("#") && token.length > 1) { result.tags.push(token.slice(1)); continue; }
    if (/^[!！](重要|高)$/.test(token)) { result.priority = "high"; continue; }
    if (/^[!！](正常|中)$/.test(token)) { result.priority = "medium"; continue; }
    if (/^[!！](轻缓|低)$/.test(token)) { result.priority = "low"; continue; }
    if (token === "今天") { result.plannedDate = baseDate; continue; }
    if (token === "明天") { result.plannedDate = shiftDate(baseDate, 1); continue; }
    if (token === "后天") { result.plannedDate = shiftDate(baseDate, 2); continue; }
    if (token === "大后天") { result.plannedDate = shiftDate(baseDate, 3); continue; }
    if ((match = token.match(/^(\d{4})-(\d{2})-(\d{2})$/))) { result.plannedDate = token; continue; }
    if ((match = token.match(/^(\d{1,2})月(\d{1,2})[日号]$/))) { result.plannedDate = resolveMonthDay(baseDate, Number(match[1]), Number(match[2])); continue; }
    if ((match = token.match(/^(\d{1,2})[日号]$/))) { result.plannedDate = resolveDay(baseDate, Number(match[1])); continue; }
    if ((match = token.match(/^(下?)(?:周|星期)([一二三四五六日天])$/))) { result.plannedDate = nextWeekday(baseDate, WEEKDAY_MAP[match[2]], match[1] === "下"); continue; }
    if (token === "上午" || token === "早上") { result.timeBlock = "morning"; continue; }
    if (token === "下午" || token === "中午") { result.timeBlock = "afternoon"; continue; }
    if (token === "晚上" || token === "傍晚") { result.timeBlock = "evening"; continue; }
    if ((match = token.match(/^(\d+(?:\.\d+)?)(?:小时|h|H)$/))) { result.estimateMinutes = Math.round(Number(match[1]) * 60); continue; }
    if ((match = token.match(/^(\d+)(?:分钟|分|min)$/))) { result.estimateMinutes = Number(match[1]); continue; }
    if ((match = token.match(/^([01]?\d|2[0-3])[:：]([0-5]\d)$/))) { result.dueAt = `${match[1].padStart(2, "0")}:${match[2]}`; continue; }
    if (token === "每天") { result.repeat = "daily"; continue; }
    if (token === "工作日" || token === "每个工作日") { result.repeat = "weekdays"; continue; }
    if (token === "每周") { result.repeat = "weekly"; continue; }
    if (token === "每两周" || token === "隔周") { result.repeat = "weekly"; result.repeatConfig = { ...result.repeatConfig, interval: 2 }; continue; }
    if (token === "每月") { result.repeat = "monthly"; continue; }
    if (token === "月末" || token === "每月最后一天") { result.repeat = "monthly"; result.repeatConfig = { ...result.repeatConfig, monthlyMode: "last-day" }; continue; }
    if ((match = token.match(/^每(\d+)天$/))) { result.repeat = "daily"; result.repeatConfig = { ...result.repeatConfig, interval: Number(match[1]) }; continue; }
    if ((match = token.match(/^每(\d+)周$/))) { result.repeat = "weekly"; result.repeatConfig = { ...result.repeatConfig, interval: Number(match[1]) }; continue; }
    if ((match = token.match(/^每(\d+)(?:个)?月$/))) { result.repeat = "monthly"; result.repeatConfig = { ...result.repeatConfig, interval: Number(match[1]) }; continue; }
    if ((match = token.match(/^每周([一二三四五六日天](?:[、,，][一二三四五六日天])*)$/))) {
      const days = [...new Set(match[1].split(/[、,，]/).map((ch) => WEEKDAY_MAP[ch]).filter((day): day is number => day !== undefined))];
      result.repeat = "weekly";
      result.repeatConfig = { ...result.repeatConfig, weekdays: days };
      continue;
    }
    titleParts.push(token);
  }

  result.title = titleParts.join(" ").trim();
  return result;
}
