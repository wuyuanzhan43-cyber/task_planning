import type { Task } from "../types";

const AUTO_BACKUP_KEY = "dayflow.auto-backups.v1";

export interface AutoBackup {
  createdAt: string;
  tasks: Task[];
}

export function readAutoBackups(): AutoBackup[] {
  try {
    const backups = JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY) ?? "[]") as AutoBackup[];
    return Array.isArray(backups) ? backups.filter((backup) => backup && Array.isArray(backup.tasks)) : [];
  } catch {
    return [];
  }
}

export function writeAutoBackup(tasks: Task[]): void {
  try {
    const backups = readAutoBackups();
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify([{ createdAt: new Date().toISOString(), tasks }, ...backups].slice(0, 5)));
  } catch { /* Backup is best effort and must not interrupt task saving. */ }
}
