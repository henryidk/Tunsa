import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service implements OnModuleInit {
  private client: S3Client;
  private bucket: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const accountId       = this.config.getOrThrow<string>('R2_ACCOUNT_ID');
    const accessKeyId     = this.config.getOrThrow<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY');
    this.bucket           = this.config.getOrThrow<string>('R2_BUCKET');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  // ── Subir archivo ──────────────────────────────────────────────────────────
  async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(new PutObjectCommand({
        Bucket:      this.bucket,
        Key:         key,
        Body:        buffer,
        ContentType: contentType,
      }));
    } catch {
      throw new InternalServerErrorException('Error al subir el archivo a R2.');
    }
  }

  // ── Generar URL temporal firmada (15 minutos) ──────────────────────────────
  async getPresignedUrl(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      return await getSignedUrl(this.client, command, { expiresIn: 900 });
    } catch {
      throw new InternalServerErrorException('Error al generar la URL del documento.');
    }
  }

  // ── Eliminar archivo ───────────────────────────────────────────────────────
  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      throw new InternalServerErrorException('Error al eliminar el archivo de R2.');
    }
  }

  // ── Verificar si existe ────────────────────────────────────────────────────
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
