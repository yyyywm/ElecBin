import { getDatabase } from '../db/connection';

export interface DashboardStats {
  totalComponents: number;
  totalCategories: number;
  lowStockCount: number;
  totalBOMs: number;
  totalBOMItems: number;
}

export interface RecentActivity {
  recentBOMs: {
    id: number;
    original_name: string;
    total_items: number;
    status: string;
    created_at: string;
  }[];
  recentComponents: {
    id: number;
    part_number: string;
    description: string;
    quantity: number;
    created_at: string;
  }[];
}

export class DashboardService {
  getStats(): DashboardStats {
    const db = getDatabase();

    const totalComponents = (db.prepare('SELECT COUNT(*) as count FROM components').get() as { count: number }).count;
    const totalCategories = (db.prepare('SELECT COUNT(DISTINCT category) as count FROM components').get() as { count: number }).count;
    const lowStockCount = (db.prepare('SELECT COUNT(*) as count FROM components WHERE quantity <= min_stock AND min_stock > 0').get() as { count: number }).count;
    const totalBOMs = (db.prepare('SELECT COUNT(*) as count FROM bom_imports').get() as { count: number }).count;
    const totalBOMItems = (db.prepare('SELECT COUNT(*) as count FROM bom_items').get() as { count: number }).count;

    return { totalComponents, totalCategories, lowStockCount, totalBOMs, totalBOMItems };
  }

  getRecentActivity(): RecentActivity {
    const db = getDatabase();

    const recentBOMs = db
      .prepare('SELECT id, original_name, total_items, status, created_at FROM bom_imports ORDER BY created_at DESC LIMIT 5')
      .all() as RecentActivity['recentBOMs'];

    const recentComponents = db
      .prepare('SELECT id, part_number, description, quantity, created_at FROM components ORDER BY created_at DESC LIMIT 5')
      .all() as RecentActivity['recentComponents'];

    return { recentBOMs, recentComponents };
  }
}

export const dashboardService = new DashboardService();