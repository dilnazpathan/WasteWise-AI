"""Train the simulated-scenario discount recommender prototype."""

import json

from model_training import train_discount_recommendation


if __name__ == "__main__":
    print(json.dumps(train_discount_recommendation(), indent=2))