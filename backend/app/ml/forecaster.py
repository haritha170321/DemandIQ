from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple
import math

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error


@dataclass
class ForecastResult:
    product_id: int
    horizon_days: int
    model_name: str
    predicted_total_demand: float
    predicted_daily_demand: float
    trend_direction: str
    mae: Optional[float]
    rmse: Optional[float]
    data_points_used: int
    sufficient_data: bool
    supports_intervals: bool
    data_requirements: str
    explanation: str
    factors: List[str]
    model_comparisons: List[Dict[str, Any]]
    historical_series: List[Dict[str, Any]]
    forecast_series: List[Dict[str, Any]]
    validation_series: List[Dict[str, Any]]


def _build_daily_dataframe(daily_sales: List[Tuple[date, int]]) -> pd.DataFrame:
    if not daily_sales:
        return pd.DataFrame(columns=["date", "quantity"])

    df = pd.DataFrame(daily_sales, columns=["date", "quantity"])
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df = df.groupby("date", as_index=False)["quantity"].sum()

    end_date = max(df["date"].max(), pd.Timestamp.utcnow().normalize().tz_localize(None))
    start_date = df["date"].min()
    full_range = pd.date_range(start=start_date, end=end_date, freq="D")
    full_df = pd.DataFrame({"date": full_range}).merge(df, on="date", how="left")
    full_df["quantity"] = full_df["quantity"].fillna(0.0).astype(float)
    return full_df


def _engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    feat = df.copy()
    feat["t"] = np.arange(len(feat), dtype=float)
    feat["dow"] = feat["date"].dt.dayofweek.astype(float)
    feat["is_weekend"] = (feat["dow"] >= 5).astype(float)
    feat["dow_sin"] = np.sin(2 * np.pi * feat["dow"] / 7.0)
    feat["dow_cos"] = np.cos(2 * np.pi * feat["dow"] / 7.0)
    feat["lag_1"] = feat["quantity"].shift(1).bfill()
    feat["lag_7"] = feat["quantity"].shift(7).bfill()
    feat["roll_7"] = feat["quantity"].rolling(7, min_periods=1).mean().shift(1).bfill()
    feat["roll_14"] = feat["quantity"].rolling(14, min_periods=1).mean().shift(1).bfill()
    return feat


def _moving_average_predict(train_vals: np.ndarray, steps: int, window: int = 7) -> np.ndarray:
    w = min(window, len(train_vals))
    avg = float(np.mean(train_vals[-w:])) if w > 0 else 0.0
    return np.full(steps, max(0.0, avg), dtype=float)


def _exponential_smoothing_predict(train_vals: np.ndarray, steps: int, alpha: float = 0.35, beta: float = 0.12) -> np.ndarray:
    if len(train_vals) == 0:
        return np.zeros(steps, dtype=float)
    level = float(train_vals[0])
    trend = float(train_vals[1] - train_vals[0]) if len(train_vals) > 1 else 0.0
    for val in train_vals[1:]:
        prev_level = level
        level = alpha * float(val) + (1.0 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1.0 - beta) * trend
    preds = [max(0.0, level + (h + 1) * trend * 0.5) for h in range(steps)]
    return np.array(preds, dtype=float)


def _seasonal_naive_predict(train_vals: np.ndarray, steps: int, season_len: int = 7) -> np.ndarray:
    if len(train_vals) < season_len:
        return _moving_average_predict(train_vals, steps)
    last_season = train_vals[-season_len:]
    preds = [max(0.0, float(last_season[i % season_len])) for i in range(steps)]
    return np.array(preds, dtype=float)


def _recursive_tree_forecast(
    model: Any,
    history_df: pd.DataFrame,
    steps: int,
    feature_cols: List[str],
) -> Tuple[np.ndarray, Optional[np.ndarray]]:
    working_quantities = list(history_df["quantity"].values.astype(float))
    last_date = history_df["date"].iloc[-1]
    preds: List[float] = []
    stds: List[float] = []

    for h in range(1, steps + 1):
        next_date = last_date + pd.Timedelta(days=h)
        t_val = float(len(working_quantities))
        dow = float(next_date.dayofweek)
        is_weekend = 1.0 if dow >= 5 else 0.0
        dow_sin = math.sin(2 * math.pi * dow / 7.0)
        dow_cos = math.cos(2 * math.pi * dow / 7.0)
        lag_1 = working_quantities[-1]
        lag_7 = working_quantities[-7] if len(working_quantities) >= 7 else float(np.mean(working_quantities))
        roll_7 = float(np.mean(working_quantities[-7:]))
        roll_14 = float(np.mean(working_quantities[-14:]))

        row = pd.DataFrame(
            [{
                "t": t_val,
                "dow": dow,
                "is_weekend": is_weekend,
                "dow_sin": dow_sin,
                "dow_cos": dow_cos,
                "lag_1": lag_1,
                "lag_7": lag_7,
                "roll_7": roll_7,
                "roll_14": roll_14,
            }]
        )[feature_cols]

        pred = max(0.0, float(model.predict(row)[0]))
        preds.append(pred)
        working_quantities.append(pred)

        if hasattr(model, "estimators_") and isinstance(model, RandomForestRegressor):
            tree_preds = [max(0.0, float(est.predict(row.values)[0])) for est in model.estimators_]
            stds.append(float(np.std(tree_preds)))

    return np.array(preds, dtype=float), (np.array(stds, dtype=float) if stds else None)


