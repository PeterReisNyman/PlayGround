# PlayGround

This repository contains small experiments for simple AI training loops. The
`ai.py` module implements two demonstrations:

1. **train_thirds** – learns to categorise numbers from 0–60 into three
equal ranges using softmax regression.
2. **train_quadrants** – learns to classify two‑dimensional points into the
four quadrants of a 100×100 grid.

A helper script `visualize_training.py` runs each training loop for a short
period and saves plots of the loss and accuracy.

## Usage

Install the requirements (matplotlib) and run the visualisation script:

```bash
pip install matplotlib
python visualize_training.py
```

This will produce two images, `thirds_training.png` and `quadrant_training.png`,
showing the training progress.
