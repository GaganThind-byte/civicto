import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type SavedPhoto = {
  url: string;
  fileName: string;
};

export type PhotoUploadInput = {
  name: string;
  type?: string;
  buffer: Buffer;
};

let s3Client: S3Client | undefined;

function getS3Client() {
  if (!s3Client) {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: endpoint || undefined,
      forcePathStyle: Boolean(endpoint),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  return s3Client;
}

function encodeObjectKey(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

export async function saveUploadedPhoto(input: PhotoUploadInput): Promise<string> {
  const safeName = input.name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, 80) || `photo-${Date.now()}.png`;
  const key = [process.env.S3_KEY_PREFIX?.replace(/^\/+|\/+$/g, ''), `${randomUUID()}-${safeName}`]
    .filter(Boolean)
    .join('/');
  const bucket = process.env.S3_BUCKET;

  if (bucket) {
    await getS3Client().send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.buffer,
      ContentType: input.type || 'application/octet-stream',
    }));

    const publicBaseUrl = process.env.S3_PUBLIC_URL?.replace(/\/+$/, '')
      || (process.env.S3_ENDPOINT
        ? `${process.env.S3_ENDPOINT.replace(/\/+$/, '')}/${bucket}`
        : `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`);
    return `${publicBaseUrl}/${encodeObjectKey(key)}`;
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const uniqueName = path.basename(key);
  const targetPath = path.join(uploadDir, uniqueName);
  await writeFile(targetPath, input.buffer);

  return `/uploads/${uniqueName}`;
}
