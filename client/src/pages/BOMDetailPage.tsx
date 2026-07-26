import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bomApi } from '../api/bom';
import { StatusBadge } from '../components/shared/StatusBadge';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ArrowLeft, BarChart3, RefreshCw } from 'lucide-react';

export function BOMDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bomId = parseInt(id!);

  const { data, isLoading, error } = useQuery({
    queryKey: ['bom-detail', bomId],
    queryFn: () => bomApi.getById(bomId),
    enabled: !isNaN(bomId),
  });

  const compareMutation = useMutation({
    mutationFn: () => bomApi.compare(bomId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bom-detail', bomId] });
      queryClient.invalidateQueries({ queryKey: ['bom-list'] });
      navigate(`/bom/${bomId}/compare`, { state: { result } });
    },
  });

  if (isLoading) return <LoadingSpinner />;

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">BOM 记录未找到</p>
        <button onClick={() => navigate('/bom')} className="mt-4 text-blue-600 hover:underline text-sm">
          返回 BOM 列表
        </button>
      </div>
    );
  }

  const { import: bomImport, items } = data;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/bom')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{bomImport.original_name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            导入时间: {bomImport.created_at} | 物料项: {bomImport.total_items}
            <span className="ml-2">
              <StatusBadge status={bomImport.status} />
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          {bomImport.status === 'compared' && (
            <button
              onClick={() => navigate(`/bom/${bomId}/compare`)}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <BarChart3 size={16} />
              查看比对结果
            </button>
          )}
          <button
            onClick={() => compareMutation.mutate()}
            disabled={compareMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={compareMutation.isPending ? 'animate-spin' : ''} />
            {bomImport.status === 'compared' ? '重新比对' : '开始比对'}
          </button>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">参数</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">封装</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">描述</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">数量</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">位号</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">型号</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">比对状态</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={item.id}
                className={`border-b border-slate-100 ${
                  item.comparison_status === 'missing'
                    ? 'bg-red-50'
                    : item.comparison_status === 'insufficient'
                    ? 'bg-yellow-50'
                    : ''
                }`}
              >
                <td className="px-4 py-3 text-sm text-slate-400">{index + 1}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{item.value || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{item.package || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{item.description}</td>
                <td className="px-4 py-3 text-sm text-right text-slate-800">{item.qty}</td>
                <td className="px-4 py-3 text-sm text-slate-500 max-w-[150px] truncate">{item.reference_designators}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{item.part_number}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.comparison_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}