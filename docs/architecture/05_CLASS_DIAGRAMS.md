# Class Diagrams & OO Design Specifications

This document defines the Object-Oriented design contracts for the **Market Surface Projection Engine (MSPE)** quantitative library (`backend/quant/`). 

These classes are written in pure Python, maintaining complete separation from the FastAPI framework and database layers to facilitate modular unit testing and future high-performance rewrites.

---

## 1. Volatility Models Architecture

Defines the mathematical interface for fitting and extrapolating implied and local volatility surfaces.

```mermaid
classDiagram
    class BaseVolatilityModel {
        <<Abstract>>
        +Dict params
        +Double rmse_error
        +calibrate(List~Double~ strikes, List~Double~ tenors, List~Double~ market_ivs)*
        +get_implied_vol(Double strike, Double tenor) Double*
        +get_local_vol(Double strike, Double tenor, Double spot) Double*
        +validate_no_arbitrage() Boolean*
    }
    
    class SVIModel {
        +Double a
        +Double b
        +Double rho
        +Double m
        +Double sigma
        +calibrate(strikes, tenors, market_ivs)
        +get_implied_vol(Double strike, Double tenor) Double
        +get_local_vol(Double strike, Double tenor, Double spot) Double
        +validate_no_arbitrage() Boolean
    }
    
    class SABRModel {
        +Double alpha
        +Double beta
        +Double rho
        +Double nu
        +calibrate(strikes, tenors, market_ivs)
        +get_implied_vol(Double strike, Double tenor) Double
        +get_local_vol(Double strike, Double tenor, Double spot) Double
        +validate_no_arbitrage() Boolean
    }
    
    class HestonModel {
        +Double kappa
        +Double theta
        +Double sigma
        +Double rho
        +Double v0
        +calibrate(strikes, tenors, market_ivs)
        +get_implied_vol(Double strike, Double tenor) Double
        +get_local_vol(Double strike, Double tenor, Double spot) Double
        +validate_no_arbitrage() Boolean
        +analytical_pdf(Double strike, Double tenor) Double
    }
    
    class DupireLocalVolatility {
        +BaseVolatilityModel fitted_implied_model
        +get_local_vol_grid(List~Double~ strikes, List~Double~ tenors, Double spot) List~List~Double~~
        -numerical_partial_derivatives(Double strike, Double tenor) Dict~String, Double~
    }
    
    BaseVolatilityModel <|-- SVIModel
    BaseVolatilityModel <|-- SABRModel
    BaseVolatilityModel <|-- HestonModel
    DupireLocalVolatility o-- BaseVolatilityModel
```

---

## 2. Machine Learning Drift Predictors

Defines how historical volatility matrices are fed into neural networks or tree-based regressors to forecast future surface parameter drifts.

```mermaid
classDiagram
    class SurfaceDataset {
        +List~volatility_surfaces~ historical_surfaces
        +prepare_tensors() Tuple~Tensor, Tensor~
        +generate_lag_features(Int lookback) Array
    }
    
    class BaseDriftPredictor {
        <<Abstract>>
        +String model_id
        +train(SurfaceDataset dataset)*
        +predict_drift(Array current_params) Array*
    }
    
    class PyTorchLSTMDriftPredictor {
        +LSTMModel neural_net
        +Int hidden_dim
        +train(SurfaceDataset dataset)
        +predict_drift(Array current_params) Array
    }
    
    class XGBoostDriftPredictor {
        +XGBRegressor regressor
        +train(SurfaceDataset dataset)
        +predict_drift(Array current_params) Array
    }
    
    class DynamicPredictor {
        +BaseDriftPredictor drift_model
        +BaseVolatilityModel surface_model
        +project_surface_parameters(Int days_forward) Dict~Int, Array~
    }
    
    BaseDriftPredictor <|-- PyTorchLSTMDriftPredictor
    BaseDriftPredictor <|-- XGBoostDriftPredictor
    DynamicPredictor o-- BaseDriftPredictor
    DynamicPredictor o-- BaseVolatilityModel
```

---

## 3. Monte Carlo Simulation Engine

Defines the core stochastic simulators designed to generate future asset trajectories under physical and risk-neutral distribution profiles.

```mermaid
classDiagram
    class BasePathGenerator {
        <<Abstract>>
        +Int num_paths
        +Int steps
        +Double time_horizon
        +generate_paths(Double spot, Double rate, Double div)* Array
    }
    
    class GBMPathGenerator {
        +Double constant_vol
        +generate_paths(Double spot, Double rate, Double div) Array
    }
    
    class HestonPathGenerator {
        +Double kappa
        +Double theta
        +Double vol_of_vol
        +Double rho
        +Double initial_var
        +generate_paths(Double spot, Double rate, Double div) Array
    }
    
    class SurfaceProjector {
        +BasePathGenerator path_generator
        +DynamicPredictor drift_predictor
        +project_future_surfaces(Double spot, Int days_forward) List~ProjectedSurfaceGrid~
        -compile_probability_density(Array simulated_paths) List~Double~
    }
    
    BasePathGenerator <|-- GBMPathGenerator
    BasePathGenerator <|-- HestonPathGenerator
    SurfaceProjector o-- BasePathGenerator
    SurfaceProjector o-- DynamicPredictor
```

---

## 4. Greeks, Risk Management, and Systematic Signals

Defines portfolio risk evaluation and trading recommendation engines.

```mermaid
classDiagram
    class GreeksCalculator {
        +BaseVolatilityModel vol_model
        +Double spot
        +Double rate
        +Double dividend
        +delta(Double strike, Double tenor, String type) Double
        +gamma(Double strike, Double tenor, String type) Double
        +vega(Double strike, Double tenor) Double
        +theta(Double strike, Double tenor, String type) Double
        +vanna(Double strike, Double tenor) Double
        +volga(Double strike, Double tenor) Double
    }
    
    class RiskManager {
        +List~Position~ portfolio
        +GreeksCalculator greeks_calc
        +calculate_portfolio_greeks() Dict~String, Double~
        +run_stress_scenario(Double spot_shock, Double vol_shock) Double
        +calculate_historical_var(Int confidence_level) Double
        +calculate_cvar(Int confidence_level) Double
    }
    
    class ArbitrageDetector {
        +BaseVolatilityModel vol_model
        +check_butterfly_arbitrage(List~Double~ strikes, Double tenor) List~ArbitrageViolation~
        +check_calendar_arbitrage(Double strike, List~Double~ tenors) List~ArbitrageViolation~
    }
    
    class SignalGenerator {
        +RiskManager risk_mgr
        +ArbitrageDetector arb_detector
        +SurfaceProjector projector
        +evaluate_signals() List~TradingSignal~
        -check_dispersion_arbitrage() List~TradingSignal~
        -check_skew_mispricing() List~TradingSignal~
    }
    
    RiskManager o-- GreeksCalculator
    SignalGenerator o-- RiskManager
    SignalGenerator o-- ArbitrageDetector
    SignalGenerator o-- SurfaceProjector
```
