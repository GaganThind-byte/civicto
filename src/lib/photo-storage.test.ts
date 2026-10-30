import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'http';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { saveUploadedPhoto } from './photo-storage.ts';

test('saveUploadedPhoto writes a file under public/uploads and returns a public URL', async () => {
  const result = await saveUploadedPhoto({
    name: 'before.png',
    type: 'image/png',
    buffer: Buffer.from('abc123'),
  });

  assert.match(result, /^\/uploads\//);
  const diskPath = path.join(process.cwd(), 'public', result.replace(/^\//, ''));
  assert.equal(existsSync(diskPath), true);
  assert.equal(readFileSync(diskPath, 'utf8'), 'abc123');
});

test('saveUploadedPhoto sends objects to a configured S3-compatible endpoint', async () => {
  const keys = [
    'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET',
    'S3_ENDPOINT', 'S3_PUBLIC_URL', 'S3_KEY_PREFIX',
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  let requestMethod = '';
  let requestUrl = '';
  const server = createServer((request, response) => {
    requestMethod = request.method ?? '';
    requestUrl = request.url ?? '';
    request.resume();
    response.writeHead(200, { ETag: '"test-etag"' });
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  process.env.AWS_REGION = 'us-east-1';
  process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.S3_BUCKET = 'evidence-bucket';
  process.env.S3_ENDPOINT = `http://127.0.0.1:${address.port}`;
  process.env.S3_PUBLIC_URL = 'https://cdn.example.test/evidence';
  process.env.S3_KEY_PREFIX = 'test-prefix';

  try {
    const result = await saveUploadedPhoto({
      name: 'repair after.png',
      type: 'image/png',
      buffer: Buffer.from('repair-proof'),
    });

    assert.equal(requestMethod, 'PUT');
    assert.match(requestUrl, /^\/evidence-bucket\/test-prefix\//);
    assert.match(result, /^https:\/\/cdn\.example\.test\/evidence\/test-prefix\//);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
