# ElecBin

[中文文档](./README-zh.md)

> Electronics Bin — A full-stack component inventory management application with BOM (Bill of Materials) support, designed for electronics engineers and hobbyists to manage their component stock, import BOMs from Excel, compare against inventory, and track consumption.

Built with React + Express + TypeScript + SQLite.

## Features

### 📦 Component Management
- **CRUD operations** — Create, read, update, and delete components
- **Search & filter** — Search by part number, description, or value; filter by category
- **Customizable columns** — Show/hide columns and reorder via drag-and-drop, persisted to localStorage
- **Sort & pagination** — Sort by any column, paginated listing
- **Low stock alerts** — Visual indicators when stock falls below minimum threshold

### 📊 BOM (Bill of Materials) Management
- **Excel import** — Drag-and-drop `.xlsx`/`.xls` upload with smart column mapping (supports Chinese and English headers)
- **Inventory comparison** — Suggests inventory matches based on text similarity across part numbers, values, descriptions, and packages
- **Visual results** — Shows BOM packages and quantities to buy, with search by part number or package and filters by stock status
- **Manual matching** — Reassign missing/insufficient items to alternative components
- **CSV export** — Export comparison results filtered by status type
- **Inventory consumption** — Deduct stock based on BOM comparison results (transactional, SQLite transactions)

### 🖼️ Image Import
- **OCR-based import** — Upload component images or order screenshots, auto-extract component data via Tesseract.js
- **Editable results** — Review and correct OCR output before importing into inventory
- **Smart parsing** — Regex-based extraction of part numbers, values, packages, and quantities

### 📈 Dashboard
- **Stats overview** — Total components, categories, low stock count, BOM count
- **Low stock list** — Quick view of components below minimum stock
- **Recent activity** — Recently added components and BOM imports

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS 3 |
| **State Management** | @tanstack/react-query (server state) |
| **Routing** | react-router-dom v6 |
| **Icons** | lucide-react |
| **Backend** | Express.js, TypeScript |
| **Database** | SQLite via better-sqlite3 (WAL mode, foreign keys) |
| **File Parsing** | xlsx (Excel), multer (uploads) |
| **OCR** | Tesseract.js (loaded from CDN) |

## Project Structure

```
elecbin/
├── client/                    # React frontend
│   └── src/
│       ├── api/               # API client functions
│       │   ├── client.ts      # Generic fetch wrapper
│       │   ├── components.ts  # Component CRUD
│       │   ├── bom.ts         # BOM operations
│       │   └── dashboard.ts   # Dashboard API
│       ├── components/
│       │   ├── dashboard/     # Dashboard page component
│       │   ├── layout/        # AppLayout, Sidebar
│       │   └── shared/        # Reusable components
│       ├── pages/             # Route page components
│       ├── types/             # TypeScript interfaces
│       └── styles/            # Tailwind CSS entry
├── server/                    # Express backend
│   └── src/
│       ├── db/                # Database connection & schema
│       ├── routes/            # Express route handlers
│       ├── services/          # Business logic layer
│       ├── middleware/        # Error handler, async handler wrapper
│       └── utils/             # Excel parser
├── test/                      # Test BOM files
├── .env.example               # Environment variable reference
├── README.md                  # English documentation
├── README-zh.md               # Chinese documentation
└── package.json               # Root workspace scripts
```

## Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
# Install all dependencies (server + client)
npm run install:all

# Or install individually
cd server && npm install
cd ../client && npm install
```

### Development

```bash
# Start both server and client in dev mode (concurrent)
npm run dev

# Start only server (port 3001)
npm run dev:server

# Start only client (port 5173, proxies /api to :3001)
npm run dev:client
```

The client dev server runs on `http://localhost:5173` and proxies `/api` requests to the backend on port 3001.

### Production Build

```bash
# Build both server and client
npm run build

# Server output: server/dist/
# Client output: client/dist/

# Start production server
cd server && npm start
```

