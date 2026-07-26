import { usesSqlite } from "./storage";

/** 用系统浏览器打开外部链接（桌面模式走 opener 插件，浏览器模式新开标签页）。 */
export async function openLink(url: string): Promise<void> {
  if (!/^https?:\/\//.test(url)) return;
  if (usesSqlite()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch { /* 插件不可用时回退到 window.open */ }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
