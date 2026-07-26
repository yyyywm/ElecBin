import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ComponentsPage } from './pages/ComponentsPage';
import { ComponentDetailPage } from './pages/ComponentDetailPage';
import { BOMImportPage } from './pages/BOMImportPage';
import { BOMDetailPage } from './pages/BOMDetailPage';
import { BOMComparePage } from './pages/BOMComparePage';
import { ImageImportPage } from './pages/ImageImportPage';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { ToastProvider } from './components/shared/Toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <ErrorBoundary>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/components" element={<ComponentsPage />} />
                <Route path="/components/new" element={<ComponentDetailPage />} />
                <Route path="/components/:id" element={<ComponentDetailPage />} />
                <Route path="/bom" element={<BOMImportPage />} />
                <Route path="/bom/:id" element={<BOMDetailPage />} />
                <Route path="/bom/:id/compare" element={<BOMComparePage />} />
                <Route path="/import-image" element={<ImageImportPage />} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}