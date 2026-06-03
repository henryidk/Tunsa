import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { IDumpProvider } from './interfaces/dump-provider.interface';
import { DUMP_PROVIDER } from './interfaces/dump-provider.interface';
import type { IBackupStorage } from './interfaces/backup-storage.interface';
import { BACKUP_STORAGE } from './interfaces/backup-storage.interface';

const RETENTION_DAYS = 30;

@Injectable()
export class BackupSchedulerService {
  private readonly logger = new Logger(BackupSchedulerService.name);

  constructor(
    @Inject(DUMP_PROVIDER) private readonly dumpProvider: IDumpProvider,
    @Inject(BACKUP_STORAGE) private readonly storage: IBackupStorage,
  ) {}

  // Cada día a las 2:00 AM hora Guatemala (UTC-6)
  @Cron('0 2 * * *', { timeZone: 'America/Guatemala' })
  async runDailyBackup(): Promise<void> {
    this.logger.log('Iniciando backup diario...');

    try {
      const buffer = await this.dumpProvider.createDump();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `backup_${timestamp}.sql.gz`;

      await this.storage.upload(buffer, filename);
      const deleted = await this.storage.deleteOldBackups(RETENTION_DAYS);

      this.logger.log(`Backup completado — ${(buffer.length / 1024 / 1024).toFixed(2)} MB subidos, ${deleted} archivos eliminados`);
    } catch (err: any) {
      this.logger.error(`Error en backup diario: ${err.message}`);
    }
  }
}
