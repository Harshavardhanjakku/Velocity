"""
model.py
--------
The exact ANN architecture used during training. This MUST stay identical
to the architecture in the training script, otherwise state_dict loading
will fail or silently produce wrong shapes.

Architecture (from training script):
    Input  -> Linear(input_dim, 64) -> ReLU
           -> Linear(64, 32)        -> ReLU
           -> Linear(32, 1)
    Optimizer used at train time : EfficientADAMOptimizer (custom Adam variant)
    Loss function                : MSELoss
"""

import torch.nn as nn
import torch


class ANNModel(nn.Module):
    """Feed-forward ANN regressor for bike rental count prediction."""

    def __init__(self, input_dim: int):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, 64)
        self.fc2 = nn.Linear(64, 32)
        self.fc3 = nn.Linear(32, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        return self.fc3(x)


MODEL_METADATA = {
    "architecture": "Artificial Neural Network (Feed-Forward)",
    "layers": [
        {"name": "Input Layer", "units": "n_features", "activation": None},
        {"name": "Hidden Layer 1", "units": 64, "activation": "ReLU"},
        {"name": "Hidden Layer 2", "units": 32, "activation": "ReLU"},
        {"name": "Output Layer", "units": 1, "activation": "Linear"},
    ],
    "optimizer": "Efficient Adam (custom, randomised step size)",
    "loss_function": "Mean Squared Error (MSE)",
    "framework": "PyTorch",
    "scaler": "StandardScaler (scikit-learn)",
    "epochs": 100,
    "batch_size": 32,
    "learning_rate": 0.001,
    "weight_decay": 0.0001,
}
