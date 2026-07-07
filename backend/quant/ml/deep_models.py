import os
import joblib
from typing import Dict, Optional
import numpy as np

from backend.quant.ml.base import BaseForecaster
from backend.app.core.logging import logger

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

if TORCH_AVAILABLE:

    class PyTorchLSTMModel(nn.Module):
        """Deep Recurrent LSTM architecture with dual-heads projecting return & volatility in parallel."""

        def __init__(self, input_dim: int, hidden_dim: int = 32, num_layers: int = 2):
            super().__init__()
            self.hidden_dim = hidden_dim
            self.num_layers = num_layers

            # Projection input layer
            self.projection_in = nn.Linear(input_dim, hidden_dim)

            # LSTM cells
            self.lstm = nn.LSTM(hidden_dim, hidden_dim, num_layers, batch_first=True)

            # Dual-output fully connected layer
            # Output dim = 2 (Index 0: Expected Return, Index 1: Expected Volatility)
            self.fc_out = nn.Linear(hidden_dim, 2)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            # Input shape: (Batch, SeqLen, InputDim)
            proj = self.projection_in(x)

            # LSTM layer
            lstm_out, _ = self.lstm(proj)

            # Gather the final step hidden state (Sequence termination point)
            final_hidden = lstm_out[:, -1, :]  # shape (Batch, HiddenDim)

            out = self.fc_out(final_hidden)  # shape (Batch, 2)
            return out

else:

    class PyTorchLSTMModel:
        def __init__(self, *args, **kwargs):
            pass


