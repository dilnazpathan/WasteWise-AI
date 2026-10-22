"""Train the expiry-risk classifier."""

import json

from model_training import train_expiry_risk


if __name__ == "__main__":
    print(json.dumps(train_expiry_risk(), indent=2))