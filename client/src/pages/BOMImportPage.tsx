import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bomApi } from '../api/bom';
import { StatusBadge } from '../components/shared/StatusBadge';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { Upload, FileSpreadsheet, Trash2, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export function BOMImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const { data: bomList, isLoading } = useQuery({
    queryKey: ['bom-list'],
    queryFn: () => bomApi.list(),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => bomApi.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setUploadError(null);
    },
    onError: (err: Error) => {
      setUploadError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bomApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-list'] });
      setDeleteTarget(null);
    },
  });

  const handleFile = (file: File) => {
    setUploadError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext || '')) {
      setUploadError('仅支持 .xlsx 和 .xls 文件格式');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('文件大小不能超过 10MB');
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">BOM 管理</h1>
        <p className="text-sm text-slate-500 mt-1">上传 Excel BOM 并与库存进行比对</p>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-8 ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400 bg-white'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Upload size={36} className="mx-auto text-slate-400 mb-3" />
        <p className="text-sm font-medium text-slate-700 mb-1">
          拖拽文件到此处或点击上传
        </p>
        <p className="text-xs text-slate-400">支持 .xlsx 和 .xls 格式，最大 10MB</p>

        {uploadMutation.isPending && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            上传中...
          </div>
        )}

        {uploadError && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-red-600">
            <AlertCircle size={14} />
            {uploadError}
          </div>
        )}
      </div>

      {/* BOM List */}
      {isLoading ? (
        <LoadingSpinner />
      ) : !bomList || bomList.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet size={48} />}
          title="暂无 BOM 记录"
          description="上传一个 Excel BOM 文件开始使用"
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">文件名</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">物料数</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">状态</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">导入时间</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody>
              {bomList.map((bom) => (
                <tr
                  key={bom.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/bom/${bom.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={16} className="text-green-600" />
                      <span className="text-sm font-medium text-slate-800">{bom.original_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{bom.total_items}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={bom.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{bom.created_at}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {bom.status === 'imported' && (
                        <button
                          onClick={() => navigate(`/bom/${bom.id}`)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                        >
                          开始比对
                        </button>
                      )}
                      {bom.status === 'compared' && (
                        <button
                          onClick={() => navigate(`/bom/${bom.id}/compare`)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100"
                        >
                          查看比对
                          <ArrowRight size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget({ id: bom.id, name: bom.original_name })}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除 BOM"
        message={`确定要删除 "${deleteTarget?.name}" 及其所有物料项吗？`}
        confirmLabel="删除"
        variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}