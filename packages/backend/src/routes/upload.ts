import { Router, Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { getStorageProvider } from '../lib/storage';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
};

export function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  const signature = MAGIC_BYTES[declaredMime];
  if (!signature) return false;
  if (buffer.length < signature.length) return false;
  return signature.every((byte, i) => buffer[i] === byte);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Formato inválido. Apenas JPEG e PNG são aceitos.'));
    }
    cb(null, true);
  },
});

const router = Router();

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
      res.status(400).json({ error: 'Conteúdo do arquivo não corresponde ao tipo declarado' });
      return;
    }

    const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const provider = getStorageProvider();
    const url = await provider.upload(req.file.buffer, filename);

    res.status(201).json({ url });
  } catch {
    res.status(500).json({ error: 'Erro ao fazer upload' });
  }
});

// Error handling middleware for multer errors
router.use((err: Error, _req: Request, res: Response, _next: Function) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Arquivo excede tamanho máximo de 5MB' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  if (err.message?.includes('Formato inválido')) {
    res.status(400).json({ error: 'Formato inválido. Apenas JPEG e PNG são aceitos.' });
    return;
  }
  res.status(500).json({ error: 'Erro ao fazer upload' });
});

export default router;
