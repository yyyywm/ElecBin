import { api } from './client';
import { Component, CreateComponentInput, ComponentQuery, PaginatedResult } from '../types/component';

export const componentsApi = {
  list: (query: ComponentQuery) => {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.category) params.set('category', query.category);
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.sortBy) params.set('sortBy', query.sortBy);
    if (query.sortDir) params.set('sortDir', query.sortDir);
    const qs = params.toString();
    return api.get<PaginatedResult<Component>>(`/components${qs ? `?${qs}` : ''}`);
  },
  getById: (id: number) => api.get<Component>(`/components/${id}`),
  create: (input: CreateComponentInput) => api.post<Component>('/components', input),
  update: (id: number, input: Partial<CreateComponentInput>) => api.put<Component>(`/components/${id}`, input),
  delete: (id: number) => api.delete<{ id: number }>(`/components/${id}`),
  categories: () => api.get<string[]>('/components/categories'),
  lowStock: () => api.get<Component[]>('/components/low-stock'),
  importFromText: (items: CreateComponentInput[]) => {
    interface ImportResult {
      results: { part_number: string; success: boolean; error?: string }[];
      total: number;
      success: number;
      failed: number;
    }
    return api.post<ImportResult>('/components/import-from-text', { items });
  },
};