# ML model training

Create an isolated environment, install dependencies, and train all four
models from the project root with:

```powershell
uv venv ml\.venv
uv pip install --python ml\.venv\Scripts\python.exe -r ml\requirements.txt
ml\.venv\Scripts\python.exe ml\src\train_all.py
```

The command writes `joblib` models and per-model JSON evaluation reports to
`ml\artifacts\`. It also writes a `training_summary.json` containing the
measured holdout scores.

## Data and validation

- **Demand forecast** uses the observed `units_sold` history in
  `perishable_inventory - perishable_inventory.csv`. It adds date-derived
  calendar fields, prior sales lags and a prior-seven-day mean, unit price,
  and discount/promotion features. The last 20% of dates are held out
  chronologically. Evaluation is one-step-ahead walk-forward: actual sales
  from earlier days can be used as lag inputs for a later day. Price and
  discount are assumed to be known/planned before the forecast day. The
  supplied `calendar.csv` covers 2011-2016, while this sales history is from
  2026, so calendar fields are derived from the sales dates instead of
  joining non-overlapping event records.
- **Expiry risk** uses `inventory_batches - inventory_batches.csv` and
  explicitly excludes the target `expiry_risk_label`, batch ID, and simulated
  realized waste from the features. The holdout is the latest 20% of
  `snapshot_date` values.
- **Food waste** uses `perishable_inventory - perishable_inventory.csv` and
  predicts `waste_units`. Same-day sales, temperature, stockout, and waste
  outcomes are excluded from inputs. Features are limited to date/calendar,
  opening inventory, planned price/discount, expiry time, and lagged sales
  observed before each prediction date. The latest 20% of dates are held out
  for one-step-ahead walk-forward evaluation.
- **Discount recommendation** fits simulated gross margin from
  `discount_scenarios_simulated - discount_scenarios_simulated.csv`, joined
  with product prices/costs. All scenarios for a batch stay together in the
  holdout split. The recommender chooses the candidate discount with the
  greatest predicted margin. This is a prototype on simulated data, not
  evidence of real customer price response or causal discount lift.

Metrics in the JSON reports are holdout results, not guaranteed production
accuracy. Regression reports include MAE, RMSE, R-squared, and WAPE;
expiry-risk reports include accuracy, balanced accuracy, precision, recall,
F1, and ROC AUC when both classes are present. The discount report also
includes realized simulated margin, oracle margin, regret, and discount-choice
accuracy for held-out batches.
