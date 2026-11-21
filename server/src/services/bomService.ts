import { getDatabase } from '../db/connection';
import { parseExcel } from '../utils/excelParser';
import { Component } from './types';

/**
 * Cross-language keyword aliases for EDA BOM matching.
 * Maps a keyword to an array of synonyms that should be considered equivalent.
 * When a BOM field contains a keyword, we check if any synonym appears in the inventory fields.
 */
const KEYWORD_ALIASES: Record<string, string[]> = {
  tf: ['tf卡', 'microsd', 'sd卡', '卡座'],
  'tf-card': ['tf卡', 'microsd', 'sd卡', '卡座'],
  'tf卡': ['tf', 'tf-card', 'microsd', 'sd卡', '卡座'],
  sd: ['microsd', 'sd卡', '卡座'],
  'sd卡': ['microsd', 'sd卡', '卡座'],
  卡座: ['microsd', 'sd卡', '卡座', 'tf', 'tf-card'],
};

/**
 * Normalize text for comparison:
 * - μ (Greek) → u (ASCII) — LCEDA uses ASCII "4.7uF" while inventory may have "4.7μF"
 * - lowercase for case-insensitive matching
 * - collapse whitespace
 */
function normalizeText(v: string): string {
  return v.replace(/μ/g, 'u').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Score the overlap between two text fields.
 * Returns 0 if no meaningful overlap, higher for stronger matches.
 */
function fieldScore(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;

  // Exact match
  if (na === nb) return 10;

  // Contains (one full field inside the other)
  if (na.includes(nb) || nb.includes(na)) return 6;

  // Common prefix (e.g. "W25Q80DVUXIE" vs "W25Q80DVUX1E" share "w25q80dvux")
  let i = 0;
  while (i < na.length && i < nb.length && na[i] === nb[i]) i++;
  if (i >= 6) return 5;
  if (i >= 3) return 2;

  // Keyword alias match (cross-language, e.g. "TF" ↔ "MicroSD卡座")
  for (const [key, aliases] of Object.entries(KEYWORD_ALIASES)) {
    const bomHasKey = na.includes(key.toLowerCase());
    for (const alias of aliases) {
      if (bomHasKey && nb.includes(alias.toLowerCase())) return 4;
      if (nb.includes(key.toLowerCase()) && na.includes(alias.toLowerCase())) return 4;
    }
  }

  return 0;
}

/**
 * Score a BOM item against an inventory component.
 * Compares all non-empty text fields (part_number, value, description, package)
 * and returns the best field-pair score.
 */
function scoreMatch(item: BomItem, comp: Component): number {
  const bomFields = [item.part_number, item.value, item.description, item.package];
  const compFields = [comp.part_number, comp.value, comp.description, comp.package];

  let best = 0;
  for (const bf of bomFields) {
    if (!bf) continue;
    for (const cf of compFields) {
      if (!cf) continue;
      const s = fieldScore(bf, cf);
      if (s > best) best = s;
    }
  }
  return best;
}

const MATCH_THRESHOLD = 2;

export interface BomImport {
  id: number;
  filename: string;
  original_name: string;
  total_items: number;
  status: 'imported' | 'compared' | 'consumed';
  notes: string;
  consumed_at: string | null;
  created_at: string;
}

export interface BomItem {
  id: number;
  bom_import_id: number;
  part_number: string;
  description: string;
  qty: number;
  reference_designators: string;
  value: string;
  package: string;
  notes: string;
  comparison_status: string | null;
  matched_component_id: number | null;
  available_stock: number | null;
  created_at: string;
}

export interface ComparisonSummary {
  total: number;
  found: number;
  insufficient: number;
  missing: number;
}

export interface ConsumptionItem {
  part_number: string;
  description: string;
  qty_consumed: number;
  stock_before: number;
  stock_after: number;
}

export interface ConsumptionResult {
  import: BomImport;
  items: ConsumedBomItem[];
  consumed: ConsumptionItem[];
  summary: { total_consumed: number; total_items: number };
}

export interface ConsumedBomItem extends BomItem {
  stock_before?: number;
  stock_after?: number;
}

export class BomService {
  upload(fileBuffer: Buffer, originalName: string): BomImport {
    const db = getDatabase();
    const parsed = parseExcel(fileBuffer);

    if (parsed.items.length === 0) {
      throw new Error('No valid items found in BOM file');
    }

    const filename = `${Date.now()}_${originalName}`;

    const insertBom = db.prepare(
      `INSERT INTO bom_imports (filename, original_name, total_items, status) VALUES (?, ?, ?, 'imported')`
    );
    const insertItem = db.prepare(
      `INSERT INTO bom_items (bom_import_id, part_number, description, qty, reference_designators, value, package) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const transaction = db.transaction(() => {
      const result = insertBom.run(filename, originalName, parsed.items.length);
      const bomId = result.lastInsertRowid as number;

      for (const item of parsed.items) {
        insertItem.run(bomId, item.part_number, item.description, item.qty, item.reference_designators, item.value, item.package);
      }

      return bomId;
    });

    const bomId = transaction();

    return db.prepare('SELECT * FROM bom_imports WHERE id = ?').get(bomId) as BomImport;
  }

  getAll(): BomImport[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM bom_imports ORDER BY created_at DESC').all() as BomImport[];
  }

  getById(id: number): BomImport | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM bom_imports WHERE id = ?').get(id) as BomImport | undefined;
  }

  getItems(bomId: number): BomItem[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM bom_items WHERE bom_import_id = ? ORDER BY id').all(bomId) as BomItem[];
  }

  delete(id: number): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM bom_imports WHERE id = ?').run(id);
    return result.changes > 0;
  }

  updateItemNotes(itemId: number, notes: string): BomItem | null {
    const db = getDatabase();
    db.prepare('UPDATE bom_items SET notes = ? WHERE id = ?').run(notes, itemId);
    return (db.prepare('SELECT * FROM bom_items WHERE id = ?').get(itemId) as BomItem) || null;
  }

  updateItemMatch(itemId: number, componentId: number | null): BomItem | null {
    const db = getDatabase();
    const item = db.prepare('SELECT * FROM bom_items WHERE id = ?').get(itemId) as BomItem | null;
    if (!item) return null;

    if (componentId === null) {
      db.prepare(
        `UPDATE bom_items SET comparison_status = 'missing', matched_component_id = NULL, available_stock = NULL WHERE id = ?`
      ).run(itemId);
    } else {
      const component = db.prepare('SELECT * FROM components WHERE id = ?').get(componentId) as Component | undefined;
      if (!component) return null;

      const status = component.quantity >= item.qty ? 'found' : 'insufficient';
      db.prepare(
        `UPDATE bom_items SET comparison_status = ?, matched_component_id = ?, available_stock = ? WHERE id = ?`
      ).run(status, componentId, component.quantity, itemId);
    }

    return db.prepare('SELECT * FROM bom_items WHERE id = ?').get(itemId) as BomItem | null;
  }

  compareBom(bomId: number): { import: BomImport; items: BomItem[]; summary: ComparisonSummary } {
    const db = getDatabase();
    const bomImport = this.getById(bomId);
    if (!bomImport) {
      throw new Error('BOM import not found');
    }

    const items = this.getItems(bomId);
    const allComponents = db.prepare('SELECT * FROM components').all() as Component[];
    const updateItem = db.prepare(
      `UPDATE bom_items SET comparison_status = ?, matched_component_id = ?, available_stock = ? WHERE id = ?`
    );

    let found = 0;
    let insufficient = 0;
    let missing = 0;

    // Track which components are already matched (1:1 to avoid double-counting)
    const matchedIds = new Set<number>();

    // Score all BOM items against all components, store results
    const scored: { item: BomItem; comp: Component; score: number }[] = [];
    for (const item of items) {
      for (const comp of allComponents) {
        const s = scoreMatch(item, comp);
        scored.push({ item, comp, score: s });
      }
    }

    // Sort by score descending, greedily assign best match per BOM item
    // ensuring each inventory component is used at most once
    scored.sort((a, b) => b.score - a.score);
    const assignments = new Map<string, { comp: Component; score: number }>();
    for (const { item, comp, score } of scored) {
      if (score < MATCH_THRESHOLD) continue;
      const key = `${item.id}-${comp.id}`;
      if (assignments.has(key)) continue;
      // Check this BOM item already got a better match
      const existing = assignments.get(String(item.id));
      if (existing && existing.score >= score) continue;
      // Check this component already used
      if (matchedIds.has(comp.id)) continue;
      assignments.set(String(item.id), { comp, score });
      matchedIds.add(comp.id);
    }

    const transaction = db.transaction(() => {
      for (const item of items) {
        const assignment = assignments.get(String(item.id));
        const component = assignment ? assignment.comp : null;

        if (!component) {
          updateItem.run('missing', null, 0, item.id);
          missing++;
        } else if (component.quantity >= item.qty) {
          updateItem.run('found', component.id, component.quantity, item.id);
          found++;
        } else if (component.quantity > 0) {
          updateItem.run('insufficient', component.id, component.quantity, item.id);
          insufficient++;
        } else {
          updateItem.run('missing', component.id, 0, item.id);
          missing++;
        }
      }

      db.prepare("UPDATE bom_imports SET status = 'compared' WHERE id = ?").run(bomId);
    });

    transaction();

    const updatedItems = this.getItems(bomId);
    const updatedBom = this.getById(bomId)!;

    return {
      import: updatedBom,
      items: updatedItems,
      summary: { total: items.length, found, insufficient, missing },
    };
  }

  getComparisonResult(bomId: number): { import: BomImport; items: BomItem[]; summary: ComparisonSummary } | null {
    const db = getDatabase();
    const bomImport = this.getById(bomId);
    if (!bomImport || bomImport.status !== 'compared') return null;

    const items = this.getItems(bomId);

    const summary: ComparisonSummary = { total: 0, found: 0, insufficient: 0, missing: 0 };
    for (const item of items) {
      summary.total++;
      if (item.comparison_status === 'found') summary.found++;
      else if (item.comparison_status === 'insufficient') summary.insufficient++;
      else if (item.comparison_status === 'missing') summary.missing++;
    }

    return { import: bomImport, items, summary };
  }

  consumeBom(bomId: number): ConsumptionResult {
    const db = getDatabase();
    const bomImport = this.getById(bomId);
    if (!bomImport) throw new Error('BOM import not found');
    if (bomImport.status !== 'compared') throw new Error('BOM must be compared before consuming');

    const items = this.getItems(bomId);
    const getComponent = db.prepare('SELECT * FROM components WHERE id = ?');
    const updateComponent = db.prepare("UPDATE components SET quantity = ?, updated_at = datetime('now', 'localtime') WHERE id = ?");
    const updateItem = db.prepare('UPDATE bom_items SET comparison_status = ?, available_stock = ? WHERE id = ?');

    const consumed: ConsumptionItem[] = [];
    const updatedItems: ConsumedBomItem[] = [];

    const transaction = db.transaction(() => {
      for (const item of items) {
        const consumedItem: ConsumedBomItem = { ...item };

        if (item.comparison_status === 'found' || item.comparison_status === 'insufficient') {
          const component = getComponent.get(item.matched_component_id) as Component | undefined;
          if (component) {
            const stockBefore = component.quantity;
            const actualConsume = Math.min(item.qty, stockBefore);
            const stockAfter = stockBefore - actualConsume;

            updateComponent.run(stockAfter, component.id);
            updateItem.run(stockAfter >= item.qty ? 'found' : 'insufficient', stockAfter, item.id);

            consumedItem.stock_before = stockBefore;
            consumedItem.stock_after = stockAfter;
            consumedItem.available_stock = stockAfter;

            consumed.push({
              part_number: item.part_number,
              description: item.description,
              qty_consumed: actualConsume,
              stock_before: stockBefore,
              stock_after: stockAfter,
            });
          }
        }

        updatedItems.push(consumedItem);
      }

      db.prepare("UPDATE bom_imports SET status = 'consumed', consumed_at = datetime('now', 'localtime') WHERE id = ?").run(bomId);
    });

    transaction();

    const updatedBom = this.getById(bomId)!;
    const totalConsumed = consumed.reduce((s, c) => s + c.qty_consumed, 0);

    return {
      import: updatedBom,
      items: updatedItems,
      consumed,
      summary: { total_consumed: totalConsumed, total_items: items.length },
    };
  }
}

export const bomService = new BomService();