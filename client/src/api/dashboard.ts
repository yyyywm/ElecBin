import { api } from './client';
import { DashboardStats, RecentActivity } from '../types/dashboard';

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
  recentActivity: () => api.get<RecentActivity>('/dashboard/recent-activity'),
};