import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

/**
 * Storage provider interface — abstracts file storage so we can swap
 * local disk for Cloud Storage (GCP) on deploy.
 */
export interface StorageProvider {
  upload(file: Buffer, filename: string): Promise<string>;
}

/**
 * Local disk storage — saves files to packages/backend/uploads/ and
 * returns a URL path like /uploads/filename.jpg.
 */
export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;

  constructor(uploadDir?: string) {
    this.uploadDir = uploadDir ?? path.resolve(__dirname, '../../uploads');
  }

  async upload(file: Buffer, filename: string): Promise<string> {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    const filePath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filePath, file);
    return `/uploads/${filename}`;
  }
}

/**
 * Google Cloud Storage provider — uploads to a GCS bucket and returns
 * a public URL like https://storage.googleapis.com/bucket/filename.jpg
 */
export class GCSStorageProvider implements StorageProvider {
  private bucket;

  constructor(bucketName: string) {
    const storage = new Storage();
    this.bucket = storage.bucket(bucketName);
  }

  async upload(file: Buffer, filename: string): Promise<string> {
    const blob = this.bucket.file(filename);
    await blob.save(file, {
      resumable: false,
      metadata: {
        contentType: filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
      },
    });
    return `https://storage.googleapis.com/${this.bucket.name}/${filename}`;
  }
}

// Auto-detect: use GCS if GCS_BUCKET env is set, otherwise local
const bucketName = process.env.GCS_BUCKET;
let storageProvider: StorageProvider = bucketName
  ? new GCSStorageProvider(bucketName)
  : new LocalStorageProvider();

export function getStorageProvider(): StorageProvider {
  return storageProvider;
}

export function setStorageProvider(provider: StorageProvider): void {
  storageProvider = provider;
}