def _classify_trend(series: np.ndarray) -> Tuple[str, float]:
    if len(series) < 14:
        if len(series) < 4:
            return "STABLE", 0.0
        half = len(series) // 2
        first_avg = float(np.mean(series[:half]))
        second_avg = float(np.mean(series[half:]))
    else:
        first_avg = float(np.mean(series[-28:-14])) if len(series) >= 28 else float(np.mean(series[:-7]))
        second_avg = float(np.mean(series[-14:])) if len(series) >= 28 else float(np.mean(series[-7:]))

    if first_avg <= 0.01:
        if second_avg > 0.25:
            return "INCREASING", 100.0
        return "STABLE", 0.0

    pct_change = ((second_avg - first_avg) / first_avg) * 100.0
    if pct_change >= 10.0:
        return "INCREASING", round(pct_change, 1)
    if pct_change <= -10.0:
        return "DECREASING", round(pct_change, 1)
    return "STABLE", round(pct_change, 1)


def generate_product_forecast(
    product_id: int,
    product_name: str,
    daily_sales: List[Tuple[date, int]],
    horizon_days: int = 30,
    model_preference: Optional[str] = None,
) -> ForecastResult:
    df = _build_daily_dataframe(daily_sales)
    data_points = len(df)
    today = date.today()

    # Edge case: No historical sales or fewer than 7 days
    if data_points == 0 or float(df["quantity"].sum()) == 0.0:
        forecast_series = [
            {
                "date": (today + timedelta(days=i)).isoformat(),
                "predicted": 0.0,
                "lower_bound": None,
                "upper_bound": None,
            }
            for i in range(1, horizon_days + 1)
        ]
        return ForecastResult(
            product_id=product_id,
            horizon_days=horizon_days,
            model_name="Zero-History Fallback (Baseline)",
            predicted_total_demand=0.0,
            predicted_daily_demand=0.0,
            trend_direction="STABLE",
            mae=None,
            rmse=None,
            data_points_used=data_points,
            sufficient_data=False,
            supports_intervals=False,
            data_requirements="Minimum 14 days of sales history required for accuracy evaluation and 30+ days for ML models.",
            explanation=(
                f"{product_name} currently has no recorded sales history. "
                "Zero demand is projected until initial sales transactions are logged."
            ),
            factors=["Insufficient historical sales volume (0 units sold)"],
            model_comparisons=[],
            historical_series=[],
            forecast_series=forecast_series,
            validation_series=[],
        )

    historical_series = [
        {"date": row["date"].date().isoformat(), "actual": round(float(row["quantity"]), 2)}
        for _, row in df.tail(90).iterrows()
    ]
    values = df["quantity"].values.astype(float)
    trend_dir, trend_pct = _classify_trend(values)

    # Insufficient data fallback (< 14 days)
    if data_points < 14:
        preds = _moving_average_predict(values, horizon_days, window=min(7, data_points))
        last_hist_date = df["date"].iloc[-1].date()
        forecast_series = [
            {
                "date": (last_hist_date + timedelta(days=i + 1)).isoformat(),
                "predicted": round(float(preds[i]), 2),
                "lower_bound": None,
                "upper_bound": None,
            }
            for i in range(horizon_days)
        ]
        avg_daily = float(np.mean(preds))
        return ForecastResult(
            product_id=product_id,
            horizon_days=horizon_days,
            model_name="Moving Average Fallback",
            predicted_total_demand=round(float(np.sum(preds)), 2),
            predicted_daily_demand=round(avg_daily, 2),
            trend_direction=trend_dir,
            mae=None,
            rmse=None,
            data_points_used=data_points,
            sufficient_data=False,
            supports_intervals=False,
            data_requirements="At least 14 days of history needed for holdout MAE/RMSE validation; 30+ days for tree-based ML.",
            explanation=(
                f"Only {data_points} days of sales history exist for {product_name}. "
                f"Using an explainable {min(7, data_points)}-day moving average ({avg_daily:.2f} units/day) until more sales accumulate."
            ),
            factors=[
                f"Limited history window ({data_points} days)",
                f"Recent average demand: {avg_daily:.2f} units/day",
            ],
            model_comparisons=[],
            historical_series=historical_series,
            forecast_series=forecast_series,
            validation_series=[],
        )

    # Holdout split for genuine MAE/RMSE evaluation
    test_size = min(14, max(5, data_points // 5))
    train_df = df.iloc[:-test_size].copy()
    test_df = df.iloc[-test_size:].copy()
    train_vals = train_df["quantity"].values.astype(float)
    test_vals = test_df["quantity"].values.astype(float)

    candidates: Dict[str, Dict[str, Any]] = {}

    # 1. Moving Average (7-day)
    ma_val_preds = _moving_average_predict(train_vals, test_size, window=7)
    candidates["Moving Average (7D)"] = {
        "mae": float(mean_absolute_error(test_vals, ma_val_preds)),
        "rmse": float(math.sqrt(mean_squared_error(test_vals, ma_val_preds))),
        "val_preds": ma_val_preds,
        "supports_intervals": True,
    }

    # 2. Holt Exponential Smoothing
    es_val_preds = _exponential_smoothing_predict(train_vals, test_size)
    candidates["Exponential Smoothing"] = {
        "mae": float(mean_absolute_error(test_vals, es_val_preds)),
        "rmse": float(math.sqrt(mean_squared_error(test_vals, es_val_preds))),
        "val_preds": es_val_preds,
        "supports_intervals": True,
    }

    # 3. Seasonal Naive (7-day weekly pattern)
    sn_val_preds = _seasonal_naive_predict(train_vals, test_size, season_len=7)
    candidates["Seasonal Naive (Weekly)"] = {
        "mae": float(mean_absolute_error(test_vals, sn_val_preds)),
        "rmse": float(math.sqrt(mean_squared_error(test_vals, sn_val_preds))),
        "val_preds": sn_val_preds,
        "supports_intervals": False,
    }

    feature_cols = ["t", "dow", "is_weekend", "dow_sin", "dow_cos", "lag_1", "lag_7", "roll_7", "roll_14"]
    if data_points >= 30:
        feat_df = _engineer_features(df)
        train_feat = feat_df.iloc[:-test_size]
        X_train = train_feat[feature_cols]
        y_train = train_feat["quantity"].values.astype(float)

        # 4. Random Forest Regressor
        rf = RandomForestRegressor(n_estimators=80, max_depth=6, random_state=42)
        rf.fit(X_train, y_train)
        rf_val_preds, _ = _recursive_tree_forecast(rf, train_df, test_size, feature_cols)
        candidates["Random Forest"] = {
            "mae": float(mean_absolute_error(test_vals, rf_val_preds)),
            "rmse": float(math.sqrt(mean_squared_error(test_vals, rf_val_preds))),
            "val_preds": rf_val_preds,
            "supports_intervals": True,
        }

        # 5. Gradient Boosting Regressor
        gb = GradientBoostingRegressor(n_estimators=80, max_depth=3, learning_rate=0.06, random_state=42)
        gb.fit(X_train, y_train)
        gb_val_preds, _ = _recursive_tree_forecast(gb, train_df, test_size, feature_cols)
        candidates["Gradient Boosting"] = {
            "mae": float(mean_absolute_error(test_vals, gb_val_preds)),
            "rmse": float(math.sqrt(mean_squared_error(test_vals, gb_val_preds))),
            "val_preds": gb_val_preds,
            "supports_intervals": False,
        }

    # Select best model (or honored user preference if valid)
    if model_preference and model_preference in candidates:
        selected_name = model_preference
    else:
        selected_name = min(candidates.keys(), key=lambda name: (candidates[name]["rmse"], candidates[name]["mae"]))

    best_eval = candidates[selected_name]
    best_mae = round(best_eval["mae"], 3)
    best_rmse = round(best_eval["rmse"], 3)
    supports_intervals = bool(best_eval["supports_intervals"])

    validation_series = [
        {
            "date": test_df["date"].iloc[i].date().isoformat(),
            "actual": round(float(test_vals[i]), 2),
            "predicted": round(float(best_eval["val_preds"][i]), 2),
        }
        for i in range(test_size)
    ]

    # Refit selected model on full history to project horizon
    pred_stds: Optional[np.ndarray] = None
    if selected_name == "Moving Average (7D)":
        future_preds = _moving_average_predict(values, horizon_days, window=7)
        residual_std = float(np.std(test_vals - best_eval["val_preds"]))
        pred_stds = np.array([residual_std * math.sqrt(1 + i * 0.05) for i in range(horizon_days)])
    elif selected_name == "Exponential Smoothing":
        future_preds = _exponential_smoothing_predict(values, horizon_days)
        residual_std = float(np.std(test_vals - best_eval["val_preds"]))
        pred_stds = np.array([residual_std * math.sqrt(1 + i * 0.07) for i in range(horizon_days)])
    elif selected_name == "Seasonal Naive (Weekly)":
        future_preds = _seasonal_naive_predict(values, horizon_days, season_len=7)
    elif selected_name == "Random Forest":
        full_feat = _engineer_features(df)
        rf_full = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)
        rf_full.fit(full_feat[feature_cols], full_feat["quantity"].values.astype(float))
        future_preds, pred_stds = _recursive_tree_forecast(rf_full, df, horizon_days, feature_cols)
    else:
        full_feat = _engineer_features(df)
        gb_full = GradientBoostingRegressor(n_estimators=100, max_depth=3, learning_rate=0.06, random_state=42)
        gb_full.fit(full_feat[feature_cols], full_feat["quantity"].values.astype(float))
        future_preds, _ = _recursive_tree_forecast(gb_full, df, horizon_days, feature_cols)

    last_hist_date = df["date"].iloc[-1].date()
    forecast_series = []
    for i in range(horizon_days):
        val = float(future_preds[i])
        lower = None
        upper = None
        if supports_intervals and pred_stds is not None:
            margin = 1.645 * float(pred_stds[i])
            lower = round(max(0.0, val - margin), 2)
            upper = round(val + margin, 2)
        forecast_series.append(
            {
                "date": (last_hist_date + timedelta(days=i + 1)).isoformat(),
                "predicted": round(val, 2),
                "lower_bound": lower,
                "upper_bound": upper,
            }
        )

    predicted_total = round(float(np.sum(future_preds)), 2)
    predicted_daily = round(float(np.mean(future_preds)), 2)

    # Analyze weekly seasonality for explainability
    df_dow = df.copy()
    df_dow["dow"] = df_dow["date"].dt.dayofweek
    weekend_avg = float(df_dow[df_dow["dow"] >= 5]["quantity"].mean() or 0.0)
    weekday_avg = float(df_dow[df_dow["dow"] < 5]["quantity"].mean() or 0.0)

    factors = [
        f"Recent 14-day demand trajectory: {trend_dir.title()} ({trend_pct:+.1f}% vs prior period)",
        f"30-day historical daily average: {float(np.mean(values[-30:])):.2f} units/day",
    ]
    if weekday_avg > 0 and abs(weekend_avg - weekday_avg) / weekday_avg > 0.12:
        direction = "higher" if weekend_avg > weekday_avg else "lower"
        factors.append(f"Weekly seasonality: Weekend volume is {abs((weekend_avg - weekday_avg) / weekday_avg) * 100:.0f}% {direction} than weekdays")
    if data_points >= 60:
        factors.append(f"Evaluated across {data_points} historical days with {test_size}-day out-of-sample backtest")

    explanation = (
        f"{selected_name} achieved the lowest holdout error (MAE {best_mae:.2f}, RMSE {best_rmse:.2f}) "
        f"on {product_name} across {data_points} days of sales data. Demand is {trend_dir.lower()} "
        f"({trend_pct:+.1f}%), projecting {predicted_total:.0f} total units ({predicted_daily:.2f}/day) over the next {horizon_days} days."
    )

    comparisons = [
        {
            "model_name": name,
            "mae": round(metrics["mae"], 3),
            "rmse": round(metrics["rmse"], 3),
            "selected": name == selected_name,
        }
        for name, metrics in sorted(candidates.items(), key=lambda kv: kv[1]["rmse"])
    ]

    return ForecastResult(
        product_id=product_id,
        horizon_days=horizon_days,
        model_name=selected_name,
        predicted_total_demand=predicted_total,
        predicted_daily_demand=predicted_daily,
        trend_direction=trend_dir,
        mae=best_mae,
        rmse=best_rmse,
        data_points_used=data_points,
        sufficient_data=True,
        supports_intervals=supports_intervals,
        data_requirements=f"Validated on {data_points} days ({test_size}-day holdout split).",
        explanation=explanation,
        factors=factors,
        model_comparisons=comparisons,
        historical_series=historical_series,
        forecast_series=forecast_series,
        validation_series=validation_series,
    )
