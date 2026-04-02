import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { createFullTenantSetup } from '../test/factories';
import { generateTestJwt, authHeader } from '../test/helpers';
import { Role } from '../generated/prisma/enums';

describe('POST /upload', () => {
  async function setupAuth() {
    const { tenant, user } = await createFullTenantSetup();
    const token = generateTestJwt({
      user_id: user.id,
      tenant_id: tenant.id,
      role: Role.OWNER,
    });
    return { token };
  }

  // Create a minimal valid JPEG buffer (smallest valid JPEG)
  function createJpegBuffer(sizeBytes?: number): Buffer {
    // Minimal JPEG: SOI marker + JFIF APP0 + minimal content + EOI
    const minJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
    if (!sizeBytes || sizeBytes <= minJpeg.length) return minJpeg;
    // Pad to desired size
    const padding = Buffer.alloc(sizeBytes - minJpeg.length, 0);
    return Buffer.concat([minJpeg.subarray(0, minJpeg.length - 2), padding, minJpeg.subarray(-2)]);
  }

  it('should upload a JPEG file and return URL', async () => {
    const { token } = await setupAuth();
    const jpegBuf = createJpegBuffer();

    const res = await request(app)
      .post('/upload')
      .set('Authorization', authHeader(token))
      .attach('file', jpegBuf, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.url).toBeDefined();
    expect(res.body.url).toMatch(/^\/uploads\/.+\.jpg$/);
  });

  it('should reject non-JPEG file with 400', async () => {
    const { token } = await setupAuth();
    const pngBuf = Buffer.from('fake png content');

    const res = await request(app)
      .post('/upload')
      .set('Authorization', authHeader(token))
      .attach('file', pngBuf, { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/formato inválido|não corresponde ao tipo declarado/i);
  });

  it('should reject file over 5MB with 400', async () => {
    const { token } = await setupAuth();
    const largeBuf = createJpegBuffer(6 * 1024 * 1024); // 6MB

    const res = await request(app)
      .post('/upload')
      .set('Authorization', authHeader(token))
      .attach('file', largeBuf, { filename: 'large.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/5MB/);
  });

  it('should require authentication (401 without token)', async () => {
    const jpegBuf = createJpegBuffer();

    const res = await request(app)
      .post('/upload')
      .attach('file', jpegBuf, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
  });
});
