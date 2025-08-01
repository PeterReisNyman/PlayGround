"""Simple training loops for demonstration.

This module provides two training examples:
1. `train_thirds` - learns to classify numbers into thirds of the range 0-60.
2. `train_quadrants` - learns to classify 2D points into four quadrants.

Both training loops use a very small neural model (softmax regression) and log
basic metrics that can be visualised with matplotlib.
"""

import random as rnd
import math
from typing import List, Tuple, Dict


def exp(x: float, terms: int = 20) -> float:
    """Approximate e**x using a truncated series."""
    result = 1.0
    term = 1.0
    for i in range(1, terms):
        term *= x / i
        result += term
    return max(result, 0.0)


def softmax(values: List[float]) -> List[float]:
    """Compute a stable softmax."""
    max_input = max(values)
    exps = [exp(v - max_input) for v in values]
    total = sum(exps)
    return [x / total for x in exps]


# ---------------------------------------------------------------------------
# 1D classification: which third of [0, 60) does a number belong to?
# ---------------------------------------------------------------------------

THIRDS = [0, 20, 40, 60]


def label_third(num: int) -> List[int]:
    """Return a one-hot label indicating which third the number belongs to."""
    result = []
    for third in THIRDS[:-1]:
        if third <= num < third + 20:
            result.append(1)
        else:
            result.append(0)
    return result


def evaluate_thirds(x: int, weights: List[float], biases: List[float]) -> List[float]:
    raw = [x * w + b for w, b in zip(weights, biases)]
    return softmax(raw)


def train_thirds(epochs: int = 1000, alpha: float = 0.001) -> Dict[str, List]:
    """Train the thirds classifier and return training history."""
    weights = [1.0, 0.0, -4.0]
    biases = [0.0, 0.0, 0.0]

    history = {
        "loss": [],
        "accuracy": [],
        "weights": [],
        "biases": [],
    }

    for _ in range(epochs):
        x = rnd.randint(0, 59)
        y_true = label_third(x)
        y_pred = evaluate_thirds(x, weights, biases)

        # cross-entropy loss
        loss = -sum(t * math.log(p + 1e-9) for t, p in zip(y_true, y_pred))
        pred_class = y_pred.index(max(y_pred))
        true_class = y_true.index(1)
        acc = 1 if pred_class == true_class else 0

        history["loss"].append(loss)
        history["accuracy"].append(acc)
        history["weights"].append(weights.copy())
        history["biases"].append(biases.copy())

        for i in range(len(weights)):
            diff = y_pred[i] - y_true[i]
            biases[i] -= alpha * diff
            weights[i] -= alpha * diff * x

    return history


# ---------------------------------------------------------------------------
# 2D classification: which quadrant of [0, 100) x [0, 100)?
# ---------------------------------------------------------------------------

QUADRANTS = [
    ((0, 50), (0, 50)),
    ((50, 100), (0, 50)),
    ((0, 50), (50, 100)),
    ((50, 100), (50, 100)),
]


def label_quadrant(pt: Tuple[float, float]) -> List[int]:
    """Return a one-hot label for the point's quadrant."""
    x, y = pt
    for idx, ((x0, x1), (y0, y1)) in enumerate(QUADRANTS):
        if x0 <= x < x1 and y0 <= y < y1:
            return [1 if i == idx else 0 for i in range(4)]
    # Should not happen
    return [0, 0, 0, 0]


def evaluate_quadrant(pt: Tuple[float, float], weights: List[List[float]], biases: List[float]) -> List[float]:
    raw = [pt[0] * w[0] + pt[1] * w[1] + b for w, b in zip(weights, biases)]
    return softmax(raw)


def train_quadrants(epochs: int = 1000, alpha: float = 0.001) -> Dict[str, List]:
    """Train the quadrant classifier and return training history."""
    # small random initialisation
    weights = [[(rnd.random() - 0.5) * 0.1, (rnd.random() - 0.5) * 0.1] for _ in range(4)]
    biases = [0.0 for _ in range(4)]

    history = {
        "loss": [],
        "accuracy": [],
        "weights": [],
        "biases": [],
    }

    for _ in range(epochs):
        pt = (rnd.uniform(0, 100), rnd.uniform(0, 100))
        y_true = label_quadrant(pt)
        y_pred = evaluate_quadrant(pt, weights, biases)

        loss = -sum(t * math.log(p + 1e-9) for t, p in zip(y_true, y_pred))
        pred_class = y_pred.index(max(y_pred))
        true_class = y_true.index(1)
        acc = 1 if pred_class == true_class else 0

        history["loss"].append(loss)
        history["accuracy"].append(acc)
        history["weights"].append([w.copy() for w in weights])
        history["biases"].append(biases.copy())

        for i in range(4):
            diff = y_pred[i] - y_true[i]
            biases[i] -= alpha * diff
            weights[i][0] -= alpha * diff * pt[0]
            weights[i][1] -= alpha * diff * pt[1]

    return history


if __name__ == "__main__":
    # Run a short demonstration when executed directly
    h = train_thirds(epochs=200)
    print(f"Trained thirds classifier for {len(h['loss'])} steps")
    h2 = train_quadrants(epochs=200)
    print(f"Trained quadrant classifier for {len(h2['loss'])} steps")
