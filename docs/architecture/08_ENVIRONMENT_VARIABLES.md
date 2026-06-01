# Environment Variable Schema & Security Practices

This document defines the comprehensive environment variables list, validation criteria, and secret management processes for the **Market Surface Projection Engine (MSPE)**.

---

## 1. Backend & Workers Environment Variables (`backend/.env.template`)

These variables are validated at startup using a custom Pydantic `BaseSettings` object in `backend/app/core/config.py`.

### 1.1 Application Metadata & Security
```bash
# Environment Mode: 'development' | 'staging' | 'production'
ENV=development

# Application Listening Port
PORT=8000

# JSON API Log Level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'
LOG_LEVEL=INFO

# Security: ECDSA or HS256 Secret key for JSON Web Tokens (JWT)
# Generate with: openssl rand -hex 32
SECRET_KEY=9a1f28b7e61a29f8c6e28a502cd8ff82a1768222b918f0fcd6be841b9e28acab

# JWT Parameters
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Allowed CORS Origins (comma-separated for security validation)
CORS_ORIGINS=http://localhost:3000,https://mspe.trading
```

### 1.2 Relational Database Configuration
```bash
# Primary database connection string for Celery workers & bulk writes (PgBouncer Transaction Pool)
DATABASE_URL=postgresql://postgres.uuid:secure_password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# Async connection string for FastAPI endpoints (using asyncpg driver)
ASYNC_DATABASE_URL=postgresql+asyncpg://postgres.uuid:secure_password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### 1.3 Caching & Celery Message Broker
```bash
# Redis URL for memory storage and pub/sub surface fit streaming
REDIS_URL=redis://:redis_password@railway-redis-instance:6379/0

# Celery Queue Configurations
CELERY_BROKER_URL=redis://:redis_password@railway-redis-instance:6379/1
CELERY_RESULT_BACKEND=redis://:redis_password@railway-redis-instance:6379/2
```

### 1.4 Institutional Market Data Feeds
```bash
# Polygon.io API Credentials for options ticks & equity bars
POLYGON_API_KEY=your_polygon_api_key_here

# Kaiko / CoinAPI Credentials for Crypto Volatility metrics
KAIKO_API_KEY=your_kaiko_api_key_here
COINAPI_KEY=your_coinapi_key_here

# Interactive Brokers Gateway Connection URL (for local sandbox/live trading routes)
IB_GATEWAY_URL=http://127.0.0.1:4001
```

### 1.5 Quantitative & CUDA Performance Configurations
```bash
# Limit the maximum number of simulation paths allowed to protect container memory boundaries
MAX_MC_PATHS=100000

# Toggle PyTorch GPU execution (0 = CPU only, 1 = GPU/CUDA Enabled)
MC_CUDA_ENABLED=0

# Surface Fit calibration interval (in seconds)
CALIBRATION_FREQUENCY_SECONDS=15
```

---

## 2. Frontend Environment Variables (`frontend/.env.local`)

These variables are bundled during the Next.js build phase. Publicly accessible parameters are prefixed with `NEXT_PUBLIC_` to be securely exposed in client-side WebGL/Three.js bundles.

```bash
# Backend REST API server endpoint
NEXT_PUBLIC_API_URL=https://api.mspe.trading

# Real-time WebSocket Volatility Stream Server endpoint
NEXT_PUBLIC_WS_URL=wss://api.mspe.trading/ws/v1/surfaces/live
```

---

## 3. Production Secrets Management & Rotation Policies

1.  **Zero Hardcoded Secrets**:
    No production secrets are committed to Github. All parameters are injected as environment variables in the Vercel and Railway dashboard settings.
2.  **Environment Variable Precedence**:
    In production, variables declared in Railway / Vercel take precedence over local `.env` files.
3.  **Credential Rotation**:
    *   **Market Data API Keys**: Rotated bi-annually.
    *   **PostgreSQL / Supabase password**: Rotated immediately if a database administrator leaves or once per year.
    *   **SECRET_KEY**: Rotated only during scheduled platform maintenance since rotation invalidates active user sessions.
