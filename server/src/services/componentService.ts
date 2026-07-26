import { getDatabase } from '../db/connection';
import {
  Component,
  CreateComponentInput,
  UpdateComponentInput,
  ComponentQuery,
  PaginatedResult,
} from './types';

export class ComponentService {
  getAll(query: ComponentQuery): PaginatedResult<Component> {
    const db = getDatabase();
    const { search, category, page = 1, limit = 20, sortBy = 'part_number', sortDir = 'asc' } = query;

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push('(part_number LIKE ? OR description LIKE ? OR value LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    if (category && category !== 'All') {
      conditions.push('category = ?');
      params.push(category);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Validate sortBy to prevent SQL injection
    const allowedSortColumns = ['part_number', 'description', 'category', 'quantity', 'value', 'location', 'created_at', 'updated_at'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'value';
    const safeSortDir = sortDir === 'desc' ? 'DESC' : 'ASC';

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM components ${whereClause}`).get(...params) as { count: number };
    const total = countRow.count;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const data = db
      .prepare(
        `SELECT * FROM components ${whereClause} ORDER BY ${safeSortBy} ${safeSortDir} LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as Component[];

    return { data, total, page, limit, totalPages };
  }

  getById(id: number): Component | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM components WHERE id = ?').get(id) as Component | undefined;
  }

  getByPartNumber(partNumber: string): Component | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM components WHERE part_number = ?').get(partNumber) as Component | undefined;
  }

  create(input: CreateComponentInput): Component {
    const db = getDatabase();
    // Auto-generate part_number from value if not provided
    if (!input.part_number) {
      input.part_number = `AUTO-${input.value || 'unknown'}-${Date.now()}`;
    }
    const existing = this.getByPartNumber(input.part_number);
    if (existing) {
      throw new Error(`Part number "${input.part_number}" already exists`);
    }

    const result = db
      .prepare(
        `INSERT INTO components (part_number, description, category, package, value, quantity, location, min_stock, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.part_number,
        input.description || '',
        input.category || 'Uncategorized',
        input.package || '',
        input.value || '',
        input.quantity || 0,
        input.location || '',
        input.min_stock || 0,
        input.notes || ''
      );

    return this.getById(result.lastInsertRowid as number)!;
  }

  update(id: number, input: UpdateComponentInput): Component | undefined {
    const db = getDatabase();
    const existing = this.getById(id);
    if (!existing) return undefined;

    // If part_number is being changed, check for uniqueness
    if (input.part_number && input.part_number !== existing.part_number) {
      const conflict = this.getByPartNumber(input.part_number);
      if (conflict) {
        throw new Error(`Part number "${input.part_number}" already exists`);
      }
    }

    const fields: string[] = [];
    const params: any[] = [];

    const fieldMap: Record<string, any> = {
      part_number: input.part_number,
      description: input.description,
      category: input.category,
      package: input.package,
      value: input.value,
      quantity: input.quantity,
      location: input.location,
      min_stock: input.min_stock,
      notes: input.notes,
    };

    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (fields.length === 0) return existing;

    fields.push("updated_at = datetime('now', 'localtime')");
    params.push(id);

    db.prepare(`UPDATE components SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    return this.getById(id);
  }

  delete(id: number): boolean {
    const db = getDatabase();
    try {
      const result = db.prepare('DELETE FROM components WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (err: any) {
      if (err.message?.includes('FOREIGN KEY constraint')) {
        throw new Error('Cannot delete: component is referenced in BOM imports');
      }
      throw err;
    }
  }

  getCategories(): string[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT DISTINCT category FROM components ORDER BY category').all() as { category: string }[];
    return rows.map((r) => r.category);
  }

  getLowStock(): Component[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM components WHERE quantity <= min_stock ORDER BY quantity ASC').all() as Component[];
  }
}

export const componentService = new ComponentService();