import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { signJwt, verifyJwt } from '../lib/jwt';
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

    // Generate JWT
    const token = signJwt({
      user_id: user.id,
      tenant_id: null,
      role: user.role,
    });

    res.status(201).json({
      token,
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

    res.status(200).json({
      token,
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

    // Verify the existing token
    let payload;
    try {
      payload = verifyJwt(data.token);
    } catch {
      res.status(401).json({ error: 'Token inválido ou expirado' });
      return;
    }

    // Look up the user in the database to get current data
    const user = await prisma.user.findUnique({
      where: { id: payload.user_id },
    });

    if (!user) {
      res.status(401).json({ error: 'Token inválido ou expirado' });
      return;
    }

    // Issue a new JWT with updated claims from the database
    const token = signJwt({
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
    });

    res.status(200).json({ token });
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
