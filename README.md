# DemandIQ — AI-Powered Demand Forecasting & Smart Inventory Management Platform

DemandIQ is a full-stack enterprise decision-support platform designed to help retail and wholesale businesses predict product demand, prevent stockouts, monitor supplier delivery risk, optimize purchasing budgets, clear slow-moving inventory with margin-safe discounts, and act on explainable operational intelligence.

---

## Core Capabilities

- **Authentication & Multi-Tenant Ownership**: JWT bearer authentication, bcrypt password hashing, user-isolated records, and workspace settings.
- **Product & Supplier Management**: Complete CRUD, SKU uniqueness checks, category & stock-status filtering, sorting, pagination, and vendor delivery tracking.
- **Transactional Inventory & Sales**: Atomic stock additions/reductions/adjustments and multi-item POS sales with negative-stock prevention and database rollback protection.
- **AI Demand Forecasting (Pandas / NumPy / Scikit-learn)**: 7, 30, and 90-day horizons comparing Moving Average, Exponential Smoothing, Seasonal Naive, Random Forest, and Gradient Boosting on out-of-sample **MAE** and **RMSE**, with prediction intervals, trend classification, and transparent insufficient-data fallbacks.
- **Stockout Risk Prediction**: Real-time calculation of average daily demand, remaining days of stock, expected stockout date, and comparison against supplier lead times.
- **Budget-Aware Reorder Intelligence**: Priority-ranked purchasing plans constrained strictly within a user-specified budget (e.g. ₹50,000), with rationale and accept/reject workflow.
- **Intelligent Discount Recommendations**: Identifies slow-moving inventory and computes markdown percentages that never violate the configured minimum profit margin floor.
- **AI Decision Center**: Four-part explainable business insights (*What is happening*, *Why it is happening*, *Business impact*, *What to do next*), with optional Gemini narrative enrichment.
- **Supplier Delivery Risk Intelligence**: Tracks on-time vs delayed shipments, calculates delay percentages, and flags vendors with fewer than 3 historical delivery records.
- **Automated Deduplicated Alerts & 8-Chart BI Analytics**: Real-time alerts and interactive Recharts visualizations.

---

## Technology Stack

- **Frontend (`frontend/`)**: React 19, Vite, TypeScript, Tailwind CSS v4, Recharts, Lucide React, Axios, React Router v7
- **Backend (`backend/`)**: Python 3.11+, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, JWT (`python-jose`), bcrypt (`passlib`)
- **AI / ML**: Pandas, NumPy, Scikit-learn (`RandomForestRegressor`, `GradientBoostingRegressor`)
- **Database**: PostgreSQL (managed persistent PostgreSQL via `DATABASE_URL`)

---

## Project Structure

```text
DemandIQ/
├── frontend/                  # Independently deployable Vite + React SPA
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── vercel.json
│   └── .env.example
├── backend/                   # Independently deployable FastAPI + ML backend
│   ├── alembic/
│   ├── app/
│   │   ├── core/
│   │   ├── ml/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── database.py
│   │   └── main.py
│   ├── tests/
│   ├── alembic.ini
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── vercel.json
│   └── .env.example
├── scripts/
│   └── seed_database.py       # 6-month coherent demo dataset seeder
├── DEPLOYMENT.md
└── README.md
```

---

## Local Setup

### 1. Prerequisites
- Node.js 20+ and npm
- Python 3.11+
- PostgreSQL 15+ (local or managed cloud PostgreSQL such as Neon / Supabase / RDS)

### 2. Database & Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # Update DATABASE_URL and JWT_SECRET_KEY
```

Run Alembic migrations and seed the 6-month demo dataset:
```bash
alembic upgrade head
python ../scripts/seed_database.py
```

Start the FastAPI server:
```bash
uvicorn app.main:app --reload --port 8000
```
Interactive Swagger API documentation is available at `http://localhost:8000/docs`.

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env             # Set VITE_API_BASE_URL="http://localhost:8000"
npm run dev
```
Open `http://localhost:5173`. Demo credentials created by the seed script:
- Email: `demo@demandiq.ai`
- Password: `DemandIQ#2026`

*(Note: When `VITE_API_BASE_URL` is omitted, the frontend runs in Preview Sandbox Mode using an in-browser deterministic engine seeded with the same 6-month dataset.)*

---

## Automated Testing

Run the FastAPI integration and ML test suite with `pytest`:
```bash
cd backend
pytest -v
```
Tests cover registration, login, authorization, product/supplier CRUD, transactional stock movements, atomic sales with rollback on insufficient stock, forecasting accuracy & zero-history fallbacks, stockout risk rules, budget-capped reorder allocation, profit-margin-guarded discounts, supplier delay risk, alerts, and dashboard analytics.
