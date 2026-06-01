# Repository Structure & Folder Hierarchy

This document outlines the professional monorepo directory layout for the **Market Surface Projection Engine (MSPE)**. It separates high-performance quantitative modules, backend services, relational database structures, and the Next.js/Three.js frontend.

---

## 1. Directory Tree Overview

```text
mspe-monorepo/
├── .github/                         # CI/CD Workflows (GitHub Actions)
│   └── workflows/
│       ├── test-quant.yml           # Runs pytest on mathematical & simulation engines
│       ├── test-backend.yml         # Runs FastAPI backend validation
│       └── deploy.yml               # Production deployment triggers
├── backend/                         # FastAPI Application & Quantitative Workers
│   ├── app/                         # Application logic core
│   │   ├── api/                     # API routes, middleware, and rate-limiting
│   │   │   ├── dependencies/        # DB, Auth, and service injection dependencies
│   │   │   ├── v1/                  # API endpoints v1
│   │   │   │   ├── assets.py        # Underlyings & option chains lookup
│   │   │   │   ├── surfaces.py      # Volatility fitting & historical lookups
│   │   │   │   ├── projections.py   # Monte Carlo projections & ML runs
│   │   │   │   ├── risk.py          # Greeks, VaR, and stress tests
│   │   │   │   └── signals.py       # Systematic signal engine interface
│   │   │   ├── router.py            # Main API router binding v1
│   │   │   └── websockets.py        # Real-time surface/projection streamers
│   │   ├── core/                    # Application global configurations
│   │   │   ├── config.py            # Pydantic BaseSettings model
│   │   │   ├── security.py          # Auth validation & encryption
│   │   │   └── logging.py           # Structured JSON log configurations
│   │   ├── db/                      # DB Sessions and Engine setup
│   │   │   ├── base.py              # Declarative base imports for Alembic
│   │   │   ├── session.py           # DB pool and session management
│   │   │   └── base_class.py        # Custom primary/timestamp mixins
│   │   ├── models/                  # SQLAlchemy ORM Model entities
│   │   │   ├── asset.py
│   │   │   ├── market_data.py
│   │   │   ├── volatility.py
│   │   │   ├── model_run.py
│   │   │   ├── risk.py
│   │   │   └── signal.py
│   │   ├── schemas/                 # Pydantic schemas (Request/Response validation)
│   │   │   ├── asset.py
│   │   │   ├── market_data.py
│   │   │   ├── volatility.py
│   │   │   ├── model_run.py
│   │   │   ├── risk.py
│   │   │   └── signal.py
│   │   ├── services/                # Business logic orchestrators
│   │   │   ├── ingestion.py         # Handles high-frequency options/underlying streams
│   │   │   ├── calibration.py       # Manages surface fit tasks (SVI, SABR)
│   │   │   ├── projection.py        # Orchestrates ML + Monte Carlo runs
│   │   │   ├── risk.py              # Greeks calculation and stress engine
│   │   │   └── signal.py            # Compiles and monitors trades/arbitrages
│   │   ├── workers/                 # Background task queues (Celery)
│   │   │   ├── celery_app.py        # Worker initialization
│   │   │   ├── tasks/
│   │   │   │   ├── ingestion_tasks.py
│   │   │   │   ├── fitting_tasks.py # Background surface calibration jobs
│   │   │   │   └── mc_tasks.py      # Background heavy Monte Carlo path tasks
│   │   │   └── config.py            # Redis/RabbitMQ queue parameters
│   │   └── main.py                  # ASGI entry point for FastAPI
│   │   
│   ├── quant/                       # Pure Computational Volatility & ML Package
│   │   ├── __init__.py
│   │   ├── core/                    # Common numerical & linear algebra helpers
│   │   │   └── math_utils.py        # Cubic spline, Root-finding, Integration
│   │   ├── volatility/              # Volatility Fitting & Calibration
│   │   │   ├── base.py              # BaseVolatilityModel abstract class
│   │   │   ├── svi.py               # Stochastic Volatility Inspired (Gatheral)
│   │   │   ├── sabr.py              # SABR Model calibration (Hagan analytical approximation)
│   │   │   ├── heston.py            # Heston Semi-Analytical PDF
│   │   │   └── local_vol.py         # Dupire Local Volatility numerical engine
│   │   ├── ml/                      # Machine Learning surface drift engines
│   │   │   ├── base.py
│   │   │   ├── xgboost_model.py     # Parameter drift dynamics model
│   │   │   ├── pytorch_models.py    # Deep neural nets mapping historical surface to drift
│   │   │   └── pipeline.py          # Data preprocessing & feature engineering
│   │   ├── simulation/              # Dynamic path projection (CPU/GPU)
│   │   │   ├── path_generator.py    # Multi-asset geometric Brownian motion/Heston paths
│   │   │   ├── surface_projector.py # Monte Carlo projection of fitted surfaces
│   │   │   └── cuda_kernels.py      # Optional accelerated GPU simulations
│   │   ├── risk/                    # Analytical/Numerical Risk calculations
│   │   │   ├── base_greeks.py       # Analytical Black-Scholes Greeks (Delta, Gamma, Vega, Theta)
│   │   │   ├── cross_greeks.py      # Second-order cross Greeks (Vanna, Volga, Charm)
│   │   │   └── var_engine.py        # Portfolio VaR and Conditional VaR (CVaR)
│   │   └── signals/                 # Trading Signal & Arbitrage Detection
│   │   │   ├── arbitrage.py         # Static arbitrage check (Butterfly, Calendar)
│   │   │   ├── dispersion.py        # Multi-asset dispersion opportunities
│   │   │   └── dynamic_hedging.py   # Systematic Delta-neutral rebalancing signals
│   │   
│   ├── tests/                       # Unit & Integration Tests (pytest)
│   │   ├── conftest.py              # DB & client fixtures
│   │   ├── test_quant/              # Mathematical validation tests
│   │   └── test_api/                # Endpoint validation tests
│   ├── Dockerfile
│   ├── pyproject.toml               # Poetry/UV dependency configuration
│   └── requirements.txt
│
├── frontend/                        # Next.js & Three.js/Plotly Interface
│   ├── public/                      # Static assets (icons, models)
│   ├── src/                         # Source directory
│   │   ├── app/                     # Next.js App Router
│   │   │   ├── layout.tsx           # Base layout (Tailwind, Providers)
│   │   │   ├── page.tsx             # Interactive dashboard landing page
│   │   │   ├── surfaces/
│   │   │   │   └── page.tsx         # Implied/Local Volatility 3D viewer
│   │   │   ├── projections/
│   │   │   │   └── page.tsx         # Monte Carlo path visualizer
│   │   │   ├── risk/
│   │   │   │   └── page.tsx         # Portfolio Greek monitoring & Stress tests
│   │   │   └── signals/
│   │   │       └── page.tsx         # Real-time systematic opportunity grid
│   │   ├── components/              # Highly interactive reusable UI widgets
│   │   │   ├── dashboard/           # Summary cards, live market feeds
│   │   │   ├── charts/              # WebGL & Canvas charts
│   │   │   │   ├── Volatility3D.tsx # Three.js custom WebGL Volatility Surface
│   │   │   │   ├── StrikeSkew.tsx   # Plotly.js strike skew comparisons
│   │   │   │   └── MCPaths.tsx      # SVG/Plotly path trajectory overlay
│   │   │   ├── risk/                # Stress slider controls & Greeks grid
│   │   │   └── ui/                  # Premium glassmorphic interface wrappers
│   │   ├── hooks/                   # Custom Next.js react hooks
│   │   │   ├── useSocket.ts         # Streamlined WS state connection
│   │   │   └── useSurfaceData.ts    # Fetch and cache fitted grids
│   │   ├── services/                # Backend API & Socket connection layers
│   │   │   └── api.ts
│   │   ├── store/                   # Global state (Zustand)
│   │   │   └── useDashboardStore.ts # Centralized realtime market coordinates
│   │   ├── types/                   # TypeScript interfaces (OptionChain, SurfaceSnapshot)
│   │   │   └── index.ts
│   │   └── utils/                   # Interpolation & conversion utils
│   │       └── formulas.ts
│   ├── Dockerfile
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── docs/                            # Documentation
│   └── architecture/                # System Architecture Specifications
│       ├── README.md                # System Overview
│       ├── 01_REPOSITORY_STRUCTURE.md
│       ├── 02_DATABASE_SCHEMA.md
│       ├── 03_API_ARCHITECTURE.md
│       ├── 04_SERVICE_ARCHITECTURE.md
│       ├── 05_CLASS_DIAGRAMS.md
│       ├── 06_DATA_FLOW_DIAGRAMS.md
│       ├── 07_DEPLOYMENT_ARCHITECTURE.md
│       └── 08_ENVIRONMENT_VARIABLES.md
│
├── database/                        # Database provisioning scripts
│   ├── alembic/                     # Python DB schema migrations
│   │   ├── env.py
│   │   └── versions/
│   ├── init.sql                     # Base Supabase provisioning script
│   └── seed.sql                     # Seed script for assets and indicators
│
├── docker-compose.yml               # Local multi-container development environment
└── README.md                        # Master project readme
```

---

## 2. Core Repository Standards

1.  **Code Decoupling**: 
    The mathematical computational engine in `backend/quant/` has **zero dependencies** on `backend/app/` (APIs or database logic). This allows the quant algorithms to be fully unit-testable and optimized separately (e.g. rewritten in Rust/C++ or accelerated with CUDA without affecting the API layer).
2.  **Shared Contract**:
    Data models defined in `backend/app/schemas/` serve as the absolute contract for API communication. They map directly to TypeScript types in `frontend/src/types/` to prevent serialization bugs.
3.  **CI/CD Isolation**:
    GitHub workflows are separated so that changes to mathematical models in `quant/` run testing suites independently of frontend modifications, ensuring rapid feedback loops.
