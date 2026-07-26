const ORDER_KEY = "dayflow.day-order.v1";

/** 把 activeId 移动到 overId 之前，返回新的 id 顺序。 */
export function reorderIds(ids: string[], activeId: string, overId: string): string[] {
  if (activeId === overId) return ids;
  const withoutActive = ids.filter((id) => id !== activeId);
  const overIndex = withoutActive.indexOf(overId);
  if (overIndex === -1 || !ids.includes(activeId)) return ids;
  return [...withoutActive.slice(0, overIndex), activeId, ...withoutActive.slice(overIndex)];
}

/** 按保存的顺序排列任务；未记录的任务保持原有相对顺序排在最后。 */
export function applyDayOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return items;
  const position = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

export function readDayOrder(date: string): string[] {
  try {
    const orders = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "{}") as Record<string, string[]>;
    return Array.isArray(orders[date]) ? orders[date] : [];
  } catch {
    return [];
  }
}

export function writeDayOrder(date: string, ids: string[]): void {
  try {
    const orders = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "{}") as Record<string, string[]>;
    const entries = Object.entries({ ...orders, [date]: ids });
    // 只保留最近 60 天的排序记录，避免无限增长
    localStorage.setItem(ORDER_KEY, JSON.stringify(Object.fromEntries(entries.sort((a, b) => b[0].localeCompare(a[0])).slice(0, 60))));
  } catch { /* 排序保存失败不影响主流程 */ }
}
