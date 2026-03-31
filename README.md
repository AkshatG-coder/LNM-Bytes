# 🍽️ LNM Bytes — Campus Food Ordering System

A full-stack food ordering platform built for LNM Institute of Information Technology. Students can browse menus, place orders, and track them in real-time while store owners manage their menu and daily operations.

## 📁 Project Structure

```
LNM-Bytes/
├── LNM_BYTES_BACKEND-dev/     # Node.js + Express + MongoDB REST API
├── LNM_BYTES_FRONTEND-dev/    # React + Vite (Customer-facing app)
└── Owner_page/                # React + Vite (Store owner management portal)
```

## 🚀 Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express.js, MongoDB, Mongoose |
| Auth | JWT (JSON Web Tokens), bcrypt |
| Customer Frontend | React 18, TypeScript, Vite, Context API |
| Owner Portal | React 18, TypeScript, Vite |
| Styling | Custom CSS with dark/light mode support |

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
- MongoDB (local or Atlas)

### Backend
```bash
cd LNM_BYTES_BACKEND-dev
npm install
# Create .env with MONGO_URI, JWT_SECRET, PORT
npm run dev
```

### Customer Frontend
```bash
cd LNM_BYTES_FRONTEND-dev
npm install
npm run dev
```

### Owner Portal
```bash
cd Owner_page
npm install
npm run dev
```

## 🔐 Environment Variables

**Backend** (`LNM_BYTES_BACKEND-dev/.env`):
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
