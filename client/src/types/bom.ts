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

export interface BomDetail {
  import: BomImport;
  items: BomItem[];
}

export interface CompareResult {
  import: BomImport;
  items: BomItem[];
  summary: ComparisonSummary;
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
  items: BomItem[];
  consumed: ConsumptionItem[];
  summary: { total_consumed: number; total_items: number };
}