## Check BOM Packages and Shortages

1. Import the Excel BOM and start the inventory comparison from the BOM details. The first worksheet can use `Package`, `Footprint`, or `封装` as the package column header. To preserve leading zeros in packages such as `0603`, format the cells as text before entering the values.
2. Check the required package in the **BOM 封装** (BOM package) column. The purchase summary lists each missing or insufficient BOM line with its part number, required package, and quantity to buy. Blank package values are marked as unspecified. To fill them in, update the source spreadsheet and import it again.
3. Select **待采购** (To buy) to see both missing and insufficient items. Search the table by any part of a part number or package, such as `SOD-323`, to narrow the list further. CSV export uses the statuses selected in its own menu. The `Package` column contains the BOM package.

Before choosing a substitute or deducting stock, check the actual part number, package, and pinout of the inventory component. The comparison status reflects the quantity of the current match.

## API Endpoints

### Components

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/components` | List components (search, filter, sort, paginate) |
| GET | `/api/components/categories` | Get distinct categories |
| GET | `/api/components/low-stock` | Get low stock items |
| GET | `/api/components/:id` | Get single component |
| POST | `/api/components` | Create component |
| PUT | `/api/components/:id` | Update component |
| DELETE | `/api/components/:id` | Delete component |
| POST | `/api/components/import-from-text` | Batch import components from parsed text |

### BOM

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bom` | List all BOM imports |
| GET | `/api/bom/:id` | Get BOM import with items |
| POST | `/api/bom/upload` | Upload BOM Excel file |
| POST | `/api/bom/:id/compare` | Run comparison against inventory |
| GET | `/api/bom/:id/compare` | Get cached comparison results |
| POST | `/api/bom/:id/consume` | Consume inventory for this BOM |
| DELETE | `/api/bom/:id` | Delete BOM import |
| PATCH | `/api/bom/:bomId/items/:itemId` | Update item notes |
| PATCH | `/api/bom/:bomId/items/:itemId/match` | Manually match item to component |

### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard statistics |
| GET | `/api/dashboard/recent-activity` | Get recent activity |

## Database

SQLite database stored at `server/data/inventory.db`. Schema is auto-created on startup.

### Tables

- **`components`** — Core inventory: `part_number` (unique), `category`, `package`, `value`, `quantity`, `min_stock`, `location`
- **`bom_imports`** — BOM file uploads: status lifecycle `imported` → `compared` → `consumed`
- **`bom_items`** — BOM line items: `comparison_status` (found/insufficient/missing), matched components, available stock

### BOM Comparison Algorithm

Automatic comparison scores text similarity across the part number, value, description, and package fields of each BOM line and inventory record. The highest score from any field pair becomes the candidate's score. Candidates are assigned from highest to lowest score, with at most one automatic assignment per BOM line and inventory record. A shared value or package can produce a match, so check physical compatibility before using the part.

## Excel Column Mapping

The parser supports both Chinese and English column headers:

| Chinese | English | Field |
|---------|---------|-------|
| 型号 | part number, pn, mpn, part | `part_number` |
| 描述 | description, desc, comment | `description` |
| 数量 | qty, quantity, count | `qty` |
| 位号/位置 | reference designator, refdes, ref | `reference_designators` |
| 封装 | footprint, package | `package` |
| 数值 | value | `value` |

## Environment Variables

See `.env.example` for available configuration options.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `NODE_ENV` | - | Environment mode (production/development) |

## Development Notes

- **API response format**: All endpoints return `{ success: boolean, data: T, error?: { message: string } }`
- **React Query keys**: `['components']`, `['component', id]`, `['bom-list']`, `['bom-detail', id]`, `['bom-compare', id]`, `['dashboard-stats']`, `['recent-activity']`, `['low-stock']`, `['categories']`
- **Column visibility & order**: Persisted to `localStorage` per browser
- **Image import**: Uses Tesseract.js from CDN for OCR with `chi_sim+eng` language support
