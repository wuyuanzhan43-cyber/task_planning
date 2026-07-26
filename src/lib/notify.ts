import { usesSqlite } from "./storage";

let permissionGranted: boolean | null = null;

/** 发送系统通知（仅桌面模式；浏览器预览模式下静默跳过）。 */
export async function notify(title: string, body: string): Promise<void> {
  if (!usesSqlite()) return;
  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import("@tauri-apps/plugin-notification");
    if (permissionGranted === null) {
      permissionGranted = await isPermissionGranted();
      if (!permissionGranted) permissionGranted = (await requestPermission()) === "granted";
    }
    if (permissionGranted) sendNotification({ title, body });
  } catch { /* 通知失败不影响主流程 */ }
}
