import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index';
import { prisma } from '../test/setup';

const VALID_REGISTER = {
  email: 'owner@test.com',
  senha: 'Password123!',
  nome: 'João Silva',
  idade: 25,
  celular: '+5511999999999',
};

describe('POST /auth/register', () => {
  it('should register a new user and return 201 with token and user', async () => {
    const res = await request(app).post('/auth/register').send(VALID_REGISTER);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toMatchObject({
      email: VALID_REGISTER.email,
      nome: VALID_REGISTER.nome,
      idade: VALID_REGISTER.idade,
      celular: VALID_REGISTER.celular,
      role: 'OWNER',
      tenant_id: null,
    });
    expect(res.body.user.id).toBeDefined();

    // Verify JWT payload
    const payload = jwt.decode(res.body.token) as Record<string, unknown>;
    expect(payload.user_id).toBe(res.body.user.id);
    expect(payload.tenant_id).toBeNull();
    expect(payload.role).toBe('OWNER');

    // Verify user in database
    const dbUser = await prisma.user.findUnique({ where: { email: VALID_REGISTER.email } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.password_hash).not.toBe(VALID_REGISTER.senha);
  });

  it('should return 409 for duplicate email', async () => {
    await request(app).post('/auth/register').send(VALID_REGISTER);
    const res = await request(app).post('/auth/register').send({
      ...VALID_REGISTER,
      celular: '+5511888888888',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email já cadastrado');
  });

  it('should return 400 for invalid email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_REGISTER, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });

  it('should return 400 for short password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_REGISTER, senha: '1234567' });

    expect(res.status).toBe(400);
  });

  it('should return 400 for age < 18', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_REGISTER, idade: 17 });

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid phone format', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_REGISTER, celular: '11999999999' });

    expect(res.status).toBe(400);
  });

  it('should accept optional foto_url', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_REGISTER, foto_url: 'https://example.com/photo.jpg' });

    expect(res.status).toBe(201);
    expect(res.body.user.foto_url).toBe('https://example.com/photo.jpg');
  });
});
