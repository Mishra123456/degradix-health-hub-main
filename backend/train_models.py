import os
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint

from ml.preprocessing import load_cmapss_data, generate_rul_and_health, generate_lstm_sequences

def main():
    print("Starting DEGRADIX Model Training Pipeline...")
    
    # 1. Config
    BASE_DIR = Path(__file__).resolve().parent
    DATA_PATH = BASE_DIR / "data" / "train_FD001.txt"
    MODEL_DIR = BASE_DIR / "ml"
    MODEL_DIR.mkdir(exist_ok=True)
    
    SEQ_LEN = 20
    
    # Check if data exists
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"NASA C-MAPSS training data not found at {DATA_PATH}")
        
    # 2. Preprocess Data
    print("Loading and preprocessing data...")
    df = load_cmapss_data(str(DATA_PATH))
    df = generate_rul_and_health(df)
    
    sensor_cols = [c for c in df.columns if c.startswith("sensor")]
    print(f"Number of sensor columns: {len(sensor_cols)}")
    
    # 3. Train/Test Split on Engine IDs (to prevent cycle-level data leakage)
    engine_ids = df["engine_id"].unique()
    np.random.seed(42)
    np.random.shuffle(engine_ids)
    
    split_idx = int(len(engine_ids) * 0.8)
    train_engines = engine_ids[:split_idx]
    test_engines = engine_ids[split_idx:]
    
    train_df = df[df["engine_id"].isin(train_engines)].copy()
    test_df = df[df["engine_id"].isin(test_engines)].copy()
    
    print(f"Training on {len(train_engines)} engines, evaluating on {len(test_engines)} engines...")
    
    # 4. Scale Sensors
    scaler = MinMaxScaler()
    X_train = scaler.fit_transform(train_df[sensor_cols].values)
    X_test = scaler.transform(test_df[sensor_cols].values)
    
    # Store scaled values in dataframes for LSTM sequence generation
    train_df[sensor_cols] = X_train
    test_df[sensor_cols] = X_test
    
    # 5. Train & Evaluate RandomForest Health Model
    print("Training RandomForest Health Model...")
    rf_health = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    rf_health.fit(X_train, train_df["health"].values)
    
    health_pred = rf_health.predict(X_test)
    health_true = test_df["health"].values
    
    metrics_rf_health = {
        "mae": float(mean_absolute_error(health_true, health_pred)),
        "rmse": float(np.sqrt(mean_squared_error(health_true, health_pred))),
        "r2": float(r2_score(health_true, health_pred))
    }
    
    # 6. Train & Evaluate RandomForest RUL Model
    print("Training RandomForest RUL Model...")
    rf_rul = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    rf_rul.fit(X_train, train_df["RUL"].values)
    
    rul_pred_rf = rf_rul.predict(X_test)
    rul_true_rf = test_df["RUL"].values
    
    metrics_rf_rul = {
        "mae": float(mean_absolute_error(rul_true_rf, rul_pred_rf)),
        "rmse": float(np.sqrt(mean_squared_error(rul_true_rf, rul_pred_rf))),
        "r2": float(r2_score(rul_true_rf, rul_pred_rf))
    }
    
    # 7. Generate Sequences for LSTM
    print("Preparing sequences for LSTM...")
    X_seq_train, y_seq_train = generate_lstm_sequences(train_df, sensor_cols, SEQ_LEN)
    X_seq_test, y_seq_test = generate_lstm_sequences(test_df, sensor_cols, SEQ_LEN)
    
    # 8. Train & Evaluate LSTM RUL Model
    print("Training LSTM RUL Model (CPU optimized)...")
    lstm_model = Sequential([
        LSTM(128, return_sequences=True, input_shape=(SEQ_LEN, len(sensor_cols))),
        LSTM(64),
        Dense(32, activation="relu"),
        Dense(1)
    ])
    
    lstm_model.compile(optimizer="adam", loss="mse", metrics=["mae"])
    
    # Callbacks
    early_stop = EarlyStopping(
        monitor="val_loss",
        patience=5,
        restore_best_weights=True,
        verbose=1
    )
    checkpoint = ModelCheckpoint(
        filepath=str(MODEL_DIR / "lstm_rul.keras"),
        monitor="val_loss",
        save_best_only=True,
        verbose=0
    )
    
    lstm_model.fit(
        X_seq_train, y_seq_train,
        validation_split=0.15,
        epochs=15,
        batch_size=64,
        callbacks=[early_stop, checkpoint],
        verbose=1
    )
    
    # Load best model for evaluation
    try:
        from tensorflow.keras.models import load_model
        best_lstm = load_model(str(MODEL_DIR / "lstm_rul.keras"))
    except Exception:
        best_lstm = lstm_model
        
    rul_pred_lstm = best_lstm.predict(X_seq_test).flatten()
    
    metrics_lstm_rul = {
        "mae": float(mean_absolute_error(y_seq_test, rul_pred_lstm)),
        "rmse": float(np.sqrt(mean_squared_error(y_seq_test, rul_pred_lstm))),
        "r2": float(r2_score(y_seq_test, rul_pred_lstm))
    }
    
    # 9. Retrain final models on FULL dataset to maximize performance
    print("Retraining final Random Forest models on full dataset...")
    X_full = scaler.fit_transform(df[sensor_cols].values)
    
    final_rf_health = RandomForestRegressor(n_estimators=150, random_state=42, n_jobs=-1)
    final_rf_health.fit(X_full, df["health"].values)
    
    final_rf_rul = RandomForestRegressor(n_estimators=150, random_state=42, n_jobs=-1)
    final_rf_rul.fit(X_full, df["RUL"].values)
    
    # 10. Save Models
    print("Saving serialization artifacts...")
    joblib.dump(final_rf_health, MODEL_DIR / "rf_health.joblib")
    joblib.dump(final_rf_rul, MODEL_DIR / "rf_rul.joblib")
    joblib.dump(scaler, MODEL_DIR / "scaler.joblib")
    
    # (LSTM is already saved in MODEL_DIR / "lstm_rul.keras" via ModelCheckpoint during final split)
    
    # 11. Compile & Save Metrics JSON
    metrics = {
        "rf_health": metrics_rf_health,
        "rf_rul": metrics_rf_rul,
        "lstm_rul": metrics_lstm_rul
    }
    
    with open(MODEL_DIR / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=4)
        
    print("\n" + "="*40)
    print("TRAINING & EVALUATION COMPLETE")
    print("="*40)
    print(f"RF Health Model: MAE={metrics_rf_health['mae']:.4f}, RMSE={metrics_rf_health['rmse']:.4f}, R2={metrics_rf_health['r2']:.4f}")
    print(f"RF RUL Model:    MAE={metrics_rf_rul['mae']:.2f}, RMSE={metrics_rf_rul['rmse']:.2f}, R2={metrics_rf_rul['r2']:.2f}")
    print(f"LSTM RUL Model:  MAE={metrics_lstm_rul['mae']:.2f}, RMSE={metrics_lstm_rul['rmse']:.2f}, R2={metrics_lstm_rul['r2']:.2f}")
    print("="*40)
    print(f"Artifacts saved successfully in {MODEL_DIR}")

if __name__ == "__main__":
    main()
