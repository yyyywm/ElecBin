import { api } from './client';
import { BomImport, BomDetail, BomItem, CompareResult, ConsumptionResult } from '../types/bom';

export const bomApi = {
  list: () => api.get<BomImport[]>('/bom'),
  getById: (id: number) => api.get<BomDetail>(`/bom/${id}`),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    // Encode filename in query param to avoid Content-Disposition encoding issues
    const encodedName = encodeURIComponent(file.name);
    return api.post<BomImport>(`/bom/upload?name=${encodedName}`, formData);
  },
  delete: (id: number) => api.delete<{ id: number }>(`/bom/${id}`),
  compare: (id: number) => api.post<CompareResult>(`/bom/${id}/compare`),
  getCompareResult: (id: number) => api.get<CompareResult>(`/bom/${id}/compare`),
  consume: (id: number) => api.post<ConsumptionResult>(`/bom/${id}/consume`),
  updateItemNotes: (bomId: number, itemId: number, notes: string) =>
    api.patch<BomItem>(`/bom/${bomId}/items/${itemId}`, { notes }),
  matchItem: (bomId: number, itemId: number, componentId: number | null) =>
    api.patch<BomItem>(`/bom/${bomId}/items/${itemId}/match`, { componentId }),
};