# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start both client & server (dev mode)
npm run dev

# Start only server (port 3001)
npm run dev:server

# Start only client (port 5173, proxies /api to :3001)
npm run dev:client

# Install deps for both server and client
npm run install:all

# Build both
npm run build
```

## Project Structure

# ElecBin (Electronics Bin)

**Full-stack component inventory management app** with BOM (Bill of Materials) support. UI is in Chinese.

### Client (`client/`) — React 18 + Vite 5 + TypeScript + Tailwind CSS 3

| Path | Purpose |
|------|---------|
| `src/api/client.ts` | Generic fetch wrapper, handles `{ success, data, error }` response format |
| `src/api/components.ts` | Component CRUD API calls |
| `src/api/bom.ts` | BOM upload/compare/consume API calls |
| `src/api/dashboard.ts` | Dashboard stats/recent activity API calls |
| `src/pages/DashboardPage.tsx` | Container that fetches data and delegates to `DashboardPage` component |
| `src/pages/ComponentsPage.tsx` | Component list with search, filter, sort, pagination, customizable columns |
| `src/pages/ComponentDetailPage.tsx` | Create/edit form (shared for new and existing) |
| `src/pages/BOMImportPage.tsx` | Excel upload via drag-drop or file picker |
| `src/pages/BOMDetailPage.tsx` | BOM item list with compare trigger |
| `src/pages/BOMComparePage.tsx` | Side-by-side comparison results, CSV export, inventory consumption |
| `src/pages/ImageImportPage.tsx` | OCR-based import from images via Tesseract.js |
| `src/components/shared/` | Reusable: LoadingSpinner, EmptyState, StatusBadge, SearchInput, ConfirmDialog, ErrorBoundary, Toast |

### Server (`server/`) — Express + TypeScript + better-sqlite3 + tsx (dev runner)

| Path | Purpose |
|------|---------|
| `src/index.ts` | Entry: init DB, listen on port 3001 |
| `src/app.ts` | Express app setup (cors, json, routes, error handler) |
| `src/db/schema.ts` | SQLite schema: `components`, `bom_imports`, `bom_items`, `categories` |
| `src/db/connection.ts` | Singleton better-sqlite3 connection (WAL mode, foreign keys) |
| `src/routes/components.ts` | CRUD + categories + low-stock + batch import endpoints |
| `src/routes/bom.ts` | Upload Excel, compare, get comparison, consume, delete |
| `src/routes/dashboard.ts` | Stats + recent activity |
| `src/services/componentService.ts` | Business logic: query builder, stock validation, uniqueness checks |
| `src/services/bomService.ts` | Business logic: Excel parsing, comparison algorithm, inventory consumption |
| `src/services/dashboardService.ts` | Aggregation queries for dashboard |
| `src/utils/excelParser.ts` | XLSX parsing with smart column mapping (Chinese/English headers) |
| `src/middleware/errorHandler.ts` | Global Express error handler |
| `src/middleware/asyncHandler.ts` | Async route handler wrapper (eliminates try-catch boilerplate) |

### Key Libraries

- **Client**: `@tanstack/react-query` (server state), `react-router-dom` v6 (routing), `lucide-react` (icons), Tailwind CSS 3 (styling)
- **Server**: `better-sqlite3` (SQLite), `multer` (file uploads), `xlsx` (Excel parsing), `cors`

## Database

SQLite stored at `server/data/inventory.db`. Schema is auto-created on startup via `initDatabase()`.

**`components`** — Core inventory table with `part_number` (unique), `category`, `package`, `value`, `quantity`, `min_stock`, `location`.

**`bom_imports`** — Tracks uploaded BOM files through status lifecycle: `imported` → `compared` → `consumed`.

**`bom_items`** — Line items from BOM files. `comparison_status` tracks match results: `found` | `insufficient` | `missing`.

## Key Patterns

- **API response format**: consistently `{ success: boolean, data: T, error?: { message: string } }` across all endpoints
- **React Query keys**: `['components']`, `['component', id]`, `['bom-list']`, `['bom-detail', id]`, `['bom-compare', id]`, `['dashboard-stats']`, `['recent-activity']`, `['low-stock']`, `['categories']`
- **BOM comparison**: Priority 1: match by value+package, Priority 2: match by value, Priority 3: match by part_number. Uses the first match found.
- **BOM items now include `value`, `package`, `notes` columns**: Value/package are extracted from the Excel during upload. Notes are editable inline in the comparison results page (onBlur save via `PATCH /api/bom/:bomId/items/:itemId`).
- **Inventory consumption**: Deducts from `components.quantity` based on BOM comparison results, marks BOM as `consumed`. Uses SQLite transactions.
- **Excel column mapping**: `excelParser.ts` maps Chinese/English column headers (e.g., 型号→part_number, 数量→qty, 位号→reference_designators) using a `COLUMN_MAP` lookup.
- **Image import**: Uses Tesseract.js (loaded from CDN) for OCR, then regex-based text parsing to extract components. Supports `chi_sim+eng` language.
- **Vite proxy**: Dev server on 5173 proxies `/api` requests to backend on 3001.
- **Customizable columns**: Component list table columns are user-configurable, persisted to `localStorage`.
- **Route handlers**: Use `asyncHandler` wrapper middleware to eliminate try-catch boilerplate. Errors are forwarded to the global error handler.
- **Error boundary**: React ErrorBoundary wraps the app to catch render errors gracefully.
- **Toast notifications**: ToastProvider context provides success/error/info notifications throughout the app.