import { Injectable, Logger } from '@nestjs/common';
import { R2Service } from '../r2/r2.service';
import { IBackupStorage } from './interfaces/backup-storage.interface';

const BACKUP_PREFIX = 'backups/';

@Injectable()
export class BackupStorageService implements IBackupStorage {
  private readonly logger = new Logger(BackupStorageService.name);

  constructor(private readonly r2: R2Service) {}

  async upload(buffer: Buffer, filename: string): Promise<string> {
    const key = `${BACKUP_PREFIX}${filename}`;
    await this.r2.uploadFile(key, buffer, 'application/gzip');
    this.logger.log(`Backup subido a R2: ${key}`);
    return key;
  }

  async deleteOldBackups(retentionDays: number): Promise<number> {
    const files = await this.r2.listFiles(BACKUP_PREFIX);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const toDelete = files.filter(f => f.lastModified < cutoff);

    for (const file of toDelete) {
      await this.r2.deleteFile(file.key);
    }

    if (toDelete.length > 0) {
      this.logger.log(`Backups eliminados (>${retentionDays} días): ${toDelete.length}`);
    }

    return toDelete.length;
  }
}
