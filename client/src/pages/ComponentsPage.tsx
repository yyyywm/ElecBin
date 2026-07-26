import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { componentsApi } from '../api/components';
import { SearchInput } from '../components/shared/SearchInput';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { Plus, Package, Trash2, Edit, AlertTriangle, Columns3, GripVertical } from 'lucide-react';

const ALL_COLUMNS = [
  { key: 'part_number', label: '型号', sortable: true },
  { key: 'value', label: '参数', sortable: true },
  { key: 'description', label: '描述', sortable: false },
  { key: 'package', label: '封装', sortable: false },
  { key: 'category', label: '分类', sortable: true },
  { key: 'quantity', label: '数量', sortable: true },
  { key: 'location', label: '位置', sortable: false },
  { key: 'min_stock', label: '最低库存', sortable: false },
  { key: 'actions', label: '操作', sortable: false, always: true },
] as const;

const VISIBILITY_KEY = 'components-columns';
const ORDER_KEY = 'components-columns-order';

function loadVisibleColumns(): string[] {
  try {
    const saved = localStorage.getItem(VISIBILITY_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return ALL_COLUMNS.map((c) => c.key);
}

function loadColumnOrder(): string[] {
  try {
    const saved = localStorage.getItem(ORDER_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return ALL_COLUMNS.map((c) => c.key);
}

export function ComponentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [columnOpen, setColumnOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(loadVisibleColumns);
  const [columnOrder, setColumnOrder] = useState<string[]>(loadColumnOrder);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(VISIBILITY_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) {
        setColumnOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Build colDefs from the user's column order, filtered by visibility
  const colDefs = columnOrder
    .map((key) => ALL_COLUMNS.find((c) => c.key === key))
    .filter((c): c is (typeof ALL_COLUMNS[number]) => c !== undefined)
    .filter((c) => visibleColumns.includes(c.key));

  const handleDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverKey(key);
  };

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    setDragOverKey(null);
    const sourceKey = e.dataTransfer.getData('text/plain');
    if (!sourceKey || sourceKey === targetKey) return;

    setColumnOrder((prev) => {
      const srcIdx = prev.indexOf(sourceKey);
      const tgtIdx = prev.indexOf(targetKey);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      const next = [...prev];
      next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, sourceKey);
      return next;
    });
  };

  const handleDragEnd = () => {
    setDragOverKey(null);
  };

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => componentsApi.categories(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['components', { search, category, page, sortBy, sortDir }],
    queryFn: () => componentsApi.list({ search, category, page, limit: 20, sortBy, sortDir }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => componentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setDeleteTarget(null);
    },
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const sortIndicator = (column: string) => {
    if (sortBy !== column) return null;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">元器件</h1>
          <p className="text-sm text-slate-500 mt-1">管理你的元器件库存</p>
        </div>
        <button
          onClick={() => navigate('/components/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          添加元器件
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-64">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="搜索型号、描述、参数..." />
        </div>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">所有分类</option>
          {categories?.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <div className="relative ml-auto" ref={columnRef}>
          <button
            onClick={() => setColumnOpen(!columnOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
          >
            <Columns3 size={16} />
            列设置
          </button>
          {columnOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-2">
              <p className="px-3 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                显示列
              </p>
              <p className="px-3 pb-1 text-[10px] text-slate-400 italic">拖拽表头可调整列顺序</p>
              {ALL_COLUMNS.filter((c) => !('always' in c && c.always)).map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={<Package size={48} />}
          title="暂无元器件"
          description="添加你的第一个元器件开始管理库存"
          action={
            <button
              onClick={() => navigate('/components/new')}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              添加元器件
            </button>
          }
        />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {colDefs.map((col) => (
                    <th
                      key={col.key}
                      draggable={col.key !== 'actions'}
                      onDragStart={(e) => handleDragStart(e, col.key)}
                      onDragOver={(e) => handleDragOver(e, col.key)}
                      onDrop={(e) => handleDrop(e, col.key)}
                      onDragEnd={handleDragEnd}
                      className={`px-4 py-3 text-xs font-medium text-slate-500 uppercase select-none ${
                        col.sortable
                          ? 'cursor-pointer hover:text-slate-700'
                          : ''
                      } ${
                        col.key !== 'actions' ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${
                        dragOverKey === col.key ? 'bg-blue-100' : ''
                      } ${
                        col.key === 'quantity' || col.key === 'min_stock' || col.key === 'actions'
                          ? 'text-right'
                          : 'text-left'
                      }`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.key !== 'actions' && <GripVertical size={12} className="text-slate-300 shrink-0" />}
                        {col.label}
                        {col.sortable && sortIndicator(col.key)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((comp) => {
                  const isLowStock = comp.min_stock > 0 && comp.quantity <= comp.min_stock;
                  return (
                    <tr
                      key={comp.id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/components/${comp.id}`)}
                    >
                      {colDefs.map((col) => {
                        if (col.key === 'actions') {
                          return (
                            <td key={col.key} className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => navigate(`/components/${comp.id}`)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget({ id: comp.id, name: comp.part_number })}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          );
                        }
                        if (col.key === 'part_number') {
                          return (
                            <td key={col.key} className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-800">{comp.part_number}</span>
                                {isLowStock && <AlertTriangle size={14} className="text-amber-500" />}
                              </div>
                            </td>
                          );
                        }
                        if (col.key === 'category') {
                          return (
                            <td key={col.key} className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                {comp.category}
                              </span>
                            </td>
                          );
                        }
                        if (col.key === 'quantity') {
                          return (
                            <td key={col.key} className={`px-4 py-3 text-sm text-right font-medium ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                              {comp.quantity}
                            </td>
                          );
                        }
                        if (col.key === 'min_stock') {
                          return (
                            <td key={col.key} className="px-4 py-3 text-sm text-right text-slate-600">
                              {comp.min_stock}
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">
                            {(comp as unknown as Record<string, unknown>)[col.key] as string}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                共 {data.total} 条，第 {data.page}/{data.totalPages} 页
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                >
                  上一页
                </button>
                <button
                  disabled={page >= data.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除元器件"
        message={`确定要删除 "${deleteTarget?.name}" 吗？此操作不可撤销。`}
        confirmLabel="删除"
        variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}