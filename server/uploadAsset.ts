import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

// Configurar multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato inválido. Use PNG, JPG, WebP ou SVG.'));
    }
  },
});

export const uploadAssetHandler = upload.single('file');

export async function uploadAsset(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const targetPath = req.body.path as string;
    if (!targetPath) {
      return res.status(400).json({ error: 'Caminho não especificado' });
    }

    // Validar que o caminho está dentro de /public
    if (!targetPath.startsWith('/public/')) {
      return res.status(400).json({ error: 'Caminho inválido. Deve começar com /public/' });
    }

    // Converter caminho relativo para absoluto
    const projectRoot = path.resolve(process.cwd());
    const fullPath = path.join(projectRoot, targetPath.replace(/^\/public\//, 'public/'));

    // Criar diretório se não existir
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Salvar arquivo
    await fs.writeFile(fullPath, req.file.buffer);

    console.log(`✅ Asset salvo: ${fullPath}`);

    return res.json({
      success: true,
      path: targetPath,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
