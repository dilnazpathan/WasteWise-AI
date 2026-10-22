"""Train the one-step-ahead food-waste model."""

import json

from model_training import train_food_waste


if __name__ == "__main__":
    print(json.dumps(train_food_waste(), indent=2))