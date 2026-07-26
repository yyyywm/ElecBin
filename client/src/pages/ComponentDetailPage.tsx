import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { componentsApi } from '../api/components';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ArrowLeft, Save } from 'lucide-react';

const CATEGORIES = [
  'Resistor', 'Capacitor', 'Inductor', 'Diode', 'Transistor',
  'IC', 'Connector', 'Crystal/Oscillator', 'Relay', 'Switch',
  'Sensor', 'Module', 'Hardware', 'PCB', 'Other', 'Uncategorized',
];

export function ComponentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState({
    part_number: '',
    description: '',
    category: 'Uncategorized',
    package: '',
    value: '',
    quantity: 0,
    location: '',
    min_stock: 0,
    notes: '',
  });

  const { data: component, isLoading } = useQuery({
    queryKey: ['component', id],
    queryFn: () => componentsApi.getById(parseInt(id!)),
    enabled: !isNew,
  });

  useEffect(() => {
    if (component && !isNew) {
      setForm({
        part_number: component.part_number,
        description: component.description,
        category: component.category,
        package: component.package,
        value: component.value,
        quantity: component.quantity,
        location: component.location,
        min_stock: component.min_stock,
        notes: component.notes,
      });
    }
  }, [component, isNew]);

  const createMutation = useMutation({
    mutationFn: () => componentsApi.create(form),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      navigate(`/components/${data.id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => componentsApi.update(parseInt(id!), form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      queryClient.invalidateQueries({ queryKey: ['component', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNew) {
      createMutation.mutate();
    } else {
      updateMutation.mutate();
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (!isNew && isLoading) return <LoadingSpinner />;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/components')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isNew ? '添加元器件' : '编辑元器件'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isNew ? '输入新元器件的详细信息' : `编辑 ${component?.part_number}`}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Value — most important field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                参数值 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.value}
                onChange={(e) => handleChange('value', e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 10kΩ, 100nF"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">分类</label>
              <select
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 10kΩ ±1% 0805"
              />
            </div>

            {/* Package */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">封装</label>
              <input
                type="text"
                value={form.package}
                onChange={(e) => handleChange('package', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 0805, SOT-23"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                数量 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 0)}
                min={0}
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Part Number — moved down, less important */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">型号</label>
              <input
                type="text"
                value={form.part_number}
                onChange={(e) => handleChange('part_number', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. CL10A105KB8NNNC"
              />
            </div>

            {/* Min Stock */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">最低库存预警</label>
              <input
                type="number"
                value={form.min_stock}
                onChange={(e) => handleChange('min_stock', parseInt(e.target.value) || 0)}
                min={0}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">存放位置</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Drawer A1"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
              <textarea
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="可选备注信息..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving || !form.value}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={16} />
              {isSaving ? '保存中...' : isNew ? '创建' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/components')}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}