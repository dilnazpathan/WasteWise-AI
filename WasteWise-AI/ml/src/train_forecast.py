"""Train the chronological demand-forecasting model."""

import json

from model_training import train_demand_forecast


if __name__ == "__main__":
    print(json.dumps(train_demand_forecast(), indent=2))