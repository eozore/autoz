import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index';

const VALID_USER = {
  email: 'login-test@test.com',
  senha: 'Password123!',
  nome: 'João Silva',
  idade: 25,
  celular: '+5511999999999',
};

describe('POST /auth/login', () => {
  // Register a user before each login test group
  async function registerUser() {
    const res = await request(app).post('/auth/register').send(VALID_USER);
    expect(res.status).toBe(201);
    return res.body;
  }

  it('should login successfully with correct credentials and return 200 with token and user', async () => {
    const registered = await registerUser();

    const res = await request(app).post('/auth/login').send({
      email: VALID_USER.email,
      senha: VALID_USER.senha,
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toMatchObject({
      id: registered.user.id,
      email: VALID_USER.email,
      nome: VALID_USER.nome,
      idade: VALID_USER.idade,
      celular: VALID_USER.celular,
      role: 'OWNER',
      tenant_id: null,
    });

    // Verify JWT payload
    const payload = jwt.decode(res.body.token) as Record<string, unknown>;
    expect(payload.user_id).toBe(registered.user.id);
    expect(payload.tenant_id).toBeNull();
    expect(payload.role).toBe('OWNER');
  });

  it('should return 401 for wrong password', async () => {
    await registerUser();

    const res = await request(app).post('/auth/login').send({
      email: VALID_USER.email,
      senha: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciais inválidas');
  });

  it('should return 401 for non-existent email', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'nonexistent@test.com',
      senha: 'password123',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciais inválidas');
  });

  it('should return 400 for missing email', async () => {
    const res = await request(app).post('/auth/login').send({
      senha: 'password123',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });

  it('should return 400 for missing senha', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'test@test.com',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });

  it('should return 400 for invalid email format', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'not-an-email',
      senha: 'password123',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });
});