class LSTMForecaster(BaseForecaster):
    def __init__(
        self,
        epochs: int = 20,
        lr: float = 0.01,
        seq_len: int = 10,
        hidden_dim: int = 32,
    ):
        self.epochs = epochs
        self.lr = lr
        self.seq_len = seq_len
        self.hidden_dim = hidden_dim

        self.network = None
        self.feature_means = None
        self.feature_stds = None
        self.latest_sequence = None
        self.history_returns = None

        # Auto-detect CUDA capability
        if TORCH_AVAILABLE:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = "cpu"

    def fit(
        self,
        prices: np.ndarray,
        returns: np.ndarray,
        features: Optional[np.ndarray] = None,
    ) -> "LSTMForecaster":
        if not TORCH_AVAILABLE:
            raise RuntimeError(
                "PyTorch is not installed in this environment. LSTM forecasting is disabled. "
                "Please use statistical models (ARIMA, SARIMA, GARCH) or tree models (XGBoost, RF)."
            )
        self.history_returns = returns.tolist()

        # Fallback to random lag features if none provided
        if features is None or len(features) < 20:
            features = self._create_lag_features(returns)

        # Standardise features (Z-Score normalization) for model stability
        self.feature_means = np.mean(features, axis=0)
        self.feature_stds = np.std(features, axis=0)
        self.feature_stds = np.where(
            self.feature_stds == 0.0, 1e-9, self.feature_stds
        )  # prevent div by zero
        norm_features = (features - self.feature_means) / self.feature_stds

        # Targets mapping (Shift returns by -1 step, volatility targets over rolling next 3 days)
        target_ret = np.roll(returns, -1)
        target_vol = np.zeros_like(returns)
        for i in range(len(returns) - 3):
            target_vol[i] = np.std(returns[i + 1 : i + 4]) * np.sqrt(252)

        # Boundary adjustments
        X_seq, y_target = [], []
        n = len(norm_features)

        # Frame input arrays into sequences of length seq_len
        for i in range(n - self.seq_len - 3):
            seq = norm_features[i : i + self.seq_len]
            X_seq.append(seq)
            y_target.append(
                [target_ret[i + self.seq_len - 1], target_vol[i + self.seq_len - 1]]
            )

        if len(X_seq) == 0:
            logger.warning(
                "Data length too short to frame sequence paths. Fits cancelled."
            )
            return self

        X_train = torch.tensor(np.array(X_seq), dtype=torch.float32).to(self.device)
        y_train = torch.tensor(np.array(y_target), dtype=torch.float32).to(self.device)

        # Keep latest sequence slice for inference forecasts
        self.latest_sequence = norm_features[-self.seq_len :]

        # Initialize network
        input_dim = features.shape[1]
        self.network = PyTorchLSTMModel(input_dim, self.hidden_dim).to(self.device)

        criterion = nn.MSELoss()
        optimizer = optim.Adam(self.network.parameters(), lr=self.lr)

        logger.info(f"Training PyTorch LSTM ({self.epochs} epochs on {self.device})...")
        self.network.train()
        for epoch in range(self.epochs):
            optimizer.zero_grad()
            outputs = self.network(X_train)
            loss = criterion(outputs, y_train)
            loss.backward()
            optimizer.step()

        logger.info(f"LSTM training completed. Final Loss: {loss.item():.6f}")
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        hist_vol = float(np.std(self.history_returns[-30:]) * np.sqrt(252))
        hist_ret = float(np.mean(self.history_returns[-30:]) * horizon)

        if not TORCH_AVAILABLE or self.network is None or self.latest_sequence is None:
            return {"expected_return": hist_ret, "expected_volatility": hist_vol}

        try:
            self.network.eval()
            with torch.no_grad():
                X_inf = (
                    torch.tensor(self.latest_sequence, dtype=torch.float32)
                    .unsqueeze(0)
                    .to(self.device)
                )  # shape (1, SeqLen, InputDim)
                output = self.network(X_inf).cpu().numpy()[0]  # shape (2,)

                # Scale return expectation over horizon
                expected_return = float(output[0]) * horizon

                # Retrieve expected volatility
                expected_volatility = float(output[1])
                expected_volatility = max(0.001, expected_volatility)

                return {
                    "expected_return": expected_return,
                    "expected_volatility": expected_volatility,
                }
        except Exception as e:
            logger.error(f"LSTM predict failed: {e}")
            return {"expected_return": hist_ret, "expected_volatility": hist_vol}

    def _create_lag_features(self, returns: np.ndarray, lags: int = 5) -> np.ndarray:
        n = len(returns)
        features = []
        for i in range(n):
            if i < lags:
                features.append(np.zeros(lags))
                continue
            features.append(returns[i - lags : i])
        return np.array(features)

    def save(self, file_path: str) -> None:
        """Saves model parameters and serialized PyTorch network weights separately."""
        if not TORCH_AVAILABLE:
            raise RuntimeError(
                "PyTorch is not installed. Saving LSTM models is disabled."
            )
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        # Save weights
        weights_path = file_path + ".pth"
        torch.save(self.network.state_dict(), weights_path)

        # Save state dictionary config
        state = {
            "epochs": self.epochs,
            "lr": self.lr,
            "seq_len": self.seq_len,
            "hidden_dim": self.hidden_dim,
            "feature_means": self.feature_means,
            "feature_stds": self.feature_stds,
            "latest_sequence": self.latest_sequence,
            "history_returns": self.history_returns,
            "input_dim": self.network.projection_in.in_features if self.network else 5,
        }
        joblib.dump(state, file_path)
        logger.info(f"LSTM forecaster saved successfully to {file_path}")

    def load(self, file_path: str) -> "LSTMForecaster":
        if not TORCH_AVAILABLE:
            raise RuntimeError(
                "PyTorch is not installed. Loading LSTM models is disabled."
            )
        state = joblib.load(file_path)
        self.epochs = state["epochs"]
        self.lr = state["lr"]
        self.seq_len = state["seq_len"]
        self.hidden_dim = state["hidden_dim"]
        self.feature_means = state["feature_means"]
        self.feature_stds = state["feature_stds"]
        self.latest_sequence = state["latest_sequence"]
        self.history_returns = state["history_returns"]

        # Reconstruct network architecture
        input_dim = state["input_dim"]
        self.network = PyTorchLSTMModel(input_dim, self.hidden_dim).to(self.device)

        # Load weights
        weights_path = file_path + ".pth"
        if os.path.exists(weights_path):
            self.network.load_state_dict(
                torch.load(weights_path, map_location=self.device)
            )

        return self
