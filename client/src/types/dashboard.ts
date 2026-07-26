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