export const BACKUP_STORAGE = 'BACKUP_STORAGE';

export interface IBackupStorage {
  upload(buffer: Buffer, filename: string): Promise<string>;
  deleteOldBackups(retentionDays: number): Promise<number>;
}
