export interface Component {
  id: number;
  part_number: string;
  description: string;
  category: string;
  package: string;
  value: string;
  quantity: number;
  location: string;
  min_stock: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreateComponentInput {
  part_number: string;
  description?: string;
  category?: string;
  package?: string;
  value?: string;
  quantity?: number;
  location?: string;
  min_stock?: number;
  notes?: string;
}

export interface UpdateComponentInput {
  part_number?: string;
  description?: string;
  category?: string;
  package?: string;
  value?: string;
  quantity?: number;
  location?: string;
  min_stock?: number;
  notes?: string;
}

export interface ComponentQuery {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}