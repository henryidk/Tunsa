import { Module } from '@nestjs/common';
import { DatabaseDumpService } from './database-dump.service';
import { BackupStorageService } from './backup-storage.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { DUMP_PROVIDER } from './interfaces/dump-provider.interface';
import { BACKUP_STORAGE } from './interfaces/backup-storage.interface';

@Module({
  providers: [
    DatabaseDumpService,
    BackupStorageService,
    BackupSchedulerService,
    { provide: DUMP_PROVIDER,   useExisting: DatabaseDumpService },
    { provide: BACKUP_STORAGE,  useExisting: BackupStorageService },
  ],
})
export class BackupModule {}
