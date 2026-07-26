import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bomApi } from '../api/bom';
import { componentsApi } from '../api/components';
import { StatusBadge } from '../components/shared/StatusBadge';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { ArrowLeft, Download, CheckCircle2, AlertTriangle, XCircle, Search, ShoppingCart, PackageCheck, RefreshCw, Package } from 'lucide-react';
import { CompareResult, BomItem } from '../types/bom';
import { Component } from '../types/component';

function SummaryCard({
  label,
  value,
  color,
  bgColor,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`${bgColor} rounded-xl p-5 flex items-center gap-4`}>
      <div className={`${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-slate-600">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function exportToCsv(items: BomItem[], filename: string, includeStatuses: string[]) {
  const filtered = items.filter((i) => i.comparison_status && includeStatuses.includes(i.comparison_status));

  const headers = ['Part Number', 'Description', 'Value', 'Package', 'Qty Needed', 'Available Stock', 'Status', 'Ref Des', 'Notes'];
  const rows = filtered.map((item) => [
    item.part_number,
    item.description,
    item.value,
    item.package,
    item.qty,
    item.available_stock ?? '-',
    item.comparison_status || '-',
    item.reference_designators,
    item.notes,
  ]);

  // BOM (﻿) tells Excel this is UTF-8, fixes Chinese/Ω character encoding
  const csv = '﻿' + [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.replace('.xlsx', '')}_${includeStatuses.join('-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_OPTIONS = [
  { key: 'found', label: '充足', color: 'text-green-600' },
  { key: 'insufficient', label: '不足', color: 'text-yellow-600' },
  { key: 'missing', label: '缺少', color: 'text-red-600' },
];

export function BOMComparePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const bomId = parseInt(id!);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showConsumeConfirm, setShowConsumeConfirm] = useState(false);
  const [consumed, setConsumed] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatuses, setExportStatuses] = useState<string[]>(['found', 'insufficient', 'missing']);
  const exportRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  // Try to get result from navigation state first
  const initialData = (location.state as any)?.result as CompareResult | undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['bom-compare', bomId],
    queryFn: () => bomApi.getCompareResult(bomId),
    enabled: !initialData,
    initialData: initialData,
  });

  const consumMutation = useMutation({
    mutationFn: () => bomApi.consume(bomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-compare', bomId] });
      queryClient.invalidateQueries({ queryKey: ['bom-detail', bomId] });
      queryClient.invalidateQueries({ queryKey: ['bom-list'] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      setConsumed(true);
      setShowConsumeConfirm(false);
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: ({ itemId, notes }: { itemId: number; notes: string }) =>
      bomApi.updateItemNotes(bomId, itemId, notes),
  });

  // Component picker state
  const [pickerItemId, setPickerItemId] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const matchMutation = useMutation({
    mutationFn: ({ itemId, componentId }: { itemId: number; componentId: number | null }) =>
      bomApi.matchItem(bomId, itemId, componentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-compare', bomId] });
      queryClient.invalidateQueries({ queryKey: ['bom-detail', bomId] });
      setPickerItemId(null);
      setPickerSearch('');
    },
  });

  const { data: pickerComponents } = useQuery({
    queryKey: ['components', { search: pickerSearch, limit: 200 }],
    queryFn: () => componentsApi.list({ search: pickerSearch, limit: 200 }),
    enabled: pickerItemId !== null,
  });

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (isLoading && !data) return <LoadingSpinner />;

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">未找到比对结果</p>
        <button onClick={() => navigate(`/bom/${bomId}`)} className="mt-4 text-blue-600 hover:underline text-sm">
          返回 BOM 详情
        </button>
      </div>
    );
  }

  const { import: bomImport, items, summary } = data;
  const isConsumed = bomImport.status === 'consumed' || consumed;

  // Calculate what needs to be bought
  const needToBuy = items.filter(i => i.comparison_status === 'missing' || i.comparison_status === 'insufficient');
  const needToBuyTotal = needToBuy.reduce((s, i) => s + Math.max(0, i.qty - (i.available_stock || 0)), 0);
  const willConsume = items.filter(i => i.comparison_status === 'found' || i.comparison_status === 'insufficient')
    .reduce((s, i) => s + Math.min(i.qty, i.available_stock || 0), 0);

  const filteredItems = items.filter((item) => {
    if (filterStatus !== 'all' && item.comparison_status !== filterStatus) return false;
    if (searchTerm && !item.part_number.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const order = { found: 0, insufficient: 1, missing: 2 };
    const aOrder = order[a.comparison_status as keyof typeof order] ?? 3;
    const bOrder = order[b.comparison_status as keyof typeof order] ?? 3;
    return aOrder - bOrder;
  });

  const statusColors: Record<string, string> = {
    found: 'bg-green-50',
    insufficient: 'bg-yellow-50',
    missing: 'bg-red-50',
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(`/bom/${bomId}`)}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">BOM 比对结果</h1>
          <p className="text-sm text-slate-500 mt-1">
            {bomImport.original_name}
            {isConsumed && (
              <span className="ml-2 text-green-600 font-medium">
                · 已消耗 · {bomImport.consumed_at}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download size={16} />
              导出 CSV
              <span className="text-[10px] text-slate-400">({exportStatuses.length}种)</span>
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-2">
                <p className="px-3 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                  选择导出类型
                </p>
                {STATUS_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={exportStatuses.includes(opt.key)}
                      onChange={() => {
                        setExportStatuses((prev) =>
                          prev.includes(opt.key)
                            ? prev.filter((k) => k !== opt.key)
                            : [...prev, opt.key]
                        );
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={opt.color}>{opt.label}</span>
                  </label>
                ))}
                <div className="border-t border-slate-100 mt-1 pt-2 px-3">
                  <button
                    onClick={() => {
                      if (exportStatuses.length > 0) {
                        exportToCsv(items, bomImport.original_name, exportStatuses);
                        setExportOpen(false);
                      }
                    }}
                    disabled={exportStatuses.length === 0}
                    className="w-full px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    导出 {exportStatuses.length} 种状态
                  </button>
                </div>
              </div>
            )}
          </div>
          {!isConsumed && (
            <button
              onClick={() => setShowConsumeConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              <PackageCheck size={16} />
              消耗库存
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="总共" value={summary.total} color="text-blue-600" bgColor="bg-blue-50" icon={<Search size={24} />} />
        <SummaryCard label="库存充足" value={summary.found} color="text-green-600" bgColor="bg-green-50" icon={<CheckCircle2 size={24} />} />
        <SummaryCard label="库存不足" value={summary.insufficient} color="text-yellow-600" bgColor="bg-yellow-50" icon={<AlertTriangle size={24} />} />
        <SummaryCard label="缺少" value={summary.missing} color="text-red-600" bgColor="bg-red-50" icon={<XCircle size={24} />} />
      </div>

      {/* Buy List Warning */}
      {!isConsumed && needToBuy.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <ShoppingCart size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-800 text-sm">需要购买的物料</h3>
              <p className="text-xs text-amber-700 mt-1">
                共 {needToBuy.length} 种物料，需要补充 {needToBuyTotal} 个
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {needToBuy.map((item) => {
                  const shortage = Math.max(0, item.qty - (item.available_stock || 0));
                  return (
                    <span key={item.id} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs text-amber-800 border border-amber-200">
                      {item.part_number}
                      <span className="font-medium">+{shortage || item.qty}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consumed Success Banner */}
      {isConsumed && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-600" />
            <div>
              <h3 className="font-semibold text-green-800 text-sm">库存已消耗</h3>
              <p className="text-xs text-green-700 mt-1">
                已扣除 {willConsume} 个元器件库存，消耗 {summary.found + summary.insufficient} 种物料
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索型号..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: 'all', label: '全部', color: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
            { value: 'found', label: '充足', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
            { value: 'insufficient', label: '不足', color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
            { value: 'missing', label: '缺少', color: 'bg-red-100 text-red-700 hover:bg-red-200' },
          ].map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterStatus === value ? color : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">型号</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">描述</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">需要数量</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">可用库存</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">缺少</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">状态</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, index) => {
              const shortage = item.qty - (item.available_stock || 0);
              const rowColor = item.comparison_status ? statusColors[item.comparison_status] : '';

              return (
                <tr
                  key={item.id}
                  className={`border-b border-slate-100 ${rowColor} transition-colors`}
                >
                  <td className="px-4 py-3 text-sm text-slate-400">{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{item.part_number}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-800">{item.qty}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    <span
                      className={
                        item.comparison_status === 'found'
                          ? 'text-green-600'
                          : item.comparison_status === 'insufficient'
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }
                    >
                      {item.available_stock ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {item.comparison_status === 'missing' || item.comparison_status === 'insufficient' ? (
                      <span className="text-red-600">{shortage > 0 ? shortage : item.qty}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.comparison_status} />
                      {!isConsumed && (item.comparison_status === 'missing' || item.comparison_status === 'insufficient') && (
                        <button
                          onClick={() => { setPickerItemId(item.id); setPickerSearch(''); }}
                          className="p-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="选择替代元器件"
                        >
                          <RefreshCw size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 && (
          <div className="text-center py-8 text-sm text-slate-400">
            没有匹配的物料项
          </div>
        )}
      </div>

      {/* Component Picker Modal */}
      {pickerItemId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setPickerItemId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-800">选择替代元器件</h3>
              <button
                onClick={() => setPickerItemId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <XCircle size={18} />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="搜索型号、参数、描述..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {!pickerComponents || pickerComponents.data.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <Package size={32} className="text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">未找到匹配的元器件</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {pickerComponents.data.map((comp) => (
                    <button
                      key={comp.id}
                      onClick={() => {
                        const pickerItem = items.find(i => i.id === pickerItemId);
                        if (pickerItem) {
                          matchMutation.mutate({ itemId: pickerItem.id, componentId: comp.id });
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 text-left transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{comp.value || comp.part_number}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{comp.package || '-'}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {comp.description || comp.part_number}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-medium ${comp.quantity > 0 ? 'text-slate-800' : 'text-red-500'}`}>
                          {comp.quantity}
                        </p>
                        <p className="text-[10px] text-slate-400">库存</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {matchMutation.isPending && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-xl">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Consume Confirmation Dialog */}
      <ConfirmDialog
        open={showConsumeConfirm}
        title="确认消耗库存？"
        message={
          `将从库存中扣除 ${willConsume} 个元器件（${summary.found + summary.insufficient} 种物料）。\n` +
          (needToBuy.length > 0
            ? `另有 ${needToBuy.length} 种物料库存不足（缺 ${needToBuyTotal} 个），需要购买。`
            : '所有物料库存充足，无需额外购买。')
        }
        confirmLabel="确认消耗"
        variant="default"
        onConfirm={() => consumMutation.mutate()}
        onCancel={() => setShowConsumeConfirm(false)}
      />
    </div>
  );
}