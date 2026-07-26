# ElecBin

[English Documentation](./README.md)

> Electronics Bin — 全栈元器件库存管理应用，支持 BOM（物料清单）管理。专为电子工程师和爱好者设计，用于管理元器件库存、导入 Excel BOM、与库存比对并跟踪消耗。

技术栈：React + Express + TypeScript + SQLite。

## 功能特性

### 📦 元器件管理
- **CRUD 操作** — 创建、读取、更新、删除元器件
- **搜索与筛选** — 按型号、描述或参数值搜索；按分类筛选
- **自定义列** — 显示/隐藏列，拖拽调整顺序，持久化到 localStorage
- **排序与分页** — 点击表头排序，支持分页浏览
- **低库存预警** — 库存低于最低阈值时显示视觉提示

### 📊 BOM（物料清单）管理
- **Excel 导入** — 拖拽上传 `.xlsx`/`.xls` 文件，智能列映射（支持中英文表头）
- **智能比对** — 按参数+封装 → 参数值 → 型号三种优先级匹配库存
- **可视化结果** — 颜色编码：充足（绿色）、不足（黄色）、缺少（红色）
- **手动匹配** — 可将缺少/不足的物料重新匹配到替代元器件
- **CSV 导出** — 按状态类型筛选导出比对结果
- **库存消耗** — 根据 BOM 比对结果扣除库存（SQLite 事务保障）

### 🖼️ 图片导入
- **OCR 识别** — 上传元器件图片或订单截图，通过 Tesseract.js 自动提取元器件数据
- **可编辑结果** — 导入前审核并修正 OCR 识别结果
- **智能解析** — 正则提取型号、参数值、封装和数量

### 📈 仪表盘
- **概览统计** — 元器件总数、分类数、低库存预警数、BOM 总数
- **低库存列表** — 快速查看低于最低库存的元器件
- **最近活动** — 最近添加的元器件和导入的 BOM

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18, TypeScript, Vite 5, Tailwind CSS 3 |
| **状态管理** | @tanstack/react-query（服务端状态） |
| **路由** | react-router-dom v6 |
| **图标** | lucide-react |
| **后端** | Express.js, TypeScript |
| **数据库** | SQLite（better-sqlite3，WAL 模式，外键约束） |
| **文件解析** | xlsx（Excel）, multer（文件上传） |
| **OCR** | Tesseract.js（从 CDN 加载） |

## 项目结构

```
elecbin/
├── client/                    # React 前端
│   └── src/
│       ├── api/               # API 客户端函数
│       │   ├── client.ts      # 通用 fetch 封装
│       │   ├── components.ts  # 元器件 CRUD
│       │   ├── bom.ts         # BOM 操作
│       │   └── dashboard.ts   # 仪表盘 API
│       ├── components/
│       │   ├── dashboard/     # 仪表盘页面组件
│       │   ├── layout/        # AppLayout, Sidebar 布局
│       │   └── shared/        # 可复用组件
│       ├── pages/             # 路由页面组件
│       ├── types/             # TypeScript 接口定义
│       └── styles/            # Tailwind CSS 入口
├── server/                    # Express 后端
│   └── src/
│       ├── db/                # 数据库连接与 schema
│       ├── routes/            # Express 路由处理
│       ├── services/          # 业务逻辑层
│       ├── middleware/        # 错误处理、异步路由包装
│       └── utils/             # Excel 解析器
├── test/                      # 测试用 BOM 文件
├── .env.example               # 环境变量参考
├── README.md                  # 英文文档
├── README-zh.md               # 中文文档
└── package.json               # 根工作区脚本
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装

```bash
# 安装所有依赖（服务端 + 客户端）
npm run install:all

# 或分别安装
cd server && npm install
cd ../client && npm install
```

### 开发

```bash
# 同时启动服务端和客户端（开发模式）
npm run dev

# 仅启动服务端（端口 3001）
npm run dev:server

# 仅启动客户端（端口 5173，自动代理 /api 到 :3001）
npm run dev:client
```

客户端开发服务器运行在 `http://localhost:5173`，自动将 `/api` 请求代理到后端 3001 端口。

### 生产构建

```bash
# 构建服务端和客户端
npm run build

# 服务端输出：server/dist/
# 客户端输出：client/dist/

# 启动生产服务器
cd server && npm start
```

## API 接口

### 元器件

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/components` | 元器件列表（搜索、筛选、排序、分页） |
| GET | `/api/components/categories` | 获取所有分类 |
| GET | `/api/components/low-stock` | 获取低库存元器件 |
| GET | `/api/components/:id` | 获取单个元器件 |
| POST | `/api/components` | 创建元器件 |
| PUT | `/api/components/:id` | 更新元器件 |
| DELETE | `/api/components/:id` | 删除元器件 |
| POST | `/api/components/import-from-text` | 批量导入（文本解析） |

### BOM

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bom` | 获取所有 BOM 导入记录 |
| GET | `/api/bom/:id` | 获取 BOM 详情及物料项 |
| POST | `/api/bom/upload` | 上传 BOM Excel 文件 |
| POST | `/api/bom/:id/compare` | 执行库存比对 |
| GET | `/api/bom/:id/compare` | 获取比对结果 |
| POST | `/api/bom/:id/consume` | 消耗库存 |
| DELETE | `/api/bom/:id` | 删除 BOM 导入记录 |
| PATCH | `/api/bom/:bomId/items/:itemId` | 更新物料备注 |
| PATCH | `/api/bom/:bomId/items/:itemId/match` | 手动匹配元器件 |

### 仪表盘

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard/stats` | 获取仪表盘统计数据 |
| GET | `/api/dashboard/recent-activity` | 获取最近活动 |

## 数据库

SQLite 数据库存储在 `server/data/inventory.db`，启动时自动创建表结构。

### 数据表

- **`components`** — 核心库存表：`part_number`（唯一）、`category`、`package`、`value`、`quantity`、`min_stock`、`location`
- **`bom_imports`** — BOM 文件上传记录：状态流转 `imported` → `compared` → `consumed`
- **`bom_items`** — BOM 物料明细：`comparison_status`（found/insufficient/missing）、匹配的元器件、可用库存

### BOM 比对算法

1. **优先级 1**：按 `value`（参数值）+ `package`（封装）匹配（最精确）
2. **优先级 2**：仅按 `value`（参数值）匹配
3. **优先级 3**：按精确 `part_number`（型号）匹配
4. 每个优先级取第一个匹配结果

## Excel 列映射

解析器支持中文和英文表头自动映射：

| 中文 | 英文 | 对应字段 |
|------|------|----------|
| 型号 | part number, pn, mpn, part | `part_number` |
| 描述 | description, desc, comment | `description` |
| 数量 | qty, quantity, count | `qty` |
| 位号/位置 | reference designator, refdes, ref | `reference_designators` |
| 封装 | footprint, package | `package` |
| 数值 | value | `value` |

## 环境变量

详见 `.env.example` 文件。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3001 | 服务端端口 |
| `NODE_ENV` | - | 运行环境（production/development） |

## 开发说明

- **API 响应格式**：所有接口统一返回 `{ success: boolean, data: T, error?: { message: string } }`
- **React Query 键**：`['components']`、`['component', id]`、`['bom-list']`、`['bom-detail', id]`、`['bom-compare', id]`、`['dashboard-stats']`、`['recent-activity']`、`['low-stock']`、`['categories']`
- **列可见性与顺序**：持久化到浏览器 `localStorage`
- **图片导入**：使用 Tesseract.js（从 CDN 加载），支持 `chi_sim+eng` 中英文识别