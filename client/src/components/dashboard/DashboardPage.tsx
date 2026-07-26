import { DashboardStats, RecentActivity } from '../../types/dashboard';
import { Component } from '../../types/component';

interface DashboardPageProps {
  stats: DashboardStats | null;
  lowStock: Component[];
  activity: RecentActivity | null;
  isLoading: boolean;
}

function StatCard({ title, value, color }: { title: string; value: number | string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500 mb-1">{title}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function DashboardPage({ stats, lowStock, activity, isLoading }: DashboardPageProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">仪表盘</h1>
        <p className="text-sm text-slate-500 mt-1">元器件库存概览</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="元器件总数" value={stats?.totalComponents ?? 0} color="text-blue-600" />
        <StatCard title="分类数量" value={stats?.totalCategories ?? 0} color="text-purple-600" />
        <StatCard
          title="低库存预警"
          value={stats?.lowStockCount ?? 0}
          color={(stats?.lowStockCount ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}
        />
        <StatCard title="BOM 总数" value={stats?.totalBOMs ?? 0} color="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">低库存元器件</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">暂无低库存元器件</p>
          ) : (
            <div className="space-y-3">
              {lowStock.slice(0, 10).map((comp) => (
                <div key={comp.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{comp.part_number}</p>
                    <p className="text-xs text-slate-400">{comp.description || comp.value}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-red-600">{comp.quantity}</p>
                    <p className="text-xs text-slate-400">最低: {comp.min_stock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">最近活动</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">最近添加的元器件</h3>
              {activity?.recentComponents?.length ? (
                <div className="space-y-2">
                  {activity.recentComponents.map((comp) => (
                    <div key={comp.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{comp.part_number}</span>
                      <span className="text-slate-400">数量: {comp.quantity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">暂无</p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">最近导入的 BOM</h3>
              {activity?.recentBOMs?.length ? (
                <div className="space-y-2">
                  {activity.recentBOMs.map((bom) => (
                    <div key={bom.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{bom.original_name}</span>
                      <span className="text-slate-400">{bom.total_items} 项</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">暂无</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}