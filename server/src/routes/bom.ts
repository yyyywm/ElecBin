import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { bomService } from '../services/bomService';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .xls files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// GET /api/bom - List all BOM imports
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const imports = bomService.getAll();
  res.json({ success: true, data: imports });
}));

// GET /api/bom/:id - Get BOM import with items
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const bomImport = bomService.getById(id);
  if (!bomImport) {
    return res.status(404).json({ success: false, error: { message: 'BOM import not found' } });
  }
  const items = bomService.getItems(id);
  res.json({ success: true, data: { import: bomImport, items } });
}));

// POST /api/bom/upload - Upload BOM Excel file
router.post('/upload', (req: Request, res: Response) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: { message: err.message } });
      }
      return res.status(400).json({ success: false, error: { message: err.message } });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    try {
      // Use query param to avoid Content-Disposition Chinese filename encoding issues
      const originalName = req.query.name ? decodeURIComponent(req.query.name as string) : req.file.originalname;
      const bomImport = bomService.upload(req.file.buffer, originalName);
      res.status(201).json({ success: true, data: bomImport });
    } catch (parseErr: unknown) {
      const message = parseErr instanceof Error ? parseErr.message : 'Failed to parse BOM file';
      res.status(400).json({ success: false, error: { message } });
    }
  });
});

// POST /api/bom/:id/compare - Run comparison
router.post('/:id/compare', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const result = bomService.compareBom(id);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes('not found')) {
      return res.status(404).json({ success: false, error: { message: err.message } });
    }
    throw err;
  }
}));

// GET /api/bom/:id/compare - Get cached comparison results
router.get('/:id/compare', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const result = bomService.getComparisonResult(id);
  if (!result) {
    return res.status(404).json({
      success: false,
      error: { message: 'Comparison not found. Run comparison first.' },
    });
  }
  res.json({ success: true, data: result });
}));

// DELETE /api/bom/:id - Delete BOM import
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const deleted = bomService.delete(id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: { message: 'BOM import not found' } });
  }
  res.json({ success: true, data: { id } });
}));

// PATCH /api/bom/:bomId/items/:itemId - Update BOM item notes
router.patch('/:bomId/items/:itemId', asyncHandler(async (req: Request, res: Response) => {
  const itemId = parseInt(req.params.itemId, 10);
  const { notes } = req.body;
  const updated = bomService.updateItemNotes(itemId, notes || '');
  if (!updated) {
    return res.status(404).json({ success: false, error: { message: 'BOM item not found' } });
  }
  res.json({ success: true, data: updated });
}));

// PATCH /api/bom/:bomId/items/:itemId/match - Manually match a BOM item to a substitute component
router.patch('/:bomId/items/:itemId/match', asyncHandler(async (req: Request, res: Response) => {
  const itemId = parseInt(req.params.itemId, 10);
  const { componentId } = req.body;
  const updated = bomService.updateItemMatch(itemId, componentId ?? null);
  if (!updated) {
    return res.status(404).json({ success: false, error: { message: 'BOM item not found' } });
  }
  res.json({ success: true, data: updated });
}));

// POST /api/bom/:id/consume - Consume inventory for this BOM
router.post('/:id/consume', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const result = bomService.consumeBom(id);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message?.includes('not found')) {
        return res.status(404).json({ success: false, error: { message: err.message } });
      }
      if (err.message?.includes('must be compared')) {
        return res.status(400).json({ success: false, error: { message: err.message } });
      }
    }
    throw err;
  }
}));

export default router;