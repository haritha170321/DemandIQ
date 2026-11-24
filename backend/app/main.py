from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routes import auth, intelligence, inventory, products, sales, suppliers

settings = get_settings()

app = FastAPI(
    title="DemandIQ API",
    version="1.0.0",
    description="AI-Powered Demand Forecasting and Smart Inventory Management REST API",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(suppliers.router)
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(intelligence.router)


@app.get("/")
def root():
    return {
        "name": "DemandIQ API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }
