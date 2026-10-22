"""Training pipelines for WasteWise's four ML prototypes."""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = PROJECT_ROOT / "ml" / "data" / "raw"
ARTIFACTS_DIR = PROJECT_ROOT / "ml" / "artifacts"
RANDOM_STATE = 42
TEST_SIZE = 0.2

PERISHABLE_FILE = "perishable_inventory - perishable_inventory.csv"
BATCH_FILE = "inventory_batches - inventory_batches.csv"
DISCOUNT_FILE = "discount_scenarios_simulated - discount_scenarios_simulated.csv"
PRODUCT_FILE = "products - products.csv"


def _read_csv(filename: str, required_columns: set[str]) -> pd.DataFrame:
    path = RAW_DATA_DIR / filename
    if not path.is_file():
        raise FileNotFoundError(f"Required training data not found: {path}")
    frame = pd.read_csv(path)
    missing = required_columns.difference(frame.columns)
    if missing:
        raise ValueError(f"{filename} is missing required columns: {sorted(missing)}")
    if frame.empty:
        raise ValueError(f"Training data is empty: {path}")
    return frame


def _calendar_features(frame: pd.DataFrame, date_column: str) -> pd.DataFrame:
    result = frame.copy()
    dates = pd.to_datetime(result[date_column], errors="raise")
    day_of_year = dates.dt.dayofyear
    result["year"] = dates.dt.year
    result["month"] = dates.dt.month
    result["day_of_month"] = dates.dt.day
    result["day_of_week"] = dates.dt.dayofweek
    result["weekday"] = dates.dt.day_name()
    result["week_of_year"] = dates.dt.isocalendar().week.astype("int64")
    result["is_weekend"] = (dates.dt.dayofweek >= 5).astype("int8")
    result["day_of_year_sin"] = (2 * math.pi * day_of_year / 365.25).map(math.sin)
    result["day_of_year_cos"] = (2 * math.pi * day_of_year / 365.25).map(math.cos)
    return result


def _with_sales_history(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.sort_values(["product_id", "date"]).reset_index(drop=True).copy()
    sales_by_product = result.groupby("product_id", sort=False)["units_sold"]
    result["lag_units_sold_1"] = sales_by_product.shift(1)
    result["lag_units_sold_7"] = sales_by_product.shift(7)
    result["rolling_mean_units_sold_7"] = sales_by_product.transform(
        lambda values: values.shift(1).rolling(window=7, min_periods=1).mean()
    )
    return result


def _temporal_split(
    frame: pd.DataFrame, date_column: str, test_size: float = TEST_SIZE
) -> tuple[pd.DataFrame, pd.DataFrame, str]:
    dates = pd.to_datetime(frame[date_column], errors="raise")
    unique_dates = sorted(dates.drop_duplicates())
    split_index = int(len(unique_dates) * (1 - test_size))
    if split_index <= 0 or split_index >= len(unique_dates):
        raise ValueError(f"Not enough distinct {date_column} values for a temporal split")
    cutoff = unique_dates[split_index]
    train_mask = dates < cutoff
    test_mask = dates >= cutoff
    train_frame = frame.loc[train_mask].copy()
    test_frame = frame.loc[test_mask].copy()
    if train_frame.empty or test_frame.empty:
        raise ValueError(f"Temporal split produced an empty partition at {cutoff.date()}")
    return train_frame, test_frame, cutoff.date().isoformat()


def _make_pipeline(
    numeric_features: list[str],
    categorical_features: list[str],
    estimator: RandomForestClassifier | RandomForestRegressor,
) -> Pipeline:
    transformers: list[tuple[str, Pipeline, list[str]]] = []
    if numeric_features:
        transformers.append(
            (
                "numeric",
                Pipeline([("imputer", SimpleImputer(strategy="median"))]),
                numeric_features,
            )
        )
    if categorical_features:
        transformers.append(
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_features,
            )
        )
    preprocessing = ColumnTransformer(transformers=transformers, remainder="drop")
    return Pipeline([("preprocessing", preprocessing), ("model", estimator)])


def _regression_metrics(actual: pd.Series, predicted: Any) -> dict[str, float]:
    actual_values = actual.to_numpy(dtype=float)
    predicted_values = predicted
    return {
        "mae": float(mean_absolute_error(actual_values, predicted_values)),
        "rmse": float(math.sqrt(mean_squared_error(actual_values, predicted_values))),
        "r2": float(r2_score(actual_values, predicted_values)),
        "wape": float(
            sum(abs(actual_values - predicted_values))
            / max(sum(abs(actual_values)), 1e-12)
        ),
    }


def _classification_metrics(actual: pd.Series, predicted: Any, probabilities: Any) -> dict[str, float]:
    actual_values = actual.to_numpy()
    predicted_values = predicted
    metrics = {
        "accuracy": float(accuracy_score(actual_values, predicted_values)),
        "balanced_accuracy": float(balanced_accuracy_score(actual_values, predicted_values)),
        "precision": float(precision_score(actual_values, predicted_values, zero_division=0)),
        "recall": float(recall_score(actual_values, predicted_values, zero_division=0)),
        "f1": float(f1_score(actual_values, predicted_values, zero_division=0)),
    }
    if len(set(actual_values)) > 1:
        metrics["roc_auc"] = float(roc_auc_score(actual_values, probabilities[:, 1]))
    return metrics


def _save_artifact(
    name: str,
    model: Pipeline,
    metrics: dict[str, Any],
    metadata: dict[str, Any],
) -> dict[str, Any]:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = ARTIFACTS_DIR / f"{name}.joblib"
    metrics_path = ARTIFACTS_DIR / f"{name}_metrics.json"
    joblib.dump(model, model_path)
    report = {
        "model": name,
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "artifact": model_path.name,
        "metrics": metrics,
        **metadata,
    }
    metrics_path.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    return report


def train_demand_forecast() -> dict[str, Any]:
    frame = _read_csv(
        PERISHABLE_FILE,
        {
            "product_id",
            "date",
            "category",
            "units_sold",
            "unit_price",
            "discount_pct",
        },
    )
    frame["date"] = pd.to_datetime(frame["date"], errors="raise")
    if frame.duplicated(["product_id", "date"]).any():
        raise ValueError("Demand data must have at most one row per product and date")
    frame = _with_sales_history(frame)
    frame = _calendar_features(frame, "date")
    frame["is_promotion"] = (pd.to_numeric(frame["discount_pct"]) > 0).astype("int8")
    frame["product_id"] = frame["product_id"].astype(str)
    frame = frame.dropna(subset=["lag_units_sold_1", "lag_units_sold_7"])

    numeric_features = [
        "lag_units_sold_1",
        "lag_units_sold_7",
        "rolling_mean_units_sold_7",
        "unit_price",
        "discount_pct",
        "is_promotion",
        "year",
        "month",
        "day_of_month",
        "day_of_week",
        "week_of_year",
        "is_weekend",
        "day_of_year_sin",
        "day_of_year_cos",
    ]
    categorical_features = ["product_id", "category", "weekday"]
    target = "units_sold"
    train_frame, test_frame, cutoff = _temporal_split(frame, "date")
    model = _make_pipeline(
        numeric_features,
        categorical_features,
        RandomForestRegressor(
            n_estimators=400,
            min_samples_leaf=2,
            max_features=0.9,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
    )
    model.fit(train_frame[numeric_features + categorical_features], train_frame[target])
    prediction = model.predict(test_frame[numeric_features + categorical_features])
    return _save_artifact(
        "demand_forecast",
        model,
        _regression_metrics(test_frame[target], prediction),
        {
            "target": target,
            "data_file": PERISHABLE_FILE,
            "features": numeric_features + categorical_features,
            "split": {
                "method": "chronological",
                "train_through": (pd.Timestamp(cutoff) - pd.Timedelta(days=1)).date().isoformat(),
                "test_from": cutoff,
                "test_fraction": TEST_SIZE,
                "evaluation": "one-step-ahead walk-forward; prior actual sales are lag inputs",
            },
            "train_rows": int(len(train_frame)),
            "test_rows": int(len(test_frame)),
            "calendar_note": (
                "Calendar features are derived from each sales date. The supplied calendar.csv "
                "covers 2011-2016 and does not overlap this 2026 sales history."
            ),
            "price_and_promotion_assumption": (
                "Unit price and discount are assumed to be planned and known before the forecast day."
            ),
        },
    )


def train_expiry_risk() -> dict[str, Any]:
    frame = _read_csv(
        BATCH_FILE,
        {
            "product_id",
            "category",
            "received_at",
            "snapshot_date",
            "expiry_date",
            "initial_quantity",
            "quantity_remaining",
            "days_to_expiry",
            "avg_daily_sales_7d",
            "expected_demand_before_expiry",
            "unit_price",
            "unit_cost",
            "discount_pct",
            "expiry_risk_label",
        },
    )
    frame["snapshot_date"] = pd.to_datetime(frame["snapshot_date"], errors="raise")
    frame["received_at"] = pd.to_datetime(frame["received_at"], errors="raise")
    frame["expiry_date"] = pd.to_datetime(frame["expiry_date"], errors="raise")
    frame = _calendar_features(frame, "snapshot_date")
    frame["batch_age_days"] = (frame["snapshot_date"] - frame["received_at"]).dt.days
    frame["demand_balance"] = (
        pd.to_numeric(frame["expected_demand_before_expiry"])
        - pd.to_numeric(frame["quantity_remaining"])
    )
    frame["product_id"] = frame["product_id"].astype(str)

    numeric_features = [
        "initial_quantity",
        "quantity_remaining",
        "days_to_expiry",
        "avg_daily_sales_7d",
        "expected_demand_before_expiry",
        "unit_price",
        "unit_cost",
        "discount_pct",
        "batch_age_days",
        "demand_balance",
        "year",
        "month",
        "day_of_month",
        "day_of_week",
    ]
    categorical_features = ["product_id", "category", "weekday"]
    target = "expiry_risk_label"
    frame[target] = pd.to_numeric(frame[target], errors="raise").astype(int)
    if not set(frame[target].unique()).issubset({0, 1}):
        raise ValueError("expiry_risk_label must contain only binary 0/1 labels")
    train_frame, test_frame, cutoff = _temporal_split(frame, "snapshot_date")
    if train_frame[target].nunique() < 2:
        raise ValueError("The chronological training partition needs both expiry-risk classes")

    model = _make_pipeline(
        numeric_features,
        categorical_features,
        RandomForestClassifier(
            n_estimators=400,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
    )
    feature_columns = numeric_features + categorical_features
    model.fit(train_frame[feature_columns], train_frame[target])
    prediction = model.predict(test_frame[feature_columns])
    probabilities = model.predict_proba(test_frame[feature_columns])
    return _save_artifact(
        "expiry_risk",
        model,
        _classification_metrics(test_frame[target], prediction, probabilities),
        {
            "target": target,
            "data_file": BATCH_FILE,
            "features": feature_columns,
            "excluded_columns": [
                "expiry_risk_label",
                "batch_id",
                "waste_units_actual_simulated",
                "received_at",
                "snapshot_date",
                "expiry_date",
            ],
            "split": {
                "method": "chronological by snapshot_date",
                "test_from": cutoff,
                "test_fraction": TEST_SIZE,
            },
            "train_rows": int(len(train_frame)),
            "test_rows": int(len(test_frame)),
        },
    )


def train_food_waste() -> dict[str, Any]:
    frame = _read_csv(
        PERISHABLE_FILE,
        {
            "product_id",
            "date",
            "category",
            "opening_stock",
            "units_sold",
            "unit_price",
            "discount_pct",
            "days_to_expiry",
            "waste_units",
        },
    )
    frame["date"] = pd.to_datetime(frame["date"], errors="raise")
    if frame.duplicated(["product_id", "date"]).any():
        raise ValueError("Waste data must have at most one row per product and date")
    frame = _with_sales_history(frame)
    frame = _calendar_features(frame, "date")
    frame["product_id"] = frame["product_id"].astype(str)
    frame = frame.dropna(subset=["lag_units_sold_1", "lag_units_sold_7"])

    numeric_features = [
        "opening_stock",
        "unit_price",
        "discount_pct",
        "days_to_expiry",
        "lag_units_sold_1",
        "lag_units_sold_7",
        "rolling_mean_units_sold_7",
        "year",
        "month",
        "day_of_month",
        "day_of_week",
        "week_of_year",
        "is_weekend",
    ]
    categorical_features = ["product_id", "category", "weekday"]
    target = "waste_units"
    train_frame, test_frame, cutoff = _temporal_split(frame, "date")
    selection_scores = _select_waste_estimator(
        train_frame, numeric_features, categorical_features, target
    )
    selected_estimator = min(selection_scores, key=selection_scores.get)
    if selected_estimator == "median_baseline":
        estimator = DummyRegressor(strategy="median")
    else:
        estimator = RandomForestRegressor(
            n_estimators=400,
            min_samples_leaf=2,
            max_features=0.9,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
    model = _make_pipeline(
        numeric_features,
        categorical_features,
        estimator,
    )
    feature_columns = numeric_features + categorical_features
    model.fit(train_frame[feature_columns], train_frame[target])
    prediction = model.predict(test_frame[feature_columns])
    metrics = _regression_metrics(test_frame[target], prediction)
    actual_events = test_frame[target].to_numpy() > 0
    predicted_events = prediction > 0
    metrics["exact_value_accuracy"] = float(
        (test_frame[target].to_numpy() == prediction).mean()
    )
    metrics["waste_event_recall"] = float(
        (actual_events & predicted_events).sum() / max(actual_events.sum(), 1)
    )
    return _save_artifact(
        "food_waste",
        model,
        metrics,
        {
            "target": target,
            "data_file": PERISHABLE_FILE,
            "features": feature_columns,
            "excluded_columns": [
                "waste_units",
                "units_sold",
                "units_received",
                "temperature_c",
                "stockout_flag",
            ],
            "split": {
                "method": "chronological by date",
                "test_from": cutoff,
                "test_fraction": TEST_SIZE,
                "evaluation": (
                    "one-step-ahead walk-forward; lagged sales use only observations "
                    "available before each prediction date"
                ),
            },
            "input_availability": (
                "Opening stock, planned price/discount, expiry time, calendar, and prior-day "
                "sales are inputs; same-day sales, temperature, stockout, and waste outcomes are excluded."
            ),
            "model_selection": {
                "method": "expanding-window validation on training dates; lowest mean MAE selected",
                "validation_mae_by_estimator": selection_scores,
                "selected_estimator": selected_estimator,
            },
            "target_distribution_note": (
                "The target is highly zero-inflated; the selected median baseline may predict "
                "zero for every row and therefore has low recall for nonzero waste events."
            ),
            "train_rows": int(len(train_frame)),
            "test_rows": int(len(test_frame)),
        },
    )


def _select_waste_estimator(
    train_frame: pd.DataFrame,
    numeric_features: list[str],
    categorical_features: list[str],
    target: str,
) -> dict[str, float]:
    dates = sorted(pd.to_datetime(train_frame["date"]).drop_duplicates())
    validation_dates = dates[int(len(dates) * 0.55) :]
    chunk_size = max(1, math.ceil(len(validation_dates) / 3))
    folds = [
        validation_dates[index : index + chunk_size]
        for index in range(0, len(validation_dates), chunk_size)
    ]
    scores: dict[str, list[float]] = {
        "median_baseline": [],
        "random_forest": [],
    }
    feature_columns = numeric_features + categorical_features

    for fold_dates in folds:
        if not fold_dates:
            continue
        fold_train = train_frame.loc[train_frame["date"] < fold_dates[0]]
        fold_validation = train_frame.loc[train_frame["date"].isin(fold_dates)]
        if fold_train.empty or fold_validation.empty:
            continue
        candidates = {
            "median_baseline": DummyRegressor(strategy="median"),
            "random_forest": RandomForestRegressor(
                n_estimators=200,
                min_samples_leaf=2,
                max_features=0.9,
                random_state=RANDOM_STATE,
                n_jobs=-1,
            ),
        }
        for name, estimator in candidates.items():
            candidate = _make_pipeline(
                numeric_features, categorical_features, estimator
            )
            candidate.fit(fold_train[feature_columns], fold_train[target])
            prediction = candidate.predict(fold_validation[feature_columns])
            scores[name].append(
                float(mean_absolute_error(fold_validation[target], prediction))
            )

    if any(not estimator_scores for estimator_scores in scores.values()):
        raise ValueError("Not enough training dates for food-waste model selection")
    return {
        name: float(sum(estimator_scores) / len(estimator_scores))
        for name, estimator_scores in scores.items()
    }


def train_discount_recommendation() -> dict[str, Any]:
    scenarios = _read_csv(
        DISCOUNT_FILE,
        {
            "batch_id",
            "product_id",
            "days_to_expiry",
            "quantity_remaining",
            "discount_pct",
            "estimated_gross_margin_simulated",
        },
    )
    products = _read_csv(PRODUCT_FILE, {"product_id", "selling_price", "unit_cost"})
    products = products[["product_id", "selling_price", "unit_cost"]].drop_duplicates(
        subset=["product_id"]
    )
    frame = scenarios.merge(products, on="product_id", how="left", validate="many_to_one")
    if frame[["selling_price", "unit_cost"]].isna().any().any():
        raise ValueError("Some discount scenario product IDs have no matching product pricing")
    frame["product_id"] = frame["product_id"].astype(str)
    numeric_features = [
        "days_to_expiry",
        "quantity_remaining",
        "discount_pct",
        "selling_price",
        "unit_cost",
    ]
    categorical_features = ["product_id"]
    feature_columns = numeric_features + categorical_features
    target = "estimated_gross_margin_simulated"

    splitter = GroupShuffleSplit(
        n_splits=1, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    train_indices, test_indices = next(
        splitter.split(frame[feature_columns], frame[target], groups=frame["batch_id"])
    )
    train_frame = frame.iloc[train_indices]
    test_frame = frame.iloc[test_indices].copy()
    model = _make_pipeline(
        numeric_features,
        categorical_features,
        RandomForestRegressor(
            n_estimators=500,
            min_samples_leaf=3,
            max_features=0.9,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
    )
    model.fit(train_frame[feature_columns], train_frame[target])
    test_frame["predicted_margin"] = model.predict(test_frame[feature_columns])
    chosen = test_frame.loc[
        test_frame.groupby("batch_id")["predicted_margin"].idxmax()
    ]
    oracle = test_frame.loc[
        test_frame.groupby("batch_id")[target].idxmax()
    ]
    metrics = _regression_metrics(test_frame[target], test_frame["predicted_margin"].to_numpy())
    metrics.update(
        {
            "mean_recommended_simulated_margin": float(chosen[target].mean()),
            "mean_oracle_simulated_margin": float(oracle[target].mean()),
            "mean_simulated_margin_regret": float(
                (oracle[target].to_numpy() - chosen[target].to_numpy()).mean()
            ),
            "discount_choice_accuracy": float(
                (
                    chosen["discount_pct"].to_numpy()
                    == oracle["discount_pct"].to_numpy()
                ).mean()
            ),
            "evaluated_batches": int(chosen["batch_id"].nunique()),
        }
    )
    return _save_artifact(
        "discount_recommendation",
        model,
        metrics,
        {
            "target": target,
            "data_file": DISCOUNT_FILE,
            "features": feature_columns,
            "excluded_columns": [
                "batch_id",
                "estimated_units_sold_simulated",
                "estimated_revenue_simulated",
                "estimated_gross_margin_simulated",
            ],
            "recommendation_rule": (
                "Score each available discount scenario and choose the discount with "
                "the highest predicted gross margin."
            ),
            "split": {
                "method": "group holdout by batch_id",
                "test_fraction": TEST_SIZE,
                "train_rows": int(len(train_frame)),
                "test_rows": int(len(test_frame)),
            },
            "prototype_only": True,
            "limitation": (
                "Training targets are simulated scenarios and are not evidence of real "
                "customer price response or causal discount lift."
            ),
        },
    )


def train_all() -> list[dict[str, Any]]:
    trainers = [
        train_demand_forecast,
        train_expiry_risk,
        train_food_waste,
        train_discount_recommendation,
    ]
    reports = [trainer() for trainer in trainers]
    summary_path = ARTIFACTS_DIR / "training_summary.json"
    summary_path.write_text(
        json.dumps(
            {
                "trained_at_utc": datetime.now(timezone.utc).isoformat(),
                "models": [
                    {
                        "model": report["model"],
                        "artifact": report["artifact"],
                        "metrics": report["metrics"],
                        "prototype_only": report.get("prototype_only", False),
                    }
                    for report in reports
                ],
            },
            indent=2,
            allow_nan=False,
        )
        + "\n",
        encoding="utf-8",
    )
    return reports
