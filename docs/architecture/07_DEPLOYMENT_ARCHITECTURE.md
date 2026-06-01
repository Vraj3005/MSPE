# Deployment Architecture & Production Infrastructure

This document outlines the multi-region cloud production setup for the **Market Surface Projection Engine (MSPE)**. Using the specified stack of Vercel, Railway, and Supabase guarantees scalable WebGL client interaction, highly reliable quantitative worker execution, and resilient time-series storage.

---

## 1. Infrastructure Topology Diagram

This diagram displays the flow of network requests, caching boundaries, and computing domains in production.

```mermaid
flowchart TD
    subgraph Client Layer
        WebClient[Next.js SPA on Vercel Edge]
    end

    subgraph CDN & Edge DNS
        VercelCDN[Vercel CDN Edge Network]
    end
    WebClient -->|HTTPS / Static Assets| VercelCDN

    subgraph Backend Execution Layer (Railway Container Service)
        RailwayGateway[Railway Load Balancer & Gateway]
        FastApiApp[FastAPI Web Server Container]
        
        CeleryFit[Celery Worker: Fitting Queue]
        CeleryMC[Celery Worker: Monte Carlo Queue]
        
        RedisCluster[Railway Redis: Cache & Queue Broker]
    end
    
    WebClient -->|REST & WebSocket Streams| RailwayGateway
    RailwayGateway --> FastApiApp
    
    FastApiApp -->|Dispatch Tasks| RedisCluster
    RedisCluster --> CeleryFit
    RedisCluster --> CeleryMC

    subgraph Data & Storage Layer (Supabase Managed Services)
        SupaDbPool[PgBouncer Connection Pool]
        PostgreSql[(Supabase PostgreSQL Database)]
    end
    
    FastApiApp -->|Read/Write Metadata| SupaDbPool
    CeleryFit -->|Write Calibration Parameters| SupaDbPool
    CeleryMC -->|Write Paths & Percentiles| SupaDbPool
    SupaDbPool --> PostgreSql
```

---

## 2. Component Configurations

### 2.1 Frontend: Vercel Edge
*   **Hosting**: Next.js App Router static files and serverless endpoints are hosted on Vercel's global CDN network.
*   **Static Site Generation (SSG)**: Landing layouts and documentation pages are generated statically.
*   **Client-Side Rendering (CSR)**: Three.js/WebGL volatility surfaces and Plotly.js charts are executed entirely within user browsers using HTML5 Canvas to eliminate server-side GPU/CPU rendering bottlenecks.
*   **WebSockets Protocol**: Browser clients establish direct, persistent TCP/WebSocket handshakes with the backend container hosted on Railway.

### 2.2 Backend & Worker Nodes: Railway
Railway hosts the core execution elements inside containerized environments defined by Dockerfiles.

1.  **FastAPI ASGI container**:
    *   *Docker Entrypoint*: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 4`
    *   *Scaling Policy*: Configured to scale horizontally (from 1 to 5 instances) when CPU consumption exceeds 75% or active WebSocket connections cross 500 per container.
2.  **Celery Volatility Fitting Worker**:
    *   *Docker Entrypoint*: `celery -A app.workers.celery_app worker --loglevel=info -Q realtime_fit --concurrency=4`
    *   *Resource Limits*: Memory-intensive. Setup with 2 CPU Cores and 4GB RAM to prevent SVI parameter calibration tasks from choking.
3.  **Celery Monte Carlo Simulation Worker**:
    *   *Docker Entrypoint*: `celery -A app.workers.celery_app worker --loglevel=info -Q monte_carlo --concurrency=1`
    *   *Resource Limits*: Compute-intensive. Linked to Railway's high-performance compute nodes (or GPU enabled if PyTorch CUDA kernels are activated). Setup with 4 CPU Cores and 8GB RAM.

### 2.3 Caching & Task Broker: Railway Redis
*   **Plan**: Managed Redis instance on Railway.
*   **Settings**:
    *   *Maxmemory Policy*: `volatile-lru`
    *   *Persistence*: Disabled (`save ""` in configuration) to optimize Redis solely for ultra-fast, in-memory queue broker and Pub/Sub volatility parameter streams.

### 2.4 Data Layer: Supabase
Supabase provides the managed database framework.
*   **Timescale DB / Partitioning**: Native PostgreSQL partitioning splits `market_bars` and `option_quotes` into monthly partition chunks.
*   **PgBouncer Pooling**: Backend and workers connect to Supabase via the Transaction Pooler endpoint (`port 6543`) to prevent options calibration workers from spawning thousands of concurrent persistent connections.
*   **Row Level Security (RLS)**: Active RLS blocks third-party direct writes, allowing authenticated APIs to write while maintaining public read permissions for verified trading applications.

---

## 3. Production CI/CD & Deploy Pipeline

1.  **Repository Sync**: A unified Monorepo setup manages pipeline tasks using GitHub Actions workflows.
2.  **Testing Automation**:
    *   Every commit to `main` triggers a GitHub Action runner.
    *   Runs mathematical validation sets on volatility models using `pytest backend/tests/test_quant`.
    *   Executes frontend builds to verify TypeScript compile integrity.
3.  **Automatic Provisioning**:
    *   *Frontend*: Deploys directly to Vercel upon successful test validation.
    *   *Backend*: Re-builds Railway Docker containers automatically via webhooks linked to successful GitHub test runs.
    *   *Database*: Database schemas are safely adjusted using Alembic migrations executed within a dry-run test container before applying updates directly to Supabase production tables.
