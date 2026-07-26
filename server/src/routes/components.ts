import { Router, Request, Response } from 'express';
import { componentService } from '../services/componentService';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// GET /api/components - List all components
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { search, category, page, limit, sortBy, sortDir } = req.query;
  const result = componentService.getAll({
    search: search as string,
    category: category as string,
    page: page ? parseInt(page as string, 10) : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    sortBy: sortBy as string,
    sortDir: sortDir as 'asc' | 'desc',
  });
  res.json({ success: true, data: result });
}));

// GET /api/components/categories - Get distinct categories
router.get('/categories', asyncHandler(async (_req: Request, res: Response) => {
  const categories = componentService.getCategories();
  res.json({ success: true, data: categories });
}));

// GET /api/components/low-stock - Get low stock items
router.get('/low-stock', asyncHandler(async (_req: Request, res: Response) => {
  const items = componentService.getLowStock();
  res.json({ success: true, data: items });
}));

// GET /api/components/:id - Get single component
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const component = componentService.getById(id);
  if (!component) {
    return res.status(404).json({ success: false, error: { message: 'Component not found' } });
  }
  res.json({ success: true, data: component });
}));

// POST /api/components - Create component
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const component = componentService.create(req.body);
    res.status(201).json({ success: true, data: component });
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes('already exists')) {
      return res.status(409).json({ success: false, error: { message: err.message } });
    }
    throw err;
  }
}));

// POST /api/components/import-from-text - Batch import components from parsed text
router.post('/import-from-text', asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'No items provided' } });
  }

  const results: { part_number: string; success: boolean; error?: string }[] = [];
  for (const item of items) {
    try {
      const component = componentService.create({
        part_number: item.part_number,
        description: item.description || '',
        category: item.category || 'Uncategorized',
        package: item.package || '',
        value: item.value || '',
        quantity: item.quantity || 0,
        location: item.location || '',
        min_stock: item.min_stock || 0,
        notes: item.notes || '',
      });
      results.push({ part_number: component.part_number, success: true });
    } catch (err: unknown) {
      results.push({ part_number: item.part_number, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  res.status(201).json({
    success: true,
    data: { results, total: items.length, success: successCount, failed: items.length - successCount },
  });
}));

// PUT /api/components/:id - Update component
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const component = componentService.update(id, req.body);
    if (!component) {
      return res.status(404).json({ success: false, error: { message: 'Component not found' } });
    }
    res.json({ success: true, data: component });
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes('already exists')) {
      return res.status(409).json({ success: false, error: { message: err.message } });
    }
    throw err;
  }
}));

// DELETE /api/components/:id - Delete component
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    const deleted = componentService.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: { message: 'Component not found' } });
    }
    res.json({ success: true, data: { id } });
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes('Cannot delete')) {
      return res.status(409).json({ success: false, error: { message: err.message } });
    }
    throw err;
  }
}));

export default router;