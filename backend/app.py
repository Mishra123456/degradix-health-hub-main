# from fastapi import FastAPI, UploadFile, File
# from fastapi.middleware.cors import CORSMiddleware
# import pandas as pd
# import numpy as np

# # ML
# from sklearn.preprocessing import MinMaxScaler
# from sklearn.ensemble import RandomForestRegressor
# from sklearn.cluster import KMeans

# from tensorflow.keras.models import Sequential
# from tensorflow.keras.layers import LSTM, Dense

# # --------------------------------------------------
# # APP INIT
# # --------------------------------------------------
# app = FastAPI(
#     title="DEGRADIX – ML-Based Machine Health API",
#     version="2.0.0"
# )

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # --------------------------------------------------
# # GLOBAL MODELS (TRAIN ON UPLOAD)
# # --------------------------------------------------
# rf_model = RandomForestRegressor(
#     n_estimators=200,
#     random_state=42
# )

# lstm_model = Sequential([
#     LSTM(64, input_shape=(20, 1)),
#     Dense(1)
# ])
# lstm_model.compile(optimizer="adam", loss="mse")

# rf_trained = False
# scaler = MinMaxScaler()

# # --------------------------------------------------
# # UTILITIES
# # --------------------------------------------------
# def load_csv(file: UploadFile) -> pd.DataFrame:
#     df = pd.read_csv(file.file)

#     if not {"engine_id", "cycle"}.issubset(df.columns):
#         raise ValueError("CSV must contain engine_id and cycle columns")

#     return df


# def get_sensor_columns(df: pd.DataFrame):
#     sensors = [c for c in df.columns if c.startswith("sensor")]
#     if not sensors:
#         raise ValueError("No sensor_* columns found")
#     return sensors


# # --------------------------------------------------
# # RF + LSTM HEALTH COMPUTATION
# # --------------------------------------------------
# def compute_health_ml(df: pd.DataFrame) -> pd.DataFrame:
#     global rf_trained

#     sensor_cols = get_sensor_columns(df)
#     X = df[sensor_cols].values

#     # Scale sensors
#     X_scaled = scaler.fit_transform(X)

#     # ---- RANDOM FOREST (instant health) ----
#     if not rf_trained:
#         # pseudo-label: monotonic degradation
#         y = np.linspace(1, 0, len(X_scaled))
#         rf_model.fit(X_scaled, y)
#         rf_trained = True

#     health_rf = rf_model.predict(X_scaled)

#     # ---- LSTM (temporal health) ----
#     seq_len = 20
#     sequences, targets = [], []

#     for i in range(len(health_rf) - seq_len):
#         sequences.append(health_rf[i:i + seq_len])
#         targets.append(health_rf[i + seq_len])

#     sequences = np.array(sequences).reshape(-1, seq_len, 1)
#     targets = np.array(targets)

#     if len(sequences) > 0:
#         lstm_model.fit(sequences, targets, epochs=10, batch_size=32, verbose=0)
#         lstm_pred = lstm_model.predict(sequences).flatten()
#         lstm_pred = np.pad(
#             lstm_pred,
#             (len(health_rf) - len(lstm_pred), 0),
#             constant_values=lstm_pred[0]
#         )
#     else:
#         lstm_pred = health_rf

#     # ---- FINAL HEALTH (HYBRID) ----
#     df["health"] = 0.6 * health_rf + 0.4 * lstm_pred
#     df["health"] = np.clip(df["health"], 0, 1)

#     return df


# # --------------------------------------------------
# # DSI
# # --------------------------------------------------
# def compute_dsi(df: pd.DataFrame) -> pd.DataFrame:
#     df = df.sort_values(["engine_id", "cycle"])
#     df["DSI"] = -df.groupby("engine_id")["health"].diff()
#     df["DSI"] = df["DSI"].fillna(0)
#     return df


# # --------------------------------------------------
# # RELIABILITY
# # --------------------------------------------------
# def compute_reliability(df: pd.DataFrame, lam=2.0) -> pd.DataFrame:
#     df["reliability"] = np.exp(-lam * (1 - df["health"]))
#     return df


# # --------------------------------------------------
# # CLUSTERING
# # --------------------------------------------------
# def cluster_engines(df: pd.DataFrame) -> pd.DataFrame:
#     features = df.groupby("engine_id").agg(
#         avg_health=("health", "mean"),
#         min_health=("health", "min"),
#         degradation_span=("health", lambda x: x.iloc[0] - x.iloc[-1]),
#         cycles=("cycle", "max"),
#     )

#     n_clusters = min(3, len(features))
#     kmeans = KMeans(n_clusters=n_clusters, random_state=42)
#     features["cluster"] = kmeans.fit_predict(features)

#     return features.reset_index()


# # --------------------------------------------------
# # API ENDPOINTS
# # --------------------------------------------------
# @app.post("/analyze")
# async def analyze(file: UploadFile = File(...)):
#     df = load_csv(file)
#     df = compute_health_ml(df)
#     df = compute_dsi(df)
#     clusters = cluster_engines(df)

#     return {
#         "health": df[["engine_id", "cycle", "health"]].to_dict("records"),
#         "dsi": df[["engine_id", "cycle", "DSI"]].to_dict("records"),
#         "clusters": clusters.to_dict("records"),
#     }


# @app.post("/health")
# async def health(file: UploadFile = File(...)):
#     df = load_csv(file)
#     df = compute_health_ml(df)
#     return df[["engine_id", "cycle", "health"]].to_dict("records")


# @app.post("/dsi")
# async def dsi(file: UploadFile = File(...)):
#     df = load_csv(file)
#     df = compute_health_ml(df)
#     df = compute_dsi(df)
#     return df[["engine_id", "cycle", "DSI"]].to_dict("records")


