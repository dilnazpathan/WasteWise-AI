"""Train every WasteWise ML model and write artifacts under ml/artifacts."""

import json

from model_training import train_all


if __name__ == "__main__":
    print(json.dumps(train_all(), indent=2))
