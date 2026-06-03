import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createGzip } from 'zlib';
import { Readable } from 'stream';
import { IDumpProvider } from './interfaces/dump-provider.interface';

const execAsync = promisify(exec);

@Injectable()
export class DatabaseDumpService implements IDumpProvider {
  private readonly logger = new Logger(DatabaseDumpService.name);

  constructor(private readonly config: ConfigService) {}

  async createDump(): Promise<Buffer> {
    const { host, port, user, password, database } = this.parseConnectionString();

    this.logger.log('Iniciando pg_dump...');

    const env = { ...process.env, PGPASSWORD: password };
    const cmd = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} --no-password`;

    const { stdout } = await execAsync(cmd, { env, maxBuffer: 500 * 1024 * 1024 });

    const compressed = await this.gzip(Buffer.from(stdout, 'utf8'));
    this.logger.log(`pg_dump completado — ${(compressed.length / 1024 / 1024).toFixed(2)} MB`);

    return compressed;
  }

  private parseConnectionString(): { host: string; port: string; user: string; password: string; database: string } {
    const url = this.config.getOrThrow<string>('DATABASE_URL');
    const parsed = new URL(url);
    return {
      host:     parsed.hostname,
      port:     parsed.port || '5432',
      user:     parsed.username,
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace('/', '').split('?')[0],
    };
  }

  private gzip(input: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const gz = createGzip();
      const stream = Readable.from(input);
      stream.pipe(gz);
      gz.on('data', chunk => chunks.push(chunk));
      gz.on('end', () => resolve(Buffer.concat(chunks)));
      gz.on('error', reject);
    });
  }
}
