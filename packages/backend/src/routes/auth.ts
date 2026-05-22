import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { signJwt } from '../lib/jwt';
import { generateRefreshToken, hashRefreshToken } from '../lib/refreshToken';
import { registerSchema, loginSchema, refreshSchema } from '../schemas/auth';
import { ZodError } from 'zod';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      res.status(409).json({ error: 'Email já cadastrado' });
      return;
    }

    // Hash password
    const password_hash = await bcrypt.hash(data.senha, 12);

    // Create user with role OWNER and tenant_id NULL
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password_hash,
        nome: data.nome,
        idade: data.idade,
        celular: data.celular,
        foto_url: data.foto_url ?? null,
        role: 'OWNER',
        tenant_id: null,
      },
    });

    // Generate access token (JWT, 1h expiry)
    const token = signJwt({
      user_id: user.id,
      tenant_id: null,
      role: user.role,
    });

    // Generate refresh token (opaque, 7-day expiry)
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    res.status(201).json({
      token,
      refresh_token: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        idade: user.idade,
        celular: user.celular,
        foto_url: user.foto_url,
        role: user.role,
        tenant_id: user.tenant_id,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Register error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const passwordMatch = await bcrypt.compare(data.senha, user.password_hash);

    if (!passwordMatch) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const token = signJwt({
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
    });

    // Generate refresh token (opaque, 7-day expiry)
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    res.status(200).json({
      token,
      refresh_token: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        idade: user.idade,
        celular: user.celular,
        foto_url: user.foto_url,
        role: user.role,
        tenant_id: user.tenant_id,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Login error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const data = refreshSchema.parse(req.body);

    // Hash the incoming refresh token
    const tokenHash = hashRefreshToken(data.refresh_token);

    // Look up the hash in the RefreshToken table
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
    });

    // Verify token exists and is not expired
    if (!storedToken || storedToken.expires_at < new Date()) {
      res.status(401).json({ error: 'Token inválido ou expirado' });
      return;
    }

    // Delete the old token row (rotation)
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Look up the user to get current data for the new access token
    const user = await prisma.user.findUnique({
      where: { id: storedToken.user_id },
    });

    if (!user) {
      res.status(401).json({ error: 'Token inválido ou expirado' });
      return;
    }

    // Generate a new access token
    const token = signJwt({
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
    });

    // Generate a new refresh token and store its hash
    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashRefreshToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: newTokenHash,
        expires_at: expiresAt,
      },
    });

    res.status(200).json({ token, refresh_token: newRawRefreshToken });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Refresh error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
