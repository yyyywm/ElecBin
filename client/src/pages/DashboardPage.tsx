import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { componentsApi } from '../api/components';
import { DashboardPage as DashboardPageComponent } from '../components/dashboard/DashboardPage';

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats(),
  });

  const { data: lowStock, isLoading: lowStockLoading } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => componentsApi.lowStock(),
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => dashboardApi.recentActivity(),
  });

  return (
    <DashboardPageComponent
      stats={stats || null}
      lowStock={lowStock || []}
      activity={activity || null}
      isLoading={statsLoading || lowStockLoading || activityLoading}
    />
  );
}