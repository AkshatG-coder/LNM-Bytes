# 🍽️ LNM Bytes — Campus Food Ordering System

A full-stack food ordering platform built for LNM Institute of Information Technology. Students can browse menus, place orders, and track them in real-time while store owners manage their menu and daily operations.

## 📁 Project Structure

```
LNM-Bytes/
├── apps/
│   ├── backend/               # Node.js + Express + MongoDB REST API
│   ├── user-web/              # React 19 + Vite (Customer-facing app)
│   └── owner-web/             # React 19 + Vite (Store owner management portal)
├── packages/
│   └── types/                 # Shared TypeScript models, enums & contracts
├── package.json               # Root workspace scripts (pnpm dev, pnpm build)
├── pnpm-workspace.yaml        # Workspace configuration
└── turbo.json                 # Turborepo task pipeline
```

## 🚀 Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo, pnpm workspaces |
| Backend | Node.js, Express.js, MongoDB, Mongoose, TypeScript |
| Auth | JWT (JSON Web Tokens), bcrypt |
| Customer Frontend | React 19, TypeScript, Vite, Redux Toolkit, Tailwind CSS |
| Owner Portal | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Shared Contracts | `@lnm-bytes/types` |

## ✨ Features

### Customer App
- 🔐 Authentication (Login/Register)
- 🛍️ Browse menu by store/category
- 🛒 Cart management with quantity controls
- 📦 Order placement and tracking

### Owner Portal
- 🔐 Owner authentication (JWT-based)
- 📋 Menu management (Add/Edit/Delete items)
- 📊 Daily sales analytics
- 🛎️ Order management dashboard

## 🛠️ Setup & Installation

### Prerequisites
- Node.js v18+
- pnpm v9+ (`corepack enable` or `npm i -g pnpm`)
- MongoDB (local or Atlas)

### 1. Install all dependencies (single command)
```bash
pnpm install
```

### 2. Configure Environment Variables
Create `.env` inside `apps/backend/`:
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
```

### 3. Run entire stack concurrently
```bash
pnpm dev
```
This boots:
- Backend on `http://localhost:5000`
- Customer App on `http://localhost:5173`
- Owner App on `http://localhost:5174`

### 4. Build all apps (with Turborepo caching)
```bash
pnpm build
```

## 🔐 Environment Variables

**Backend** (`apps/backend/.env`):
```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
```

**Frontends** (`.env` in each frontend folder):
```
VITE_API_URL=http://localhost:5000
```

> ⚠️ Never commit `.env` files. They are listed in `.gitignore`.

## 👨‍💻 Author

**Akshat Gupta** — [@AkshatG-coder](https://github.com/AkshatG-coder)

---

*Built as part of B.Tech Project (BTP) at LNMIIT*
