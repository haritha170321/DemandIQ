# DemandIQ Deployment Guide (GitHub + Vercel + Managed PostgreSQL)

DemandIQ is architected as two independently deployable Vercel projects backed by a managed PostgreSQL database.

---

## 1. GitHub Repository Setup

1. Initialize Git and verify `.env` files are ignored (only `.env.example` templates should be tracked):
   ```bash
   git init
   git add .
   git status
   git commit -m "Initial DemandIQ platform"
   ```
2. Push to a new GitHub repository:
   ```bash
   git remote add origin https://github.com/<your-org>/demandiq.git
   git branch -M main
   git push -u origin main
   ```

---

## 2. Managed PostgreSQL Configuration

Provision a managed PostgreSQL instance (e.g. Neon, Supabase, Railway, or AWS RDS).
1. Copy the SSL-enabled PostgreSQL connection string:
   ```text
   postgresql+psycopg2://USER:PASSWORD@HOST:5432/demandiq?sslmode=require
   ```
2. From your local machine (pointing `DATABASE_URL` to your managed database), apply the schema migrations and optionally seed demo records:
   ```bash
   cd backend
   export DATABASE_URL="postgresql+psycopg2://USER:PASSWORD@HOST:5432/demandiq?sslmode=require"
   alembic upgrade head
   python ../scripts/seed_database.py
   ```
   > **Note**: Production deployments use `NullPool` when `ENVIRONMENT=production` to prevent connection exhaustion across Vercel serverless invocations.

---

## 3. Project B: Backend Vercel Deployment (`backend/`)

1. In the Vercel Dashboard, click **Add New → Project** and import your GitHub repository.
2. Set **Root Directory** to `backend`.
3. Vercel automatically detects `backend/vercel.json` (`@vercel/python`) and `app/main.py`.
4. Configure **Environment Variables** in Vercel Project Settings:
   - `ENVIRONMENT`: `production`
   - `DATABASE_URL`: `postgresql+psycopg2://USER:PASSWORD@HOST:5432/demandiq?sslmode=require`
   - `JWT_SECRET_KEY`: *(generate a strong 32+ character random string)*
   - `JWT_ALGORITHM`: `HS256`
   - `ACCESS_TOKEN_EXPIRE_MINUTES`: `1440`
   - `CORS_ORIGINS`: `https://<your-frontend-domain>.vercel.app`
   - `MIN_PROFIT_MARGIN_PCT`: `10.0`
   - `GEMINI_API_KEY`: *(optional, for natural-language decision summaries)*
5. Deploy and verify `https://<your-backend-domain>.vercel.app/api/health` returns:
   ```json
   {"status": "healthy", "service": "demandiq-api"}
   ```

---

## 4. Project A: Frontend Vercel Deployment (`frontend/`)

1. In the Vercel Dashboard, create a **second** project importing the same GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Verify build settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Configure **Environment Variables**:
   - `VITE_API_BASE_URL`: `https://<your-backend-domain>.vercel.app`
5. Deploy. `frontend/vercel.json` handles SPA client-side routing rewrites (`/(.*) -> /index.html`).

---

## 5. CORS & Production Verification

1. Once the frontend receives its production URL (e.g. `https://demandiq-app.vercel.app`), update `CORS_ORIGINS` on the **Backend** Vercel project to include the exact frontend origin (comma-separated, no trailing slash) and redeploy the backend.
2. Open the frontend production URL:
   - Verify `/login` authenticates against `POST /api/auth/login`.
   - Verify `/docs` on the backend URL renders interactive Swagger docs.
   - Create a product or record a sale and confirm persistence across page reloads.

---

## 6. Redeploying After Updates

1. Push changes to `main` on GitHub — Vercel automatically triggers isolated builds for `frontend/` and/or `backend/`.
2. If SQLAlchemy models change, generate and apply an Alembic migration before deploying:
   ```bash
   cd backend
   alembic revision --autogenerate -m "describe_change"
   alembic upgrade head
   ```