# @app.post("/reliability")
# async def reliability(file: UploadFile = File(...)):
#     df = load_csv(file)
#     df = compute_health_ml(df)
#     df = compute_reliability(df)
#     return df[["engine_id", "cycle", "reliability"]].to_dict("records")


# @app.post("/clusters")
# async def clusters(file: UploadFile = File(...)):
#     df = load_csv(file)
#     df = compute_health_ml(df)
#     clusters = cluster_engines(df)
#     return clusters.to_dict("records")


# @app.post("/insights")
# async def insights(file: UploadFile = File(...)):
#     df = load_csv(file)
#     df = compute_health_ml(df)
#     clusters = cluster_engines(df)

#     worst = clusters.sort_values("min_health").iloc[0]

#     return {
#         "summary": "Hybrid RF + LSTM degradation analysis completed.",
#         "worst_engine": int(worst["engine_id"]),
#         "lowest_health": round(float(worst["min_health"]), 3),
#         "cluster": int(worst["cluster"]),
#     }

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import joblib
from pathlib import Path

from sklearn.cluster import KMeans
from tensorflow.keras.models import load_model

# --------------------------------------------------
# PATHS
# --------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "ml"

RF_PATH = MODEL_DIR / "rf_model.joblib"
SCALER_PATH = MODEL_DIR / "scaler.joblib"
LSTM_PATH = MODEL_DIR / "lstm_model.keras"

SEQ_LEN = 20

# --------------------------------------------------
# APP INIT
# --------------------------------------------------
app = FastAPI(
    title="DEGRADIX – Predictive Machine Health API",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# LOAD MODELS (ONCE AT STARTUP)
# --------------------------------------------------
rf_model = joblib.load(RF_PATH)
scaler = joblib.load(SCALER_PATH)
lstm_model = load_model(LSTM_PATH)

# --------------------------------------------------
# UTILITIES
# --------------------------------------------------
def load_csv(file: UploadFile) -> pd.DataFrame:
    df = pd.read_csv(file.file)
    if not {"engine_id", "cycle"}.issubset(df.columns):
        raise ValueError("CSV must contain engine_id and cycle columns")
    return df


def sensor_columns(df: pd.DataFrame):
    cols = [c for c in df.columns if c.startswith("sensor")]
    if not cols:
        raise ValueError("sensor_* columns required")
    return cols


# --------------------------------------------------
# HEALTH PREDICTION (RF + LSTM)
# --------------------------------------------------
def compute_health(df: pd.DataFrame) -> pd.DataFrame:
    sensors = sensor_columns(df)

    # Scale sensors (same scaler as training)
    X = scaler.transform(df[sensors].values)

    # --- RF: instant health ---
    health_rf = rf_model.predict(X)

    # --- LSTM: temporal smoothing ---
    lstm_pred = np.zeros_like(health_rf)

    if len(health_rf) >= SEQ_LEN:
        sequences = [
            health_rf[i:i + SEQ_LEN]
            for i in range(len(health_rf) - SEQ_LEN)
        ]
        sequences = np.array(sequences).reshape(-1, SEQ_LEN, 1)

        preds = lstm_model.predict(sequences, verbose=0).flatten()

        lstm_pred[SEQ_LEN:] = preds
        lstm_pred[:SEQ_LEN] = preds[0]
    else:
        lstm_pred = health_rf

    # --- Hybrid ---
    df["health"] = np.clip(
        0.6 * health_rf + 0.4 * lstm_pred,
        0, 1
    )

    return df


# --------------------------------------------------
# DSI
# --------------------------------------------------
def compute_dsi(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["engine_id", "cycle"])
    df["DSI"] = -df.groupby("engine_id")["health"].diff().fillna(0)
    return df


# --------------------------------------------------
# RELIABILITY
# --------------------------------------------------
def compute_reliability(df: pd.DataFrame, lam=2.0) -> pd.DataFrame:
    df["reliability"] = np.exp(-lam * (1 - df["health"]))
    return df


# --------------------------------------------------
# CLUSTERING
# --------------------------------------------------
def cluster_engines(df: pd.DataFrame) -> pd.DataFrame:
    features = df.groupby("engine_id").agg(
        avg_health=("health", "mean"),
        min_health=("health", "min"),
        degradation_span=("health", lambda x: x.iloc[0] - x.iloc[-1]),
        cycles=("cycle", "max"),
    )

    kmeans = KMeans(
        n_clusters=min(3, len(features)),
        random_state=42
    )
    features["cluster"] = kmeans.fit_predict(features)

    return features.reset_index()


# --------------------------------------------------
# API ENDPOINTS
# --------------------------------------------------
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    df = load_csv(file)
    df = compute_health(df)
    df = compute_dsi(df)
    clusters = cluster_engines(df)

    return {
        "health": df[["engine_id", "cycle", "health"]].to_dict("records"),
        "dsi": df[["engine_id", "cycle", "DSI"]].to_dict("records"),
        "clusters": clusters.to_dict("records"),
    }


@app.post("/health")
async def health(file: UploadFile = File(...)):
    df = compute_health(load_csv(file))
    return df[["engine_id", "cycle", "health"]].to_dict("records")


@app.post("/dsi")
async def dsi(file: UploadFile = File(...)):
    df = compute_dsi(compute_health(load_csv(file)))
    return df[["engine_id", "cycle", "DSI"]].to_dict("records")


@app.post("/reliability")
async def reliability(file: UploadFile = File(...)):
    df = compute_reliability(compute_health(load_csv(file)))
    return df[["engine_id", "cycle", "reliability"]].to_dict("records")


@app.post("/clusters")
async def clusters(file: UploadFile = File(...)):
    df = compute_health(load_csv(file))
    return cluster_engines(df).to_dict("records")

