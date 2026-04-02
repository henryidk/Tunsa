import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// Días de retención para audit_logs — registros más antiguos se eliminan
const AUDIT_LOG_RETENTION_DAYS = 90;

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Ejecuta todos los días a las 3:00 AM — hora de bajo tráfico
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDailyCleanup(): Promise<void> {
    this.logger.log('Iniciando limpieza diaria de DB...');
    await this.cleanExpiredRefreshTokens();
    await this.cleanOldAuditLogs();
    this.logger.log('Limpieza diaria completada.');
  }

  /**
   * Elimina refresh tokens cuya fecha de expiración ya pasó.
   * Tanto revocados como no revocados — si expiraron, nunca podrán usarse.
   * Usa el índice @@index([revoked, expiresAt]) del schema.
   */
  private async cleanExpiredRefreshTokens(): Promise<void> {
    try {
      const { count } = await this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      this.logger.log(`refresh_tokens eliminados: ${count}`);
    } catch (err: any) {
      this.logger.error(`Error limpiando refresh_tokens: ${err.message}`);
    }
  }

  /**
   * Elimina audit logs más antiguos que AUDIT_LOG_RETENTION_DAYS días.
   * Usa el índice @@index([action, createdAt]) del schema.
   */
  private async cleanOldAuditLogs(): Promise<void> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - AUDIT_LOG_RETENTION_DAYS);

      const { count } = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      this.logger.log(`audit_logs eliminados (> ${AUDIT_LOG_RETENTION_DAYS} días): ${count}`);
    } catch (err: any) {
      this.logger.error(`Error limpiando audit_logs: ${err.message}`);
    }
  }
}
