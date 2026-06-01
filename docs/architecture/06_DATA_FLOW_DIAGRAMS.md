# Data Flow Diagrams & Pipelines

This document details the transaction paths, streaming vectors, and batch boundaries of the **Market Surface Projection Engine (MSPE)**. Visualizing these channels ensures seamless data synchronization between real-time feeds, the database layer, quantitative execution queues, and Next.js clients.

---

## 1. Pipeline 1: Option Quote Ingestion & Real-Time Volatility Surface Fitting

This sequence shows the path from raw tick feeds to real-time WebGL 3D render updates.

```mermaid
sequenceDiagram
    autonumber
    participant Feed as Market Data Provider
    participant Ingestion as IngestionService (Async)
    participant Buffer as Redis Quote Buffer
    participant Worker as Celery Fitting Worker
    participant DB as PostgreSQL Store
    participant Cache as Redis Broker & Cache
    participant WS as WebSocket Streamer
    participant Client as Next.js Web Frontend

    Feed->>Ingestion: Continuous live tick/quote stream (Option Chains)
    Ingestion->>Buffer: LPUSH raw quote objects (no SQL write)
    
    loop Every 15 Seconds (Cron)
        Worker->>Buffer: LTRIM & RPOP latest 15s quote window
        Worker->>Worker: Fit SVI parameters (Gatheral Optimizer)
        Worker->>Worker: Verify static arbitrage constraints
        
        alt Calibration Successful & No Arbitrage
            Worker->>DB: INSERT into volatility_surfaces & surface_grids
            Worker->>Cache: SET mspe:surface:SPX:svi parameters
            Worker->>Cache: PUBLISH to channel 'surface_snapshot'
            Cache-->>WS: Trigger pub/sub callback
            WS-->>Client: Send JSON payload (fitted parameters & grid)
            Client->>Client: Re-render WebGL 3D Volatility Mesh
        else Optimization Failure / Arbitrage Found
            Worker->>DB: Log warning/error to projection_runs
        end
    end
```

---

## 2. Pipeline 2: Probabilistic Surface Projection (ML + Monte Carlo)

This flowchart represents the high-performance process of running long-term surface predictions.

```mermaid
flowchart TD
    subgraph Trigger Phase
        A[API Client POST /api/v1/projections/run] --> B{Validate Request}
        B -->|Invalid| C[Return 420 Bad Request]
        B -->|Valid| D[Create DB Record: status=PENDING]
        D --> E[Dispatch Task to Celery queue: monte_carlo]
        E --> F[Return 202 Accepted to API Client]
    end

    subgraph Prediction Phase (Celery Worker)
        E --> G[Load historical fitted surface grids from DB]
        G --> H[MachineLearningService: Ingest historical features]
        H --> I[PyTorch LSTM: Forecast parameter drift vectors]
    end

    subgraph Simulation Phase (CUDA Node)
        I --> J[Quant Engine: Initialize Heston Stochastic Path Generator]
        J --> K[Generate 100,000 multi-asset simulated spot paths]
        K --> L[Evaluate option joint distribution grids over steps]
        L --> M[Compile percentiles: P10, P50, P90 projected surfaces]
    end

    subgraph Persistence & Notification
        M --> N[Write simulation logs to database: status=COMPLETED]
        M --> O[Write dense projected_surfaces coordinates to DB]
        O --> P[Cache completed status to Redis mspe:jobs:status:id]
        P --> Q[WebSocket Channel: Stream progress complete alert]
    end
```

---

## 3. Pipeline 3: Systematic Signal Generation & Risk Controls

This diagram demonstrates how risk systems validate volatility structures to generate delta-neutral opportunities.

```mermaid
sequenceDiagram
    autonumber
    participant DB as PostgreSQL Store
    participant Risk as RiskEngineService (Python Class)
    participant Signal as SignalGenerator (Python Class)
    participant Cache as Redis Broker
    participant WS as WebSocket Streamer
    participant Client as Next.js Dashboard

    loop Every Minute
        Risk->>DB: Fetch latest spot price & calibrated SVI grid
        Risk->>Risk: Calculate analytical Greeks (Delta, Gamma, Vega, Theta)
        Risk->>Risk: Calculate numerical cross-Greeks (Vanna, Volga)
        Risk->>Risk: Simulate macro stress test portfolio shocks
        Risk->>DB: Save metrics to risk_profiles table
        
        Signal->>DB: Fetch latest risk_profiles & projected_surfaces
        Signal->>Signal: Run dispersion arbitrage check (Indices vs Components)
        Signal->>Signal: Run static butterfly calendar arbitrage check
        
        alt Alpha Detected (Discrepancy > Threshold)
            Signal->>DB: INSERT into trading_signals (status=ACTIVE)
            Signal->>Cache: PUBLISH to channel 'signals'
            Cache-->>WS: Trigger pub/sub callback
            WS-->>Client: Stream alert (Opportunity card, hedge ratios)
            Client->>Client: Play acoustic alert / Flash opportunity card
        end
    end
```
