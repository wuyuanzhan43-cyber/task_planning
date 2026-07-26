import { Component, type ReactNode } from "react";
import { loadAllDailyReviews, loadTasks } from "../lib/storage";
import { getTaskDate } from "../lib/task-date";

interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { error: Error | null }

async function exportRescueBackup(): Promise<void> {
  try {
    const [tasks, dailyReviews] = await Promise.all([loadTasks(), loadAllDailyReviews()]);
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks, dailyReviews }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dayflow-rescue-${getTaskDate()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch {
    window.alert("读取数据失败，无法导出备份。你的数据仍保存在本地数据库中。");
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <div className="crash-page"><div className="crash-card"><h1>页面遇到了一点问题</h1><p>别担心，你的任务数据都安全地保存在本地。可以先导出一份备份，然后重新载入应用。</p><pre>{String(this.state.error?.message ?? this.state.error)}</pre><div className="crash-actions"><button className="primary-button" onClick={() => window.location.reload()}>重新载入</button><button className="text-button" onClick={() => void exportRescueBackup()}>导出数据备份</button></div></div></div>;
    }
    return this.props.children;
  }
}
